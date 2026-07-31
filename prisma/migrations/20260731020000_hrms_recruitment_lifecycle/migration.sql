-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "HrEmploymentStatus" ADD VALUE 'PRE_HIRE';
ALTER TYPE "HrEmploymentStatus" ADD VALUE 'READY_FOR_START';
ALTER TYPE "HrEmploymentStatus" ADD VALUE 'ON_HOLD';
ALTER TYPE "HrEmploymentStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Applicant" ADD COLUMN     "applicantNumber" TEXT,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "normalizedEmail" TEXT,
ADD COLUMN     "normalizedPhone" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "Applicant_organizationId_normalizedEmail_idx" ON "Applicant"("organizationId", "normalizedEmail");
CREATE INDEX "Applicant_organizationId_normalizedPhone_idx" ON "Applicant"("organizationId", "normalizedPhone");

-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN     "applicationOwnerId" TEXT,
ADD COLUMN     "applicationReference" TEXT,
ADD COLUMN     "assignedHiringTeamId" TEXT,
ADD COLUMN     "recruitmentStatus" TEXT,
ADD COLUMN     "submissionKey" TEXT,
ADD COLUMN     "vacancyId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "HrRecruitmentNumberSequence" (
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrRecruitmentNumberSequence_pkey" PRIMARY KEY ("organizationId","kind","year")
);

-- CreateTable
CREATE TABLE "HrApplicationAnswer" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "answer" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrApplicationAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrApplicationStageHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "previousState" TEXT,
    "newState" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrApplicationStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrApplicationReviewTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "hiringTeamId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrApplicationReviewTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrInterview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL,
    "location" TEXT,
    "meetingUrl" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrInterviewParticipant" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrInterviewParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrInterviewFeedback" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "interviewerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scores" JSONB NOT NULL,
    "recommendation" TEXT,
    "comments" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "reopenedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrInterviewFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrAssessment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "assessmentType" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3),
    "evaluatorId" TEXT,
    "score" DECIMAL(8,2),
    "outcome" TEXT,
    "evidenceKey" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrRecruitmentOffer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "activeVersionId" TEXT,
    "acceptedVersionId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrRecruitmentOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrRecruitmentOfferVersion" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "positionId" TEXT,
    "positionTitle" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "managerId" TEXT,
    "legalEntityId" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL,
    "gradeId" TEXT,
    "salary" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "payFrequency" TEXT NOT NULL,
    "allowances" JSONB NOT NULL,
    "benefits" JSONB NOT NULL,
    "location" TEXT,
    "workMode" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "probationPeriod" TEXT,
    "contractType" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "terms" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrRecruitmentOfferVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrRecruitmentOfferApproval" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "offerVersionId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "decision" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "comments" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrRecruitmentOfferApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrRecruitmentOfferDelivery" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "offerVersionId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrRecruitmentOfferDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrRecruitmentOfferAcceptance" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "offerVersionId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "evidence" JSONB,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrRecruitmentOfferAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrRecruitmentOfferDecline" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "offerVersionId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "reason" TEXT,
    "declinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrRecruitmentOfferDecline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrRecruitmentHandover" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "offerAcceptanceId" TEXT NOT NULL,
    "assignedHrTeamId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_HR_REVIEW',
    "version" INTEGER NOT NULL DEFAULT 1,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrRecruitmentHandover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrRecruitmentRequirementDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "blocking" BOOLEAN NOT NULL DEFAULT true,
    "evidenceType" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrRecruitmentRequirementDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrRecruitmentRequirement" (
    "id" TEXT NOT NULL,
    "handoverId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "blocking" BOOLEAN NOT NULL,
    "evidence" JSONB,
    "evaluatedAt" TIMESTAMP(3),
    "evaluatedById" TEXT,
    "overrideReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "HrRecruitmentRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrRecruitmentDocumentReview" (
    "id" TEXT NOT NULL,
    "handoverId" TEXT NOT NULL,
    "uploadedDocumentId" TEXT NOT NULL,
    "documentVersion" INTEGER NOT NULL DEFAULT 1,
    "reviewScope" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrRecruitmentDocumentReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCandidateEmployeeLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCandidateEmployeeLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPreHireConversion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "handoverId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "lifecycleInstanceId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "convertedById" TEXT NOT NULL,
    "convertedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPreHireConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrRecruitmentActivation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeActivatedAt" TIMESTAMP(3),
    "userActivatedAt" TIMESTAMP(3),
    "activatedById" TEXT,
    "source" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrRecruitmentActivation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HrApplicationAnswer_applicationId_idx" ON "HrApplicationAnswer"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrApplicationAnswer_applicationId_questionKey_key" ON "HrApplicationAnswer"("applicationId", "questionKey");

