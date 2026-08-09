CREATE TYPE "HrProbationCaseStatus" AS ENUM ('ACTIVE', 'UNDER_REVIEW', 'CONFIRMED', 'EXTENDED', 'UNSUCCESSFUL', 'CANCELLED');
CREATE TYPE "HrProbationReviewType" AS ENUM ('CHECKPOINT', 'FINAL');
CREATE TYPE "HrProbationRecommendation" AS ENUM ('CONTINUE', 'CONFIRM', 'EXTEND', 'END_EMPLOYMENT');
CREATE TYPE "HrEmploymentContractStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SIGNED', 'SCHEDULED', 'ACTIVE', 'SUPERSEDED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "HrSeparationType" AS ENUM ('RESIGNATION', 'TERMINATION', 'REDUNDANCY', 'RETIREMENT', 'CONTRACT_EXPIRY', 'DEATH_IN_SERVICE', 'OTHER');
CREATE TYPE "HrSeparationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'SCHEDULED', 'APPLIED', 'WITHDRAWN', 'REJECTED', 'CANCELLED', 'FAILED');

CREATE TABLE "HrProbationCase" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
  "workforceEventId" TEXT, "status" "HrProbationCaseStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1, "startedAt" TIMESTAMP(3) NOT NULL,
  "scheduledEndAt" TIMESTAMP(3) NOT NULL, "configuredDurationDays" INTEGER NOT NULL,
  "objectives" JSONB NOT NULL, "extensionCount" INTEGER NOT NULL DEFAULT 0,
  "confirmedAt" TIMESTAMP(3), "unsuccessfulAt" TIMESTAMP(3), "decisionReason" TEXT,
  "createdById" TEXT NOT NULL, "decidedById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrProbationCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrProbationCase_version_check" CHECK ("version" > 0),
  CONSTRAINT "HrProbationCase_duration_check" CHECK ("configuredDurationDays" > 0),
  CONSTRAINT "HrProbationCase_extension_check" CHECK ("extensionCount" >= 0)
);

CREATE TABLE "HrProbationReview" (
  "id" TEXT NOT NULL, "probationCaseId" TEXT NOT NULL, "type" "HrProbationReviewType" NOT NULL,
  "checkpointAt" TIMESTAMP(3) NOT NULL, "managerUserId" TEXT, "employeeComment" TEXT,
  "managerComment" TEXT, "recommendation" "HrProbationRecommendation", "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrProbationReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrEmploymentContract" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
  "workRelationshipId" TEXT NOT NULL, "contractRef" TEXT NOT NULL,
  "status" "HrEmploymentContractStatus" NOT NULL DEFAULT 'DRAFT', "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "effectiveFrom" TIMESTAMP(3) NOT NULL, "effectiveTo" TIMESTAMP(3), "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrEmploymentContract_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrEmploymentContract_version_check" CHECK ("currentVersion" > 0)
);

CREATE TABLE "HrEmploymentContractVersion" (
  "id" TEXT NOT NULL, "contractId" TEXT NOT NULL, "version" INTEGER NOT NULL, "termsSnapshot" JSONB NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL, "effectiveTo" TIMESTAMP(3), "documentVersionId" TEXT,
  "approvedById" TEXT, "approvedAt" TIMESTAMP(3), "signedAt" TIMESTAMP(3), "supersededAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrEmploymentContractVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrEmploymentContractVersion_version_check" CHECK ("version" > 0)
);

CREATE TABLE "HrSeparationCase" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
  "workRelationshipId" TEXT NOT NULL, "workforceEventId" TEXT, "type" "HrSeparationType" NOT NULL,
  "status" "HrSeparationStatus" NOT NULL DEFAULT 'DRAFT', "version" INTEGER NOT NULL DEFAULT 1,
  "reason" TEXT NOT NULL, "initiatedById" TEXT NOT NULL, "noticeDate" TIMESTAMP(3),
  "finalWorkingDate" TIMESTAMP(3) NOT NULL, "approvedById" TEXT, "approvedAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3), "withdrawnAt" TIMESTAMP(3), "cancelledAt" TIMESTAMP(3),
  "failureReason" TEXT, "correlationId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrSeparationCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrSeparationCase_version_check" CHECK ("version" > 0)
);

CREATE INDEX "HrProbationCase_organizationId_status_scheduledEndAt_idx" ON "HrProbationCase"("organizationId", "status", "scheduledEndAt");
CREATE INDEX "HrProbationCase_employeeId_status_startedAt_idx" ON "HrProbationCase"("employeeId", "status", "startedAt");
CREATE UNIQUE INDEX "HrProbationReview_case_type_checkpoint_key" ON "HrProbationReview"("probationCaseId", "type", "checkpointAt");
CREATE INDEX "HrProbationReview_checkpointAt_submittedAt_idx" ON "HrProbationReview"("checkpointAt", "submittedAt");
CREATE UNIQUE INDEX "HrEmploymentContract_organizationId_contractRef_key" ON "HrEmploymentContract"("organizationId", "contractRef");
CREATE INDEX "HrEmploymentContract_employeeId_status_effective_idx" ON "HrEmploymentContract"("employeeId", "status", "effectiveFrom", "effectiveTo");
CREATE UNIQUE INDEX "HrEmploymentContractVersion_contractId_version_key" ON "HrEmploymentContractVersion"("contractId", "version");
CREATE INDEX "HrEmploymentContractVersion_contractId_effective_idx" ON "HrEmploymentContractVersion"("contractId", "effectiveFrom", "effectiveTo");
CREATE UNIQUE INDEX "HrSeparationCase_organizationId_correlationId_key" ON "HrSeparationCase"("organizationId", "correlationId");
CREATE INDEX "HrSeparationCase_organizationId_status_finalWorkingDate_idx" ON "HrSeparationCase"("organizationId", "status", "finalWorkingDate");
CREATE INDEX "HrSeparationCase_employeeId_status_finalWorkingDate_idx" ON "HrSeparationCase"("employeeId", "status", "finalWorkingDate");

ALTER TABLE "HrProbationCase" ADD CONSTRAINT "HrProbationCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrProbationCase" ADD CONSTRAINT "HrProbationCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrProbationReview" ADD CONSTRAINT "HrProbationReview_probationCaseId_fkey" FOREIGN KEY ("probationCaseId") REFERENCES "HrProbationCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmploymentContract" ADD CONSTRAINT "HrEmploymentContract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmploymentContract" ADD CONSTRAINT "HrEmploymentContract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmploymentContract" ADD CONSTRAINT "HrEmploymentContract_workRelationshipId_fkey" FOREIGN KEY ("workRelationshipId") REFERENCES "HrWorkRelationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmploymentContractVersion" ADD CONSTRAINT "HrEmploymentContractVersion_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "HrEmploymentContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrSeparationCase" ADD CONSTRAINT "HrSeparationCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrSeparationCase" ADD CONSTRAINT "HrSeparationCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrSeparationCase" ADD CONSTRAINT "HrSeparationCase_workRelationshipId_fkey" FOREIGN KEY ("workRelationshipId") REFERENCES "HrWorkRelationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
