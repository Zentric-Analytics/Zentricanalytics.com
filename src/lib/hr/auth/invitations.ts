import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { createOpaqueToken, hashHrPassword, hashOpaqueToken, passwordMeetsPolicy, sealHrCredential } from "./crypto";
import { tokenCanBeConsumed } from "./tokens";

export async function createHrInvitation(input: { organizationId: string; userId: string; createdById: string; recipient: string }) {
  const rawToken = createOpaqueToken();
  const invitation = await prisma.$transaction(async (tx) => {
    await tx.hrAccountInvitation.updateMany({ where: { userId: input.userId, status: "ACTIVE" }, data: { status: "REVOKED" } });
    const created = await tx.hrAccountInvitation.create({ data: { organizationId: input.organizationId, userId: input.userId, createdById: input.createdById, tokenHash: hashOpaqueToken(rawToken), expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) } });
    await enqueueHrEmail(tx, { organizationId: input.organizationId, recipient: input.recipient, template: "hr-account-invitation", subject: "Set up your Zentric HR account", payload: { invitationId: created.id, credentialEnvelope: sealHrCredential(rawToken) }, idempotencyKey: `hr-invitation:${created.id}` });
    await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.createdById, entityType: "HrUser", entityId: input.userId, action: "hr.user.invited" });
    return created;
  });
  return { invitation, rawToken };
}

export async function consumeHrInvitation(rawToken: string, password: string) {
  if (!passwordMeetsPolicy(password)) throw new Error("Password does not meet policy.");
  const tokenHash = hashOpaqueToken(rawToken);
  return prisma.$transaction(async (tx) => {
    const invitation = await tx.hrAccountInvitation.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!tokenCanBeConsumed(invitation)) throw new Error("Invitation is invalid or expired.");
    await tx.hrAccountInvitation.update({ where: { id: invitation!.id }, data: { status: "USED", usedAt: new Date() } });
    await tx.hrUser.update({ where: { id: invitation!.userId }, data: { passwordHash: await hashHrPassword(password), status: "ACTIVE", emailVerifiedAt: new Date() } });
    await appendHrAudit(tx, { organizationId: invitation!.organizationId, actorUserId: invitation!.userId, entityType: "HrUser", entityId: invitation!.userId, action: "hr.invitation.consumed" });
  });
}
