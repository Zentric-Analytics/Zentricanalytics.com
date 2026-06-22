'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { initialApplicationSchema, toStage1SubmissionPayload } from '@/lib/hiring';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { savePrivateUpload, validateCvFile } from '@/lib/storage';
import { sha256 } from '@/lib/security';
import { createStageRows, nextApplicationId } from '@/lib/workflow';
import { sendAndRecordEmail } from '@/lib/email';
import type { Stage1Field, Stage1FormState } from './form-state';

function valueOf(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function preserveValues(formData: FormData) {
  return ['firstName','middleInitial','lastName','email','phoneCountryIso','phoneNational','location','role','otherRole','workMode','experienceLevel','skills','portfolioUrl','message','privacyConsent','signatureName','signatureConsent'].reduce<Record<string,string>>((acc, key) => {
    acc[key] = valueOf(formData, key);
    return acc;
  }, {});
}

function formatFieldErrors(formData: FormData, fileError: string | null) {
  const parsed = initialApplicationSchema.safeParse(Object.fromEntries(formData));
  const fieldErrors: Partial<Record<Stage1Field,string>> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as Stage1Field | undefined;
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
  }
  if (fileError) fieldErrors.cv = fileError;
  return { parsed, fieldErrors };
}

export async function submitStage1Application(_previousState: Stage1FormState, formData: FormData): Promise<Stage1FormState> {
  const fileValue = formData.get('cv');
  const file = fileValue instanceof File ? fileValue : null;
  const fileError = validateCvFile(file);
  const { parsed, fieldErrors } = formatFieldErrors(formData, fileError);
  if (!parsed.success || fileError || !file) {
    return { ok: false, message: 'Please correct the highlighted fields.', values: preserveValues(formData), fieldErrors };
  }

  const data = toStage1SubmissionPayload(parsed.data);
  const applicationPublicId = await nextApplicationId();
  const upload = await savePrivateUpload(file, applicationPublicId);
  const h = await headers();
  const app = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const applicant = await tx.applicant.create({ data: { fullName: data.fullName, firstName: data.firstName, middleInitial: data.middleInitial || null, lastName: data.lastName, email: data.email.toLowerCase(), phone: data.phoneE164, phoneCountryIso: data.phoneCountryIso, phoneCountryName: data.phoneCountryName, phoneDialCode: data.phoneDialCode, phoneNationalNumber: data.phoneNational, phoneE164: data.phoneE164, location: data.location } });
    const application = await tx.jobApplication.create({ data: { applicationId: applicationPublicId, applicantId: applicant.id, roleAppliedFor: data.roleAppliedFor, workModePreference: data.workMode, experienceLevel: data.experienceLevel, skills: data.skills, portfolioUrl: data.portfolioUrl || null, message: data.message, privacyConsent: true, status: 'Application Submitted', currentStageOrder: 1 } });
    return application;
  });
  await createStageRows(app.id);
  const stage1 = await prisma.hiringStage.findFirstOrThrow({ where: { applicationId: app.id, stageOrder: 1 } });
  await prisma.hiringStage.update({ where: { id: stage1.id }, data: { submittedAt: new Date(), status: 'Under Review' } });
  const submission = await prisma.stageSubmission.create({ data: { stageId: stage1.id, version: 1, status: 'Under Review', payload: data, submittedAt: new Date() } });
  const doc = await prisma.uploadedDocument.create({ data: { applicationId: app.id, kind: 'Stage 1 CV', fileName: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size, storageKey: upload.storageKey } });
  await prisma.applicantDocument.create({ data: { submissionId: submission.id, uploadedDocumentId: doc.id } });
  await prisma.electronicSignature.create({ data: { submissionId: submission.id, typedName: data.signatureName, confirmed: true, ipHash: sha256(h.get('x-forwarded-for') ?? 'unknown'), userAgent: h.get('user-agent') } });
  await prisma.auditLog.create({ data: { applicationId: app.id, actorType: 'applicant', actorRef: data.email.toLowerCase(), action: 'Application submitted', metadata: { applicationId: applicationPublicId } } });
  await sendAndRecordEmail({ applicationId: app.id, to: data.email, template: 'application-received', subject: `Application received: ${applicationPublicId}`, portalUrl: `${process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://staging.zentricanalytics.com'}/track`, body: `Hello ${data.fullName}, your application ${applicationPublicId} was received. Track it at /track.` });
  redirect(`/apply?submitted=${encodeURIComponent(applicationPublicId)}`);
}
