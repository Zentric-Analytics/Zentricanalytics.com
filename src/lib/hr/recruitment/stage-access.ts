import type { Prisma } from '@prisma/client';
import { assertVacancyCreatorOrDelegate } from './delegation';
import { prisma } from '@/lib/prisma';
import { requireAuthenticatedUser } from '@/lib/hr/permissions/authorize';
import { StageAuthorityError } from './stage-authority-error';
export async function recruitmentOversight() {
  const auth = await requireAuthenticatedUser();
  if (!auth.roles.some((role) => role === 'ADMIN' || role === 'HR_ADMIN')) throw new Error('Recruitment oversight requires an admin role.');
  const where: Prisma.JobApplicationWhereInput = auth.user.isPrimaryAdmin && auth.roles.includes('ADMIN')
    ? { OR: [{ organizationId: auth.user.organizationId }, { organizationId: null }] }
    : { organizationId: auth.user.organizationId };
  return { auth, where };
}

export async function requireRecruitmentRead(applicationId: string) {
  const auth = await requireAuthenticatedUser();
  if (auth.user.isPrimaryAdmin && auth.roles.includes('ADMIN')) {
    const unmapped = await prisma.jobApplication.findFirst({ where: { id: applicationId, organizationId: null }, select: { id: true } });
    if (unmapped) return auth.user;
  }
  const app = await prisma.jobApplication.findFirstOrThrow({ where: { id: applicationId, organizationId: auth.user.organizationId } });
  if (auth.roles.some((role) => role === 'ADMIN' || role === 'HR_ADMIN')) return auth.user;
  if (!app.vacancyId) throw new Error('Application has no scoped vacancy.');
  const vacancy = await prisma.hrVacancy.findFirstOrThrow({ where: { id: app.vacancyId, organizationId: auth.user.organizationId } });
  if (vacancy.createdById === auth.user.id || vacancy.responsibleHrUserId === auth.user.id) return auth.user;
  const now = new Date();
  const member = await prisma.hrHiringTeamMember.findFirst({ where: {
    hiringTeamId: vacancy.hiringTeamId, userId: auth.user.id, status: 'ACTIVE', effectiveFrom: { lte: now },
    OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }], hiringTeam: { status: 'ACTIVE', organizationId: auth.user.organizationId },
  } });
  if (!member) throw new Error('Application is outside your assigned recruitment scope.');
  return auth.user;
}
export async function canReadRecruitmentSensitive(applicationId: string) {
  const auth = await requireAuthenticatedUser();
  await requireRecruitmentRead(applicationId);
  if (auth.permissions.has('document.read_sensitive')) return true;
  if (!auth.roles.some((role) => role === 'ADMIN' || role === 'HR_ADMIN')) return false;
  const app = await prisma.jobApplication.findFirst({ where: { id: applicationId, organizationId: auth.user.organizationId } });
  if (!app?.vacancyId) return false;
  return Boolean(await prisma.hrVacancy.findFirst({ where: { id: app.vacancyId, organizationId: auth.user.organizationId, responsibleHrUserId: auth.user.id } }));
}
export async function canManageRecruitmentStage(applicationId: string, stage: number) {
  const auth = await requireAuthenticatedUser();
  try {
    const app = await prisma.jobApplication.findFirst({ where: { id: applicationId, organizationId: auth.user.organizationId, deletedAt: null } });
    if (!app || app.status === 'Hired' || app.currentStageOrder > stage) return false;
    await assertRecruitmentStageAccess(prisma, { applicationId, stage, organizationId: auth.user.organizationId, actorUserId: auth.user.id });
    return true;
  } catch { return false; }
}

/** Scoped authority for the preserved eight-stage recruitment workflow. */
export async function assertRecruitmentStageAccess(tx: Prisma.TransactionClient, input: {
  applicationId: string; organizationId: string; actorUserId: string; stage: number;
}) {
  if (!Number.isInteger(input.stage) || input.stage < 1 || input.stage > 8) throw new Error('Invalid recruitment stage.');
  const application = await tx.jobApplication.findFirstOrThrow({ where: { id: input.applicationId, organizationId: input.organizationId, deletedAt: null } });
  if (!application.vacancyId) throw new Error('Application requires a reviewed vacancy link before migration.');
  await tx.hrUser.findFirstOrThrow({ where: { id: input.actorUserId, organizationId: input.organizationId, status: 'ACTIVE' } });
  const vacancy = await tx.hrVacancy.findFirstOrThrow({ where: { id: application.vacancyId, organizationId: input.organizationId } });
  if (input.stage >= 6) {
    if (vacancy.responsibleHrUserId !== input.actorUserId) throw new StageAuthorityError('Only the assigned HR person may review this stage.');
    const currentHrRole = await tx.hrUserRole.findFirst({ where: { userId: input.actorUserId, revokedAt: null, role: { key: { in: ['ADMIN', 'HR_ADMIN'] } } } });
    if (!currentHrRole) throw new StageAuthorityError('The assigned HR person must retain an active HR Admin or Admin role.');
  } else if (input.stage === 4) {
    await assertVacancyCreatorOrDelegate(tx, { ...input, vacancyId: vacancy.id });
  } else {
    const now = new Date();
    const member = await tx.hrHiringTeamMember.findFirst({ where: {
      hiringTeamId: vacancy.hiringTeamId, userId: input.actorUserId, status: 'ACTIVE',
      effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      hiringTeam: { organizationId: input.organizationId, status: 'ACTIVE' },
    } });
    if (!member) {
      if (input.stage !== 5) throw new Error('Only an active assigned hiring-team member may review this stage.');
      await assertVacancyCreatorOrDelegate(tx, { ...input, vacancyId: vacancy.id });
    }
  }
  return application;
}
