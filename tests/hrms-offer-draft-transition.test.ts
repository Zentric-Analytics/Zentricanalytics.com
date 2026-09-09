import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ prisma: {} as Record<string, unknown>, access: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/hr/permissions/authorize', () => ({ requireAuthenticatedUser: async () => ({ user: { id: 'actor', organizationId: 'org' }, roles: ['HR_ADMIN'] }) }));
vi.mock('@/lib/hr/recruitment/stage-access', () => ({ assertRecruitmentStageAccess: mocks.access }));
vi.mock('@/lib/hr/notifications/outbox', () => ({ enqueueHrEmail: vi.fn() }));
import { transitionApplicationWithStateAction } from '@/app/hr/admin/applications/[id]/actions';
import { enqueueHrEmail } from '@/lib/hr/notifications/outbox';
function fixture(from = 'OFFER_PENDING_APPROVAL', count = 1) {
  const tx = { jobApplication: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: 'cm1234567890123456789012', recruitmentStatus: from, version: 3 }), updateMany: vi.fn().mockResolvedValue({ count }) }, hrApplicationStageHistory: { create: vi.fn() }, hrAuditEvent: { create: vi.fn() } };
  mocks.prisma.$transaction = async (run: (client: typeof tx) => Promise<unknown>) => run(tx);
  const form = new FormData();
  Object.entries({ applicationId: 'cm1234567890123456789012', expectedVersion: '3', to: 'OFFER_DRAFT', reason: 'Synthetic unsent revision' }).forEach(([k,v]) => form.set(k,v));
  return { tx, form };
}
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue(undefined); });
it.each(['FINAL_REVIEW', 'OFFER_PENDING_APPROVAL'])('allows the existing %s to draft transition through the action', async from => {
  const { tx, form } = fixture(from);
  expect(await transitionApplicationWithStateAction({ status: 'idle' }, form)).toMatchObject({ status: 'success' });
  expect(mocks.access).toHaveBeenCalledWith(tx, expect.objectContaining({ stage: 3, organizationId: 'org' }));
  expect(tx.jobApplication.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ version: 3, organizationId: 'org' }), data: expect.objectContaining({ recruitmentStatus: 'OFFER_DRAFT' }) }));
  expect(tx.hrApplicationStageHistory.create).toHaveBeenCalledOnce();
  expect(enqueueHrEmail).not.toHaveBeenCalled();
});
it.each(['PENDING_REVIEW', 'OFFER_ISSUED', 'OFFER_ACCEPTED', 'TRANSFERRED_TO_HR'])('does not permit draft transition from %s', async from => {
  const { tx, form } = fixture(from);
  expect(await transitionApplicationWithStateAction({ status: 'idle' }, form)).toMatchObject({ status: 'error' });
  expect(tx.jobApplication.updateMany).not.toHaveBeenCalled();
});
it('retains authority checks', async () => {
  const { tx, form } = fixture(); mocks.access.mockRejectedValueOnce(new Error('Forbidden'));
  expect(await transitionApplicationWithStateAction({ status: 'idle' }, form)).toMatchObject({ status: 'error' });
  expect(tx.jobApplication.updateMany).not.toHaveBeenCalled();
});
it('retains stale version protection without history or mail', async () => {
  const { tx, form } = fixture('OFFER_PENDING_APPROVAL', 0);
  expect(await transitionApplicationWithStateAction({ status: 'idle' }, form)).toMatchObject({ status: 'error' });
  expect(tx.hrApplicationStageHistory.create).not.toHaveBeenCalled();
  expect(enqueueHrEmail).not.toHaveBeenCalled();
});
