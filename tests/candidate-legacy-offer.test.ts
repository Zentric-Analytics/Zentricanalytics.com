import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), query: vi.fn(), app: vi.fn(), stage: vi.fn(), offer: vi.fn(), update: vi.fn(), audit: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: mocks.transaction } }));
import { acceptOffer } from '@/lib/workflow';
beforeEach(() => {
  vi.resetAllMocks();
  const tx = { $queryRaw: mocks.query, jobApplication: { findUnique: mocks.app, update: mocks.update }, hiringStage: { findFirst: mocks.stage, update: mocks.update }, offer: { findUnique: mocks.offer, update: mocks.update }, auditLog: { create: mocks.audit } };
  mocks.transaction.mockImplementation(async run => run(tx));
  mocks.app.mockResolvedValue({ id: 'app', currentStageOrder: 4, status: 'Offer Pending', deletedAt: null });
  mocks.stage.mockImplementation(async ({ where }) => ({ id: `stage-${where.stageOrder}`, status: where.stageOrder === 4 ? 'Available' : 'Locked' }));
  mocks.offer.mockResolvedValue({ status: 'Released', offerExpiryDate: new Date(Date.now() + 60000) });
});
it('locks before authorization and any state read', async () => {
  const authorize = vi.fn(); await acceptOffer('app', undefined, authorize);
  expect(mocks.query.mock.calls[0][0].join('')).toContain('FOR UPDATE');
  expect(mocks.query.mock.invocationCallOrder[0]).toBeLessThan(authorize.mock.invocationCallOrder[0]);
  expect(authorize.mock.invocationCallOrder[0]).toBeLessThan(mocks.app.mock.invocationCallOrder[0]);
  expect(mocks.audit).toHaveBeenCalledTimes(1);
});
it.each(['Rejected', 'Withdrawn', 'Hired'])('cannot accept a %s application', async status => {
  mocks.app.mockResolvedValue({ id: 'app', currentStageOrder: 4, status });
  await expect(acceptOffer('app')).rejects.toThrow('closed'); expect(mocks.update).not.toHaveBeenCalled();
});
it('cannot reopen onboarding when an old acceptance request arrives late', async () => {
  mocks.app.mockResolvedValue({ id: 'app', currentStageOrder: 7, status: 'Final Review' });
  await expect(acceptOffer('app')).rejects.toThrow('closed'); expect(mocks.update).not.toHaveBeenCalled();
});
it('does not write when cookie authorization fails inside the transaction', async () => {
  await expect(acceptOffer('app', undefined, async () => { throw new Error('expired session'); })).rejects.toThrow('expired session');
  expect(mocks.app).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
});
