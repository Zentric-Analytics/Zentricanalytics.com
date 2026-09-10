import type { Prisma } from '@prisma/client';

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
