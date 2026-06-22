import { prisma } from './prisma';
export type EmailEvent = { to: string; subject: string; applicationId: string; portalUrl?: string; template: string; body?: string };
export async function sendHiringEmail(event: EmailEvent) {
  const provider = process.env.EMAIL_PROVIDER ?? 'console';
  console.info('Hiring email', { provider, to: event.to, subject: event.subject, applicationId: event.applicationId, template: event.template, body: event.body });
  return { provider, status: provider === 'console' ? 'sent' as const : 'queued' as const };
}
export async function sendAndRecordEmail(event: EmailEvent) {
  let status = 'sent';
  try { const result = await sendHiringEmail(event); status = result.status; } catch { status = 'failed'; }
  const record = await prisma.emailNotification.create({ data: { applicationId: event.applicationId, toEmail: event.to, template: event.template, subject: event.subject, status } });
  await prisma.auditLog.create({ data: { applicationId: event.applicationId, actorType: 'system', action: 'Email notification queued/sent', metadata: { template: event.template, status } } });
  return record;
}
