import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createOpaqueToken, hashOpaqueToken } from "./crypto";

export const HR_SESSION_COOKIE = "za_hr_session";
const DEFAULT_TTL_SECONDS = 60 * 60 * 8;

function sessionTtlSeconds() {
  const configured = Number(process.env.AUTH_SESSION_TTL);
  return Number.isSafeInteger(configured) && configured >= 900 ? configured : DEFAULT_TTL_SECONDS;
}

export async function createHrSession(userId: string, context?: { ipHash?: string; userAgent?: string }) {
  const token = createOpaqueToken();
  const ttl = sessionTtlSeconds();
  await prisma.hrSession.create({ data: { userId, tokenHash: hashOpaqueToken(token), expiresAt: new Date(Date.now() + ttl * 1000), ...context } });
  const jar = await cookies();
  jar.set(HR_SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0, path: "/hr" });
  jar.set(HR_SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: ttl, path: "/" });
}

export async function revokeCurrentHrSession() {
  const jar = await cookies();
  const token = jar.get(HR_SESSION_COOKIE)?.value;
  if (token) await prisma.hrSession.updateMany({ where: { tokenHash: hashOpaqueToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
  jar.set(HR_SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0, path: "/" });
  jar.set(HR_SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0, path: "/hr" });
}

export async function revokeAllHrSessions(userId: string) {
  await prisma.hrSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function rotateCurrentHrSession(context?: { ipHash?: string; userAgent?: string }) {
  const jar = await cookies();
  const currentToken = jar.get(HR_SESSION_COOKIE)?.value;
  if (!currentToken) return false;
  const token = createOpaqueToken();
  const now = new Date();
  const rotated = await prisma.$transaction(async (tx) => {
    const current = await tx.hrSession.findUnique({ where: { tokenHash: hashOpaqueToken(currentToken) }, include: { user: true } });
    if (!current || current.revokedAt || current.expiresAt <= now || current.user.status !== "ACTIVE") return null;
    const revoked = await tx.hrSession.updateMany({ where: { id: current.id, revokedAt: null }, data: { revokedAt: now } });
    if (!revoked.count) return null;
    await tx.hrSession.create({ data: { userId: current.userId, tokenHash: hashOpaqueToken(token), expiresAt: current.expiresAt, ...context } });
    return current.expiresAt;
  });
  if (!rotated) return false;
  jar.set(HR_SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: Math.max(1, Math.floor((rotated.getTime() - now.getTime()) / 1000)), path: "/" });
  return true;
}

export async function getAuthenticatedHrUser() {
  const token = (await cookies()).get(HR_SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.hrSession.findUnique({
    where: { tokenHash: hashOpaqueToken(token) },
    include: { user: { include: { employee: true, roles: { where: { revokedAt: null }, include: { role: { include: { permissions: { include: { permission: true } } } } } } } } },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") return null;
  return { sessionId: session.id, user: session.user, roles: session.user.roles.map(({ role }) => role.key), permissions: new Set(session.user.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.key))) };
}
