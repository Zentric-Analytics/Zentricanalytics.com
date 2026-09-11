import { beforeEach, describe, expect, it, vi } from 'vitest';
const { tx } = vi.hoisted(() => ({ tx: {
  jobApplication: { findUnique: vi.fn(), update: vi.fn() }, hiringStage: { findFirst: vi.fn(), update: vi.fn() },
  stageApproval: { create: vi.fn() }, auditLog: { create: vi.fn() },
} }));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: (fn: (client: unknown) => unknown) => fn(tx) } }));
import { approveStage1, approveStage2, approveStage3, recordAdminStage1Action, recordAdminStage2Action, recordAdminStage3Action, stageDecisionIsRepeat } from '@/lib/workflow';
beforeEach(() => { vi.resetAllMocks(); });
describe('forward-only completed recruitment stages', () => {
  it.each([recordAdminStage1Action, recordAdminStage2Action, recordAdminStage3Action])('does not rewrite a recorded negative decision', async decide => {
    for (const status of ['Rejected', 'Correction Requested'] as const) {
      tx.jobApplication.findUnique.mockResolvedValue({ id: 'app', status, currentStageOrder: 1 });
      tx.hiringStage.findFirst.mockResolvedValue({ id: 'stage', stageOrder: 3, status });
      expect((await decide('app', status, 'reviewer@example.test')).alreadySameStatus).toBe(true);
      expect(tx.jobApplication.update).not.toHaveBeenCalled();
      expect(tx.hiringStage.update).not.toHaveBeenCalled();
      expect(tx.stageApproval.create).not.toHaveBeenCalled();
      expect(tx.auditLog.create).not.toHaveBeenCalled();
    }
  });
  it.each([approveStage1, approveStage2, approveStage3])('reapproval cannot unhire or reset later stages', async (approve) => {
    tx.jobApplication.findUnique.mockResolvedValue({ id: 'app', status: 'Hired', currentStageOrder: 8 });
    tx.hiringStage.findFirst.mockImplementation(({ where }) => ({ id: String(where.stageOrder), stageOrder: where.stageOrder, status: 'Approved' }));
    expect((await approve('app', 'reviewer@example.test')).alreadyApproved).toBe(true);
    expect(tx.hiringStage.update).not.toHaveBeenCalled();
    expect(tx.jobApplication.update).not.toHaveBeenCalled();
    expect(tx.stageApproval.create).not.toHaveBeenCalled();
  });
  it.each([5, 6, 7, 8])('stage %s repeated approval is a no-op', (stageOrder) => {
    expect(stageDecisionIsRepeat({ currentStageOrder: 8, status: 'Hired' }, { stageOrder, status: 'Approved' }, true)).toBe(true);
  });
  it.each([1, 2, 3, 5, 6, 7, 8])('cannot reject or correct closed stage %s', (stageOrder) => {
    expect(() => stageDecisionIsRepeat({ currentStageOrder: 8, status: 'Hired' }, { stageOrder, status: 'Approved' }, false)).toThrow('cannot regress');
  });
  it('cannot approve a locked stage', () => {
    expect(() => stageDecisionIsRepeat({ currentStageOrder: 1, status: 'Under Review' }, { stageOrder: 2, status: 'Locked' }, true)).toThrow('cannot regress');
  });
});
