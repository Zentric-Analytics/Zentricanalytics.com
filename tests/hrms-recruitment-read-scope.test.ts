import { beforeEach, describe, expect, it, vi } from 'vitest';
const { prisma, requireAuthenticatedUser } = vi.hoisted(() => ({
  prisma: { jobApplication: { findFirst: vi.fn(), findFirstOrThrow: vi.fn() }, hrVacancy: { findFirst: vi.fn(), findFirstOrThrow: vi.fn() }, hrHiringTeamMember: { findFirst: vi.fn() } },
  requireAuthenticatedUser: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ prisma }));
vi.mock('@/lib/hr/permissions/authorize', () => ({ requireAuthenticatedUser }));
import { recruitmentOversight, requireRecruitmentRead, canReadRecruitmentSensitive } from '@/lib/hr/recruitment/stage-access';
const auth = (primary = false, roles = ['ADMIN'], permissions: string[] = []) => ({ user: { id: 'user', organizationId: 'org', isPrimaryAdmin: primary }, roles, permissions: new Set(permissions) });
beforeEach(() => { vi.resetAllMocks(); requireAuthenticatedUser.mockResolvedValue(auth()); });
describe('recruitment read isolation', () => {
  it('limits secondary admin to own organization', async () => {
    expect((await recruitmentOversight()).where).toEqual({ organizationId: 'org' });
  });
  it('allows only primary admin reconciliation of unmapped history', async () => {
    requireAuthenticatedUser.mockResolvedValue(auth(true));
    expect((await recruitmentOversight()).where).toEqual({ OR: [{ organizationId: 'org' }, { organizationId: null }] });
  });
  it('never treats employee primary flag as admin authority', async () => {
    requireAuthenticatedUser.mockResolvedValue(auth(true, ['EMPLOYEE']));
    await expect(recruitmentOversight()).rejects.toThrow('admin role');
  });
  it('rejects application reads outside organization', async () => {
    prisma.jobApplication.findFirstOrThrow.mockRejectedValue(new Error('not found'));
    await expect(requireRecruitmentRead('outside')).rejects.toThrow('not found');
    expect(prisma.jobApplication.findFirstOrThrow).toHaveBeenCalledWith({ where: { id: 'outside', organizationId: 'org' } });
  });
  it('does not give hiring team onboarding-sensitive access', async () => {
    requireAuthenticatedUser.mockResolvedValue(auth(false, ['EMPLOYEE']));
    prisma.jobApplication.findFirstOrThrow.mockResolvedValue({ vacancyId: 'v' });
    prisma.hrVacancy.findFirstOrThrow.mockResolvedValue({ hiringTeamId: 't' });
    prisma.hrHiringTeamMember.findFirst.mockResolvedValue({ id: 'member' });
    prisma.jobApplication.findFirst.mockResolvedValue({ vacancyId: 'v' });
    prisma.hrVacancy.findFirst.mockResolvedValue(null);
    expect(await canReadRecruitmentSensitive('app')).toBe(false);
  });
  it('allows explicit sensitive permission only after scoped read', async () => {
    requireAuthenticatedUser.mockResolvedValue(auth(false, ['ADMIN'], ['document.read_sensitive']));
    prisma.jobApplication.findFirstOrThrow.mockResolvedValue({ vacancyId: 'v' });
    expect(await canReadRecruitmentSensitive('app')).toBe(true);
  });
  it('denies named HR sensitive access after HR role revocation', async () => {
    requireAuthenticatedUser.mockResolvedValue(auth(false, ['EMPLOYEE']));
    prisma.jobApplication.findFirstOrThrow.mockResolvedValue({ vacancyId: 'v' });
    prisma.hrVacancy.findFirstOrThrow.mockResolvedValue({ responsibleHrUserId: 'user' });
    prisma.hrVacancy.findFirst.mockResolvedValue({ responsibleHrUserId: 'user' });
    expect(await canReadRecruitmentSensitive('app')).toBe(false);
    expect(prisma.hrVacancy.findFirst).not.toHaveBeenCalled();
  });
});
