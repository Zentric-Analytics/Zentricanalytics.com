import crypto from 'node:crypto';
import type { JobApplication, Prisma } from '@prisma/client';

/** Synchronize the reviewed stage decision, never infer an interview or assessment result. */
export async function syncApprovedRecruitmentStage(
  tx: Prisma.TransactionClient, app: JobApplication, stage: 1 | 2 | 3, actorEmail: string, reconciliation = false,
) {
  if (!app.organizationId || !app.vacancyId || !app.recruitmentStatus) return;
  if (app.deletedAt || ['Rejected', 'Withdrawn', 'Hired'].includes(app.status) ||
      ['REJECTED', 'WITHDRAWN', 'ON_HOLD'].includes(app.recruitmentStatus)) {
    throw new Error('This application cannot advance while closed or on hold.');
  }
  const early = ['PENDING_REVIEW', 'UNDER_REVIEW', 'INFORMATION_REQUESTED', 'SHORTLISTED'];
  const target = stage === 1 ? 'UNDER_REVIEW' : stage === 2 ? 'INTERVIEW_PENDING' : 'FINAL_REVIEW';
  if (stage === 3) {
    const [interviews, assessments] = await Promise.all([
      tx.hrInterview.count({ where: { applicationId: app.id, organizationId: app.organizationId, status: 'SCHEDULED' } }),
      tx.hrAssessment.count({ where: { applicationId: app.id, organizationId: app.organizationId, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
    ]);
    if (interviews || assessments) throw new Error('Complete the outstanding interviews and assessments before approving Stage 3.');
  }
  const eligible = stage === 1 ? ['PENDING_REVIEW', 'INFORMATION_REQUESTED'] : stage === 2 ? early :
    [...early, 'INTERVIEW_PENDING', 'INTERVIEW_COMPLETED', 'ASSESSMENT_COMPLETED'];
  if (app.recruitmentStatus === target) return;
  if (!eligible.includes(app.recruitmentStatus)) {
    throw new Error('Recruitment progress conflicts with this stage decision. Review the application before continuing.');
  }
  const updated = await tx.jobApplication.updateMany({
    where: { id: app.id, organizationId: app.organizationId, deletedAt: null, version: app.version, recruitmentStatus: app.recruitmentStatus },
    data: { recruitmentStatus: target, version: { increment: 1 } },
  });
  if (updated.count !== 1) throw new Error('Application changed concurrently. Reload and try again.');
  await tx.hrApplicationStageHistory.create({ data: {
    organizationId: app.organizationId, applicationId: app.id,
    previousState: app.recruitmentStatus, newState: target, actorType: 'ADMIN',
    reason: reconciliation ? `Synchronized from recorded Stage ${stage} approval` : `Approved applicant Stage ${stage}`,
    source: reconciliation ? 'REVIEWED_STAGE_RECONCILIATION' : 'REVIEWED_STAGE', correlationId: crypto.randomUUID(),
    metadata: { stageOrder: stage, reviewerEmail: actorEmail },
  } });
}

/** Explicit, scoped repair for pre-offer records created before stage synchronization. */
export async function reconcileRecruitmentStageStatus(tx: Prisma.TransactionClient, input: {
  applicationId: string; organizationId: string; expectedVersion: number; actorEmail: string;
}) {
  const app = await tx.jobApplication.findFirstOrThrow({ where: {
    id: input.applicationId, organizationId: input.organizationId, deletedAt: null,
  } });
  if (app.version !== input.expectedVersion) throw new Error('Application changed concurrently. Reload and try again.');
  if (!app.vacancyId || app.currentStageOrder > 4 ||
      !['PENDING_REVIEW', 'UNDER_REVIEW', 'INFORMATION_REQUESTED', 'SHORTLISTED'].includes(app.recruitmentStatus ?? '')) {
    throw new Error('This record is not eligible for early-stage synchronization.');
  }
  const offer = await tx.hrRecruitmentOffer.findUnique({ where: { applicationId: app.id } });
  const legacyOffer = await tx.offer.findUnique({ where: { applicationId: app.id } });
  if (offer || legacyOffer) throw new Error('Existing offers require a separate reviewed reconciliation.');
  const stages = await tx.hiringStage.findMany({ where: { applicationId: app.id, stageOrder: { lte: 3 } }, include: { approvals: true } });
  let approved = 0;
  for (const order of [1, 2, 3]) {
    const row = stages.find(stage => stage.stageOrder === order);
    if (!row || !['Approved', 'Completed'].includes(row.status) || !row.approvals.some(decision => decision.action === 'Approved')) break;
    approved = order;
  }
  if (!approved || app.currentStageOrder !== approved + 1) throw new Error('The stage position and recorded approval evidence do not agree.');
  await syncApprovedRecruitmentStage(tx, app, approved as 1 | 2 | 3, input.actorEmail, true);
}
