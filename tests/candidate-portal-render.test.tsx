import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { stages } from '@/lib/hiring';
import { stageCardActionLabel } from '@/lib/candidate-portal-state';
import { PortalFeedback } from '@/app/track/portal/PortalFeedback';
import { candidateUploadsTooLarge, CANDIDATE_TOTAL_UPLOAD_BYTES } from '@/lib/candidate-upload-limits';

const mocks = vi.hoisted(() => ({ access: vi.fn(), offer: vi.fn(), token: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  applicationAccessCode: { findFirst: mocks.access }, hrRecruitmentOffer: { findUnique: mocks.offer },
  hrRecruitmentHandover: { findFirst: async () => null }, hrAssessment: { findMany: async () => [] },
} }));
vi.mock('@/lib/candidate-session', () => ({ candidateSessionToken: mocks.token }));
vi.mock('@/lib/hr/recruitment/candidate-interviews', () => ({ loadCandidateInterviews: async () => [] }));
vi.mock('@/app/track/actions', () => ({ submitStage2: vi.fn(), submitStage3: vi.fn(), submitStage5: vi.fn(), submitStage6: vi.fn(), submitStage7: vi.fn(), submitOfferDecision: vi.fn(), submitGovernedDocumentReplacement: vi.fn(), signOutCandidate: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock('@/components/PageShell', () => ({ PageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('@/components/Section', () => ({ Section: ({ children }: { children: React.ReactNode }) => <section>{children}</section> }));
import Portal from '@/app/track/portal/page';
const application = (order = 2) => ({ id: 'app', applicationId: 'SYNTHETIC-001', organizationId: null,
  applicant: { fullName: 'Synthetic Candidate', email: 'candidate@example.invalid' }, roleAppliedFor: 'Engineer',
  currentStageOrder: order, status: 'Candidate Information Required', offer: null, employmentAgreement: null, documents: [],
  stages: stages.map(stage => ({ id: `stage-${stage.order}`, stageKey: stage.key, stageOrder: stage.order,
    status: stage.order < order ? 'Approved' : stage.order === order ? 'Available' : 'Locked', submissions: [], metadata: null })),
});
beforeEach(() => {
  vi.clearAllMocks(); mocks.token.mockResolvedValue('secret-cookie-token');
  mocks.access.mockResolvedValue({ application: application() }); mocks.offer.mockResolvedValue(null);
});
async function render(params: { stage?: string; error?: string; success?: string; session?: string } = {}) {
  return renderToStaticMarkup(await Portal({ searchParams: Promise.resolve(params) }));
}
it('renders the actionable workspace before progress and never emits session credentials', async () => {
  const html = await render();
  expect(html.indexOf('id="selected-stage-title"')).toBeLessThan(html.indexOf('id="portal-progress-title"'));
  expect(html).toContain('role="progressbar"'); expect(html).toContain('aria-valuenow="13"');
  expect(html).toContain('name="fullLegalName"'); expect(html).toContain('Submit Stage 2');
  expect(html).not.toContain('secret-cookie-token'); expect(html).not.toContain('name="session"'); expect(html).not.toContain('?session=');
  expect(html).toContain('/track/portal?stage=1#selected-stage-title');
});
it.each(['stage2_validation', 'stage3_submit_failed', 'replacement_file_invalid', 'offer_expired', 'stage5_not_open', 'unexpected'])('renders safe feedback for %s', async error => {
  const html = await render({ error }); expect(html).toContain('role="alert"'); expect(html).not.toContain(`>${error}<`);
});
it('renders explicit submission confirmation', async () => {
  expect(await render({ success: 'stage2_submitted' })).toContain('Your candidate information has been submitted for review.');
});
it('keeps rejected stages selectable and labels their action truthfully', async () => {
  const app = application(); app.stages[2].status = 'Rejected'; mocks.access.mockResolvedValue({ application: app });
  expect(await render()).toContain('View decision');
  expect(stageCardActionLabel('Rejected', false)).toBe('View decision');
  expect(stageCardActionLabel('Locked', false)).toBe('Locked');
});
it('shows expiry recovery without querying candidate data when cookie is missing', async () => {
  mocks.token.mockResolvedValue(''); const html = await render();
  expect(html).toContain('Request passcode'); expect(mocks.access).not.toHaveBeenCalled();
});
it('strips legacy query tokens instead of accepting or rendering them', async () => {
  await expect(render({ session: 'legacy-secret' })).rejects.toThrow('redirect:/track/portal');
  expect(mocks.access).not.toHaveBeenCalled();
});
it.each(['ISSUED', 'DECLINED', 'ACCEPTED'])('preserves the %s offer lifecycle without hiding post-acceptance stages', async status => {
  mocks.offer.mockResolvedValue({ status, activeVersion: { id: 'v1', version: 1, positionTitle: 'Engineer', currency: 'USD', salary: 10, payFrequency: 'MONTHLY', workMode: 'REMOTE', terms: { text: 'Synthetic terms' } } });
  const html = await render();
  expect(html.includes('id="selected-stage-title"')).toBe(status === 'ACCEPTED');
  expect(html).not.toContain('Â'); expect(html).not.toContain('percentages are hidden once');
});
it('escapes unknown feedback instead of reflecting arbitrary text', () => {
  expect(renderToStaticMarkup(<PortalFeedback error="<script>secret</script>" />)).not.toContain('secret');
});
it('accepts the combined limit and rejects two individually valid oversized uploads', () => {
  const form = new FormData(); form.set('one', new File([new Uint8Array(12 * 1024 * 1024)], 'one.pdf'));
  form.set('two', new File([new Uint8Array(12 * 1024 * 1024)], 'two.pdf'));
  expect(candidateUploadsTooLarge(form)).toBe(false);
  form.set('three', new File(['x'], 'three.pdf')); expect(candidateUploadsTooLarge(form)).toBe(true);
  expect(CANDIDATE_TOTAL_UPLOAD_BYTES).toBeLessThan(25 * 1024 * 1024);
});
