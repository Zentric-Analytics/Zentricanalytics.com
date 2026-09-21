import type { Prisma } from '@prisma/client';
import { sha256 } from './security';

/** Lock in the same order as HR decisions: application, then stage. */
export async function lockCandidateStage(tx: Prisma.TransactionClient, input: {
  applicationId: string; stageId: string; stageOrder: number; session: string;
}) {
  await tx.$queryRaw`SELECT id FROM "JobApplication" WHERE id = ${input.applicationId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "HiringStage" WHERE id = ${input.stageId} FOR UPDATE`;
  const access = await tx.applicationAccessCode.findFirst({ where: {
    applicationId: input.applicationId, verifiedSessionTokenHash: sha256(input.session),
    sessionExpiresAt: { gt: new Date() }, application: { deletedAt: null },
  }, include: { application: { include: { stages: true } } } });
  const app = access?.application;
  const stage = app?.stages.find(item => item.id === input.stageId);
  if (!app || !stage || app.currentStageOrder > input.stageOrder ||
      ['Hired', 'Rejected', 'Withdrawn'].includes(app.status) ||
      !['Available', 'In Progress', 'Correction Requested'].includes(stage.status)) {
    throw new Error('Candidate stage is no longer open.');
  }
  const previous = app.stages.find(item => item.stageOrder === input.stageOrder - 1);
  if (input.stageOrder > 1 && previous?.status !== 'Approved' && previous?.status !== 'Completed') {
    throw new Error('Previous stage is not approved.');
  }
  return stage;
}

export async function nextSubmissionVersion(tx: Prisma.TransactionClient, stageId: string) {
  const latest = await tx.stageSubmission.aggregate({ where: { stageId }, _max: { version: true } });
  return (latest._max.version ?? 0) + 1;
}
