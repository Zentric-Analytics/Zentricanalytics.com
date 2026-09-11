import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StageAuthorityError } from '@/lib/hr/recruitment/stage-authority-error';
import { StageSubmissionChangedError } from '@/lib/hr/recruitment/stage-submission-guard';

const mocks = vi.hoisted(() => ({ guard: vi.fn(), auth: vi.fn(), send: vi.fn(), read: vi.fn(), write: vi.fn(), redirect: vi.fn(), tx: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { mocks.redirect(url); throw new Error('NEXT_REDIRECT'); } }));
vi.mock('@/lib/hr/permissions/authorize', () => ({ requireAuthenticatedUser: mocks.auth }));
vi.mock('@/lib/hr/recruitment/stage-access', () => ({ assertRecruitmentStageAccess: mocks.guard }));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: mocks.tx, jobApplication: { findUnique: mocks.read } } }));
vi.mock('@/lib/email', () => ({ sendAndRecordEmail: mocks.send }));
import { adminStage1Action, adminStage2Action, adminStage3Action, adminStage6Action, adminStage7Action, adminStage8Action } from '@/app/admin/applications/actions';

describe('named HR authority denial feedback', () => {
  it.each([adminStage1Action, adminStage2Action, adminStage3Action, adminStage6Action, adminStage7Action, adminStage8Action])('preserves a stale-submission redirect without writes or mail', async action => {
    mocks.guard.mockRejectedValue(new StageSubmissionChangedError());
    const form = new FormData(); form.set('applicationDbId', 'app'); form.set('expectedSubmissionId', 'old'); form.set('action', 'correction');
    await expect(action(form)).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.redirect).toHaveBeenCalledWith(expect.stringContaining('error=stage_submission_changed'));
    expect(mocks.write).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'hr', email: 'hr@example.test', organizationId: 'org' } });
    mocks.tx.mockImplementation(async (run) => run({ $queryRaw: vi.fn().mockResolvedValue([{ id: 'app' }]), hiringStage: { update: mocks.write }, stageApproval: { create: mocks.write } }));
  });
  it.each([adminStage1Action, adminStage2Action, adminStage3Action, adminStage6Action, adminStage7Action, adminStage8Action])('redirects an old-page denial before loading or writing review data', async action => {
    mocks.guard.mockRejectedValue(new StageAuthorityError('Only the assigned HR person may review this stage.'));
    const form = new FormData(); form.set('applicationDbId', 'app');
    await expect(action(form)).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.redirect).toHaveBeenCalledWith(expect.stringContaining('error=stage_authority_changed'));
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it.each([[6, adminStage6Action], [7, adminStage7Action], [8, adminStage8Action]] as const)('handles reassignment during the Stage %i transaction without writes or mail', async (order, action) => {
    mocks.guard.mockResolvedValueOnce({}).mockRejectedValueOnce(new StageAuthorityError('Changed HR'));
    mocks.read.mockResolvedValue({ id: 'app', deletedAt: null, applicant: {}, stages: [{ id: 'stage', stageOrder: order, submissions: [] }] });
    const form = new FormData(); form.set('applicationDbId', 'app'); form.set('action', 'correction'); form.set('notes', 'Synthetic review note');
    await expect(action(form)).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.guard).toHaveBeenCalledTimes(2);
    expect(mocks.redirect).toHaveBeenCalledWith(expect.stringContaining('error=stage_authority_changed'));
    expect(mocks.write).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it('does not mislabel a database failure as lost authority', async () => {
    mocks.guard.mockRejectedValue(new Error('database unavailable'));
    const form = new FormData(); form.set('applicationDbId', 'app');
    await expect(adminStage6Action(form)).rejects.toThrow('database unavailable');
    expect(mocks.redirect).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it('preserves the sign-in redirect', async () => {
    mocks.auth.mockRejectedValue(new Error('NEXT_REDIRECT'));
    const form = new FormData(); form.set('applicationDbId', 'app');
    await expect(adminStage6Action(form)).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.guard).not.toHaveBeenCalled();
  });
});
