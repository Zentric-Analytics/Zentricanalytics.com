import { prisma } from './prisma';
import { maskEmail, maskGeneric } from './security';
import { resolveEmailSender } from './email-senders';
import { evaluateRuntimeEmailPolicy } from './email-runtime-policy.mjs';

export type EmailEvent = {
  to: string;
  subject: string;
  applicationId: string;
  portalUrl?: string;
  template: string;
  body?: string;
  html?: string;
  replyTo?: string;
  sensitiveBody?: boolean;
  dispatchKey?: string;
};

export type EmailSendResult = {
  provider: 'console' | 'resend';
  status: 'sent' | 'failed' | 'held' | 'configuration_blocked' | 'uncertain' | 'simulated';
  invoked?: boolean;
  retryable?: boolean;
  providerMessageId?: string;
  failureReason?: string;
};

const RESEND_EMAIL_URL = 'https://api.resend.com/emails';
function selectedProvider() {
  return process.env.EMAIL_PROVIDER === 'resend' ? 'resend' : 'console';
}

function textToHtml(text: string) {
  return `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />')}</p>`;
}

async function sendConsoleEmail(event: EmailEvent): Promise<EmailSendResult> {
  const sender = resolveEmailSender(event.template);
  console.info('Hiring email delivery', {
    provider: 'console',
    status: 'simulated',
    to: maskEmail(event.to),
    subject: event.subject,
    applicationId: maskGeneric(event.applicationId),
    template: event.template,
    senderCategory: sender.category,
  });
  return { provider: 'console', status: 'simulated', invoked: false };
}

async function sendResendEmail(event: EmailEvent): Promise<EmailSendResult> {
  const sender = resolveEmailSender(event.template);
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { provider: 'resend', status: 'configuration_blocked', invoked: false, failureReason: 'EMAIL_PROVIDER_CONFIGURATION_REQUIRED' };

  try {
    const response = await fetch(RESEND_EMAIL_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(event.dispatchKey ? { 'Idempotency-Key': event.dispatchKey } : {}) },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        from: sender.from,
        reply_to: event.replyTo ?? sender.replyTo,
        to: [event.to],
        subject: event.subject,
        text: event.body ?? '',
        html: event.html ?? (event.body ? textToHtml(event.body) : undefined),
      }),
    });
    const payload = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string; error?: string };
    if (!response.ok) {
      return { provider: 'resend', status: response.status >= 500 || response.status === 408 ? 'uncertain' : 'failed', invoked: true, retryable: response.status === 429, failureReason: 'EMAIL_PROVIDER_RESPONSE_' + response.status };
    }
    if (typeof payload.id !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(payload.id)) return { provider: 'resend', status: 'uncertain', invoked: true, failureReason: 'EMAIL_PROVIDER_ACCEPTANCE_UNCONFIRMED' };
    return { provider: 'resend', status: 'sent', providerMessageId: payload.id, invoked: true };
  } catch {
    return { provider: 'resend', status: 'uncertain', invoked: true, failureReason: 'EMAIL_PROVIDER_OUTCOME_UNCERTAIN' };
  }
}

export async function sendHiringEmail(event: EmailEvent): Promise<EmailSendResult> {
  // This is the single final boundary used by direct sends and the HR outbox.
  // Re-evaluate process configuration immediately before any provider invocation.
  const policy = evaluateRuntimeEmailPolicy(process.env, event.to);
  if (policy.decision === 'SIMULATED') return sendConsoleEmail(event);
  if (policy.decision !== 'ALLOW') return { provider: selectedProvider(), status: policy.decision === 'HOLD' || policy.decision === 'INVALID_RECIPIENT' ? 'held' : 'configuration_blocked', invoked: false, failureReason: policy.reasonCode };
  if (event.replyTo && !/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(event.replyTo)) throw new Error('Invalid reply-to address.');
  if (event.dispatchKey && !/^[A-Za-z0-9_-]{1,128}$/.test(event.dispatchKey)) return { provider: selectedProvider(), status: 'configuration_blocked', invoked: false, failureReason: 'INVALID_DISPATCH_KEY' };
  if (event.sensitiveBody && selectedProvider() !== 'resend') return { provider: 'console', status: 'failed', failureReason: 'Sensitive mailbox messages require a real email provider.' };
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
