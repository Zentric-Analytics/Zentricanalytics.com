'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { randomDigits, randomToken, sha256 } from '@/lib/security';
import { sendAndRecordEmail } from '@/lib/email';
import { checkRateLimit } from '@/lib/rate-limit';

export async function requestAccessCode(formData: FormData) {
  const applicationId = String(formData.get('applicationId') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const h = await headers();
  const ipHash = sha256(h.get('x-forwarded-for') ?? 'unknown');
  const limit = await checkRateLimit({ scope: 'access-code-request', key: `${applicationId}:${email}:${ipHash}`, limit: 3, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) redirect(`/track?requested=1&applicationId=${encodeURIComponent(applicationId)}&email=${encodeURIComponent(email)}`);
  const app = await prisma.jobApplication.findUnique({ where: { applicationId }, include: { applicant: true } });
  if (app && app.applicant.email.toLowerCase() === email) {
    const code = randomDigits();
    await prisma.applicationAccessCode.create({ data: { applicationId: app.id, codeHash: sha256(code), expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
    await prisma.auditLog.create({ data: { applicationId: app.id, actorType: 'applicant', actorRef: email, action: 'Access code requested' } });
    await sendAndRecordEmail({ applicationId: app.id, to: email, template: 'access-code', subject: `Your Zentric Analytics access code`, body: `Your one-time access code is ${code}. It expires in 10 minutes.` });
  }
  redirect(`/track?requested=1&applicationId=${encodeURIComponent(applicationId)}&email=${encodeURIComponent(email)}`);
}

export async function verifyAccessCode(formData: FormData) {
  const applicationId = String(formData.get('applicationId') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const code = String(formData.get('code') ?? '').trim();
  const h = await headers();
  const ipHash = sha256(h.get('x-forwarded-for') ?? 'unknown');
  const limit = await checkRateLimit({ scope: 'access-code-verify', key: `${applicationId}:${email}:${ipHash}`, limit: 5, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) redirect('/track?verified=0');
  const app = await prisma.jobApplication.findUnique({ where: { applicationId }, include: { applicant: true } });
  if (!app || app.applicant.email.toLowerCase() !== email) redirect('/track?verified=0');
  const access = await prisma.applicationAccessCode.findFirst({ where: { applicationId: app.id, codeHash: sha256(code), usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
  if (!access) redirect('/track?verified=0');
  const token = randomToken();
  await prisma.applicationAccessCode.update({ where: { id: access.id }, data: { usedAt: new Date(), verifiedSessionTokenHash: sha256(token), sessionExpiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
  await prisma.auditLog.create({ data: { applicationId: app.id, actorType: 'applicant', actorRef: email, action: 'Access code verified' } });
  redirect(`/track/portal?session=${token}`);
}
