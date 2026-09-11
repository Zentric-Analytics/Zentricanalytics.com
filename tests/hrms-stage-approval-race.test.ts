import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ prisma: {} as Record<string, unknown>, send: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('NEXT_REDIRECT'); } }));
vi.mock('@/lib/hr/permissions/authorize', () => ({ requireAuthenticatedUser: async () => ({ user: { id: 'hr', email: 'hr@example.test', organizationId: 'org' } }) }));
vi.mock('@/lib/hr/recruitment/stage-access', () => ({ assertRecruitmentStageAccess: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/email', () => ({ sendAndRecordEmail: mocks.send }));
vi.mock('@/lib/hr/notifications/outbox', () => ({ enqueueHrEmail: vi.fn() }));
import { adminStage5Action, adminStage6Action, adminStage7Action } from '@/app/admin/applications/actions';

// Controlled ReadCommitted interleaving, not a PostgreSQL integration test.
// Without locking, both repeat reads finish before either approval write.
// With locking, the waiting caller sees the first caller's approved state.
describe('simultaneous stage approval preserves first successful decision', () => {
  it.each([
    [5, adminStage5Action, 'approve'], [6, adminStage6Action, 'approve'], [7, adminStage7Action, 'approve'],
    [5, adminStage5Action, 'correction'], [6, adminStage6Action, 'correction'], [7, adminStage7Action, 'correction'],
    [5, adminStage5Action, 'reject'], [6, adminStage6Action, 'reject'], [7, adminStage7Action, 'reject'],
  ] as const)(
    'Stage %i action %s decision %s records and notifies once', async (order, action, decision) => {
      mocks.send.mockReset().mockResolvedValue({ status: 'sent' });
      let reads = 0;
      let release!: () => void;
      const bothRead = new Promise<void>(resolve => { release = resolve; });
      let lockTail = Promise.resolve();
      let locks = 0;
      const current = { id: 'stage', stageOrder: order, status: 'Under Review', submissions: [{ signature: { confirmed: true } }] };
      const next = { id: 'next', stageOrder: order + 1, status: 'Locked', unlockedAt: null, submissions: [] };
      const app = { id: 'app', applicationId: 'TEST', vacancyId: 'vacancy', deletedAt: null, status: 'Final Review', currentStageOrder: order,
        applicant: { fullName: 'Synthetic Candidate', email: 'candidate@example.test' }, stages: [current, next] };
      const approval = vi.fn().mockResolvedValue({});
      const tx = {
        jobApplication: { findUniqueOrThrow: async () => ({ ...app }), update: vi.fn().mockResolvedValue({}) },
        hiringStage: {
          findFirstOrThrow: async () => { const snapshot = { ...current }; if (++reads === 2) release(); if (!locks) await bothRead; return snapshot; },
          update: vi.fn().mockImplementation(async ({ where, data }) => { if (where.id === current.id) Object.assign(current, data); return {}; }),
        },
        stageApproval: { create: approval }, auditLog: { create: vi.fn().mockResolvedValue({}) },
        hrRecruitmentOffer: { findFirst: async () => null },
        hrVacancy: { findFirstOrThrow: async () => ({ responsibleHrUserId: 'hr' }) },
        hrUser: { findFirstOrThrow: async () => ({ id: 'hr', email: 'hr@example.test' }) },
      };
      Object.assign(mocks.prisma, {
        $transaction: async (run: (client: typeof tx & { $queryRaw: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
          let unlock: (() => void) | undefined;
          const client = { ...tx, $queryRaw: vi.fn(async (_query, applicationId, organizationId) => {
            expect(applicationId).toBe('app'); expect(organizationId).toBe('org');
            const previous = lockTail;
            lockTail = new Promise<void>(resolve => { unlock = resolve; });
            await previous; locks++; return [{ id: 'app' }];
          }) };
          try { return await run(client); } finally { unlock?.(); }
        },
        jobApplication: { findUnique: async () => app },
      });
      const form = () => { const f = new FormData(); f.set('applicationDbId', 'app'); f.set('action', decision); f.set('notes', 'Synthetic race reproduction'); return f; };
      const results = await Promise.allSettled([action(form()), action(form())]);
      expect(results.every(r => r.status === 'rejected' && r.reason.message === 'NEXT_REDIRECT')).toBe(true);
      expect(reads).toBe(2);
      expect(locks).toBe(2);
      expect.soft(approval).toHaveBeenCalledTimes(1);
      expect.soft(mocks.send).toHaveBeenCalledTimes(1);
    },
  );
});
