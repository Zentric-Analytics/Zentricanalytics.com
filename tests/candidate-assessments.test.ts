import { beforeEach, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
vi.mock('@/lib/hr/notifications/outbox', () => ({ enqueueHrEmail: vi.fn() }));
import { assessmentResponse, candidateAssessmentSelect, submitCandidateAssessmentResponse } from '@/lib/hr/recruitment/candidate-assessments';
import { enqueueHrEmail } from '@/lib/hr/notifications/outbox';
const id = 'cm1234567890123456789012';
const tx = {
  applicationAccessCode: { findFirst: vi.fn() }, hrAssessment: { findFirst: vi.fn(), updateMany: vi.fn() },
  stageSubmission: { findFirst: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
  hiringStage: { update: vi.fn() }, auditLog: { create: vi.fn() }, hrUser: { findFirst: vi.fn() },
};
const input = { session: 'test-session', assessmentId: id, expectedVersion: 1, response: 'Synthetic response' };
const app = { id, organizationId: 'org', currentStageOrder: 3, status: 'Screening', stages: [{ id: 'stage', stageOrder: 3, status: 'Available' }] };
const assessment = { id, version: 1, status: 'PENDING', dueAt: null, evaluatorId: null };
const run = () => submitCandidateAssessmentResponse(tx as unknown as Prisma.TransactionClient, input);
beforeEach(() => {
  vi.resetAllMocks();
  tx.applicationAccessCode.findFirst.mockResolvedValue({ application: app });
  tx.hrAssessment.findFirst.mockResolvedValue(assessment);
  tx.hrAssessment.updateMany.mockResolvedValue({ count: 1 });
  tx.stageSubmission.aggregate.mockResolvedValue({ _max: { version: 2 } });
  tx.stageSubmission.create.mockResolvedValue({ id: 'submission' });
});
it('stores a linked response, not an evaluator score, and retains stage review evidence', async () => {
  await run();
  expect(tx.applicationAccessCode.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ application: { deletedAt: null }, sessionExpiresAt: { gt: expect.any(Date) } }) }));
  expect(tx.hrAssessment.findFirst).toHaveBeenCalledWith({ where: { id, applicationId: id, organizationId: 'org' } });
  expect(tx.hrAssessment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id, organizationId: 'org', version: 1, status: 'PENDING' }, data: { status: 'IN_PROGRESS', version: { increment: 1 } } }));
  expect(tx.stageSubmission.create).toHaveBeenCalledWith({ data: expect.objectContaining({ version: 3, payload: { kind: 'assessment-response', assessmentId: id, assessmentVersion: 1, response: input.response }, status: 'Under Review' }) });
  expect(JSON.stringify(tx.auditLog.create.mock.calls)).not.toContain(input.response);
});
it('rejects an invalid/expired/deleted application session before reading assessments', async () => {
  tx.applicationAccessCode.findFirst.mockResolvedValue(null);
  await expect(run()).rejects.toThrow('session'); expect(tx.hrAssessment.findFirst).not.toHaveBeenCalled();
});
it('rejects a different application or organization assessment', async () => {
  tx.hrAssessment.findFirst.mockResolvedValue(null); await expect(run()).rejects.toThrow('no longer open');
});
it.each(['Approved', 'Locked', 'Rejected'])('rejects closed stage %s', async status => {
  tx.applicationAccessCode.findFirst.mockResolvedValue({ application: { ...app, stages: [{ id: 'stage', stageOrder: 3, status }] } });
  await expect(run()).rejects.toThrow('not open');
});
it.each(['COMPLETED', 'CANCELLED'])('rejects closed assessment %s', async status => {
  tx.hrAssessment.findFirst.mockResolvedValue({ ...assessment, status }); await expect(run()).rejects.toThrow('no longer open');
});
it('rejects late, duplicate and stale writes', async () => {
  tx.hrAssessment.findFirst.mockResolvedValue({ ...assessment, dueAt: new Date(0) }); await expect(run()).rejects.toThrow('deadline');
  tx.hrAssessment.findFirst.mockResolvedValue(assessment); tx.stageSubmission.findFirst.mockResolvedValue({ id: 'old' }); await expect(run()).rejects.toThrow('already');
  tx.stageSubmission.findFirst.mockResolvedValue(null); tx.hrAssessment.updateMany.mockResolvedValue({ count: 0 }); await expect(run()).rejects.toThrow('changed');
  expect(tx.stageSubmission.create).not.toHaveBeenCalled();
});
it('keeps evaluator private fields out of the candidate projection and response parser', () => {
  expect(Object.keys(candidateAssessmentSelect).sort()).toEqual(['id', 'assessmentType', 'instructions', 'status', 'dueAt', 'version'].sort());
  expect(assessmentResponse({ kind: 'assessment-response', assessmentId: id, response: 'test' }, id)).toBe('test');
  expect(assessmentResponse({ kind: 'assessment-response', assessmentId: 'other', response: 'private' }, id)).toBeNull();
});
it('notifies only the assigned active evaluator without response contents', async () => {
  tx.hrAssessment.findFirst.mockResolvedValue({ ...assessment, evaluatorId: 'evaluator' });
  tx.hrUser.findFirst.mockResolvedValue({ email: 'evaluator@example.test' });
  await run();
  expect(tx.hrUser.findFirst).toHaveBeenCalledWith({ where: { id: 'evaluator', organizationId: 'org', status: 'ACTIVE' } });
  expect(enqueueHrEmail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ recipient: 'evaluator@example.test', idempotencyKey: 'assessment-response:submission' }));
  expect(JSON.stringify(vi.mocked(enqueueHrEmail).mock.calls)).not.toContain(input.response);
});
it('allows another assessment response while the stage is under review without advancing the applicant', async () => {
  tx.applicationAccessCode.findFirst.mockResolvedValue({ application: { ...app, stages: [{ id: 'stage', stageOrder: 3, status: 'Under Review' }] } });
  tx.hrAssessment.findFirst.mockResolvedValue({ ...assessment, status: 'IN_PROGRESS' });
  await expect(run()).resolves.toBe('submission');
  expect(tx.hiringStage.update).toHaveBeenCalledWith({ where: { id: 'stage' }, data: { status: 'Under Review', submittedAt: expect.any(Date) } });
});
