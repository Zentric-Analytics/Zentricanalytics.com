-- Baseline Phase 2 schema for fresh staging/dev databases.
-- This migration intentionally creates the current Prisma schema from zero so
-- `prisma migrate deploy` does not depend on missing pre-Phase-2 migrations.

CREATE TABLE "Applicant" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Applicant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "roleAppliedFor" TEXT NOT NULL,
    "workModePreference" TEXT,
    "experienceLevel" TEXT,
    "skills" TEXT,
    "portfolioUrl" TEXT,
    "message" TEXT,
    "privacyConsent" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "currentStageOrder" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HiringStage" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "stageKey" TEXT NOT NULL,
    "stageOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Locked',
    "unlockedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "HiringStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StageSubmission" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StageApproval" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UploadedDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "restricted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicantDocument" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "uploadedDocumentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Submitted',

    CONSTRAINT "ApplicantDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ElectronicSignature" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "typedName" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "ElectronicSignature_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminNote" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailNotification" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "roleOffered" TEXT NOT NULL,
    "salary" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "workMode" TEXT NOT NULL,
    "reportingManager" TEXT,
    "probationPeriod" TEXT,
    "offerExpiryDate" TIMESTAMP(3),
    "specialConditions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmploymentAgreement" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "agreementText" TEXT NOT NULL,
    "roleSchedule" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmploymentAgreement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorRef" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationAccessCode" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "verifiedSessionTokenHash" TEXT,
    "sessionExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationAccessCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobApplication_applicationId_key" ON "JobApplication"("applicationId");
CREATE UNIQUE INDEX "ElectronicSignature_submissionId_key" ON "ElectronicSignature"("submissionId");
CREATE UNIQUE INDEX "Offer_applicationId_key" ON "Offer"("applicationId");
CREATE UNIQUE INDEX "EmploymentAgreement_applicationId_key" ON "EmploymentAgreement"("applicationId");

ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HiringStage" ADD CONSTRAINT "HiringStage_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StageSubmission" ADD CONSTRAINT "StageSubmission_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "HiringStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StageApproval" ADD CONSTRAINT "StageApproval_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "HiringStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UploadedDocument" ADD CONSTRAINT "UploadedDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicantDocument" ADD CONSTRAINT "ApplicantDocument_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "StageSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicantDocument" ADD CONSTRAINT "ApplicantDocument_uploadedDocumentId_fkey" FOREIGN KEY ("uploadedDocumentId") REFERENCES "UploadedDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ElectronicSignature" ADD CONSTRAINT "ElectronicSignature_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "StageSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailNotification" ADD CONSTRAINT "EmailNotification_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApplicationAccessCode" ADD CONSTRAINT "ApplicationAccessCode_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
