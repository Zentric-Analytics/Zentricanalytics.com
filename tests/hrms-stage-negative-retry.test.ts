import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ prisma: {} as Record<string, unknown>, send: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('NEXT_REDIRECT'); } }));
vi.mock('@/lib/hr/permissions/authorize', () => ({ requireAuthenticatedUser: async () => ({ user: { id: 'hr', email: 'hr@example.test', organizationId: 'org' } }) }));
vi.mock('@/lib/hr/recruitment/stage-access', () => ({ assertRecruitmentStageAccess: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/email', () => ({ sendAndRecordEmail: mocks.send }));
import { adminStage1Action, adminStage2Action, adminStage3Action, adminStage5Action, adminStage6Action, adminStage7Action, adminStage8Action } from '@/app/admin/applications/actions';

describe('negative decision retries preserve the first result', () => {
  it.each([1, 2, 3, 5, 6, 7, 8])('does not repeat correction/rejection writes at Stage %i', async order => {
    for (const decision of ['correction', 'reject']) {
      mocks.send.mockReset().mockResolvedValue({ status: 'sent' });
      const stage = { id: 'stage', stageOrder: order, status: 'Under Review', submissions: [] };
      const app = { id: 'app', applicationId: 'TEST', deletedAt: null, currentStageOrder: order, status: 'Under Review', applicant: { fullName: 'Synthetic Candidate' }, stages: [stage] };
      const approval = vi.fn().mockResolvedValue({});
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: 'app' }]),
        jobApplication: { findUnique: async () => app, findUniqueOrThrow: async () => app, update: vi.fn().mockImplementation(async ({ data }) => Object.assign(app, data)) },
        hiringStage: { findFirst: async () => stage, findFirstOrThrow: async () => stage, update: vi.fn().mockImplementation(async ({ data }) => Object.assign(stage, data)) },
        stageApproval: { create: approval }, auditLog: { create: vi.fn().mockResolvedValue({}) },
      };
      Object.assign(mocks.prisma, { $transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx), jobApplication: { findUnique: async () => app } });
      const action = ({ 1: adminStage1Action, 2: adminStage2Action, 3: adminStage3Action, 5: adminStage5Action, 6: adminStage6Action, 7: adminStage7Action, 8: adminStage8Action })[order]!;
      for (let i = 0; i < 2; i++) {
        const form = new FormData(); form.set('applicationDbId', 'app'); form.set('action', decision); form.set('notes', 'Same synthetic decision');
        await expect(action(form)).rejects.toThrow('NEXT_REDIRECT');
      }
      expect(approval).toHaveBeenCalledTimes(1);
      expect(mocks.send).toHaveBeenCalledTimes(1);
      expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
      if (decision === 'correction') {
        // A candidate's new submission returns the stage to review.
        stage.status = 'Under Review';
        const form = new FormData(); form.set('applicationDbId', 'app'); form.set('action', decision); form.set('notes', 'Fresh review');
        await expect(action(form)).rejects.toThrow('NEXT_REDIRECT');
        expect(approval).toHaveBeenCalledTimes(2);
        expect(mocks.send).toHaveBeenCalledTimes(2);
      }
    }
  });
});
