import { describe, expect, it } from 'vitest';
import { candidateEmailTemplates } from '../src/lib/email-templates';

describe('candidate email templates', () => {
  it('builds branded application received email with text and html', () => {
    const email = candidateEmailTemplates.applicationReceived({ applicationId: 'ZA-2026-0001', applicantName: 'Ada Lovelace', portalUrl: 'https://example.com/track' });
    expect(email.subject).toBe('Application received: ZA-2026-0001');
    expect(email.body).toContain('Thank you for applying to Zentric Analytics');
    expect(email.html).toContain('Zentric Analytics LTD');
    expect(email.html).toContain('https://example.com/track');
  });

  it('keeps access code content clear without application details', () => {
    const email = candidateEmailTemplates.accessCode({ code: '123456', portalUrl: 'https://example.com/verify' });
    expect(email.subject).toBe('Your Zentric Analytics access code');
    expect(email.body).toContain('123456');
    expect(email.body).toContain('expires in 10 minutes');
    expect(email.body).not.toContain('Application ID');
    expect(email.html).toContain('One-time code: 123456');
  });
});
