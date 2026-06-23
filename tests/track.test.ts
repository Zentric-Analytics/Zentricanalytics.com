import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirects: [] as string[],
  rateLimitCount: 0,
  jobApplicationFindUnique: vi.fn(),
  jobApplicationFindFirst: vi.fn(),
  accessCodeCreate: vi.fn(async ({ data }) => data),
  auditLogCreate: vi.fn(async ({ data }) => data),
  emailNotificationCreate: vi.fn(async ({ data }) => data),
  sendAndRecordEmail: vi.fn(async () => ({ status: 'sent' })),
}));

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers({ 'x-forwarded-for': '203.0.113.10' })) }));
vi.mock('next/navigation', () => ({ redirect: vi.fn((url: string) => { mocks.redirects.push(url); throw new Error(`redirect:${url}`); }) }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    rateLimitEvent: {
      count: vi.fn(async () => mocks.rateLimitCount),
      create: vi.fn(async ({ data }) => data),
    },
    jobApplication: { findUnique: mocks.jobApplicationFindUnique, findFirst: mocks.jobApplicationFindFirst },
    applicationAccessCode: { create: mocks.accessCodeCreate, findFirst: vi.fn(), update: vi.fn() },
    auditLog: { create: mocks.auditLogCreate },
    emailNotification: { create: mocks.emailNotificationCreate },
  },
}));
vi.mock('@/lib/email', () => ({ sendAndRecordEmail: mocks.sendAndRecordEmail }));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async ({ limit }) => ({ allowed: mocks.rateLimitCount < limit, keyHash: 'hashed-key', remaining: Math.max(0, limit - mocks.rateLimitCount - 1) })),
  hashRateLimitKey: vi.fn(() => 'hashed-key'),
}));
vi.mock('@/lib/access-code-config', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/access-code-config')>('../src/lib/access-code-config');
  return actual;
  it('candidate portal removes lower Stage 2 presentation while preserving backend action coverage', () => {
    const portal = readFileSync('src/app/track/portal/page.tsx', 'utf8');
    const button = readFileSync('src/app/track/portal/Stage2SubmitButton.tsx', 'utf8');
    expect(portal).not.toContain('stageOneApproved');
    expect(portal).not.toContain('Stage 2 unlocks after Stage 1 approval.');
    expect(portal).toContain("field('fullLegalName'");
    expect(portal).toContain('submitStage2');
    expect(portal).not.toContain('/uploads/${');
    expect(button).toContain('Submitting...');
    expect(button).toContain('Submit Stage 2');
  });

  it('candidate portal keeps only the top progress card and actionable offer decision UI', () => {
    const portal = readFileSync('src/app/track/portal/page.tsx', 'utf8');
    expect(portal).toContain('Application progress');
    expect(portal).toContain('Stage4Workspace');
    expect(portal).toContain('Accept Offer');
    expect(portal).toContain('Decline Offer');
    expect(portal).toContain('Application documents');
    expect(portal).toContain('Application stages');
  });

  it('Stage 2 server action creates submission, documents, signature, under-review status, and safe diagnostics', () => {
    const actions = readFileSync('src/app/track/actions.ts', 'utf8');
    expect(actions).toContain('export async function submitStage2');
    expect(actions).toContain('verifiedSessionTokenHash: sha256(session)');
    expect(actions).toContain('application: { deletedAt: null }');
    expect(actions).toContain("stage1?.status !== 'Approved'");
    expect(actions).toContain("stage2.status === 'Locked'");
    expect(actions).toContain("['Available', 'In Progress', 'Correction Requested'].includes(stage2.status)");
    expect(actions).toContain('savePrivateUpload');
    expect(actions).toContain('stageSubmission.create');
    expect(actions).toContain('uploadedDocument.create');
    expect(actions).toContain('applicantDocument.create');
    expect(actions).toContain('electronicSignature.create');
    expect(actions).toContain("status: 'Under Review'");
    expect(actions).toContain('deletePrivateUpload');
    const failureLogStart = actions.indexOf("stage2SubmissionFailure");
    const failureLog = actions.slice(failureLogStart, actions.indexOf('export async function submitStage3', failureLogStart));
    expect(failureLog).not.toContain('idNumber');
    expect(failureLog).not.toContain('storageKey');
  });

  it('admin can review Stage 2 and perform protected Stage 2 actions that unlock Stage 3', () => {
    const detail = readFileSync('src/app/admin/applications/[id]/page.tsx', 'utf8');
    const actions = readFileSync('src/app/admin/applications/actions.ts', 'utf8');
    const workflow = readFileSync('src/lib/workflow.ts', 'utf8');
    expect(detail).toContain('Stage 2 identity verification');
    expect(detail).toContain('Uploaded Stage 2 documents');
    expect(detail).toContain('idNumberMasked');
    expect(detail).toContain('adminStage2Action');
    expect(actions).toContain('export async function adminStage2Action');
    expect(actions).toContain('getAdminSession');
    expect(actions).toContain('app.deletedAt');
    expect(workflow).toContain('export async function approveStage2');
    expect(workflow).toContain('stageOrder: 3');
    expect(workflow).toContain("status: 'Available'");
    expect(workflow).toContain('currentStageOrder: 3');
    expect(workflow).toContain("Admin approved Stage 2");
    expect(actions).toContain('recordAdminStage2Action');
  });

  it('Stage 2 uploads stay private and admin upload route remains protected', () => {
    const storage = readFileSync('src/lib/storage.ts', 'utf8');
    const uploadRoute = readFileSync('src/app/api/admin/applications/[applicationId]/uploads/[documentId]/route.ts', 'utf8');
    expect(storage).toContain('ALLOWED_ID_DOCUMENT_MIME_TYPES');
    expect(storage).toContain('privateUploadRoot');
    expect(storage).not.toContain('public/');
    expect(uploadRoute).toContain('requireAdminSession');
    expect(uploadRoute).toContain('readPrivateUpload');
    expect(uploadRoute).not.toContain('storageKey: document.storageKey');
  });

});
vi.mock('@/lib/security', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/security')>('../src/lib/security');
  return { ...actual, randomDigits: vi.fn(() => '654321') };
  it('candidate portal removes lower Stage 2 presentation while preserving backend action coverage', () => {
    const portal = readFileSync('src/app/track/portal/page.tsx', 'utf8');
    const button = readFileSync('src/app/track/portal/Stage2SubmitButton.tsx', 'utf8');
    expect(portal).not.toContain('stageOneApproved');
    expect(portal).not.toContain('Stage 2 unlocks after Stage 1 approval.');
    expect(portal).toContain("field('fullLegalName'");
    expect(portal).toContain('submitStage2');
    expect(portal).not.toContain('/uploads/${');
    expect(button).toContain('Submitting...');
    expect(button).toContain('Submit Stage 2');
  });

  it('candidate portal keeps only the top progress card and actionable offer decision UI', () => {
    const portal = readFileSync('src/app/track/portal/page.tsx', 'utf8');
    expect(portal).toContain('Application progress');
    expect(portal).toContain('Stage4Workspace');
    expect(portal).toContain('Accept Offer');
    expect(portal).toContain('Decline Offer');
    expect(portal).toContain('Application documents');
    expect(portal).toContain('Application stages');
  });

  it('Stage 2 server action creates submission, documents, signature, under-review status, and safe diagnostics', () => {
    const actions = readFileSync('src/app/track/actions.ts', 'utf8');
    expect(actions).toContain('export async function submitStage2');
    expect(actions).toContain('verifiedSessionTokenHash: sha256(session)');
    expect(actions).toContain('application: { deletedAt: null }');
    expect(actions).toContain("stage1?.status !== 'Approved'");
    expect(actions).toContain("stage2.status === 'Locked'");
    expect(actions).toContain("['Available', 'In Progress', 'Correction Requested'].includes(stage2.status)");
    expect(actions).toContain('savePrivateUpload');
    expect(actions).toContain('stageSubmission.create');
    expect(actions).toContain('uploadedDocument.create');
    expect(actions).toContain('applicantDocument.create');
    expect(actions).toContain('electronicSignature.create');
    expect(actions).toContain("status: 'Under Review'");
    expect(actions).toContain('deletePrivateUpload');
    const failureLogStart = actions.indexOf("stage2SubmissionFailure");
    const failureLog = actions.slice(failureLogStart, actions.indexOf('export async function submitStage3', failureLogStart));
    expect(failureLog).not.toContain('idNumber');
    expect(failureLog).not.toContain('storageKey');
  });

  it('admin can review Stage 2 and perform protected Stage 2 actions that unlock Stage 3', () => {
    const detail = readFileSync('src/app/admin/applications/[id]/page.tsx', 'utf8');
    const actions = readFileSync('src/app/admin/applications/actions.ts', 'utf8');
    const workflow = readFileSync('src/lib/workflow.ts', 'utf8');
    expect(detail).toContain('Stage 2 identity verification');
    expect(detail).toContain('Uploaded Stage 2 documents');
    expect(detail).toContain('idNumberMasked');
    expect(detail).toContain('adminStage2Action');
    expect(actions).toContain('export async function adminStage2Action');
    expect(actions).toContain('getAdminSession');
    expect(actions).toContain('app.deletedAt');
    expect(workflow).toContain('export async function approveStage2');
    expect(workflow).toContain('stageOrder: 3');
    expect(workflow).toContain("status: 'Available'");
    expect(workflow).toContain('currentStageOrder: 3');
    expect(workflow).toContain("Admin approved Stage 2");
    expect(actions).toContain('recordAdminStage2Action');
  });

  it('Stage 2 uploads stay private and admin upload route remains protected', () => {
    const storage = readFileSync('src/lib/storage.ts', 'utf8');
    const uploadRoute = readFileSync('src/app/api/admin/applications/[applicationId]/uploads/[documentId]/route.ts', 'utf8');
    expect(storage).toContain('ALLOWED_ID_DOCUMENT_MIME_TYPES');
    expect(storage).toContain('privateUploadRoot');
    expect(storage).not.toContain('public/');
    expect(uploadRoute).toContain('requireAdminSession');
    expect(uploadRoute).toContain('readPrivateUpload');
    expect(uploadRoute).not.toContain('storageKey: document.storageKey');
  });

});

