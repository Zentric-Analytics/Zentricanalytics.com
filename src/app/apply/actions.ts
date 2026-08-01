'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { initialApplicationSchema, toStage1SubmissionPayload } from '@/lib/hiring';
import { stage1ApplicantFieldNames } from '@/lib/stage1-fields';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { LOCAL_PRIVATE_PROVIDER, PrivateUploadStorageConfigurationError, deletePrivateUpload, savePrivateUpload, selectedStorageProvider, validateCvFile } from '@/lib/storage';
import { sha256 } from '@/lib/security';
import { createApplicationWithRetry, createStageRows } from '@/lib/workflow';
import { sendAndRecordEmail } from '@/lib/email';
import { applicationReceivedEmail } from '../../lib/email-templates';
import { checkRateLimit } from '@/lib/rate-limit';
import { isVacancyAcceptingApplications } from '@/lib/hr/recruitment/states';
import { appendHrAudit } from '@/lib/hr/audit';
import { enqueueHrEmail } from '@/lib/hr/notifications/outbox';
import { applicantIdentityFilter } from '@/lib/hr/recruitment/applicant-identity';
import type { Stage1Field, Stage1FormState } from './form-state';

function valueOf(formData: FormData, key: string) { const value = formData.get(key); return typeof value === 'string' ? value : ''; }
function preserveValues(formData: FormData) { return stage1ApplicantFieldNames.reduce<Record<string,string>>((acc, key) => { acc[key] = valueOf(formData, key); return acc; }, {}); }
function formatFieldErrors(formData: FormData, fileError: string | null) { const parsed = initialApplicationSchema.safeParse(Object.fromEntries(formData)); const fieldErrors: Partial<Record<Stage1Field,string>> = {}; if (!parsed.success) for (const issue of parsed.error.issues) { const field = issue.path[0] as Stage1Field | undefined; if (field && !fieldErrors[field]) fieldErrors[field] = issue.message; } if (fileError) fieldErrors.cv = fileError; return { parsed, fieldErrors }; }

