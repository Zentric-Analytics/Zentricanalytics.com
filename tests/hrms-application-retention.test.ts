import { beforeEach, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { setApplicationDeleted } from '@/lib/hr/recruitment/record-retention';
const tx = {
  hrUser: { findFirstOrThrow: vi.fn() }, hrUserRole: { findFirst: vi.fn() },
  hrEmployee: { findUnique: vi.fn() }, jobApplication: { findFirstOrThrow: vi.fn(), updateMany: vi.fn() },
  applicationAccessCode: { deleteMany: vi.fn() }, auditLog: { create: vi.fn() },
};
const input = { applicationId: 'app', organizationId: 'org', actorUserId: 'actor', deleted: true, reason: 'Synthetic restart' };
const run = (deleted = true) => setApplicationDeleted(tx as unknown as Prisma.TransactionClient, { ...input, deleted });
beforeEach(() => {
  vi.resetAllMocks();
  tx.hrUser.findFirstOrThrow.mockResolvedValue({ id: 'actor', email: 'admin@example.test' });
  tx.hrUserRole.findFirst.mockResolvedValue({ id: 'role' });
  tx.jobApplication.findFirstOrThrow.mockResolvedValue({ id: 'app', version: 1, status: 'Screening', deletedAt: null });
  tx.jobApplication.updateMany.mockResolvedValue({ count: 1 });
});
it('scopes deletion to the active primary administrator and organization', async () => {
  await run();
  expect(tx.hrUser.findFirstOrThrow).toHaveBeenCalledWith({ where: { id: 'actor', organizationId: 'org', isPrimaryAdmin: true, status: 'ACTIVE' } });
  expect(tx.jobApplication.findFirstOrThrow).toHaveBeenCalledWith({ where: { id: 'app', organizationId: 'org' } });
  expect(tx.jobApplication.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'app', organizationId: 'org', version: 1 }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) }));
  expect(tx.applicationAccessCode.deleteMany).toHaveBeenCalledWith({ where: { applicationId: 'app' } });
  expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'Admin soft deleted application' }) });
});
it('rejects revoked administrator authority', async () => {
  tx.hrUserRole.findFirst.mockResolvedValue(null);
  await expect(run()).rejects.toThrow('primary administrator');
  expect(tx.jobApplication.updateMany).not.toHaveBeenCalled();
});
it('rejects cross-organization or non-primary actors', async () => {
  tx.hrUser.findFirstOrThrow.mockRejectedValue(new Error('No authorized actor'));
  await expect(run()).rejects.toThrow();
  expect(tx.jobApplication.updateMany).not.toHaveBeenCalled();
});
it('preserves employee-linked history', async () => {
  tx.hrEmployee.findUnique.mockResolvedValue({ id: 'employee' });
  await expect(run()).rejects.toThrow('retained');
  expect(tx.jobApplication.updateMany).not.toHaveBeenCalled();
});
it('rejects concurrent changes', async () => {
  tx.jobApplication.updateMany.mockResolvedValue({ count: 0 });
  await expect(run()).rejects.toThrow('concurrently');
  expect(tx.applicationAccessCode.deleteMany).not.toHaveBeenCalled();
});
it('restores without reviving old access codes', async () => {
  tx.jobApplication.findFirstOrThrow.mockResolvedValue({ id: 'app', version: 2, deletedAt: new Date() });
  await run(false);
  expect(tx.jobApplication.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deletedAt: null, restoredAt: expect.any(Date) }) }));
  expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'Admin restored application' }) });
});
