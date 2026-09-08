import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JobApplication, Prisma } from '@prisma/client';
import { reconcileRecruitmentStageStatus, syncApprovedRecruitmentStage } from '@/lib/hr/recruitment/stage-status';

const tx = {
  jobApplication: { updateMany: vi.fn(), findFirstOrThrow: vi.fn() },
  hrApplicationStageHistory: { create: vi.fn() },
  hrInterview: { count: vi.fn() }, hrAssessment: { count: vi.fn() },
  hrRecruitmentOffer: { findUnique: vi.fn() }, offer: { findUnique: vi.fn() },
  hiringStage: { findMany: vi.fn() },
};
const client = tx as unknown as Prisma.TransactionClient;
const application = (recruitmentStatus = 'PENDING_REVIEW') => ({
  id: 'application', organizationId: 'organization', vacancyId: 'vacancy', version: 7,
  recruitmentStatus, currentStageOrder: 4, status: 'Offer Pending', deletedAt: null,
} as JobApplication);
beforeEach(() => {
  vi.resetAllMocks();
  tx.jobApplication.updateMany.mockResolvedValue({ count: 1 });
  tx.hrInterview.count.mockResolvedValue(0); tx.hrAssessment.count.mockResolvedValue(0);
  tx.jobApplication.findFirstOrThrow.mockResolvedValue(application());
  tx.hiringStage.findMany.mockResolvedValue([1, 2, 3].map(stageOrder => ({ stageOrder, status: 'Approved', approvals: [{ action: 'Approved' }] })));
});
describe('reviewed stages share recruitment progress', () => {
  it.each([[1, 'UNDER_REVIEW'], [2, 'INTERVIEW_PENDING'], [3, 'FINAL_REVIEW']] as const)('stage %s synchronizes atomically with provenance', async (stage, target) => {
    await syncApprovedRecruitmentStage(client, application(), stage, 'reviewer@example.test');
    expect(tx.jobApplication.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: 'organization', version: 7, recruitmentStatus: 'PENDING_REVIEW' }),
      data: { recruitmentStatus: target, version: { increment: 1 } },
    }));
    expect(tx.hrApplicationStageHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ previousState: 'PENDING_REVIEW', newState: target, source: 'REVIEWED_STAGE' }) });
  });
  it.each(['REJECTED', 'WITHDRAWN', 'ON_HOLD', 'OFFER_ISSUED', 'TRANSFERRED_TO_HR'])('does not overwrite %s', async state => {
    await expect(syncApprovedRecruitmentStage(client, application(state), 2, 'reviewer@example.test')).rejects.toThrow();
    expect(tx.jobApplication.updateMany).not.toHaveBeenCalled();
  });
  it('repeated target is a no-op', async () => {
    await syncApprovedRecruitmentStage(client, application('INTERVIEW_PENDING'), 2, 'reviewer@example.test');
    expect(tx.jobApplication.updateMany).not.toHaveBeenCalled();
  });
  it.each(['hrInterview', 'hrAssessment'] as const)('pending %s blocks stage three', async model => {
    tx[model].count.mockResolvedValue(1);
    await expect(syncApprovedRecruitmentStage(client, application(), 3, 'reviewer@example.test')).rejects.toThrow('outstanding');
    expect(tx.jobApplication.updateMany).not.toHaveBeenCalled();
  });
  it('rejects stale writes without creating history', async () => {
    tx.jobApplication.updateMany.mockResolvedValue({ count: 0 });
    await expect(syncApprovedRecruitmentStage(client, application(), 1, 'reviewer@example.test')).rejects.toThrow('concurrently');
    expect(tx.hrApplicationStageHistory.create).not.toHaveBeenCalled();
  });
  it('leaves unscoped legacy records unmapped', async () => {
    await syncApprovedRecruitmentStage(client, { ...application(), organizationId: null }, 1, 'reviewer@example.test');
    expect(tx.jobApplication.updateMany).not.toHaveBeenCalled();
  });
});
describe('guarded historical synchronization', () => {
  const input = { applicationId: 'application', organizationId: 'organization', expectedVersion: 7, actorEmail: 'reviewer@example.test' };
  it('uses the contiguous recorded approvals without resubmitting them', async () => {
    await reconcileRecruitmentStageStatus(client, input);
    expect(tx.jobApplication.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { recruitmentStatus: 'FINAL_REVIEW', version: { increment: 1 } } }));
  });
  it('does not trust stage labels without decision evidence', async () => {
    tx.hiringStage.findMany.mockResolvedValue([{ stageOrder: 1, status: 'Approved', approvals: [] }]);
    await expect(reconcileRecruitmentStageStatus(client, input)).rejects.toThrow('evidence');
  });
  it.each(['hrRecruitmentOffer', 'offer'] as const)('does not change a record with an existing %s', async model => {
    tx[model].findUnique.mockResolvedValue({ id: 'offer' });
    await expect(reconcileRecruitmentStageStatus(client, input)).rejects.toThrow('offers');
  });
  it('requires the displayed version', async () => {
    await expect(reconcileRecruitmentStageStatus(client, { ...input, expectedVersion: 6 })).rejects.toThrow('concurrently');
  });
});
