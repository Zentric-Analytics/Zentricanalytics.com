import { beforeEach, describe, expect, it, vi } from 'vitest';
const { enqueueHrEmail } = vi.hoisted(() => ({ enqueueHrEmail: vi.fn() }));
vi.mock('@/lib/hr/notifications/outbox', () => ({ enqueueHrEmail }));
vi.mock('@/lib/hr/audit', () => ({ appendHrAudit: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
import { submitApplication } from '@/lib/hr/recruitment/applications';
const organizationId = 'cm00000000000000000000001';
const vacancyId = 'cm00000000000000000000002';
const now = new Date('2026-09-06T12:00:00Z');
const input = { organizationId, vacancyId, idempotencyKey: 'submission-key-0001', firstName: 'Test', lastName: 'Candidate', email: 'candidate@example.test', privacyConsent: true as const };
const member = (email: string, effectiveFrom = new Date('2026-01-01'), effectiveTo: Date | null = null, status = 'ACTIVE') => ({ status: 'ACTIVE', effectiveFrom, effectiveTo, user: { id: email, email, status } });
function fixture() {
  const vacancy = { id: vacancyId, status: 'OPEN', opensAt: null, applicationDeadline: null, filledOpenings: 0, numberOfOpenings: 2, title: 'Role', vacancyNumber: 'V1', hiringTeamId: 'team',
    hiringTeam: { members: [member('team@example.test'), member('future@example.test', new Date('2027-01-01')), member('ended@example.test', new Date('2026-01-01'), now), member('suspended@example.test', undefined, null, 'SUSPENDED')] },
    responsibleHrTeam: { members: [member('hr@example.test')] },
  };
  return {
    jobApplication: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'application', applicationId: 'APL1' }) },
    hrVacancy: { findFirstOrThrow: vi.fn().mockResolvedValue(vacancy) },
    applicant: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'candidate', fullName: 'Test Candidate' }) },
    hrRecruitmentNumberSequence: { upsert: vi.fn().mockResolvedValue({ lastValue: 1 }) },
    hiringStage: { createMany: vi.fn() }, hrApplicationStageHistory: { create: vi.fn() }, hrApplicationReviewTask: { create: vi.fn() },
  };
}
beforeEach(() => vi.clearAllMocks());
describe('alternate application submission preserves consolidated stage flow', () => {
  it('creates all eight stages and notifies only effective active hiring members', async () => {
    const tx = fixture();
    await submitApplication(tx as never, input, now);
    const rows = tx.hiringStage.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(8);
    expect(rows.map((r: { stageOrder: number }) => r.stageOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(rows[0].status).toBe('Under Review');
    expect(rows.slice(1).every((r: { status: string }) => r.status === 'Locked')).toBe(true);
    const notices = enqueueHrEmail.mock.calls.map((call) => call[1]);
    expect(notices.filter((n) => n.template === 'hr-new-application').map((n) => n.recipient)).toEqual(['team@example.test']);
    expect(notices.some((n) => n.recipient === 'hr@example.test')).toBe(false);
    expect(tx.hrVacancy.findFirstOrThrow.mock.calls[0][0].include.hiringTeam.include.members.where).toEqual({ status: 'ACTIVE' });
  });
  it('returns same-scope idempotent submission without duplicate stages or email', async () => {
    const tx = fixture(); const prior = { id: 'existing', organizationId, vacancyId };
    tx.jobApplication.findUnique.mockResolvedValue(prior);
    expect(await submitApplication(tx as never, input, now)).toBe(prior);
    expect(tx.hiringStage.createMany).not.toHaveBeenCalled();
    expect(enqueueHrEmail).not.toHaveBeenCalled();
  });
  it.each([{ organizationId: 'other', vacancyId }, { organizationId, vacancyId: 'other' }])('denies cross-scope idempotency reuse', async (scope) => {
    const tx = fixture(); tx.jobApplication.findUnique.mockResolvedValue({ id: 'existing', ...scope });
    await expect(submitApplication(tx as never, input, now)).rejects.toThrow('another application scope');
    expect(tx.jobApplication.create).not.toHaveBeenCalled();
    expect(enqueueHrEmail).not.toHaveBeenCalled();
  });
});
