import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { sha256 } from '@/lib/security';
import { enqueueHrEmail } from '../notifications/outbox';

export const candidateAssessmentSelect = { id: true, assessmentType: true, instructions: true,
  status: true, dueAt: true, version: true } satisfies Prisma.HrAssessmentSelect;
export type CandidateAssessment = Prisma.HrAssessmentGetPayload<{ select: typeof candidateAssessmentSelect }>;

export function assessmentResponse(payload: Prisma.JsonValue, assessmentId: string) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return payload.kind === 'assessment-response' && payload.assessmentId === assessmentId && typeof payload.response === 'string'
    ? payload.response : null;
}

export const candidateAssessmentResponseSchema = z.object({
  session: z.string().min(1).max(256), assessmentId: z.string().cuid(),
  expectedVersion: z.coerce.number().int().positive(), response: z.string().trim().min(1).max(10000),
});

/** Called in a Serializable transaction: session, ownership, lifecycle and version rechecked together. */
export async function submitCandidateAssessmentResponse(tx: Prisma.TransactionClient, raw: unknown) {
  const input = candidateAssessmentResponseSchema.parse(raw);
  const access = await tx.applicationAccessCode.findFirst({
    where: { verifiedSessionTokenHash: sha256(input.session), sessionExpiresAt: { gt: new Date() }, application: { deletedAt: null } },
    include: { application: { include: { stages: true } } },
  });
  if (!access) throw new Error('Your session has expired. Request a new access code.');
  const app = access.application;
  const stage = app.stages.find(item => item.stageOrder === 3);
  if (!app.organizationId || app.currentStageOrder !== 3 || !stage ||
    !['Available', 'In Progress', 'Correction Requested', 'Under Review', 'Submitted'].includes(stage.status) ||
    ['Hired', 'Rejected', 'Withdrawn'].includes(app.status)) throw new Error('This assessment is not open for responses.');
  const assessment = await tx.hrAssessment.findFirst({ where: { id: input.assessmentId, applicationId: app.id, organizationId: app.organizationId } });
  if (!assessment || !['PENDING', 'IN_PROGRESS'].includes(assessment.status)) throw new Error('This assessment is no longer open.');
  if (assessment.dueAt && assessment.dueAt.getTime() < Date.now()) throw new Error('The assessment deadline has passed. Contact the hiring team.');
  const previous = await tx.stageSubmission.findFirst({ where: { stageId: stage.id, payload: { path: ['assessmentId'], equals: assessment.id } } });
  if (previous) throw new Error('Your response has already been submitted.');
  const changed = await tx.hrAssessment.updateMany({ where: { id: assessment.id, organizationId: app.organizationId,
    version: input.expectedVersion, status: assessment.status }, data: { status: 'IN_PROGRESS', version: { increment: 1 } } });
  if (changed.count !== 1) throw new Error('The assessment changed. Reload and try again.');
  const latest = await tx.stageSubmission.aggregate({ where: { stageId: stage.id }, _max: { version: true } });
  const submission = await tx.stageSubmission.create({ data: { stageId: stage.id, version: (latest._max.version ?? 0) + 1,
    payload: { kind: 'assessment-response', assessmentId: assessment.id, assessmentVersion: input.expectedVersion, response: input.response },
    status: 'Under Review', submittedAt: new Date() } });
  await tx.hiringStage.update({ where: { id: stage.id }, data: { status: 'Under Review', submittedAt: new Date() } });
  await tx.auditLog.create({ data: { applicationId: app.id, actorType: 'applicant', actorRef: 'masked-email',
    action: 'Applicant submitted assessment response', metadata: { assessmentId: assessment.id, submissionId: submission.id } } });
  if (assessment.evaluatorId) {
    const evaluator = await tx.hrUser.findFirst({ where: { id: assessment.evaluatorId, organizationId: app.organizationId, status: 'ACTIVE' } });
    if (evaluator) await enqueueHrEmail(tx, { organizationId: app.organizationId, recipient: evaluator.email,
      template: 'hr-assessment-assigned', subject: 'Assessment response ready for review',
      payload: { assessmentId: assessment.id, href: `/hr/recruitment/${app.id}/tools` },
      idempotencyKey: `assessment-response:${submission.id}` });
  }
  return submission.id;
}
