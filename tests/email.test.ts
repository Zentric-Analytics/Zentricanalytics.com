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
    vi.stubEnv('RENDER', 'true');
    vi.stubEnv('IS_PULL_REQUEST', 'false');
    vi.stubEnv('RENDER_SERVICE_ID', 'srv-d8s89fbeo5us73e7ljk0');
    vi.stubEnv('RENDER_SERVICE_TYPE', 'web');
    vi.stubEnv('RENDER_GIT_REPO_SLUG', 'Zentric-Analytics/Zentricanalytics.com');
    vi.stubEnv('RENDER_GIT_BRANCH', 'main');
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('APPLICATION_BASE_URL', 'https://www.zentricanalytics.com');
  });

  it('uses console provider as fallback', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { sendHiringEmail } = await loadEmailModule();
    await expect(sendHiringEmail({ applicationId: 'app_1', to: 'ada@example.com', template: 'application-received', subject: 'Received', body: 'Body' })).resolves.toEqual({ provider: 'console', status: 'simulated', invoked: false });
    expect(info).toHaveBeenCalledWith('Hiring email delivery', expect.objectContaining({ provider: 'console', status: 'simulated' }));
  });

  it('selects Resend when EMAIL_PROVIDER=resend and records provider response ID', async () => {
    vi.stubEnv('EMAIL_PROVIDER', 'resend');
    vi.stubEnv('RESEND_API_KEY', 'secret-key');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'email_123' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { sendAndRecordEmail } = await loadEmailModule();
    const record = await sendAndRecordEmail({ applicationId: 'app_1', to: 'ada@example.com', template: 'access-code', subject: 'Code', body: '123456' });
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer secret-key' }) }));
    const request = JSON.parse(String((fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[0]?.[1]?.body));
    expect(request).toMatchObject({
      from: 'Zentric Careers <careers@zentricanalytics.com>',
      reply_to: 'careers@zentricanalytics.com',
    });
    expect(record).toMatchObject({ status: 'sent', providerMessageId: 'email_123' });
    expect(mocks.emailNotificationCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ status: 'sent', providerMessageId: 'email_123' }) });
  });

  it('records failed status when Resend API key is missing', async () => {
    vi.stubEnv('EMAIL_PROVIDER', 'resend');
    const { sendAndRecordEmail } = await loadEmailModule();
    const record = await sendAndRecordEmail({ applicationId: 'app_1', to: 'ada@example.com', template: 'access-code', subject: 'Code', body: '123456' });
    expect(record).toMatchObject({ status: 'configuration_blocked', failureReason: 'EMAIL_PROVIDER_CONFIGURATION_REQUIRED' });
    expect(mocks.auditLogCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ metadata: expect.objectContaining({ status: 'configuration_blocked', provider: 'resend' }) }) });
  });

  it('does not leak API keys in recorded failures or logs', async () => {
    vi.stubEnv('EMAIL_PROVIDER', 'resend');
    vi.stubEnv('RESEND_API_KEY', 'secret-key');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'bad secret-key token' }), { status: 401 })));
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { sendAndRecordEmail } = await loadEmailModule();
    const record = await sendAndRecordEmail({ applicationId: 'app_1', to: 'ada@example.com', template: 'access-code', subject: 'Code', body: '123456' });
    expect(record.failureReason).toBe('EMAIL_PROVIDER_RESPONSE_401');
    expect(JSON.stringify(mocks.emailNotificationCreate.mock.calls)).not.toContain('secret-key');
    expect(JSON.stringify(info.mock.calls)).not.toContain('secret-key');
  });

  it('does not log one-time passcodes from email body', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { sendAndRecordEmail } = await loadEmailModule();
    await sendAndRecordEmail({ applicationId: 'app_1', to: 'ada@example.com', template: 'access-code', subject: 'Code', body: 'Your one-time access code is 123456.' });
    expect(JSON.stringify(info.mock.calls)).not.toContain('123456');
  });

  it('blocks a direct staging send before fetch when recipient is not approved', async () => {
    vi.stubEnv('EMAIL_PROVIDER','resend');vi.stubEnv('RESEND_API_KEY','synthetic-key');
    vi.stubEnv('RENDER_SERVICE_ID','srv-d8s6ovvavr4c73fctksg');vi.stubEnv('RENDER_GIT_BRANCH','dev');vi.stubEnv('APP_ENV','staging');vi.stubEnv('APPLICATION_BASE_URL','https://staging.zentricanalytics.com');vi.stubEnv('STAGING_EMAIL_RECIPIENT_ALLOWLIST','["tester@example.invalid"]');
    const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);
    const {sendHiringEmail}=await loadEmailModule();
    expect(await sendHiringEmail({applicationId:'app',to:'unapproved@gmail.com',template:'access-code',subject:'Synthetic'})).toMatchObject({status:'held',invoked:false});expect(fetchMock).not.toHaveBeenCalled();
  });
  it('unknown identity cannot use configured provider credentials', async () => {
    vi.stubEnv('EMAIL_PROVIDER','resend');vi.stubEnv('RESEND_API_KEY','synthetic-key');vi.stubEnv('RENDER_SERVICE_ID','unknown');const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);const {sendHiringEmail}=await loadEmailModule();expect(await sendHiringEmail({applicationId:'app',to:'candidate@gmail.com',template:'access-code',subject:'Synthetic'})).toMatchObject({status:'configuration_blocked',invoked:false});expect(fetchMock).not.toHaveBeenCalled();
  });
  it('an ambiguous provider response is not a confirmed failure', async () => {
    vi.stubEnv('EMAIL_PROVIDER','resend');vi.stubEnv('RESEND_API_KEY','synthetic-key');vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:503})));const {sendHiringEmail}=await loadEmailModule();expect(await sendHiringEmail({applicationId:'app',to:'candidate@gmail.com',template:'access-code',subject:'Synthetic'})).toMatchObject({status:'uncertain',invoked:true});
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