export async function submitStage1Application(_previousState: Stage1FormState, formData: FormData): Promise<Stage1FormState> {
  const h = await headers();
  const ipHash = sha256(h.get('x-forwarded-for') ?? 'unknown');
  const limited = await checkRateLimit({ scope: 'stage1-submit', key: ipHash, limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limited.allowed) return { ok: false, message: 'We could not process this request right now. Please try again later.', values: preserveValues(formData), fieldErrors: {} };

  const fileValue = formData.get('cv'); const file = fileValue instanceof File ? fileValue : null; const fileError = validateCvFile(file); const { parsed, fieldErrors } = formatFieldErrors(formData, fileError);
  if (!parsed.success || fileError || !file) return { ok: false, message: 'Please correct the highlighted fields.', values: preserveValues(formData), fieldErrors };

  const data = toStage1SubmissionPayload(parsed.data);
  const vacancySlug = valueOf(formData, 'vacancySlug');
  const submissionKey = valueOf(formData, 'submissionKey');
  if (vacancySlug && submissionKey) {
    const existing = await prisma.jobApplication.findUnique({ where: { submissionKey }, select: { applicationReference: true, applicationId: true } });
    if (existing) redirect(`/apply?submitted=${encodeURIComponent(existing.applicationReference ?? existing.applicationId)}`);
  }
  const savedUploads: Awaited<ReturnType<typeof savePrivateUpload>>[] = [];
  let submittedApplicationId = '';
  let metadataCommitted = false;
  try {
    const app = await createApplicationWithRetry(async (applicationPublicId) => {
      const upload = await savePrivateUpload(file, applicationPublicId);
      savedUploads.push(upload);
      return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const hrOrganization = await tx.hrOrganization.findUnique({ where: { slug: "zentric-analytics" }, select: { id: true } });
        const vacancy = vacancySlug && hrOrganization ? await tx.hrVacancy.findFirst({
          where: { publicSlug: vacancySlug, organizationId: hrOrganization.id },
          include: {
            hiringTeam: { include: { members: { where: { status: "ACTIVE" }, include: { user: true } } } },
            responsibleHrTeam: { include: { members: { where: { status: "ACTIVE" }, include: { user: true } } } },
          },
        }) : null;
        if (vacancySlug && (!vacancy || !isVacancyAcceptingApplications({ status: vacancy.status, opensAt: vacancy.opensAt, closesAt: vacancy.applicationDeadline, now: new Date() }) || vacancy.filledOpenings >= vacancy.numberOfOpenings)) {
          throw new Error("This vacancy is no longer accepting applications.");
        }
        const normalizedEmail = data.email.toLowerCase();
        let applicant = vacancy && hrOrganization ? await tx.applicant.findFirst({ where: applicantIdentityFilter({ organizationId: hrOrganization.id, normalizedEmail }), orderBy: { createdAt: "asc" } }) : null;
        if (!applicant) {
          let applicantNumber: string | undefined;
          if (vacancy && hrOrganization) {
            const year = new Date().getUTCFullYear();
            const sequence = await tx.hrRecruitmentNumberSequence.upsert({
              where: { organizationId_kind_year: { organizationId: hrOrganization.id, kind: "APPLICANT", year } },
              create: { organizationId: hrOrganization.id, kind: "APPLICANT", year, lastValue: 1 },
              update: { lastValue: { increment: 1 } },
            });
            applicantNumber = `APP-${year}-${String(sequence.lastValue).padStart(6, "0")}`;
          }
          applicant = await tx.applicant.create({ data: { organizationId: vacancy ? hrOrganization?.id : null, applicantNumber, normalizedEmail, normalizedPhone: data.phoneE164, fullName: data.fullName, firstName: data.firstName, middleInitial: data.middleInitial || null, lastName: data.lastName, email: normalizedEmail, phone: data.phoneE164, phoneCountryIso: data.phoneCountryIso, phoneCountryName: data.phoneCountryName, phoneDialCode: data.phoneDialCode, phoneNationalNumber: data.phoneNational, phoneE164: data.phoneE164, location: data.location } });
        } else {
          applicant = await tx.applicant.update({ where: { id: applicant.id }, data: { normalizedPhone: data.phoneE164, fullName: data.fullName, firstName: data.firstName, middleInitial: data.middleInitial || null, lastName: data.lastName, email: normalizedEmail, phone: data.phoneE164, phoneCountryIso: data.phoneCountryIso, phoneCountryName: data.phoneCountryName, phoneDialCode: data.phoneDialCode, phoneNationalNumber: data.phoneNational, phoneE164: data.phoneE164, location: data.location } });
        }
        let applicationReference: string | undefined;
        if (vacancy && hrOrganization) {
          const year = new Date().getUTCFullYear();
          const sequence = await tx.hrRecruitmentNumberSequence.upsert({
            where: { organizationId_kind_year: { organizationId: hrOrganization.id, kind: "APPLICATION", year } },
            create: { organizationId: hrOrganization.id, kind: "APPLICATION", year, lastValue: 1 },
            update: { lastValue: { increment: 1 } },
          });
          applicationReference = `APL-${year}-${String(sequence.lastValue).padStart(6, "0")}`;
        }
        const owner = vacancy?.hiringTeam.members.find((member) => member.user.status === "ACTIVE")?.user ?? vacancy?.responsibleHrTeam.members.find((member) => member.user.status === "ACTIVE")?.user;
        const application = await tx.jobApplication.create({ data: { organizationId: hrOrganization?.id, vacancyId: vacancy?.id, applicationId: applicationPublicId, applicationReference, submissionKey: vacancy ? submissionKey : null, applicantId: applicant.id, roleAppliedFor: vacancy?.title ?? data.roleAppliedFor, workModePreference: data.workMode, experienceLevel: data.experienceLevel, skills: data.skills, portfolioUrl: data.portfolioUrl || null, message: data.message, privacyConsent: true, status: vacancy ? 'Pending Review' : 'Application Submitted', recruitmentStatus: vacancy ? "PENDING_REVIEW" : null, assignedHiringTeamId: vacancy?.hiringTeamId, applicationOwnerId: owner?.id, currentStageOrder: 1 } });
        await createStageRows(application.id, tx);
        const stage1 = await tx.hiringStage.findFirstOrThrow({ where: { applicationId: application.id, stageOrder: 1 } });
        await tx.hiringStage.update({ where: { id: stage1.id }, data: { submittedAt: new Date(), status: 'Under Review' } });
        const submission = await tx.stageSubmission.create({ data: { stageId: stage1.id, version: 1, status: 'Under Review', payload: data, submittedAt: new Date() } });
        const doc = await tx.uploadedDocument.create({ data: { applicationId: application.id, kind: 'Stage 1 CV', fileName: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size, storageKey: upload!.storageKey, provider: upload!.provider, restricted: true } });
        await tx.applicantDocument.create({ data: { submissionId: submission.id, uploadedDocumentId: doc.id } });
        await tx.electronicSignature.create({ data: { submissionId: submission.id, typedName: data.signatureName, confirmed: true, ipHash, userAgent: h.get('user-agent') } });
        await tx.auditLog.create({ data: { applicationId: application.id, actorType: 'applicant', actorRef: data.email.toLowerCase(), action: 'Application submitted', metadata: { applicationId: applicationPublicId } } });
        if (vacancy && hrOrganization && applicationReference) {
          await tx.hrApplicationStageHistory.create({ data: { organizationId: hrOrganization.id, applicationId: application.id, newState: "PENDING_REVIEW", actorType: "APPLICANT", reason: "Application submitted", source: "PUBLIC_PORTAL", correlationId: submissionKey } });
          await tx.hrApplicationReviewTask.create({ data: { organizationId: hrOrganization.id, applicationId: application.id, hiringTeamId: vacancy.hiringTeamId, ownerUserId: owner?.id, idempotencyKey: `application-review:${application.id}` } });
          await appendHrAudit(tx, { organizationId: hrOrganization.id, entityType: "JobApplication", entityId: application.id, action: "hr.recruitment.application.submitted", newValues: { applicationReference, vacancyNumber: vacancy.vacancyNumber, status: "PENDING_REVIEW" }, reason: "Applicant submitted an application", correlationId: submissionKey });
          const recipients = [...new Map([...vacancy.hiringTeam.members, ...vacancy.responsibleHrTeam.members].filter((member) => member.user.status === "ACTIVE").map((member) => [member.user.email, member.user])).values()];
          for (const recipient of recipients) await enqueueHrEmail(tx, { organizationId: hrOrganization.id, recipient: recipient.email, template: "hr-new-application", subject: `New application: ${applicationReference}`, payload: { applicationReference, vacancyNumber: vacancy.vacancyNumber, href: `/hr/admin/applications/${application.id}` }, idempotencyKey: `new-application:${application.id}:${recipient.id}` });
        }
        return application;
      });
    });
    metadataCommitted = true;
    const publicReference = app.applicationReference ?? app.applicationId;
    const email = applicationReceivedEmail({ applicationId: publicReference, candidateName: data.fullName });
    await sendAndRecordEmail({ applicationId: app.id, to: data.email, template: 'application-received', ...email });
    submittedApplicationId = publicReference;
  } catch (error) {
    if (!metadataCommitted) {
      await Promise.all(savedUploads.map((upload) => deletePrivateUpload(upload.storageKey, upload.provider)));
    }
    if (error instanceof PrivateUploadStorageConfigurationError) {
      const provider = selectedStorageProvider();
      console.error('applicationUploadStorageRejected', {
        reason: 'PRIVATE_UPLOAD_ROOT missing',
        provider,
        environment: {
          nodeEnv: process.env.NODE_ENV,
          vercelEnv: process.env.VERCEL_ENV,
          appEnv: process.env.APP_ENV,
        },
        outcome: 'upload rejected before DB metadata creation',
      });
      const message = provider === LOCAL_PRIVATE_PROVIDER
        ? 'Application upload storage is not configured. Please contact support.'
        : 'Application upload storage is unavailable. Please contact support.';
      return { ok: false, message, values: preserveValues(formData), fieldErrors: {} };
    }
    throw error;
  }

  redirect(`/apply?submitted=${encodeURIComponent(submittedApplicationId)}`);
}
