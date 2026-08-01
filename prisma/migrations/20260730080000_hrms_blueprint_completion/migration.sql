-- Complete the durable in-app notification foundation without altering recruitment data.
CREATE TYPE "HrCompanyEmailStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED');
CREATE TYPE "HrWorkMode" AS ENUM ('ONSITE', 'HYBRID', 'REMOTE');
CREATE TYPE "HrSystemAccessStatus" AS ENUM ('REQUESTED', 'ACTIVE', 'SUSPENDED', 'REVOKED');
ALTER TYPE "HrEmploymentStatus" ADD VALUE IF NOT EXISTS 'ONBOARDING';
ALTER TYPE "HrEmploymentStatus" ADD VALUE IF NOT EXISTS 'NOTICE_PERIOD';
ALTER TYPE "HrEmploymentStatus" ADD VALUE IF NOT EXISTS 'RESIGNED';

ALTER TABLE "HrEmployee"
  ADD COLUMN "preferredNotificationEmail" TEXT,
  ADD COLUMN "companyEmailStatus" "HrCompanyEmailStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "startDate" TIMESTAMP(3),
  ADD COLUMN "workMode" "HrWorkMode",
  ADD COLUMN "probationEndDate" TIMESTAMP(3),
  ADD COLUMN "confirmationDate" TIMESTAMP(3),
  ADD COLUMN "noticePeriodStartDate" TIMESTAMP(3),
  ADD COLUMN "notes" TEXT;

ALTER TABLE "HrLifecycleInstance"
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "payrollStopDate" TIMESTAMP(3),
  ADD COLUMN "finalPayrollRequired" BOOLEAN,
  ADD COLUMN "leaveReconciliation" TEXT,
  ADD COLUMN "companyEmailDisabledAt" TIMESTAMP(3),
  ADD COLUMN "finalCommunicationSentAt" TIMESTAMP(3);

ALTER TABLE "HrWorkflowStageRun"
  ADD COLUMN "delegatedFromUserId" TEXT,
  ADD COLUMN "reassignedAt" TIMESTAMP(3);

ALTER TABLE "HrWorkflowApproval"
  ADD COLUMN "actorRole" TEXT,
  ADD COLUMN "requestType" TEXT,
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "previousStatus" TEXT,
  ADD COLUMN "newStatus" TEXT,
  ADD COLUMN "correlationId" TEXT;
UPDATE "HrWorkflowApproval" approval
SET "actorRole" = 'LEGACY_UNKNOWN',
    "requestType" = instance."subjectType",
    "requestId" = instance."subjectId",
    "previousStatus" = 'ACTIVE',
    "newStatus" = approval."decision"::text,
    "correlationId" = 'legacy-workflow-approval:' || approval."id"
FROM "HrWorkflowStageRun" stage
JOIN "HrWorkflowInstance" instance ON instance."id" = stage."instanceId"
WHERE approval."stageRunId" = stage."id";
ALTER TABLE "HrWorkflowApproval"
  ALTER COLUMN "actorRole" SET NOT NULL,
  ALTER COLUMN "requestType" SET NOT NULL,
  ALTER COLUMN "requestId" SET NOT NULL,
  ALTER COLUMN "previousStatus" SET NOT NULL,
  ALTER COLUMN "newStatus" SET NOT NULL,
  ALTER COLUMN "correlationId" SET NOT NULL;
CREATE UNIQUE INDEX "HrWorkflowApproval_correlationId_key" ON "HrWorkflowApproval"("correlationId");

ALTER TABLE "HrSupervisorAssignment" ADD COLUMN "teamScopeId" TEXT;
CREATE INDEX "HrSupervisorAssignment_organizationId_departmentScopeId_teamScopeId_status_idx"
  ON "HrSupervisorAssignment"("organizationId", "departmentScopeId", "teamScopeId", "status");
ALTER TABLE "HrSupervisorAssignment"
  ADD CONSTRAINT "HrSupervisorAssignment_teamScopeId_fkey"
  FOREIGN KEY ("teamScopeId") REFERENCES "HrTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "HrEmployeeNumberSequence" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "lastValue" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrEmployeeNumberSequence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HrEmployeeNumberSequence_organizationId_year_key" ON "HrEmployeeNumberSequence"("organizationId", "year");
ALTER TABLE "HrEmployeeNumberSequence" ADD CONSTRAINT "HrEmployeeNumberSequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "HrEmployeeStatusHistory" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "previousStatus" "HrEmploymentStatus",
  "newStatus" "HrEmploymentStatus" NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "changedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrEmployeeStatusHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HrEmployeeStatusHistory_employeeId_effectiveAt_idx" ON "HrEmployeeStatusHistory"("employeeId", "effectiveAt");
CREATE INDEX "HrEmployeeStatusHistory_organizationId_newStatus_effectiveAt_idx" ON "HrEmployeeStatusHistory"("organizationId", "newStatus", "effectiveAt");
ALTER TABLE "HrEmployeeStatusHistory" ADD CONSTRAINT "HrEmployeeStatusHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeStatusHistory" ADD CONSTRAINT "HrEmployeeStatusHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeStatusHistory" ADD CONSTRAINT "HrEmployeeStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "HrSystemAccessAssignment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "systemKey" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "accountRef" TEXT,
  "status" "HrSystemAccessStatus" NOT NULL DEFAULT 'REQUESTED',
  "assignedAt" TIMESTAMP(3),
  "expectedEndAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "endedById" TEXT,
  "reason" TEXT NOT NULL,
  "endReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrSystemAccessAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HrSystemAccessAssignment_employeeId_systemKey_status_idx" ON "HrSystemAccessAssignment"("employeeId", "systemKey", "status");
CREATE INDEX "HrSystemAccessAssignment_organizationId_status_expectedEndAt_idx" ON "HrSystemAccessAssignment"("organizationId", "status", "expectedEndAt");
ALTER TABLE "HrSystemAccessAssignment" ADD CONSTRAINT "HrSystemAccessAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrSystemAccessAssignment" ADD CONSTRAINT "HrSystemAccessAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrSystemAccessAssignment" ADD CONSTRAINT "HrSystemAccessAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrSystemAccessAssignment" ADD CONSTRAINT "HrSystemAccessAssignment_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "HrNotification" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "href" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrNotificationPreference" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrNotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HrNotification_idempotencyKey_key" ON "HrNotification"("idempotencyKey");
CREATE INDEX "HrNotification_userId_readAt_createdAt_idx" ON "HrNotification"("userId", "readAt", "createdAt");
CREATE INDEX "HrNotification_organizationId_category_createdAt_idx" ON "HrNotification"("organizationId", "category", "createdAt");
CREATE UNIQUE INDEX "HrNotificationPreference_userId_category_key" ON "HrNotificationPreference"("userId", "category");
CREATE INDEX "HrNotificationPreference_organizationId_category_idx" ON "HrNotificationPreference"("organizationId", "category");

ALTER TABLE "HrNotification"
  ADD CONSTRAINT "HrNotification_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrNotification"
  ADD CONSTRAINT "HrNotification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "HrUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrNotificationPreference"
  ADD CONSTRAINT "HrNotificationPreference_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrNotificationPreference"
  ADD CONSTRAINT "HrNotificationPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "HrUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
