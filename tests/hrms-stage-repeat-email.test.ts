import { beforeEach, describe, expect, it, vi } from 'vitest';
const { sendAndRecordEmail } = vi.hoisted(() => ({ sendAndRecordEmail: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('NEXT_REDIRECT'); } }));
vi.mock('@/lib/hr/permissions/authorize', () => ({ requireAuthenticatedUser: async () => ({ user: { id: 'u', email: 'hr@example.test', organizationId: 'o' } }) }));
vi.mock('@/lib/hr/recruitment/stage-access', () => ({ assertRecruitmentStageAccess: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: async (fn: (tx: unknown) => unknown) => fn({}), jobApplication: { findUnique: async () => ({ id: 'a', applicationId: 'A', deletedAt: null, applicant: { email: 'candidate@example.test' } }) } } }));
vi.mock('@/lib/email', () => ({ sendAndRecordEmail }));
vi.mock('@/lib/workflow', async (original) => ({ ...(await original<typeof import('@/lib/workflow')>()),
  approveStage1: async () => ({ alreadyApproved: true }), approveStage2: async () => ({ alreadyApproved: true }), approveStage3: async () => ({ alreadyApproved: true }),
  recordAdminStage1Action: async () => ({ alreadySameStatus: true }), recordAdminStage2Action: async () => ({ alreadySameStatus: true }), recordAdminStage3Action: async () => ({ alreadySameStatus: true }),
}));
import { adminStage1Action, adminStage2Action, adminStage3Action } from '@/app/admin/applications/actions';
describe('repeated stage approvals do not resend unlock messages', () => {
  beforeEach(() => sendAndRecordEmail.mockClear());
  it.each([adminStage1Action, adminStage2Action, adminStage3Action])('does not notify again for a recorded negative decision', async act => {
    for (const decision of ['correction', 'reject']) {
      sendAndRecordEmail.mockClear();
      const form = new FormData(); form.set('applicationDbId', 'a'); form.set('action', decision);
      await expect(act(form)).rejects.toThrow('NEXT_REDIRECT');
      expect(sendAndRecordEmail).not.toHaveBeenCalled();
    }
  });
  it.each([adminStage1Action, adminStage2Action, adminStage3Action])('does not send email after repeat', async (act) => {
    const form = new FormData(); form.set('applicationDbId', 'a'); form.set('action', 'approve');
    await expect(act(form)).rejects.toThrow('NEXT_REDIRECT');
    expect(sendAndRecordEmail).not.toHaveBeenCalled();
  });
});
