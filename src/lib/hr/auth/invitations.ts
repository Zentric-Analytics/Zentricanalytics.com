import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { createOpaqueToken, hashHrPassword, hashOpaqueToken, passwordMeetsPolicy, sealHrCredential } from "./crypto";
import { tokenCanBeConsumed } from "./tokens";

export class HrInvitationAcceptanceError extends Error {
  constructor(public readonly code: "INVALID_TOKEN" | "PASSWORD_POLICY") {
    super(code === "PASSWORD_POLICY" ? "Password does not meet policy." : "Invitation is invalid or expired.");
    this.name = "HrInvitationAcceptanceError";
  }
}

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
  if (!passwordMeetsPolicy(password)) throw new HrInvitationAcceptanceError("PASSWORD_POLICY");
  const tokenHash = hashOpaqueToken(rawToken);
  return prisma.$transaction(async (tx) => {
    const invitation = await tx.hrAccountInvitation.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!tokenCanBeConsumed(invitation)) throw new HrInvitationAcceptanceError("INVALID_TOKEN");
    const now = new Date();
    const claimed = await tx.hrAccountInvitation.updateMany({
      where: { id: invitation!.id, status: "ACTIVE", usedAt: null, expiresAt: { gt: now } },
      data: { status: "USED", usedAt: now },
    });
    if (claimed.count !== 1) throw new HrInvitationAcceptanceError("INVALID_TOKEN");
    await tx.hrUser.update({ where: { id: invitation!.userId }, data: { passwordHash: await hashHrPassword(password), status: "ACTIVE", emailVerifiedAt: new Date() } });
    await appendHrAudit(tx, { organizationId: invitation!.organizationId, actorUserId: invitation!.userId, entityType: "HrUser", entityId: invitation!.userId, action: "hr.invitation.consumed" });
  });
}