-- CreateIndex
CREATE INDEX "HrApplicationStageHistory_applicationId_createdAt_idx" ON "HrApplicationStageHistory"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "HrApplicationStageHistory_organizationId_newState_createdAt_idx" ON "HrApplicationStageHistory"("organizationId", "newState", "createdAt");

-- CreateIndex
CREATE INDEX "HrApplicationStageHistory_correlationId_idx" ON "HrApplicationStageHistory"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrApplicationReviewTask_idempotencyKey_key" ON "HrApplicationReviewTask"("idempotencyKey");

-- CreateIndex
CREATE INDEX "HrApplicationReviewTask_hiringTeamId_status_createdAt_idx" ON "HrApplicationReviewTask"("hiringTeamId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "HrApplicationReviewTask_ownerUserId_status_createdAt_idx" ON "HrApplicationReviewTask"("ownerUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "HrInterview_applicationId_status_startsAt_idx" ON "HrInterview"("applicationId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "HrInterview_organizationId_startsAt_idx" ON "HrInterview"("organizationId", "startsAt");

-- CreateIndex
CREATE INDEX "HrInterviewParticipant_userId_interviewId_idx" ON "HrInterviewParticipant"("userId", "interviewId");

-- CreateIndex
CREATE UNIQUE INDEX "HrInterviewParticipant_interviewId_userId_key" ON "HrInterviewParticipant"("interviewId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "HrInterviewFeedback_interviewId_interviewerId_key" ON "HrInterviewFeedback"("interviewId", "interviewerId");

-- CreateIndex
CREATE INDEX "HrAssessment_applicationId_status_idx" ON "HrAssessment"("applicationId", "status");

-- CreateIndex
CREATE INDEX "HrAssessment_evaluatorId_status_dueAt_idx" ON "HrAssessment"("evaluatorId", "status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrRecruitmentOffer_applicationId_key" ON "HrRecruitmentOffer"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrRecruitmentOffer_activeVersionId_key" ON "HrRecruitmentOffer"("activeVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "HrRecruitmentOffer_acceptedVersionId_key" ON "HrRecruitmentOffer"("acceptedVersionId");

-- CreateIndex
CREATE INDEX "HrRecruitmentOffer_organizationId_status_updatedAt_idx" ON "HrRecruitmentOffer"("organizationId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "HrRecruitmentOfferVersion_offerId_createdAt_idx" ON "HrRecruitmentOfferVersion"("offerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrRecruitmentOfferVersion_offerId_version_key" ON "HrRecruitmentOfferVersion"("offerId", "version");

-- CreateIndex
CREATE INDEX "HrRecruitmentOfferApproval_approverId_decidedAt_idx" ON "HrRecruitmentOfferApproval"("approverId", "decidedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrRecruitmentOfferApproval_offerVersionId_step_key" ON "HrRecruitmentOfferApproval"("offerVersionId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "HrRecruitmentOfferDelivery_idempotencyKey_key" ON "HrRecruitmentOfferDelivery"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "HrRecruitmentOfferAcceptance_offerId_key" ON "HrRecruitmentOfferAcceptance"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "HrRecruitmentOfferAcceptance_offerVersionId_key" ON "HrRecruitmentOfferAcceptance"("offerVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "HrRecruitmentOfferDecline_offerId_key" ON "HrRecruitmentOfferDecline"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "HrRecruitmentHandover_offerAcceptanceId_key" ON "HrRecruitmentHandover"("offerAcceptanceId");

-- CreateIndex
CREATE INDEX "HrRecruitmentHandover_organizationId_status_updatedAt_idx" ON "HrRecruitmentHandover"("organizationId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "HrRecruitmentHandover_assignedHrTeamId_status_idx" ON "HrRecruitmentHandover"("assignedHrTeamId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HrRecruitmentRequirementDefinition_organizationId_key_key" ON "HrRecruitmentRequirementDefinition"("organizationId", "key");

-- CreateIndex
CREATE INDEX "HrRecruitmentRequirement_handoverId_status_blocking_idx" ON "HrRecruitmentRequirement"("handoverId", "status", "blocking");

-- CreateIndex
CREATE UNIQUE INDEX "HrRecruitmentRequirement_handoverId_definitionId_key" ON "HrRecruitmentRequirement"("handoverId", "definitionId");

-- CreateIndex
CREATE INDEX "HrRecruitmentDocumentReview_handoverId_status_idx" ON "HrRecruitmentDocumentReview"("handoverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HrRecruitmentDocumentReview_handoverId_uploadedDocumentId_d_key" ON "HrRecruitmentDocumentReview"("handoverId", "uploadedDocumentId", "documentVersion", "reviewScope");

-- CreateIndex
CREATE UNIQUE INDEX "HrCandidateEmployeeLink_applicantId_key" ON "HrCandidateEmployeeLink"("applicantId");

-- CreateIndex
CREATE UNIQUE INDEX "HrCandidateEmployeeLink_employeeId_key" ON "HrCandidateEmployeeLink"("employeeId");

-- CreateIndex
CREATE INDEX "HrCandidateEmployeeLink_organizationId_createdAt_idx" ON "HrCandidateEmployeeLink"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrPreHireConversion_handoverId_key" ON "HrPreHireConversion"("handoverId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPreHireConversion_applicantId_key" ON "HrPreHireConversion"("applicantId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPreHireConversion_applicationId_key" ON "HrPreHireConversion"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPreHireConversion_employeeId_key" ON "HrPreHireConversion"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPreHireConversion_lifecycleInstanceId_key" ON "HrPreHireConversion"("lifecycleInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPreHireConversion_idempotencyKey_key" ON "HrPreHireConversion"("idempotencyKey");

-- CreateIndex
CREATE INDEX "HrPreHireConversion_organizationId_convertedAt_idx" ON "HrPreHireConversion"("organizationId", "convertedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrRecruitmentActivation_employeeId_key" ON "HrRecruitmentActivation"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "HrRecruitmentActivation_idempotencyKey_key" ON "HrRecruitmentActivation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "HrRecruitmentActivation_organizationId_createdAt_idx" ON "HrRecruitmentActivation"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Applicant_applicantNumber_key" ON "Applicant"("applicantNumber");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_applicationReference_key" ON "JobApplication"("applicationReference");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_submissionKey_key" ON "JobApplication"("submissionKey");

-- CreateIndex
CREATE INDEX "JobApplication_organizationId_recruitmentStatus_createdAt_idx" ON "JobApplication"("organizationId", "recruitmentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "JobApplication_vacancyId_recruitmentStatus_idx" ON "JobApplication"("vacancyId", "recruitmentStatus");

-- CreateIndex
CREATE INDEX "JobApplication_assignedHiringTeamId_recruitmentStatus_idx" ON "JobApplication"("assignedHiringTeamId", "recruitmentStatus");

-- AddForeignKey
ALTER TABLE "HrInterviewParticipant" ADD CONSTRAINT "HrInterviewParticipant_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "HrInterview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrInterviewFeedback" ADD CONSTRAINT "HrInterviewFeedback_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "HrInterview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRecruitmentOffer" ADD CONSTRAINT "HrRecruitmentOffer_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "HrRecruitmentOfferVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRecruitmentOffer" ADD CONSTRAINT "HrRecruitmentOffer_acceptedVersionId_fkey" FOREIGN KEY ("acceptedVersionId") REFERENCES "HrRecruitmentOfferVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRecruitmentOfferVersion" ADD CONSTRAINT "HrRecruitmentOfferVersion_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "HrRecruitmentOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRecruitmentOfferApproval" ADD CONSTRAINT "HrRecruitmentOfferApproval_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "HrRecruitmentOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRecruitmentOfferDelivery" ADD CONSTRAINT "HrRecruitmentOfferDelivery_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "HrRecruitmentOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRecruitmentOfferAcceptance" ADD CONSTRAINT "HrRecruitmentOfferAcceptance_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "HrRecruitmentOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRecruitmentOfferDecline" ADD CONSTRAINT "HrRecruitmentOfferDecline_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "HrRecruitmentOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRecruitmentHandover" ADD CONSTRAINT "HrRecruitmentHandover_offerAcceptanceId_fkey" FOREIGN KEY ("offerAcceptanceId") REFERENCES "HrRecruitmentOfferAcceptance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Scalar lifecycle links intentionally remain decoupled in Prisma to preserve the legacy
-- application API, but PostgreSQL still enforces the complete recruitment ownership chain.
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_vacancyId_fkey"
  FOREIGN KEY ("vacancyId") REFERENCES "HrVacancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrApplicationAnswer" ADD CONSTRAINT "HrApplicationAnswer_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrApplicationStageHistory" ADD CONSTRAINT "HrApplicationStageHistory_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrApplicationReviewTask" ADD CONSTRAINT "HrApplicationReviewTask_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrInterview" ADD CONSTRAINT "HrInterview_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrAssessment" ADD CONSTRAINT "HrAssessment_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrRecruitmentOffer" ADD CONSTRAINT "HrRecruitmentOffer_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrRecruitmentHandover" ADD CONSTRAINT "HrRecruitmentHandover_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrRecruitmentDocumentReview" ADD CONSTRAINT "HrRecruitmentDocumentReview_uploadedDocumentId_fkey"
  FOREIGN KEY ("uploadedDocumentId") REFERENCES "UploadedDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrCandidateEmployeeLink" ADD CONSTRAINT "HrCandidateEmployeeLink_applicantId_fkey"
  FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrCandidateEmployeeLink" ADD CONSTRAINT "HrCandidateEmployeeLink_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPreHireConversion" ADD CONSTRAINT "HrPreHireConversion_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPreHireConversion" ADD CONSTRAINT "HrPreHireConversion_lifecycleInstanceId_fkey"
  FOREIGN KEY ("lifecycleInstanceId") REFERENCES "HrLifecycleInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrRecruitmentActivation" ADD CONSTRAINT "HrRecruitmentActivation_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HrInterview" ADD CONSTRAINT "HrInterview_valid_time_range"
  CHECK ("endsAt" > "startsAt");
ALTER TABLE "HrRecruitmentOfferVersion" ADD CONSTRAINT "HrRecruitmentOfferVersion_positive_salary"
  CHECK ("salary" > 0);
ALTER TABLE "HrRecruitmentOfferVersion" ADD CONSTRAINT "HrRecruitmentOfferVersion_valid_expiry"
  CHECK ("expiresAt" > "createdAt");

-- AddForeignKey
ALTER TABLE "HrRecruitmentRequirement" ADD CONSTRAINT "HrRecruitmentRequirement_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "HrRecruitmentHandover"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRecruitmentDocumentReview" ADD CONSTRAINT "HrRecruitmentDocumentReview_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "HrRecruitmentHandover"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrPreHireConversion" ADD CONSTRAINT "HrPreHireConversion_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "HrRecruitmentHandover"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