async function loadTrackActions() {
  vi.resetModules();
  return import('../src/app/track/actions');
}

function form(applicationId = 'ZA-APP-2026-00041', email = 'ada@example.com') {
  const data = new FormData();
  data.set('applicationId', applicationId);
  data.set('email', email);
  return data;
}

describe('track access-code flow', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    mocks.redirects.length = 0;
    mocks.rateLimitCount = 0;
    mocks.jobApplicationFindUnique.mockResolvedValue({ id: 'app_db_1', applicationId: 'ZA-APP-2026-00041', applicant: { email: 'ada@example.com' } });
    mocks.jobApplicationFindFirst.mockResolvedValue({ id: 'app_db_1', applicationId: 'ZA-APP-2026-00041', applicant: { email: 'ada@example.com' } });
    mocks.sendAndRecordEmail.mockResolvedValue({ status: 'sent' });
  });

  it('allows access-code requests under the configured limit', async () => {
    const { requestAccessCode } = await loadTrackActions();
    await expect(requestAccessCode(form())).rejects.toThrow('redirect:');
    expect(mocks.redirects.at(-1)).toContain('requested=1');
    expect(mocks.sendAndRecordEmail).toHaveBeenCalledOnce();
  });

  it('blocks access-code requests over the limit with safe limited status', async () => {
    mocks.rateLimitCount = 5;
    const { requestAccessCode } = await loadTrackActions();
    await expect(requestAccessCode(form())).rejects.toThrow('redirect:');
    expect(mocks.redirects.at(-1)).toContain('limited=1');
    expect(mocks.sendAndRecordEmail).not.toHaveBeenCalled();
    expect(mocks.auditLogCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'Access code request rate limited' }) });
  });

  it('keeps unknown application/email requests privacy-safe and generic', async () => {
    mocks.jobApplicationFindUnique.mockResolvedValue(null);
    mocks.jobApplicationFindFirst.mockResolvedValue(null);
    const { requestAccessCode } = await loadTrackActions();
    await expect(requestAccessCode(form('ZA-APP-2026-99999', 'unknown@example.com'))).rejects.toThrow('redirect:');
    expect(mocks.redirects.at(-1)).toContain('requested=1');
    expect(mocks.sendAndRecordEmail).not.toHaveBeenCalled();
  });

  it('returns safe error state when email recording fails for a matching application', async () => {
    mocks.sendAndRecordEmail.mockRejectedValue(new Error('provider unavailable'));
    const { requestAccessCode } = await loadTrackActions();
    await expect(requestAccessCode(form())).rejects.toThrow('redirect:');
    expect(mocks.redirects.at(-1)).toContain('error=1');
    expect(mocks.redirects.at(-1)).not.toContain('provider');
  });

  it('creates an access code and records/sends email for a matching application/email', async () => {
    const { requestAccessCode } = await loadTrackActions();
    await expect(requestAccessCode(form())).rejects.toThrow('redirect:');
    expect(mocks.accessCodeCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ applicationId: 'app_db_1', codeHash: expect.any(String), expiresAt: expect.any(Date) }) });
    expect(mocks.sendAndRecordEmail).toHaveBeenCalledWith(expect.objectContaining({ applicationId: 'app_db_1', to: 'ada@example.com', template: 'access-code' }));
    expect(mocks.auditLogCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'Access code requested' }) });
  });

  it('returns safe error state when Resend records a failed status', async () => {
    mocks.sendAndRecordEmail.mockResolvedValue({ status: 'failed' });
    const { requestAccessCode } = await loadTrackActions();
    await expect(requestAccessCode(form())).rejects.toThrow('redirect:');
    expect(mocks.redirects.at(-1)).toContain('error=1');
    expect(mocks.redirects.at(-1)).not.toContain('failed');
  });

  it('diagnostics never log the one-time code', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { requestAccessCode } = await loadTrackActions();
    await expect(requestAccessCode(form())).rejects.toThrow('redirect:');
    expect(JSON.stringify(info.mock.calls)).not.toContain('654321');
  });

  it('uses documented environment overrides for limits', async () => {
    vi.stubEnv('ACCESS_CODE_REQUEST_LIMIT', '7');
    vi.stubEnv('ACCESS_CODE_VERIFY_LIMIT', '4');
    vi.stubEnv('RATE_LIMIT_WINDOW_MS', '600000');
    const { accessCodeRateLimitConfig } = await import('../src/lib/access-code-config');
    expect(accessCodeRateLimitConfig.requestLimit()).toBe(7);
    expect(accessCodeRateLimitConfig.verifyLimit()).toBe(4);
    expect(accessCodeRateLimitConfig.windowMs()).toBe(600000);
  });
  it('candidate portal removes lower Stage 2 presentation while preserving backend action coverage', () => {
    const portal = readFileSync('src/app/track/portal/page.tsx', 'utf8');
    const button = readFileSync('src/app/track/portal/Stage2SubmitButton.tsx', 'utf8');
    expect(portal).not.toContain('stageOneApproved');
    expect(portal).not.toContain('Stage 2 unlocks after Stage 1 approval.');
    expect(portal).toContain("field('fullLegalName'");
    expect(portal).toContain('submitStage2');
    expect(portal).not.toContain('/uploads/${');
    expect(button).toContain('Submitting...');
    expect(button).toContain('Submit Stage 2');
  });

  it('candidate portal keeps only the top progress card and actionable offer decision UI', () => {
    const portal = readFileSync('src/app/track/portal/page.tsx', 'utf8');
    expect(portal).toContain('Application progress');
    expect(portal).toContain('Stage4Workspace');
    expect(portal).toContain('Accept Offer');
    expect(portal).toContain('Decline Offer');
    expect(portal).toContain('Application documents');
    expect(portal).toContain('Application stages');
  });

  it('Stage 2 server action creates submission, documents, signature, under-review status, and safe diagnostics', () => {
    const actions = readFileSync('src/app/track/actions.ts', 'utf8');
    expect(actions).toContain('export async function submitStage2');
    expect(actions).toContain('verifiedSessionTokenHash: sha256(session)');
    expect(actions).toContain('application: { deletedAt: null }');
    expect(actions).toContain("stage1?.status !== 'Approved'");
    expect(actions).toContain("stage2.status === 'Locked'");
    expect(actions).toContain("['Available', 'In Progress', 'Correction Requested'].includes(stage2.status)");
    expect(actions).toContain('savePrivateUpload');
    expect(actions).toContain('stageSubmission.create');
    expect(actions).toContain('uploadedDocument.create');
    expect(actions).toContain('applicantDocument.create');
    expect(actions).toContain('electronicSignature.create');
    expect(actions).toContain("status: 'Under Review'");
    expect(actions).toContain('deletePrivateUpload');
    const failureLogStart = actions.indexOf("stage2SubmissionFailure");
    const failureLog = actions.slice(failureLogStart, actions.indexOf('export async function submitStage3', failureLogStart));
    expect(failureLog).not.toContain('idNumber');
    expect(failureLog).not.toContain('storageKey');
  });

  it('admin can review Stage 2 and perform protected Stage 2 actions that unlock Stage 3', () => {
    const detail = readFileSync('src/app/admin/applications/[id]/page.tsx', 'utf8');
    const actions = readFileSync('src/app/admin/applications/actions.ts', 'utf8');
    const workflow = readFileSync('src/lib/workflow.ts', 'utf8');
    expect(detail).toContain('Stage 2 identity verification');
    expect(detail).toContain('Uploaded Stage 2 documents');
    expect(detail).toContain('idNumberMasked');
    expect(detail).toContain('adminStage2Action');
    expect(actions).toContain('export async function adminStage2Action');
    expect(actions).toContain('getAdminSession');
    expect(actions).toContain('app.deletedAt');
    expect(workflow).toContain('export async function approveStage2');
    expect(workflow).toContain('stageOrder: 3');
    expect(workflow).toContain("status: 'Available'");
    expect(workflow).toContain('currentStageOrder: 3');
    expect(workflow).toContain("Admin approved Stage 2");
    expect(actions).toContain('recordAdminStage2Action');
  });

  it('Stage 2 uploads stay private and admin upload route remains protected', () => {
    const storage = readFileSync('src/lib/storage.ts', 'utf8');
    const uploadRoute = readFileSync('src/app/api/admin/applications/[applicationId]/uploads/[documentId]/route.ts', 'utf8');
    expect(storage).toContain('ALLOWED_ID_DOCUMENT_MIME_TYPES');
    expect(storage).toContain('privateUploadRoot');
    expect(storage).not.toContain('public/');
    expect(uploadRoute).toContain('requireAdminSession');
    expect(uploadRoute).toContain('readPrivateUpload');
    expect(uploadRoute).not.toContain('storageKey: document.storageKey');
  });

});

