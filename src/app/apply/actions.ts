'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { initialApplicationSchema } from '@/lib/hiring';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { savePrivateUpload, validateCvFile } from '@/lib/storage';
import { sha256 } from '@/lib/security';
import { createStageRows, nextApplicationId } from '@/lib/workflow';
import { sendAndRecordEmail } from '@/lib/email';

export async function submitStage1Application(formData: FormData) {
  const file = formData.get('cv') as File;
  const fileError = validateCvFile(file);
  const parsed = initialApplicationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || fileError) redirect('/apply?error=validation');
  const data = parsed.data;
  const applicationPublicId = await nextApplicationId();
  const upload = await savePrivateUpload(file, applicationPublicId);
  const h = await headers();
  const app = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const applicant = await tx.applicant.create({ data: { fullName: data.fullName, email: data.email.toLowerCase(), phone: data.phone, location: data.location } });
    const application = await tx.jobApplication.create({ data: { applicationId: applicationPublicId, applicantId: applicant.id, roleAppliedFor: data.role, workModePreference: data.workMode, experienceLevel: data.experienceLevel, skills: data.skills, portfolioUrl: data.portfolioUrl || null, message: data.message, privacyConsent: true, status: 'Application Submitted', currentStageOrder: 1 } });
    return application;
  });
  await createStageRows(app.id);
  const stage1 = await prisma.hiringStage.findFirstOrThrow({ where: { applicationId: app.id, stageOrder: 1 } });
  await prisma.hiringStage.update({ where: { id: stage1.id }, data: { submittedAt: new Date(), status: 'Under Review' } });
  const submission = await prisma.stageSubmission.create({ data: { stageId: stage1.id, version: 1, status: 'Under Review', payload: data, submittedAt: new Date() } });
  const doc = await prisma.uploadedDocument.create({ data: { applicationId: app.id, kind: 'Stage 1 CV', fileName: file.name, mimeType: file.type, sizeBytes: file.size, storageKey: upload.storageKey } });
  await prisma.applicantDocument.create({ data: { submissionId: submission.id, uploadedDocumentId: doc.id } });
  await prisma.electronicSignature.create({ data: { submissionId: submission.id, typedName: data.signatureName, confirmed: true, ipHash: sha256(h.get('x-forwarded-for') ?? 'unknown'), userAgent: h.get('user-agent') } });
  await prisma.auditLog.create({ data: { applicationId: app.id, actorType: 'applicant', actorRef: data.email.toLowerCase(), action: 'Application submitted', metadata: { applicationId: applicationPublicId } } });
  await sendAndRecordEmail({ applicationId: app.id, to: data.email, template: 'application-received', subject: `Application received: ${applicationPublicId}`, portalUrl: `${process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://staging.zentricanalytics.com'}/track`, body: `Hello ${data.fullName}, your application ${applicationPublicId} was received. Track it at /track.` });
  redirect(`/apply?submitted=${encodeURIComponent(applicationPublicId)}`);
}
