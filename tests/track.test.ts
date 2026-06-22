import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirects: [] as string[],
  rateLimitCount: 0,
  jobApplicationFindUnique: vi.fn(),
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
    jobApplication: { findUnique: mocks.jobApplicationFindUnique },
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
});
vi.mock('@/lib/security', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/security')>('../src/lib/security');
  return { ...actual, randomDigits: vi.fn(() => '654321') };
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
    const { requestAccessCode } = await loadTrackActions();
    await expect(requestAccessCode(form('ZA-APP-2026-99999', 'unknown@example.com'))).rejects.toThrow('redirect:');
    expect(mocks.redirects.at(-1)).toContain('requested=1');
    expect(mocks.sendAndRecordEmail).not.toHaveBeenCalled();
  });

  it('does not crash request flow when email recording fails', async () => {
    mocks.sendAndRecordEmail.mockRejectedValue(new Error('provider unavailable'));
    const { requestAccessCode } = await loadTrackActions();
    await expect(requestAccessCode(form())).rejects.toThrow('redirect:');
    expect(mocks.redirects.at(-1)).toContain('requested=1');
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
});

describe('admin and track UI source checks', () => {
  it('admin dashboard pages include logout links without adminSecret query strings', () => {
    const list = readFileSync('src/app/admin/applications/page.tsx', 'utf8');
    const detail = readFileSync('src/app/admin/applications/[id]/page.tsx', 'utf8');
    expect(list).toContain('href="/admin/logout"');
    expect(detail).toContain('href="/admin/logout"');
    expect(`${list}\n${detail}`).not.toContain('adminSecret');
  });

  it('admin logout route clears the admin session', () => {
    const route = readFileSync('src/app/admin/logout/route.ts', 'utf8');
    const auth = readFileSync('src/lib/admin-auth.ts', 'utf8');
    expect(route).toContain('clearAdminSession');
    expect(route).toContain("redirect('/admin/login')");
    expect(auth).toContain('maxAge: 0');
  });

  it('track form keeps application ID/email after request and has pending button labels', () => {
    const page = readFileSync('src/app/track/page.tsx', 'utf8');
    const forms = readFileSync('src/app/track/TrackForms.tsx', 'utf8');
    expect(page).toContain('applicationId={params.applicationId}');
    expect(page).toContain('email={params.email}');
    expect(forms).toContain('Sending...');
    expect(forms).toContain('Verifying...');
    expect(forms).toContain('If your details match our records, an access code will be sent.');
  });
});