describe('admin and track UI source checks', () => {
  it('admin dashboard pages use POST-safe logout controls without adminSecret query strings', () => {
    const list = readFileSync('src/app/admin/applications/page.tsx', 'utf8');
    const detail = readFileSync('src/app/admin/applications/[id]/page.tsx', 'utf8');
    const diagnostics = readFileSync('src/app/admin/tracking-diagnostics/page.tsx', 'utf8');
    const logoutButton = readFileSync('src/components/AdminLogoutButton.tsx', 'utf8');
    expect(`${list}\n${detail}\n${diagnostics}`).not.toContain('href="/admin/logout"');
    expect(`${list}\n${detail}`).not.toContain('adminSecret');
    expect(list).toContain('<AdminLogoutButton />');
    expect(detail).toContain('<AdminLogoutButton />');
    expect(diagnostics).toContain('<AdminLogoutButton />');
    expect(logoutButton).toContain('<form action={adminLogoutAction}>');
    expect(logoutButton).toContain('type="submit"');
  });

  it('admin logout is not triggered by GET and only POST/server action clears the session', () => {
    const route = readFileSync('src/app/admin/logout/route.ts', 'utf8');
    const action = readFileSync('src/app/admin/logout/actions.ts', 'utf8');
    const auth = readFileSync('src/lib/admin-auth.ts', 'utf8');
    const getBody = route.slice(route.indexOf('export async function GET'), route.indexOf('export async function POST'));
    const postBody = route.slice(route.indexOf('export async function POST'));
    expect(getBody).not.toContain('clearAdminSession');
    expect(getBody).toContain("redirect('/admin/applications')");
    expect(postBody).toContain('clearAdminSession');
    expect(action).toContain('clearAdminSession');
    expect(action).toContain("redirect('/admin/login')");
    expect(auth).toContain('maxAge: 0');
  });

  it('track flow separates access and verification passcode controls', () => {
    const page = readFileSync('src/app/track/page.tsx', 'utf8');
    const forms = readFileSync('src/app/track/TrackForms.tsx', 'utf8');
    const verifyPage = readFileSync('src/app/track/verify/page.tsx', 'utf8');
    const verifyForm = readFileSync('src/app/track/verify/VerifyCodeForm.tsx', 'utf8');
    expect(page).toContain('applicationId={params.applicationId}');
    expect(page).toContain('email={params.email}');
    expect(forms).toContain('Secure access');
    expect(forms).toContain('Send code');
    expect(forms).toContain('Sending...');
    expect(forms).toContain('If the details match Zentric Analytics records');
    expect(forms).not.toContain('One-time passcode');
    expect(forms).not.toContain('verifyAccessCode');
    expect(verifyPage).toContain("requested={params.requested === '1'}");
    expect(verifyForm).toContain('Enter your passcode');
    expect(verifyForm).toContain('One-time passcode');
    expect(verifyForm).toContain('Open portal');
    expect(verifyForm).toContain('Verifying...');
  });

  it('requested and failed verification states stay on the verify page', () => {
    const actions = readFileSync('src/app/track/actions.ts', 'utf8');
    const verifyForm = readFileSync('src/app/track/verify/VerifyCodeForm.tsx', 'utf8');
    expect(actions).toContain("status === 'requested' ? '/track/verify' : '/track'");
    expect(actions).toContain('function verifyUrl(applicationId: string, email: string)');
    expect(actions).toContain('const failedUrl = verifyUrl(applicationId, email);');
    expect(verifyForm).toContain('If the details match Zentric Analytics records, a code was sent.');
    expect(verifyForm).toContain('The code is invalid or expired.');
    expect(verifyForm).toContain('href="/track"');
  });

  it('admin tracking diagnostics are protected and omit OTP fields', () => {
    const diagnostics = readFileSync('src/app/admin/tracking-diagnostics/page.tsx', 'utf8');
    expect(diagnostics).toContain('getAdminSession');
    expect(diagnostics).toContain("redirect('/admin/login')");
    expect(diagnostics).toContain("template: 'access-code'");
    expect(diagnostics).not.toContain('codeHash');
    expect(diagnostics).not.toContain('session=');
  });


  it('admin soft delete, restore, and permanent delete controls are protected and explicit', () => {
    const schema = readFileSync('prisma/schema.prisma', 'utf8');
    const list = readFileSync('src/app/admin/applications/page.tsx', 'utf8');
    const detail = readFileSync('src/app/admin/applications/[id]/page.tsx', 'utf8');
    const deleted = readFileSync('src/app/admin/applications/deleted/page.tsx', 'utf8');
    const actions = readFileSync('src/app/admin/applications/actions.ts', 'utf8');
    expect(schema).toContain('deletedAt');
    expect(schema).toContain('deletedByAdminEmail');
    expect(schema).toContain('deleteReason');
    expect(list).toContain('deletedAt: null');
    expect(list).toContain('Deleted applications');
    expect(deleted).toContain('where: { deletedAt: { not: null } }');
    expect(detail).toContain('Move to deleted records');
    expect(detail).toContain('Permanently delete');
    expect(actions).toContain('getAdminSession');
    expect(actions).toContain('softDeleteApplicationAction');
    expect(actions).toContain('restoreApplicationAction');
    expect(actions).toContain('permanentlyDeleteApplicationAction');
    expect(actions).toContain("confirmation !== 'DELETE'");
    expect(actions).toContain('app.applicationId !== typedPublicId');
    expect(actions).toContain('deletePrivateUpload');
    expect(actions).toContain('Admin soft deleted application');
    expect(actions).toContain('Admin restored application');
  });

  it('candidate tracking and portal ignore soft-deleted applications', () => {
    const actions = readFileSync('src/app/track/actions.ts', 'utf8');
    const portal = readFileSync('src/app/track/portal/page.tsx', 'utf8');
    expect(actions).toContain('deletedAt: null');
    expect(portal).toContain('application: { deletedAt: null }');
  });

  it('permanent delete diagnostics avoid private fields and storage keys', () => {
    const actions = readFileSync('src/app/admin/applications/actions.ts', 'utf8');
    const diagnosticStart = actions.indexOf("adminAction: 'permanent_delete_application'");
    const diagnosticBlock = actions.slice(diagnosticStart, actions.indexOf('const adminSession', diagnosticStart));
    expect(diagnosticBlock).toContain('applicationPublicIdPresent');
    expect(diagnosticBlock).toContain('privateFilesDeleted');
    expect(diagnosticBlock).not.toContain('email');
    expect(diagnosticBlock).not.toContain('storageKey');
    expect(diagnosticBlock).not.toContain('token');
  });

  it('candidate portal removes lower Stage 2 presentation while preserving backend action coverage', () => {
    const portal = readFileSync('src/app/track/portal/page.tsx', 'utf8');
    const button = readFileSync('src/app/track/portal/Stage2SubmitButton.tsx', 'utf8');
    expect(portal).not.toContain('stageOneApproved');
    expect(portal).not.toContain('Stage 2 unlocks after Stage 1 approval.');
    expect(portal).toContain("field('fullLegalName'");
    expect(portal).toContain('submitStage2');
    expect(portal).not.toContain('/uploads/${');
    expect(button).toContain('Submitting...');
    expect(button).toContain('Submit Stage 2');
  });

  it('candidate portal keeps only the top progress card and actionable offer decision UI', () => {
    const portal = readFileSync('src/app/track/portal/page.tsx', 'utf8');
    expect(portal).toContain('Application progress');
    expect(portal).toContain('Stage4Workspace');
    expect(portal).toContain('Accept Offer');
    expect(portal).toContain('Decline Offer');
    expect(portal).toContain('Application documents');
    expect(portal).toContain('Application stages');
  });

  it('Stage 2 server action creates submission, documents, signature, under-review status, and safe diagnostics', () => {
    const actions = readFileSync('src/app/track/actions.ts', 'utf8');
    expect(actions).toContain('export async function submitStage2');
    expect(actions).toContain('verifiedSessionTokenHash: sha256(session)');
    expect(actions).toContain('application: { deletedAt: null }');
    expect(actions).toContain("stage1?.status !== 'Approved'");
    expect(actions).toContain("stage2.status === 'Locked'");
    expect(actions).toContain("['Available', 'In Progress', 'Correction Requested'].includes(stage2.status)");
    expect(actions).toContain('savePrivateUpload');
    expect(actions).toContain('stageSubmission.create');
    expect(actions).toContain('uploadedDocument.create');
    expect(actions).toContain('applicantDocument.create');
    expect(actions).toContain('electronicSignature.create');
    expect(actions).toContain("status: 'Under Review'");
    expect(actions).toContain('deletePrivateUpload');
    const failureLogStart = actions.indexOf("stage2SubmissionFailure");
    const failureLog = actions.slice(failureLogStart, actions.indexOf('export async function submitStage3', failureLogStart));
    expect(failureLog).not.toContain('idNumber');
    expect(failureLog).not.toContain('storageKey');
  });

  it('admin can review Stage 2 and perform protected Stage 2 actions that unlock Stage 3', () => {
    const detail = readFileSync('src/app/admin/applications/[id]/page.tsx', 'utf8');
    const actions = readFileSync('src/app/admin/applications/actions.ts', 'utf8');
    const workflow = readFileSync('src/lib/workflow.ts', 'utf8');
    expect(detail).toContain('Stage 2 identity verification');
    expect(detail).toContain('Uploaded Stage 2 documents');
    expect(detail).toContain('idNumberMasked');
    expect(detail).toContain('adminStage2Action');
    expect(actions).toContain('export async function adminStage2Action');
    expect(actions).toContain('getAdminSession');
    expect(actions).toContain('app.deletedAt');
    expect(workflow).toContain('export async function approveStage2');
    expect(workflow).toContain('stageOrder: 3');
    expect(workflow).toContain("status: 'Available'");
    expect(workflow).toContain('currentStageOrder: 3');
    expect(workflow).toContain("Admin approved Stage 2");
    expect(actions).toContain('recordAdminStage2Action');
  });

  it('Stage 2 uploads stay private and admin upload route remains protected', () => {
    const storage = readFileSync('src/lib/storage.ts', 'utf8');
    const uploadRoute = readFileSync('src/app/api/admin/applications/[applicationId]/uploads/[documentId]/route.ts', 'utf8');
    expect(storage).toContain('ALLOWED_ID_DOCUMENT_MIME_TYPES');
    expect(storage).toContain('privateUploadRoot');
    expect(storage).not.toContain('public/');
    expect(uploadRoute).toContain('requireAdminSession');
    expect(uploadRoute).toContain('readPrivateUpload');
    expect(uploadRoute).not.toContain('storageKey: document.storageKey');
  });

});
