'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { randomDigits, randomToken, sha256 } from '@/lib/security';
import { sendAndRecordEmail } from '@/lib/email';
import { checkRateLimit } from '@/lib/rate-limit';
import { accessCodeRateLimitConfig } from '@/lib/access-code-config';

type RedirectStatus = 'requested' | 'limited' | 'error';

function trackUrl(status: RedirectStatus, applicationId: string, email: string) {
  const params = new URLSearchParams({ applicationId, email });
  params.set(status === 'requested' ? 'requested' : status, '1');
  return `/track?${params.toString()}`;
}

function safeDiagnostics(event: string, diagnostics: Record<string, unknown>) {
  console.info('trackAccessCode', { event, ...diagnostics });
}

export async function requestAccessCode(formData: FormData) {
  const applicationId = String(formData.get('applicationId') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const h = await headers();
  const ipHash = sha256(h.get('x-forwarded-for') ?? 'unknown');
  const baseDiagnostics = {
    accessCodeRequestReceived: true,
    applicationIdPresent: applicationId.length > 0,
    emailPresent: email.length > 0,
  };
  let destination = trackUrl('error', applicationId, email);

  try {
    const limit = await checkRateLimit({ scope: 'access-code-request', key: `${applicationId}:${email}:${ipHash}`, limit: accessCodeRateLimitConfig.requestLimit(), windowMs: accessCodeRateLimitConfig.windowMs() });
    safeDiagnostics('request', { ...baseDiagnostics, rateLimitAllowed: limit.allowed });

    const app = await prisma.jobApplication.findUnique({ where: { applicationId }, include: { applicant: true } });
    const matchingApplicationFound = Boolean(app && app.applicant.email.toLowerCase() === email);

    if (!limit.allowed) {
      if (app && matchingApplicationFound) {
        await prisma.auditLog.create({ data: { applicationId: app.id, actorType: 'applicant', actorRef: 'masked-email', action: 'Access code request rate limited', metadata: { scope: 'access-code-request' } } });
      }
      safeDiagnostics('requestLimited', { ...baseDiagnostics, rateLimitAllowed: false, matchingApplicationFound, emailAttempted: false, emailStatus: 'not-attempted', redirectStatus: 'limited' });
      destination = trackUrl('limited', applicationId, email);
    } else {
      let emailAttempted = false;
      let emailStatus = 'not-attempted';
      if (app && matchingApplicationFound) {
        const code = randomDigits();
        await prisma.applicationAccessCode.create({ data: { applicationId: app.id, codeHash: sha256(code), expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
        await prisma.auditLog.create({ data: { applicationId: app.id, actorType: 'applicant', actorRef: 'masked-email', action: 'Access code requested' } });
        emailAttempted = true;
        try {
          const emailRecord = await sendAndRecordEmail({ applicationId: app.id, to: email, template: 'access-code', subject: `Your Zentric Analytics access code`, body: `Your one-time access code is ${code}. It expires in 10 minutes.` });
          emailStatus = emailRecord.status;
        } catch (error) {
          emailStatus = 'failed';
          safeDiagnostics('emailRecordFailure', { ...baseDiagnostics, matchingApplicationFound, emailAttempted: true, emailStatus, errorName: error instanceof Error ? error.name : 'UnknownError' });
        }
      }
      safeDiagnostics('requestComplete', { ...baseDiagnostics, rateLimitAllowed: true, matchingApplicationFound, emailAttempted, emailStatus, redirectStatus: 'requested' });
      destination = trackUrl('requested', applicationId, email);
    }
  } catch (error) {
    safeDiagnostics('requestError', { ...baseDiagnostics, rateLimitAllowed: null, matchingApplicationFound: null, emailAttempted: false, emailStatus: 'failed', redirectStatus: 'error', errorName: error instanceof Error ? error.name : 'UnknownError' });
    destination = trackUrl('error', applicationId, email);
  }

  redirect(destination);
}

export async function verifyAccessCode(formData: FormData) {
  const applicationId = String(formData.get('applicationId') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const code = String(formData.get('code') ?? '').trim();
  const h = await headers();
  const ipHash = sha256(h.get('x-forwarded-for') ?? 'unknown');
  const failedUrl = `/track?verified=0&applicationId=${encodeURIComponent(applicationId)}&email=${encodeURIComponent(email)}`;
  const limit = await checkRateLimit({ scope: 'access-code-verify', key: `${applicationId}:${email}:${ipHash}`, limit: accessCodeRateLimitConfig.verifyLimit(), windowMs: accessCodeRateLimitConfig.windowMs() });
  if (!limit.allowed) redirect(failedUrl);
  const app = await prisma.jobApplication.findUnique({ where: { applicationId }, include: { applicant: true } });
  if (!app || app.applicant.email.toLowerCase() !== email) redirect(failedUrl);
  const access = await prisma.applicationAccessCode.findFirst({ where: { applicationId: app.id, codeHash: sha256(code), usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
  if (!access) redirect(failedUrl);
  const token = randomToken();
  await prisma.applicationAccessCode.update({ where: { id: access.id }, data: { usedAt: new Date(), verifiedSessionTokenHash: sha256(token), sessionExpiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
  await prisma.auditLog.create({ data: { applicationId: app.id, actorType: 'applicant', actorRef: 'masked-email', action: 'Access code verified' } });
  redirect(`/track/portal?session=${token}`);
}
