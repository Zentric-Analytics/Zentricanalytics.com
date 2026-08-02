import { prisma } from './prisma';
import { maskEmail, maskGeneric } from './security';
import { resolveEmailSender } from './email-senders';

export type EmailEvent = {
  to: string;
  subject: string;
  applicationId: string;
  portalUrl?: string;
  template: string;
  body?: string;
  html?: string;
};

type EmailSendResult = {
  provider: 'console' | 'resend';
  status: 'sent' | 'failed';
  providerMessageId?: string;
  failureReason?: string;
};

const RESEND_EMAIL_URL = 'https://api.resend.com/emails';
function selectedProvider() {
  return process.env.EMAIL_PROVIDER === 'resend' ? 'resend' : 'console';
}

function safeFailureReason(error: unknown) {
  const apiKey = process.env.RESEND_API_KEY;
  const message = error instanceof Error ? error.message : String(error || 'Unknown email provider error');
  return apiKey ? message.split(apiKey).join('[redacted]') : message;
}

function textToHtml(text: string) {
  return `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />')}</p>`;
}

async function sendConsoleEmail(event: EmailEvent): Promise<EmailSendResult> {
  const sender = resolveEmailSender(event.template);
  console.info('Hiring email delivery', {
    provider: 'console',
    status: 'sent',
    to: maskEmail(event.to),
    subject: event.subject,
    applicationId: maskGeneric(event.applicationId),
    template: event.template,
    senderCategory: sender.category,
  });
  return { provider: 'console', status: 'sent' };
}

async function sendResendEmail(event: EmailEvent): Promise<EmailSendResult> {
  const sender = resolveEmailSender(event.template);
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { provider: 'resend', status: 'failed', failureReason: 'RESEND_API_KEY is required when EMAIL_PROVIDER=resend' };

  try {
    const response = await fetch(RESEND_EMAIL_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: sender.from,
        reply_to: sender.replyTo,
        to: [event.to],
        subject: event.subject,
        text: event.body ?? '',
        html: event.html ?? (event.body ? textToHtml(event.body) : undefined),
      }),
    });
    const payload = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string; error?: string };
    if (!response.ok) {
      const providerMessage = payload.message || payload.error || payload.name || `Resend request failed with status ${response.status}`;
      return { provider: 'resend', status: 'failed', failureReason: safeFailureReason(providerMessage) };
    }
    return { provider: 'resend', status: 'sent', providerMessageId: payload.id };
  } catch (error) {
    return { provider: 'resend', status: 'failed', failureReason: safeFailureReason(error) };
  }
}

export async function sendHiringEmail(event: EmailEvent): Promise<EmailSendResult> {
  return selectedProvider() === 'resend' ? sendResendEmail(event) : sendConsoleEmail(event);
}

export async function sendAndRecordEmail(event: EmailEvent) {
  const result = await sendHiringEmail(event);
  console.info('Hiring email delivery status', {
    provider: result.provider,
    status: result.status,
    to: maskEmail(event.to),
    applicationId: maskGeneric(event.applicationId),
    template: event.template,
    providerMessageId: result.providerMessageId,
    failureReason: result.failureReason,
  });
  const record = await prisma.emailNotification.create({
    data: {
      applicationId: event.applicationId,
      toEmail: event.to,
      template: event.template,
      subject: event.subject,
      status: result.status,
      providerMessageId: result.providerMessageId,
      failureReason: result.failureReason,
    },
  });
  await prisma.auditLog.create({
    data: {
      applicationId: event.applicationId,
      actorType: 'system',
      action: 'Email notification queued/sent',
      metadata: { template: event.template, status: result.status, provider: result.provider, providerMessageId: result.providerMessageId, failureReason: result.failureReason },
    },
  });
  return record;
}
