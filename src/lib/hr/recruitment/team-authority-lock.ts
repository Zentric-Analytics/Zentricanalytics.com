import type { Prisma } from '@prisma/client';
import { lockHrAuthority } from './hr-authority-lock';
import { StageAuthorityError } from './stage-authority-error';

/** Keep membership/team/user eligibility stable until the decision transaction ends. */
export async function lockHiringTeamAuthority(tx: Prisma.TransactionClient, organizationId: string, vacancyId: string, actorUserId: string) {
  try {
    await lockHrAuthority(tx, organizationId, vacancyId);
    await tx.$queryRaw`SELECT t.id FROM "HrHiringTeam" t JOIN "HrVacancy" v ON v."hiringTeamId" = t.id
      WHERE v.id = ${vacancyId} AND v."organizationId" = ${organizationId}
      AND t."organizationId" = ${organizationId} FOR SHARE OF t`;
    await tx.$queryRaw`SELECT m.id FROM "HrHiringTeamMember" m JOIN "HrVacancy" v ON v."hiringTeamId" = m."hiringTeamId"
      WHERE v.id = ${vacancyId} AND v."organizationId" = ${organizationId}
      AND m."userId" = ${actorUserId} ORDER BY m.id FOR SHARE OF m`;
    await tx.$queryRaw`SELECT id FROM "HrUser" WHERE id = ${actorUserId}
      AND "organizationId" = ${organizationId} FOR SHARE`;
  } catch (error) {
    const conflict = error as { code?: string; meta?: { code?: string } } | null;
    if (conflict?.code === 'P2034' || (conflict?.code === 'P2010' && ['40001', '40P01', '55P03'].includes(conflict.meta?.code ?? ''))) {
      throw new StageAuthorityError('Hiring-team authority changed while this decision was running. Reload and try again.');
    }
    throw error;
  }
}
