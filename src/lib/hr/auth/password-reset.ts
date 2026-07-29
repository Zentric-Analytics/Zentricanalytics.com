import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { createOpaqueToken, hashHrPassword, hashOpaqueToken, normalizeHrEmail, passwordMeetsPolicy, sealHrCredential } from "./crypto";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { revokeAllHrSessions } from "./session";
import { tokenCanBeConsumed } from "./tokens";

export async function requestPasswordReset(organizationId: string, emailInput: string) {
  const email = normalizeHrEmail(emailInput);
  const user = await prisma.hrUser.findUnique({ where: { organizationId_email: { organizationId, email } } });
  if (!user || user.status !== "ACTIVE") return;
  const rawToken = createOpaqueToken();
  await prisma.$transaction(async (tx) => {
    await tx.hrPasswordResetToken.updateMany({ where: { userId: user.id, status: "ACTIVE" }, data: { status: "REVOKED" } });
    const reset = await tx.hrPasswordResetToken.create({ data: { userId: user.id, tokenHash: hashOpaqueToken(rawToken), expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
    await enqueueHrEmail(tx, { organizationId, recipient: user.email, template: "hr-password-reset", subject: "Reset your Zentric HR password", payload: { resetId: reset.id, credentialEnvelope: sealHrCredential(rawToken) }, idempotencyKey: `hr-password-reset:${reset.id}` });
    await appendHrAudit(tx, { organizationId, actorUserId: user.id, entityType: "HrUser", entityId: user.id, action: "hr.password.reset_requested" });
  });
}

export async function consumePasswordReset(rawToken: string, password: string) {
  if (!passwordMeetsPolicy(password)) throw new Error("Password does not meet policy.");
  const reset = await prisma.hrPasswordResetToken.findUnique({ where: { tokenHash: hashOpaqueToken(rawToken) }, include: { user: true } });
  if (!tokenCanBeConsumed(reset) || reset!.user.status !== "ACTIVE") throw new Error("Reset token is invalid or expired.");
  await prisma.$transaction(async (tx) => {
    await tx.hrPasswordResetToken.update({ where: { id: reset!.id }, data: { status: "USED", usedAt: new Date() } });
    await tx.hrUser.update({ where: { id: reset!.userId }, data: { passwordHash: await hashHrPassword(password) } });
    await appendHrAudit(tx, { organizationId: reset!.user.organizationId, actorUserId: reset!.userId, entityType: "HrUser", entityId: reset!.userId, action: "hr.password.reset" });
  });
  await revokeAllHrSessions(reset!.userId);
}
