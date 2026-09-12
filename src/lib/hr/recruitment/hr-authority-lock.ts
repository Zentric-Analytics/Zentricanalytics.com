import type { Prisma } from '@prisma/client';
import { StageAuthorityError } from './stage-authority-error';

/** Keep account status and existing qualifying role grants stable through commit. */
export async function lockNamedHrEligibility(tx: Prisma.TransactionClient, organizationId: string, vacancyId: string, actorUserId: string) {
  try {
    await lockHrAuthority(tx, organizationId, vacancyId);
    await lockHrAccountEligibility(tx, organizationId, actorUserId);
  } catch (error) {
    const conflict = error as { code?: string; meta?: { code?: string } } | null;
    if (conflict?.code === 'P2034' || (conflict?.code === 'P2010' && ['40001', '40P01', '55P03'].includes(conflict.meta?.code ?? ''))) {
      throw new StageAuthorityError('HR eligibility changed while this decision was running. Reload and try again.');
    }
    throw error;
  }
}

/** Also used for primary-admin account setup when no vacancy is linked. */
export async function lockHrAccountEligibility(tx: Prisma.TransactionClient, organizationId: string, actorUserId: string) {
  await tx.$queryRaw`SELECT id FROM "HrUser" WHERE id = ${actorUserId}
    AND "organizationId" = ${organizationId} FOR SHARE`;
  await tx.$queryRaw`SELECT ur.id FROM "HrUserRole" ur
    JOIN "HrRole" r ON r.id = ur."roleId"
    JOIN "HrUser" u ON u.id = ur."userId"
    WHERE ur."userId" = ${actorUserId} AND u."organizationId" = ${organizationId}
    AND r."organizationId" = ${organizationId} AND r.key IN ('ADMIN', 'HR_ADMIN')
    ORDER BY ur.id FOR SHARE OF ur`;
}

/** Hold until transaction end. Read authority only after acquiring this lock.
 * Decisions share the vacancy row; reassignment locks it exclusively before
 * touching handover rows. Never use KEY SHARE: it permits non-key HR updates.
 */
export async function lockHrAuthority(tx: Prisma.TransactionClient, organizationId: string, vacancyId: string, reassign = false) {
  const rows = reassign
    ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "HrVacancy" WHERE id = ${vacancyId} AND "organizationId" = ${organizationId} FOR UPDATE`
    : await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "HrVacancy" WHERE id = ${vacancyId} AND "organizationId" = ${organizationId} FOR SHARE`;
  if (rows.length !== 1) throw new Error('Scoped vacancy not found.');
}
