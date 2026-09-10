import { Prisma } from "@prisma/client";

/** Call before eligibility reads in a Serializable publication transaction.
 * SHARE (not KEY SHARE) conflicts with ordinary revocation/status updates.
 * Locks last until commit/rollback, including history and outbox writes.
 */
export async function lockPublicationEligibility(tx: Prisma.TransactionClient, organizationId: string, vacancyId: string) {
  const vacancies = await tx.$queryRaw<Array<{
    createdById: string; vacancyOwnerId: string; responsibleHrUserId: string | null;
    hiringTeamId: string; responsibleHrTeamId: string;
  }>>`SELECT "createdById", "vacancyOwnerId", "responsibleHrUserId", "hiringTeamId", "responsibleHrTeamId"
    FROM "HrVacancy" WHERE id = ${vacancyId} AND "organizationId" = ${organizationId} FOR UPDATE`;
  const vacancy = vacancies[0];
  if (!vacancy) throw new Error("Scoped vacancy not found.");
  const teams = [...new Set([vacancy.hiringTeamId, vacancy.responsibleHrTeamId])].sort();
  await tx.$queryRaw`SELECT id FROM "HrHiringTeam" WHERE "organizationId" = ${organizationId}
    AND id IN (${Prisma.join(teams)}) ORDER BY id FOR SHARE`;
  const members = await tx.$queryRaw<Array<{ userId: string }>>`SELECT "userId" FROM "HrHiringTeamMember"
    WHERE "hiringTeamId" = ${vacancy.hiringTeamId} ORDER BY id FOR SHARE`;
  const users = [...new Set([vacancy.createdById, vacancy.vacancyOwnerId, vacancy.responsibleHrUserId,
    ...members.map(member => member.userId)].filter((id): id is string => Boolean(id)))].sort();
  await tx.$queryRaw`SELECT id FROM "HrUser" WHERE "organizationId" = ${organizationId}
    AND id IN (${Prisma.join(users)}) ORDER BY id FOR SHARE`;
  const assignments = await tx.$queryRaw<Array<{ roleId: string }>>`SELECT ur."roleId" FROM "HrUserRole" ur
    JOIN "HrUser" u ON u.id = ur."userId" WHERE u."organizationId" = ${organizationId}
    AND ur."userId" IN (${Prisma.join(users)}) ORDER BY ur.id FOR SHARE OF ur`;
  const roles = [...new Set(assignments.map(assignment => assignment.roleId))].sort();
  if (roles.length) {
    await tx.$queryRaw`SELECT id FROM "HrRole" WHERE "organizationId" = ${organizationId}
      AND id IN (${Prisma.join(roles)}) ORDER BY id FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM "HrRolePermission" WHERE "roleId" IN (${Prisma.join(roles)})
      ORDER BY id FOR SHARE`;
  }
}
