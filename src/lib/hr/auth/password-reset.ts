import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { createOpaqueToken, hashHrPassword, hashOpaqueToken, hashPasswordResetCode, normalizeHrEmail, passwordMeetsPolicy, sealHrCredential } from "./crypto";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { tokenCanBeConsumed } from "./tokens";

export const RESET_OTP_TTL_SECONDS = 600;
export const RESET_RESEND_COOLDOWN_SECONDS = 60;
export const RESET_ATTEMPT_LIMIT = 5;
export const RESET_SESSION_TTL_SECONDS = 600;

export class PasswordResetError extends Error {
  constructor(public code: "invalid" | "expired" | "attempts" | "cooldown" | "session" | "policy") { super(code); }
}

export async function requestPasswordReset(organizationId: string, emailInput: string, now = new Date()) {
  const email = normalizeHrEmail(emailInput);
  const user = await prisma.hrUser.findUnique({ where: { organizationId_email: { organizationId, email } }, include: { employee: true } });
  if (!user || user.status !== "ACTIVE") return { challengeId: createOpaqueToken(), issued: false };
  const code = crypto.randomInt(100000, 1000000).toString();
  const challenge = await prisma.$transaction(async (tx) => {
    await tx.hrPasswordResetChallenge.updateMany({ where: { userId: user.id, status: "ACTIVE" }, data: { status: "REVOKED" } });
    const created = await tx.hrPasswordResetChallenge.create({ data: { userId: user.id, codeHash: hashPasswordResetCode(user.id, code), expiresAt: new Date(now.getTime() + RESET_OTP_TTL_SECONDS * 1000), createdAt: now } });
    const recipientName = user.employee ? `${user.employee.preferredName ?? user.employee.legalFirstName} ${user.employee.lastName}` : undefined;
    await enqueueHrEmail(tx, { organizationId, recipient: user.email, template: "hr-password-reset", subject: "Your Zentric HR password reset code", payload: { credentialEnvelope: sealHrCredential(code), recipientName }, idempotencyKey: `hr-password-reset:${created.id}` });
    await appendHrAudit(tx, { organizationId, actorUserId: user.id, entityType: "HrUser", entityId: user.id, action: "hr.password.reset_requested" });
    return created;
  });
  return { challengeId: challenge.id, issued: true };
}

export async function resendPasswordReset(challengeId: string, now = new Date()) {
  const challenge = await prisma.hrPasswordResetChallenge.findUnique({ where: { id: challengeId }, include: { user: true } });
  if (!challenge || challenge.user.status !== "ACTIVE") return { challengeId: createOpaqueToken(), issued: false };
  if (now.getTime() - challenge.createdAt.getTime() < RESET_RESEND_COOLDOWN_SECONDS * 1000) throw new PasswordResetError("cooldown");
  return requestPasswordReset(challenge.user.organizationId, challenge.user.email, now);
}

export async function verifyPasswordResetCode(challengeId: string, code: string, now = new Date()) {
  if (!/^\d{6}$/.test(code)) throw new PasswordResetError("invalid");
  const challenge = await prisma.hrPasswordResetChallenge.findUnique({ where: { id: challengeId }, include: { user: true } });
  if (!challenge || challenge.status !== "ACTIVE" || challenge.usedAt) throw new PasswordResetError("invalid");
  if (challenge.expiresAt <= now) { await prisma.hrPasswordResetChallenge.updateMany({ where: { id: challenge.id, status: "ACTIVE" }, data: { status: "REVOKED" } }); throw new PasswordResetError("expired"); }
  if (challenge.attemptCount >= RESET_ATTEMPT_LIMIT) throw new PasswordResetError("attempts");
  const matches = crypto.timingSafeEqual(Buffer.from(challenge.codeHash, "hex"), Buffer.from(hashPasswordResetCode(challenge.userId, code), "hex"));
  if (!matches) {
    const attempts = challenge.attemptCount + 1;
    await prisma.hrPasswordResetChallenge.updateMany({ where: { id: challenge.id, status: "ACTIVE", attemptCount: challenge.attemptCount }, data: { attemptCount: attempts, status: attempts >= RESET_ATTEMPT_LIMIT ? "REVOKED" : "ACTIVE" } });
    throw new PasswordResetError(attempts >= RESET_ATTEMPT_LIMIT ? "attempts" : "invalid");
  }
  const rawToken = createOpaqueToken();
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.hrPasswordResetChallenge.updateMany({ where: { id: challenge.id, status: "ACTIVE", usedAt: null }, data: { status: "USED", verifiedAt: now, usedAt: now } });
    if (!consumed.count) throw new PasswordResetError("invalid");
    await tx.hrPasswordResetToken.updateMany({ where: { userId: challenge.userId, status: "ACTIVE" }, data: { status: "REVOKED" } });
    await tx.hrPasswordResetToken.create({ data: { userId: challenge.userId, tokenHash: hashOpaqueToken(rawToken), expiresAt: new Date(now.getTime() + RESET_SESSION_TTL_SECONDS * 1000) } });
  });
  return rawToken;
}

export async function consumePasswordReset(rawToken: string, password: string, confirmation: string, now = new Date()) {
  if (password !== confirmation) throw new PasswordResetError("policy");
  if (!passwordMeetsPolicy(password)) throw new PasswordResetError("policy");
  const reset = await prisma.hrPasswordResetToken.findUnique({ where: { tokenHash: hashOpaqueToken(rawToken) }, include: { user: true } });
  if (!tokenCanBeConsumed(reset, now) || reset!.user.status !== "ACTIVE") throw new PasswordResetError("session");
  const passwordHash = await hashHrPassword(password);
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.hrPasswordResetToken.updateMany({ where: { id: reset!.id, status: "ACTIVE", usedAt: null, expiresAt: { gt: now } }, data: { status: "USED", usedAt: now } });
    if (!consumed.count) throw new PasswordResetError("session");
    await tx.hrUser.update({ where: { id: reset!.userId }, data: { passwordHash } });
    await tx.hrSession.updateMany({ where: { userId: reset!.userId, revokedAt: null }, data: { revokedAt: now } });
    await tx.hrPasswordResetChallenge.updateMany({ where: { userId: reset!.userId, status: "ACTIVE" }, data: { status: "REVOKED" } });
    await appendHrAudit(tx, { organizationId: reset!.user.organizationId, actorUserId: reset!.userId, entityType: "HrUser", entityId: reset!.userId, action: "hr.password.reset" });
    await enqueueHrEmail(tx, { organizationId: reset!.user.organizationId, recipient: reset!.user.email, template: "hr-password-reset-complete", subject: "Your Zentric HR password was changed", payload: { href: "/hr/login" }, idempotencyKey: `hr-password-reset-complete:${reset!.id}` });
  });
}
