import { describe, it, expect, vi } from 'vitest';
const { tx } = vi.hoisted(() => ({ tx: { jobApplication: { findUnique: vi.fn() } } }));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: (fn: (client: unknown) => unknown) => fn(tx) } }));
import { approveStage1, approveStage2, approveStage3, recordAdminStage1Action, recordAdminStage2Action, recordAdminStage3Action } from '@/lib/workflow';

describe('stage authorization inside mutation transaction', () => {
  it.each([approveStage1, approveStage2, approveStage3])('checks authorization before approval reads or writes', async (approve) => {
    const guard = vi.fn().mockRejectedValue(new Error('revoked'));
    await expect(approve('app', 'actor@example.test', '', guard)).rejects.toThrow('revoked');
    expect(guard).toHaveBeenCalledWith(tx);
    expect(tx.jobApplication.findUnique).not.toHaveBeenCalled();
  });
  it.each([recordAdminStage1Action, recordAdminStage2Action, recordAdminStage3Action])('checks authorization before correction or rejection', async (decide) => {
    const guard = vi.fn().mockRejectedValue(new Error('revoked'));
    await expect(decide('app', 'Rejected', 'actor@example.test', '', guard)).rejects.toThrow('revoked');
    expect(guard).toHaveBeenCalledWith(tx);
  });
});
