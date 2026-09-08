import type { Prisma } from '@prisma/client';

/** Recoverable deletion only: employee records and immutable evidence are never purged. */
export async function setApplicationDeleted(tx: Prisma.TransactionClient, input: {
  applicationId: string; organizationId: string; actorUserId: string; deleted: boolean; reason: string;
}) {
  const actor = await tx.hrUser.findFirstOrThrow({ where: {
    id: input.actorUserId, organizationId: input.organizationId, isPrimaryAdmin: true, status: 'ACTIVE',
  } });
  const role = await tx.hrUserRole.findFirst({ where: { userId: actor.id, revokedAt: null, role: { key: 'ADMIN' } } });
  if (!role) throw new Error('Only the active primary administrator may delete or restore applications.');
  const app = await tx.jobApplication.findFirstOrThrow({ where: { id: input.applicationId, organizationId: input.organizationId } });
  if (input.deleted && (app.status === 'Hired' || await tx.hrEmployee.findUnique({ where: { recruitmentApplicationId: app.id } }))) {
    throw new Error('Employee-linked applications must be retained with their employment history.');
  }
  if (Boolean(app.deletedAt) === input.deleted) return;
  const changed = await tx.jobApplication.updateMany({
    where: { id: app.id, organizationId: input.organizationId, version: app.version },
    data: input.deleted ? {
      deletedAt: new Date(), deletedByAdminEmail: actor.email, deleteReason: input.reason,
      restoredAt: null, restoredByAdminEmail: null, version: { increment: 1 },
    } : {
      deletedAt: null, deletedByAdminEmail: null, deleteReason: null,
      restoredAt: new Date(), restoredByAdminEmail: actor.email, version: { increment: 1 },
    },
  });
  if (changed.count !== 1) throw new Error('Application changed concurrently. Reload and try again.');
  if (input.deleted) await tx.applicationAccessCode.deleteMany({ where: { applicationId: app.id } });
  await tx.auditLog.create({ data: {
    applicationId: app.id, actorType: 'admin', actorRef: actor.email,
    action: input.deleted ? 'Admin soft deleted application' : 'Admin restored application',
    metadata: { reasonPresent: Boolean(input.reason), recoverable: true },
  } });
}
