import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/hr/permissions/authorize', () => ({ requireAuthenticatedUser: vi.fn() }));
vi.mock('@/lib/hr/recruitment/delegation', () => ({ assertVacancyCreatorOrDelegate: vi.fn() }));
import { assertRecruitmentStageAccess } from '@/lib/hr/recruitment/stage-access';
import { assertVacancyCreatorOrDelegate } from '@/lib/hr/recruitment/delegation';

function fixture(member = false, hr = 'hr') {
  return {
    jobApplication: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: 'app', vacancyId: 'vacancy' }) },
    hrUser: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: 'actor' }) },
    hrUserRole: { findFirst: vi.fn().mockResolvedValue({ role: { key: 'HR_ADMIN' } }) },
    hrVacancy: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: 'vacancy', hiringTeamId: 'team', responsibleHrUserId: hr }) },
    hrHiringTeamMember: { findFirst: vi.fn().mockResolvedValue(member ? { userId: 'actor' } : null) },
  };
}
const input = { applicationId: 'app', organizationId: 'org', actorUserId: 'actor', stage: 1 };
describe('preserved recruitment stage authority', () => {
  it('requires a scoped nondeleted application', async () => {
    const tx = fixture(true);
    await assertRecruitmentStageAccess(tx as never, input);
    expect(tx.jobApplication.findFirstOrThrow).toHaveBeenCalledWith({ where: { id: 'app', organizationId: 'org', deletedAt: null } });
  });
  it('fails closed for an unmapped legacy application', async () => {
    const tx = fixture(true); tx.jobApplication.findFirstOrThrow.mockResolvedValue({ id: 'app', vacancyId: null });
    await expect(assertRecruitmentStageAccess(tx as never, input)).rejects.toThrow('reviewed vacancy link');
  });
  it.each([1, 2, 3])('does not give blanket admin authority at stage %s', async (stage) => {
    await expect(assertRecruitmentStageAccess(fixture() as never, { ...input, stage })).rejects.toThrow('hiring-team member');
  });
  it.each([6, 7, 8])('requires the named HR person at stage %s', async (stage) => {
    await expect(assertRecruitmentStageAccess(fixture(true) as never, { ...input, stage })).rejects.toThrow('assigned HR');
    await expect(assertRecruitmentStageAccess(fixture(false, 'actor') as never, { ...input, stage })).resolves.toBeTruthy();
  });
  it('uses creator/delegate approval for offers', async () => {
    await assertRecruitmentStageAccess(fixture() as never, { ...input, stage: 4 });
    expect(assertVacancyCreatorOrDelegate).toHaveBeenCalled();
  });
  it('allows either team member or creator/delegate for agreement', async () => {
    await expect(assertRecruitmentStageAccess(fixture(true) as never, { ...input, stage: 5 })).resolves.toBeTruthy();
    await expect(assertRecruitmentStageAccess(fixture() as never, { ...input, stage: 5 })).resolves.toBeTruthy();
  });
  it('rejects unknown stages', async () => {
    await expect(assertRecruitmentStageAccess(fixture(true) as never, { ...input, stage: 9 })).rejects.toThrow('Invalid');
  });
  it.each([6, 7, 8])('denies revoked HR role even when still assigned at stage %s', async (stage) => {
    const tx = fixture(false, 'actor'); tx.hrUserRole.findFirst.mockResolvedValue(null);
    await expect(assertRecruitmentStageAccess(tx as never, { ...input, stage })).rejects.toThrow('retain an active');
  });
});
