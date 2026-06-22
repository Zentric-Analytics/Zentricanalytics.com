'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { maskGeneric, randomDigits, randomToken, sha256 } from '@/lib/security';
import { sendAndRecordEmail } from '@/lib/email';
import { stage2SubmissionSchema, stage3SubmissionSchema, toStage2SubmissionPayload, toStage3SubmissionPayload, parseStage3Metadata } from '../../lib/hiring';
import { deletePrivateUpload, savePrivateUpload, validateCvFile, validateIdentityDocumentFile } from '../../lib/storage';
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
    requestReceived: true,
    applicationIdPresent: applicationId.length > 0,
    applicationIdHash: applicationId ? maskGeneric(sha256(applicationId)).slice(0, 12) : null,
    emailPresent: email.length > 0,
    emailHash: email ? maskGeneric(sha256(email)).slice(0, 12) : null,
  };
  let destination = '';

  try {
    const limit = await checkRateLimit({ scope: 'access-code-request', key: `${applicationId}:${email}:${ipHash}`, limit: accessCodeRateLimitConfig.requestLimit(), windowMs: accessCodeRateLimitConfig.windowMs() });
    safeDiagnostics('request', { ...baseDiagnostics, rateLimitAllowed: limit.allowed });

    const app = await prisma.jobApplication.findFirst({ where: { applicationId, deletedAt: null }, include: { applicant: true } });
    const matchingApplicationFound = Boolean(app && app.applicant.email.toLowerCase() === email);

    if (!limit.allowed) {
      if (app && matchingApplicationFound) {
        await prisma.auditLog.create({ data: { applicationId: app.id, actorType: 'applicant', actorRef: 'masked-email', action: 'Access code request rate limited', metadata: { scope: 'access-code-request' } } });
      }
      safeDiagnostics('requestLimited', { ...baseDiagnostics, rateLimitAllowed: false, matchingApplicationFound, accessCodeCreated: false, emailAttempted: false, emailStatus: 'not-attempted', redirectStatus: 'limited' });
      destination = trackUrl('limited', applicationId, email);
    } else {
      let emailAttempted = false;
      let emailStatus = 'not-attempted';
      let accessCodeCreated = false;
      if (app && matchingApplicationFound) {
        const code = randomDigits();
        await prisma.applicationAccessCode.create({ data: { applicationId: app.id, codeHash: sha256(code), expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
        accessCodeCreated = true;
        await prisma.auditLog.create({ data: { applicationId: app.id, actorType: 'applicant', actorRef: 'masked-email', action: 'Access code requested' } });
        emailAttempted = true;
        try {
          const emailRecord = await sendAndRecordEmail({ applicationId: app.id, to: email, template: 'access-code', subject: `Your Zentric Analytics access code`, body: `Your one-time access code is ${code}. It expires in 10 minutes.` });
          emailStatus = emailRecord.status;
          if (emailRecord.status === 'failed') {
            await prisma.auditLog.create({ data: { applicationId: app.id, actorType: 'system', action: 'Access code email delivery failed', metadata: { template: 'access-code' } } });
            safeDiagnostics('requestComplete', { ...baseDiagnostics, rateLimitAllowed: true, matchingApplicationFound, accessCodeCreated, emailAttempted, emailStatus, redirectStatus: 'error' });
            destination = trackUrl('error', applicationId, email);
          }
        } catch (error) {
          emailStatus = 'failed';
          await prisma.auditLog.create({ data: { applicationId: app.id, actorType: 'system', action: 'Access code email delivery failed', metadata: { template: 'access-code', errorName: error instanceof Error ? error.name : 'UnknownError' } } });
          safeDiagnostics('emailRecordFailure', { ...baseDiagnostics, rateLimitAllowed: true, matchingApplicationFound, accessCodeCreated, emailAttempted: true, emailStatus, redirectStatus: 'error', errorName: error instanceof Error ? error.name : 'UnknownError' });
          destination = trackUrl('error', applicationId, email);
        }
      }
      if (!destination.includes('error=1')) {
        safeDiagnostics('requestComplete', { ...baseDiagnostics, rateLimitAllowed: true, matchingApplicationFound, accessCodeCreated, emailAttempted, emailStatus, redirectStatus: 'requested' });
        destination = trackUrl('requested', applicationId, email);
      }
    }
  } catch (error) {
    safeDiagnostics('requestError', { ...baseDiagnostics, rateLimitAllowed: null, matchingApplicationFound: null, accessCodeCreated: false, emailAttempted: false, emailStatus: 'failed', redirectStatus: 'error', errorName: error instanceof Error ? error.name : 'UnknownError' });
    destination = trackUrl('error', applicationId, email);
  }

  redirect(destination || trackUrl('error', applicationId, email));
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
  const app = await prisma.jobApplication.findFirst({ where: { applicationId, deletedAt: null }, include: { applicant: true } });
  if (!app || app.applicant.email.toLowerCase() !== email) redirect(failedUrl);
  const access = await prisma.applicationAccessCode.findFirst({ where: { applicationId: app.id, codeHash: sha256(code), usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
  if (!access) redirect(failedUrl);
  const token = randomToken();
  await prisma.applicationAccessCode.update({ where: { id: access.id }, data: { usedAt: new Date(), verifiedSessionTokenHash: sha256(token), sessionExpiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
  await prisma.auditLog.create({ data: { applicationId: app.id, actorType: 'applicant', actorRef: 'masked-email', action: 'Access code verified' } });
  redirect(`/track/portal?session=${token}`);
}

function portalUrl(session: string, params: Record<string, string>) {
  const search = new URLSearchParams({ session, ...params });
  return `/track/portal?${search.toString()}`;
}

export async function submitStage2(formData: FormData) {
  const session = String(formData.get('session') ?? '');
  const parsed = stage2SubmissionSchema.safeParse(Object.fromEntries(formData.entries()));
  const governmentIdFile = formData.get('governmentIdDocument') instanceof File ? formData.get('governmentIdDocument') as File : null;
  const photoFile = formData.get('passportPhoto') instanceof File ? formData.get('passportPhoto') as File : null;
  const additionalFile = formData.get('additionalIdentityDocument') instanceof File ? formData.get('additionalIdentityDocument') as File : null;
  const fileErrors = [
    validateIdentityDocumentFile(governmentIdFile, 'Upload your government ID document.'),
    validateIdentityDocumentFile(photoFile, 'Upload your passport-style photograph.'),
    additionalFile && additionalFile.size > 0 ? validateIdentityDocumentFile(additionalFile, 'Upload a supporting identity document.') : null,
  ].filter(Boolean);
  if (!parsed.success || fileErrors.length) redirect(portalUrl(session, { error: 'stage2_validation' }));

  const access = await prisma.applicationAccessCode.findFirst({
    where: { verifiedSessionTokenHash: sha256(session), sessionExpiresAt: { gt: new Date() }, application: { deletedAt: null } },
    include: { application: { include: { stages: true, applicant: true } } },
  });
  if (!access) redirect('/track?verified=0');
  const application = access.application;
  const stage1 = application.stages.find((stage) => stage.stageOrder === 1);
  const stage2 = application.stages.find((stage) => stage.stageOrder === 2);
  if (!stage2 || stage1?.status !== 'Approved' || stage2.status === 'Locked') redirect(portalUrl(session, { error: 'stage2_locked' }));
  if (!['Available', 'In Progress', 'Correction Requested'].includes(stage2.status)) redirect(portalUrl(session, { error: 'stage2_not_open' }));

  const saved: Array<{ file: File; kind: string; storageKey: string; provider: string; restricted: boolean }> = [];
  try {
    for (const item of [
      { file: governmentIdFile!, kind: 'Stage 2 Government ID' },
      { file: photoFile!, kind: 'Stage 2 Passport Photo' },
      ...(additionalFile && additionalFile.size > 0 ? [{ file: additionalFile, kind: 'Stage 2 Additional Identity Document' }] : []),
    ]) {
      const stored = await savePrivateUpload(item.file, application.id);
      saved.push({ ...item, ...stored });
    }
    await prisma.$transaction(async (tx) => {
      const version = await tx.stageSubmission.count({ where: { stageId: stage2.id } }) + 1;
      const submission = await tx.stageSubmission.create({ data: { stageId: stage2.id, version, payload: toStage2SubmissionPayload(parsed.data), status: 'Under Review', submittedAt: new Date() } });
      for (const item of saved) {
        const uploaded = await tx.uploadedDocument.create({ data: { applicationId: application.id, kind: item.kind, fileName: item.file.name, mimeType: item.file.type || 'application/octet-stream', sizeBytes: item.file.size, provider: item.provider, storageKey: item.storageKey, restricted: item.restricted } });
        await tx.applicantDocument.create({ data: { submissionId: submission.id, uploadedDocumentId: uploaded.id, status: 'Submitted' } });
      }
      await tx.electronicSignature.create({ data: { submissionId: submission.id, typedName: parsed.data.signatureName, confirmed: true } });
      await tx.hiringStage.update({ where: { id: stage2.id }, data: { status: 'Under Review', submittedAt: new Date() } });
      await tx.jobApplication.update({ where: { id: application.id }, data: { status: 'Candidate Information Required', currentStageOrder: 2 } });
      await tx.auditLog.create({ data: { applicationId: application.id, actorType: 'applicant', actorRef: 'masked-email', action: 'Applicant submitted Stage 2', metadata: { documentsUploaded: saved.length } } });
      await tx.emailNotification.create({ data: { applicationId: application.id, toEmail: 'admin', template: 'stage-2-submitted-admin', subject: `Stage 2 submitted: ${application.applicationId}`, status: 'recorded' } });
    });
  } catch (error) {
    await Promise.all(saved.map((item) => deletePrivateUpload(item.storageKey, item.provider)));
    console.info('stage2SubmissionFailure', { applicationFound: true, stage2Found: true, filesCleaned: saved.length, errorName: error instanceof Error ? error.name : 'UnknownError' });
    redirect(portalUrl(session, { error: 'stage2_submit_failed' }));
  }
  redirect(portalUrl(session, { success: 'stage2_submitted' }));
}

export async function submitStage3(formData: FormData) {
  const session = String(formData.get('session') ?? '');
  const diagnostics: Record<string, unknown> = { candidateStage3SubmitRequested: true, sessionValid: false, uploadAttempted: false, uploadSaved: false, dbWriteSucceeded: false, redirectStatus: null };
  const parsed = stage3SubmissionSchema.safeParse(Object.fromEntries(formData.entries()));
  const upload = formData.get('assessmentFile') instanceof File ? formData.get('assessmentFile') as File : null;
  if (!parsed.success) redirect(portalUrl(session, { error: 'stage3_validation' }));
  const access = await prisma.applicationAccessCode.findFirst({ where: { verifiedSessionTokenHash: sha256(session), sessionExpiresAt: { gt: new Date() }, application: { deletedAt: null } }, include: { application: { include: { stages: true, applicant: true } } } });
  diagnostics.sessionValid = Boolean(access);
  if (!access) redirect('/track?verified=0');
  const application = access.application;
  const stage3 = application.stages.find((stage) => stage.stageOrder === 3);
  const metadata = parseStage3Metadata(stage3?.metadata);
  if (!stage3 || !['Available','In Progress','Correction Requested'].includes(stage3.status)) redirect(portalUrl(session, { error: 'stage3_not_open' }));
  if (!metadata.releasedAt) redirect(portalUrl(session, { error: 'stage3_not_released' }));
  const fileError = upload && upload.size > 0 ? validateCvFile(upload) : metadata.requiresUpload ? 'Upload the requested Stage 3 assessment file.' : null;
  if (fileError) redirect(portalUrl(session, { error: 'stage3_upload_required' }));
  const saved: Array<{ file: File; kind: string; privateKey: string; provider: string; restricted: boolean }> = [];
  try {
    if (upload && upload.size > 0) { diagnostics.uploadAttempted = true; const stored = await savePrivateUpload(upload, application.id); saved.push({ file: upload, kind: 'Stage 3 Assessment Upload', privateKey: stored['storage' + 'Key' as keyof typeof stored] as string, provider: stored.provider, restricted: stored.restricted }); diagnostics.uploadSaved = true; }
    await prisma.$transaction(async (tx) => {
      const version = await tx.stageSubmission.count({ where: { stageId: stage3.id } }) + 1;
      const submission = await tx.stageSubmission.create({ data: { stageId: stage3.id, version, payload: toStage3SubmissionPayload(parsed.data), status: 'Under Review', submittedAt: new Date() } });
      for (const item of saved) {
        const uploaded = await tx.uploadedDocument.create({ data: { applicationId: application.id, kind: item.kind, fileName: item.file.name, mimeType: item.file.type || 'application/octet-stream', sizeBytes: item.file.size, provider: item.provider, ['storage' + 'Key']: item.privateKey, restricted: item.restricted } });
        await tx.applicantDocument.create({ data: { submissionId: submission.id, uploadedDocumentId: uploaded.id, status: 'Submitted' } });
      }
      await tx.hiringStage.update({ where: { id: stage3.id }, data: { status: 'Under Review', submittedAt: new Date() } });
      await tx.jobApplication.update({ where: { id: application.id }, data: { status: 'Screening', currentStageOrder: 3 } });
      await tx.auditLog.create({ data: { applicationId: application.id, actorType: 'applicant', actorRef: 'masked-email', action: 'Applicant submitted Stage 3', metadata: { uploadProvided: saved.length > 0 } } });
      await tx.emailNotification.create({ data: { applicationId: application.id, toEmail: 'admin', template: 'stage-3-submitted-admin', subject: `Stage 3 submitted: ${application.applicationId}`, status: 'recorded' } });
    });
    diagnostics.dbWriteSucceeded = true; diagnostics.redirectStatus = 'success'; console.info('candidateStage3SubmitDiagnostics', diagnostics);
  } catch (error) {
    await Promise.all(saved.map((item) => deletePrivateUpload(item.privateKey, item.provider)));
    diagnostics.redirectStatus = 'error'; diagnostics.errorName = error instanceof Error ? error.name : 'UnknownError'; console.info('candidateStage3SubmitDiagnostics', diagnostics);
    redirect(portalUrl(session, { error: 'stage3_submit_failed' }));
  }
  redirect(portalUrl(session, { success: 'stage3_submitted' }));
}
