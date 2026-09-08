import { beforeEach, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
vi.mock('@/lib/hr/audit', () => ({ appendHrAudit: vi.fn() }));
vi.mock('@/lib/hr/notifications/outbox', () => ({ enqueueHrEmail: vi.fn() }));
import { scheduleInterview } from '@/lib/hr/recruitment/interviews';
const id = 'cm1234567890123456789012';
const tx = {
  jobApplication: { findFirstOrThrow: vi.fn(), updateMany: vi.fn() },
  applicant: { findUniqueOrThrow: vi.fn() }, hrUser: { findMany: vi.fn() },
  hrRecruitmentOffer: { findUnique: vi.fn() }, offer: { findUnique: vi.fn() },
  hrInterview: { create: vi.fn() },
};
const input = { organizationId: id, applicationId: id, actorUserId: id, title: 'Synthetic test interview',
  startsAt: new Date('2030-01-01T10:00:00Z'), endsAt: new Date('2030-01-01T10:30:00Z'),
  timeZone: 'UTC', participantUserIds: [id] };
beforeEach(() => {
  vi.resetAllMocks();
  tx.jobApplication.findFirstOrThrow.mockResolvedValue({ id, applicantId: id, recruitmentStatus: 'INTERVIEW_PENDING', version: 1 });
  tx.jobApplication.updateMany.mockResolvedValue({ count: 1 });
  tx.hrUser.findMany.mockResolvedValue([{ id, email: 'interviewer@example.test' }]);
  tx.applicant.findUniqueOrThrow.mockResolvedValue({ email: 'candidate@example.test' });
  tx.hrInterview.create.mockResolvedValue({ id, version: 1 });
});
it.each(['SHORTLISTED', 'INTERVIEW_PENDING', 'FINAL_REVIEW'])('allows pre-offer scheduling from %s', async recruitmentStatus => {
  tx.jobApplication.findFirstOrThrow.mockResolvedValue({ id, applicantId: id, recruitmentStatus, version: 1 });
  await scheduleInterview(tx as unknown as Prisma.TransactionClient, input);
  expect(tx.jobApplication.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ version: 1, recruitmentStatus }), data: { recruitmentStatus: 'INTERVIEW_SCHEDULED', version: { increment: 1 } },
  }));
});
it.each(['PENDING_REVIEW', 'OFFER_ISSUED', 'REJECTED', 'WITHDRAWN', 'TRANSFERRED_TO_HR'])('blocks ineligible %s', async recruitmentStatus => {
  tx.jobApplication.findFirstOrThrow.mockResolvedValue({ id, recruitmentStatus });
  await expect(scheduleInterview(tx as unknown as Prisma.TransactionClient, input)).rejects.toThrow('eligible');
  expect(tx.hrInterview.create).not.toHaveBeenCalled();
});
it.each(['offer', 'hrRecruitmentOffer'] as const)('blocks an existing %s', async model => {
  tx[model].findUnique.mockResolvedValue({ id });
  await expect(scheduleInterview(tx as unknown as Prisma.TransactionClient, input)).rejects.toThrow('offer already exists');
  expect(tx.hrInterview.create).not.toHaveBeenCalled();
});
