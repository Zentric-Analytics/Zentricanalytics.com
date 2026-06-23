import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  emailNotificationCreate: vi.fn(async ({ data }) => data),
  auditLogCreate: vi.fn(async ({ data }) => data),
}));

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    emailNotification: { create: mocks.emailNotificationCreate },
    auditLog: { create: mocks.auditLogCreate },
  },
}));

async function loadEmailModule() {
  vi.resetModules();
  return import('../src/lib/email');
}

describe('email provider abstraction', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    mocks.emailNotificationCreate.mockClear();
    mocks.auditLogCreate.mockClear();
  });

  it('uses console provider as fallback', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { sendHiringEmail } = await loadEmailModule();
    await expect(sendHiringEmail({ applicationId: 'app_1', to: 'ada@example.com', template: 'application-received', subject: 'Received', body: 'Body' })).resolves.toEqual({ provider: 'console', status: 'sent' });
    expect(info).toHaveBeenCalledWith('Hiring email delivery', expect.objectContaining({ provider: 'console', status: 'sent' }));
  });

  it('selects Resend when EMAIL_PROVIDER=resend and records provider response ID', async () => {
    vi.stubEnv('EMAIL_PROVIDER', 'resend');
    vi.stubEnv('RESEND_API_KEY', 'secret-key');
    vi.stubEnv('EMAIL_FROM', 'careers@example.com');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'email_123' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { sendAndRecordEmail } = await loadEmailModule();
    const record = await sendAndRecordEmail({ applicationId: 'app_1', to: 'ada@example.com', template: 'access-code', subject: 'Code', body: '123456' });
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer secret-key' }) }));
    expect(record).toMatchObject({ status: 'sent', providerMessageId: 'email_123' });
    expect(mocks.emailNotificationCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ status: 'sent', providerMessageId: 'email_123' }) });
  });

  it('records failed status when Resend API key is missing', async () => {
    vi.stubEnv('EMAIL_PROVIDER', 'resend');
    const { sendAndRecordEmail } = await loadEmailModule();
    const record = await sendAndRecordEmail({ applicationId: 'app_1', to: 'ada@example.com', template: 'access-code', subject: 'Code', body: '123456' });
    expect(record).toMatchObject({ status: 'failed', failureReason: 'RESEND_API_KEY is required when EMAIL_PROVIDER=resend' });
    expect(mocks.auditLogCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ metadata: expect.objectContaining({ status: 'failed', provider: 'resend' }) }) });
  });

  it('does not leak API keys in recorded failures or logs', async () => {
    vi.stubEnv('EMAIL_PROVIDER', 'resend');
    vi.stubEnv('RESEND_API_KEY', 'secret-key');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'bad secret-key token' }), { status: 401 })));
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { sendAndRecordEmail } = await loadEmailModule();
    const record = await sendAndRecordEmail({ applicationId: 'app_1', to: 'ada@example.com', template: 'access-code', subject: 'Code', body: '123456' });
    expect(record.failureReason).toBe('bad [redacted] token');
    expect(JSON.stringify(mocks.emailNotificationCreate.mock.calls)).not.toContain('secret-key');
    expect(JSON.stringify(info.mock.calls)).not.toContain('secret-key');
  });

  it('does not log one-time passcodes from email body', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { sendAndRecordEmail } = await loadEmailModule();
    await sendAndRecordEmail({ applicationId: 'app_1', to: 'ada@example.com', template: 'access-code', subject: 'Code', body: 'Your one-time access code is 123456.' });
    expect(JSON.stringify(info.mock.calls)).not.toContain('123456');
  });

});

describe('candidate email CTA links', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadTemplates() {
    vi.resetModules();
    return import('../src/lib/email-templates');
  }

  it('renders application received CTA links as absolute URLs when APP_BASE_URL is valid', async () => {
    vi.stubEnv('APP_BASE_URL', 'https://staging.zentricanalytics.com/');
    const { applicationReceivedEmail } = await loadTemplates();
    const email = applicationReceivedEmail({ applicationId: 'ZA-123', candidateName: 'Ada' });
    expect(email.html).toContain('href="https://staging.zentricanalytics.com/track"');
    expect(email.body).toContain('Track your application: https://staging.zentricanalytics.com/track');
    expect(email.html).not.toContain('href="/track"');
  });

  it('falls back to NEXT_PUBLIC_SITE_URL and trims trailing slashes for stage emails', async () => {
    vi.stubEnv('APP_BASE_URL', 'not-a-url');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.zentricanalytics.com///');
    const { stage2UnlockedEmail } = await loadTemplates();
    const email = stage2UnlockedEmail({ applicationId: 'ZA-123' });
    expect(email.html).toContain('href="https://www.zentricanalytics.com/track"');
    expect(email.body).toContain('https://www.zentricanalytics.com/track');
    expect(email.html).not.toContain('href="/track"');
  });

  it('renders access code verification links with preserved safe query params', async () => {
    vi.stubEnv('APP_BASE_URL', 'https://staging.zentricanalytics.com');
    const { accessCodeEmail } = await loadTemplates();
    const email = accessCodeEmail({ applicationId: 'ZA 123', accessCode: '123456' });
    expect(email.html).toContain('href="https://staging.zentricanalytics.com/track/verify?applicationId=ZA+123&amp;requested=1&amp;verified=0"');
    expect(email.body).toContain('Open verification page: https://staging.zentricanalytics.com/track/verify?applicationId=ZA+123&requested=1&verified=0');
    expect(email.html).not.toContain('href="/track');
  });

  it('omits CTA buttons and plain text links when no valid absolute base URL exists', async () => {
    vi.stubEnv('APP_BASE_URL', '/relative');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'ftp://zentricanalytics.com');
    const { applicationReceivedEmail, accessCodeEmail, stage2UnlockedEmail } = await loadTemplates();
    for (const email of [
      applicationReceivedEmail({ applicationId: 'ZA-123' }),
      accessCodeEmail({ applicationId: 'ZA-123', accessCode: '123456' }),
      stage2UnlockedEmail({ applicationId: 'ZA-123' }),
    ]) {
      expect(email.html).not.toContain('<a href=');
      expect(email.html).not.toContain('href="/track');
      expect(email.body).not.toContain('https://');
      expect(email.body).not.toContain('/track');
    }
  });
});
