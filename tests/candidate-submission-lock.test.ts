import { beforeEach, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { lockCandidateStage, nextSubmissionVersion } from '@/lib/candidate-submission';
const tx = { $queryRaw: vi.fn(), applicationAccessCode: { findFirst: vi.fn() }, stageSubmission: { aggregate: vi.fn() } };
const input = { applicationId: 'app', stageId: 'stage', stageOrder: 2, session: 'cookie-only-token' };
const client = tx as unknown as Prisma.TransactionClient;
const app = (status = 'Available') => ({ currentStageOrder: 2, status: 'Candidate Information Required', stages: [{ id: 'previous', stageOrder: 1, status: 'Approved' }, { id: 'stage', stageOrder: 2, status }] });
beforeEach(() => { vi.resetAllMocks(); tx.applicationAccessCode.findFirst.mockResolvedValue({ application: app() }); });
it('locks application then stage before reading current session and status', async () => {
  await lockCandidateStage(client, input);
  expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
  expect(tx.$queryRaw.mock.calls[0][0].join('')).toContain('JobApplication');
  expect(tx.$queryRaw.mock.calls[1][0].join('')).toContain('HiringStage');
  expect(tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(tx.applicationAccessCode.findFirst.mock.invocationCallOrder[0]);
});
it.each(['Under Review', 'Approved', 'Rejected', 'Locked'])('rejects a stage changed to %s while waiting for the lock', async status => {
  tx.$queryRaw.mockImplementation(async () => { tx.applicationAccessCode.findFirst.mockResolvedValue({ application: app(status) }); return []; });
  await expect(lockCandidateStage(client, input)).rejects.toThrow('no longer open');
});
it('rejects expiry/deletion discovered after locking', async () => {
  tx.applicationAccessCode.findFirst.mockResolvedValue(null);
  await expect(lockCandidateStage(client, input)).rejects.toThrow('no longer open');
});
it('rejects a withdrawn or forward-progressed application', async () => {
  tx.applicationAccessCode.findFirst.mockResolvedValue({ application: { ...app(), status: 'Withdrawn' } });
  await expect(lockCandidateStage(client, input)).rejects.toThrow('no longer open');
  tx.applicationAccessCode.findFirst.mockResolvedValue({ application: { ...app(), currentStageOrder: 3 } });
  await expect(lockCandidateStage(client, input)).rejects.toThrow('no longer open');
});
it('rechecks prior-stage approval', async () => {
  const application = app(); application.stages[0].status = 'Correction Requested';
  tx.applicationAccessCode.findFirst.mockResolvedValue({ application });
  await expect(lockCandidateStage(client, input)).rejects.toThrow('Previous stage');
});
it('allocates after the highest historical version, including gaps', async () => {
  tx.stageSubmission.aggregate.mockResolvedValue({ _max: { version: 8 } });
  expect(await nextSubmissionVersion(client, 'stage')).toBe(9);
  tx.stageSubmission.aggregate.mockResolvedValue({ _max: { version: null } });
  expect(await nextSubmissionVersion(client, 'stage')).toBe(1);
});
