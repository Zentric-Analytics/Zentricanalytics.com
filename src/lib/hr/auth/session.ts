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
  (await cookies()).set(HR_SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: ttl, path: "/hr" });
}

export async function revokeCurrentHrSession() {
  const jar = await cookies();
  const token = jar.get(HR_SESSION_COOKIE)?.value;
  if (token) await prisma.hrSession.updateMany({ where: { tokenHash: hashOpaqueToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
  jar.set(HR_SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0, path: "/hr" });
}

export async function revokeAllHrSessions(userId: string) {
  await prisma.hrSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
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
