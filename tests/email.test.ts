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
