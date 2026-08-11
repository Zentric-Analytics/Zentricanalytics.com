-- CreateEnum
CREATE TYPE "HrLeaveEntitlementModel" AS ENUM ('ENTITLEMENT', 'EVENT_LIMITED', 'UNLIMITED', 'UNPAID', 'STATUTORY', 'LONG_TERM');

-- CreateEnum
CREATE TYPE "HrLeaveRequestLifecycleStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED', 'APPROVED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLATION_PENDING', 'CANCELLED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "HrLeaveEntryKind" AS ENUM ('GRANT', 'ACCRUAL', 'CARRYOVER_IN', 'CARRYOVER_OUT', 'RESERVATION', 'RESERVATION_RELEASE', 'CONSUMPTION', 'ADJUSTMENT', 'EXPIRY', 'REVERSAL', 'CORRECTION');

-- CreateEnum
CREATE TYPE "HrLeaveJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'ABANDONED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "HrWorkforceEventType" ADD VALUE 'LEAVE_OF_ABSENCE';
ALTER TYPE "HrWorkforceEventType" ADD VALUE 'RETURN_FROM_LEAVE';

-- AlterTable
ALTER TABLE "HrLeavePolicy" ADD COLUMN     "entitlementModel" "HrLeaveEntitlementModel" NOT NULL DEFAULT 'ENTITLEMENT',
ADD COLUMN     "evidenceClass" TEXT,
ADD COLUMN     "evidenceRetentionDays" INTEGER,
ADD COLUMN     "minimumRequest" DECIMAL(10,2),
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC',
ADD COLUMN     "workflowDefinitionKey" TEXT;

-- CreateTable
CREATE TABLE "HrLeavePolicyApplicability" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leavePolicyId" TEXT NOT NULL,
    "countryCode" TEXT,
    "legalEntityId" TEXT,
    "locationId" TEXT,
    "employmentType" "HrEmploymentType",
    "gradeId" TEXT,
    "minimumTenureDays" INTEGER,
    "maximumTenureDays" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "ruleSchemaVersion" INTEGER NOT NULL DEFAULT 1,
    "rule" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrLeavePolicyApplicability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrWorkSchedule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrWorkSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrWorkScheduleVersion" (
    "id" TEXT NOT NULL,
    "workScheduleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "weeklyPattern" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrWorkScheduleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrWorkScheduleAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workScheduleId" TEXT NOT NULL,
    "workScheduleVersionId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrWorkScheduleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrHolidayCalendar" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrHolidayCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrHolidayCalendarVersion" (
    "id" TEXT NOT NULL,
    "holidayCalendarId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrHolidayCalendarVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrHolidayOccurrence" (
    "id" TEXT NOT NULL,
    "holidayCalendarVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "localDate" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER,
    "companyShutdown" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "HrHolidayOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrHolidayCalendarAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "holidayCalendarId" TEXT NOT NULL,
    "holidayCalendarVersionId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrHolidayCalendarAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrLeaveAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "unit" "HrLeaveUnit" NOT NULL,
    "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrLeaveAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrLeaveAccountPeriod" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "leavePolicyId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "granted" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "accrued" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "carriedOver" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "adjusted" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "consumed" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "expired" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrLeaveAccountPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrLeaveLedgerEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountPeriodId" TEXT NOT NULL,
    "leavePolicyId" TEXT NOT NULL,
    "kind" "HrLeaveEntryKind" NOT NULL,
    "amount" DECIMAL(12,4) NOT NULL,
    "unit" "HrLeaveUnit" NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "workerKey" TEXT,
    "reason" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reversalOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrLeaveLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrLeaveRequestVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leavePolicyId" TEXT NOT NULL,
    "workScheduleVersionId" TEXT NOT NULL,
    "holidayCalendarVersionId" TEXT NOT NULL,
    "lifecycleStatus" "HrLeaveRequestLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "unit" "HrLeaveUnit" NOT NULL,
    "requestedAmount" DECIMAL(12,4) NOT NULL,
    "operationalReason" TEXT,
    "confidentialReason" TEXT,
    "calculationSnapshot" JSONB NOT NULL,
    "workflowInstanceId" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrLeaveRequestVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrLeaveRequestSegment" (
    "id" TEXT NOT NULL,
    "requestVersionId" TEXT NOT NULL,
    "accountPeriodId" TEXT,
    "sequence" INTEGER NOT NULL,
    "localDate" TIMESTAMP(3) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "scheduledMinutes" INTEGER NOT NULL,
    "excludedMinutes" INTEGER NOT NULL,
    "chargeableAmount" DECIMAL(12,4) NOT NULL,
    "exclusionReason" TEXT,

    CONSTRAINT "HrLeaveRequestSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrLeaveTransition" (
    "id" TEXT NOT NULL,
    "requestVersionId" TEXT NOT NULL,
    "fromStatus" "HrLeaveRequestLifecycleStatus",
    "toStatus" "HrLeaveRequestLifecycleStatus" NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrLeaveTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrLeaveDelegation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "delegatorUserId" TEXT NOT NULL,
    "delegateUserId" TEXT NOT NULL,
    "scope" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrLeaveDelegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrLeaveEvidence" (
    "id" TEXT NOT NULL,
    "requestVersionId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "retentionUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrLeaveEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrLeaveLongAbsence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestVersionId" TEXT NOT NULL,
    "startWorkforceEventId" TEXT,
    "returnWorkforceEventId" TEXT,
    "status" TEXT NOT NULL,
    "expectedReturnAt" TIMESTAMP(3),
    "actualReturnAt" TIMESTAMP(3),
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrLeaveLongAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrLeaveJobRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "windowKey" TEXT NOT NULL,
    "status" "HrLeaveJobStatus" NOT NULL DEFAULT 'PENDING',
    "claimTokenHash" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "checkpoint" JSONB,
    "safeError" TEXT,
    "correlationId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrLeaveJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HrLeavePolicyApplicability_organizationId_leavePolicyId_pri_idx" ON "HrLeavePolicyApplicability"("organizationId", "leavePolicyId", "priority");

-- CreateIndex
CREATE INDEX "HrLeavePolicyApplicability_legalEntityId_locationId_employm_idx" ON "HrLeavePolicyApplicability"("legalEntityId", "locationId", "employmentType", "gradeId");

-- CreateIndex
CREATE INDEX "HrWorkSchedule_organizationId_status_idx" ON "HrWorkSchedule"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HrWorkSchedule_organizationId_code_key" ON "HrWorkSchedule"("organizationId", "code");

-- CreateIndex
CREATE INDEX "HrWorkScheduleVersion_workScheduleId_effectiveFrom_effectiv_idx" ON "HrWorkScheduleVersion"("workScheduleId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "HrWorkScheduleVersion_workScheduleId_version_key" ON "HrWorkScheduleVersion"("workScheduleId", "version");

-- CreateIndex
CREATE INDEX "HrWorkScheduleAssignment_organizationId_employeeId_effectiv_idx" ON "HrWorkScheduleAssignment"("organizationId", "employeeId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "HrHolidayCalendar_organizationId_status_idx" ON "HrHolidayCalendar"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HrHolidayCalendar_organizationId_code_key" ON "HrHolidayCalendar"("organizationId", "code");

-- CreateIndex
CREATE INDEX "HrHolidayCalendarVersion_holidayCalendarId_effectiveFrom_ef_idx" ON "HrHolidayCalendarVersion"("holidayCalendarId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "HrHolidayCalendarVersion_holidayCalendarId_version_key" ON "HrHolidayCalendarVersion"("holidayCalendarId", "version");

-- CreateIndex
CREATE INDEX "HrHolidayOccurrence_holidayCalendarVersionId_localDate_idx" ON "HrHolidayOccurrence"("holidayCalendarVersionId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "HrHolidayOccurrence_holidayCalendarVersionId_code_localDate_key" ON "HrHolidayOccurrence"("holidayCalendarVersionId", "code", "localDate");

-- CreateIndex
CREATE INDEX "HrHolidayCalendarAssignment_organizationId_employeeId_effec_idx" ON "HrHolidayCalendarAssignment"("organizationId", "employeeId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "HrLeaveAccount_organizationId_status_employeeId_idx" ON "HrLeaveAccount"("organizationId", "status", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "HrLeaveAccount_organizationId_employeeId_leaveTypeId_unit_key" ON "HrLeaveAccount"("organizationId", "employeeId", "leaveTypeId", "unit");

-- CreateIndex
CREATE INDEX "HrLeaveAccountPeriod_accountId_periodStart_periodEnd_idx" ON "HrLeaveAccountPeriod"("accountId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "HrLeaveAccountPeriod_accountId_periodStart_periodEnd_key" ON "HrLeaveAccountPeriod"("accountId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "HrLeaveLedgerEntry_accountPeriodId_effectiveAt_idx" ON "HrLeaveLedgerEntry"("accountPeriodId", "effectiveAt");

-- CreateIndex
CREATE INDEX "HrLeaveLedgerEntry_organizationId_correlationId_idx" ON "HrLeaveLedgerEntry"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrLeaveLedgerEntry_sourceType_sourceId_idx" ON "HrLeaveLedgerEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "HrLeaveLedgerEntry_organizationId_idempotencyKey_key" ON "HrLeaveLedgerEntry"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "HrLeaveRequestVersion_organizationId_lifecycleStatus_create_idx" ON "HrLeaveRequestVersion"("organizationId", "lifecycleStatus", "createdAt");

-- CreateIndex
CREATE INDEX "HrLeaveRequestVersion_employeeId_createdAt_idx" ON "HrLeaveRequestVersion"("employeeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrLeaveRequestVersion_requestId_version_key" ON "HrLeaveRequestVersion"("requestId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "HrLeaveRequestVersion_organizationId_correlationId_key" ON "HrLeaveRequestVersion"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrLeaveRequestSegment_requestVersionId_localDate_idx" ON "HrLeaveRequestSegment"("requestVersionId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "HrLeaveRequestSegment_requestVersionId_sequence_key" ON "HrLeaveRequestSegment"("requestVersionId", "sequence");

-- CreateIndex
CREATE INDEX "HrLeaveTransition_correlationId_createdAt_idx" ON "HrLeaveTransition"("correlationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrLeaveTransition_requestVersionId_idempotencyKey_key" ON "HrLeaveTransition"("requestVersionId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "HrLeaveDelegation_organizationId_delegateUserId_effectiveFr_idx" ON "HrLeaveDelegation"("organizationId", "delegateUserId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "HrLeaveEvidence_classification_status_idx" ON "HrLeaveEvidence"("classification", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HrLeaveEvidence_requestVersionId_documentVersionId_key" ON "HrLeaveEvidence"("requestVersionId", "documentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "HrLeaveLongAbsence_requestVersionId_key" ON "HrLeaveLongAbsence"("requestVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "HrLeaveLongAbsence_startWorkforceEventId_key" ON "HrLeaveLongAbsence"("startWorkforceEventId");

-- CreateIndex
CREATE UNIQUE INDEX "HrLeaveLongAbsence_returnWorkforceEventId_key" ON "HrLeaveLongAbsence"("returnWorkforceEventId");

-- CreateIndex
CREATE INDEX "HrLeaveLongAbsence_organizationId_status_expectedReturnAt_idx" ON "HrLeaveLongAbsence"("organizationId", "status", "expectedReturnAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrLeaveLongAbsence_organizationId_correlationId_key" ON "HrLeaveLongAbsence"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrLeaveJobRun_status_createdAt_idx" ON "HrLeaveJobRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "HrLeaveJobRun_organizationId_correlationId_idx" ON "HrLeaveJobRun"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrLeaveJobRun_organizationId_jobType_windowKey_key" ON "HrLeaveJobRun"("organizationId", "jobType", "windowKey");

-- AddForeignKey
ALTER TABLE "HrLeavePolicyApplicability" ADD CONSTRAINT "HrLeavePolicyApplicability_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeavePolicyApplicability" ADD CONSTRAINT "HrLeavePolicyApplicability_leavePolicyId_fkey" FOREIGN KEY ("leavePolicyId") REFERENCES "HrLeavePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrWorkSchedule" ADD CONSTRAINT "HrWorkSchedule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrWorkScheduleVersion" ADD CONSTRAINT "HrWorkScheduleVersion_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "HrWorkSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrWorkScheduleAssignment" ADD CONSTRAINT "HrWorkScheduleAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrWorkScheduleAssignment" ADD CONSTRAINT "HrWorkScheduleAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrWorkScheduleAssignment" ADD CONSTRAINT "HrWorkScheduleAssignment_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "HrWorkSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrWorkScheduleAssignment" ADD CONSTRAINT "HrWorkScheduleAssignment_workScheduleVersionId_fkey" FOREIGN KEY ("workScheduleVersionId") REFERENCES "HrWorkScheduleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrHolidayCalendar" ADD CONSTRAINT "HrHolidayCalendar_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrHolidayCalendarVersion" ADD CONSTRAINT "HrHolidayCalendarVersion_holidayCalendarId_fkey" FOREIGN KEY ("holidayCalendarId") REFERENCES "HrHolidayCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrHolidayOccurrence" ADD CONSTRAINT "HrHolidayOccurrence_holidayCalendarVersionId_fkey" FOREIGN KEY ("holidayCalendarVersionId") REFERENCES "HrHolidayCalendarVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrHolidayCalendarAssignment" ADD CONSTRAINT "HrHolidayCalendarAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrHolidayCalendarAssignment" ADD CONSTRAINT "HrHolidayCalendarAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrHolidayCalendarAssignment" ADD CONSTRAINT "HrHolidayCalendarAssignment_holidayCalendarId_fkey" FOREIGN KEY ("holidayCalendarId") REFERENCES "HrHolidayCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrHolidayCalendarAssignment" ADD CONSTRAINT "HrHolidayCalendarAssignment_holidayCalendarVersionId_fkey" FOREIGN KEY ("holidayCalendarVersionId") REFERENCES "HrHolidayCalendarVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveAccount" ADD CONSTRAINT "HrLeaveAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveAccount" ADD CONSTRAINT "HrLeaveAccount_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveAccount" ADD CONSTRAINT "HrLeaveAccount_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "HrLeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveAccountPeriod" ADD CONSTRAINT "HrLeaveAccountPeriod_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "HrLeaveAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveAccountPeriod" ADD CONSTRAINT "HrLeaveAccountPeriod_leavePolicyId_fkey" FOREIGN KEY ("leavePolicyId") REFERENCES "HrLeavePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveLedgerEntry" ADD CONSTRAINT "HrLeaveLedgerEntry_accountPeriodId_fkey" FOREIGN KEY ("accountPeriodId") REFERENCES "HrLeaveAccountPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveLedgerEntry" ADD CONSTRAINT "HrLeaveLedgerEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "HrLeaveLedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveRequestVersion" ADD CONSTRAINT "HrLeaveRequestVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveRequestVersion" ADD CONSTRAINT "HrLeaveRequestVersion_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "HrLeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveRequestVersion" ADD CONSTRAINT "HrLeaveRequestVersion_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveRequestVersion" ADD CONSTRAINT "HrLeaveRequestVersion_leavePolicyId_fkey" FOREIGN KEY ("leavePolicyId") REFERENCES "HrLeavePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveRequestVersion" ADD CONSTRAINT "HrLeaveRequestVersion_workScheduleVersionId_fkey" FOREIGN KEY ("workScheduleVersionId") REFERENCES "HrWorkScheduleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveRequestVersion" ADD CONSTRAINT "HrLeaveRequestVersion_holidayCalendarVersionId_fkey" FOREIGN KEY ("holidayCalendarVersionId") REFERENCES "HrHolidayCalendarVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveRequestSegment" ADD CONSTRAINT "HrLeaveRequestSegment_requestVersionId_fkey" FOREIGN KEY ("requestVersionId") REFERENCES "HrLeaveRequestVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveRequestSegment" ADD CONSTRAINT "HrLeaveRequestSegment_accountPeriodId_fkey" FOREIGN KEY ("accountPeriodId") REFERENCES "HrLeaveAccountPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveTransition" ADD CONSTRAINT "HrLeaveTransition_requestVersionId_fkey" FOREIGN KEY ("requestVersionId") REFERENCES "HrLeaveRequestVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveDelegation" ADD CONSTRAINT "HrLeaveDelegation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveDelegation" ADD CONSTRAINT "HrLeaveDelegation_delegatorUserId_fkey" FOREIGN KEY ("delegatorUserId") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveDelegation" ADD CONSTRAINT "HrLeaveDelegation_delegateUserId_fkey" FOREIGN KEY ("delegateUserId") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveEvidence" ADD CONSTRAINT "HrLeaveEvidence_requestVersionId_fkey" FOREIGN KEY ("requestVersionId") REFERENCES "HrLeaveRequestVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveEvidence" ADD CONSTRAINT "HrLeaveEvidence_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "HrEmployeeDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveLongAbsence" ADD CONSTRAINT "HrLeaveLongAbsence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveLongAbsence" ADD CONSTRAINT "HrLeaveLongAbsence_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveLongAbsence" ADD CONSTRAINT "HrLeaveLongAbsence_requestVersionId_fkey" FOREIGN KEY ("requestVersionId") REFERENCES "HrLeaveRequestVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveLongAbsence" ADD CONSTRAINT "HrLeaveLongAbsence_startWorkforceEventId_fkey" FOREIGN KEY ("startWorkforceEventId") REFERENCES "HrWorkforceEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveLongAbsence" ADD CONSTRAINT "HrLeaveLongAbsence_returnWorkforceEventId_fkey" FOREIGN KEY ("returnWorkforceEventId") REFERENCES "HrWorkforceEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrLeaveJobRun" ADD CONSTRAINT "HrLeaveJobRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Unit 5 accounting and effective-date invariants.
ALTER TABLE "HrLeaveAccountPeriod" ADD CONSTRAINT "HrLeaveAccountPeriod_dates_check" CHECK ("periodEnd" > "periodStart");
ALTER TABLE "HrWorkScheduleAssignment" ADD CONSTRAINT "HrWorkScheduleAssignment_dates_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");
ALTER TABLE "HrHolidayCalendarAssignment" ADD CONSTRAINT "HrHolidayCalendarAssignment_dates_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");
ALTER TABLE "HrLeaveDelegation" ADD CONSTRAINT "HrLeaveDelegation_dates_check" CHECK ("effectiveTo" > "effectiveFrom");
ALTER TABLE "HrLeaveDelegation" ADD CONSTRAINT "HrLeaveDelegation_distinct_users_check" CHECK ("delegatorUserId" <> "delegateUserId");
ALTER TABLE "HrLeaveLedgerEntry" ADD CONSTRAINT "HrLeaveLedgerEntry_amount_check" CHECK ("amount" > 0);
ALTER TABLE "HrLeaveRequestSegment" ADD CONSTRAINT "HrLeaveRequestSegment_interval_check" CHECK ("endsAt" > "startsAt" AND "scheduledMinutes" >= 0 AND "excludedMinutes" >= 0 AND "chargeableAmount" >= 0);

CREATE OR REPLACE FUNCTION "hr_unit5_immutable_row"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Unit 5 authoritative history is immutable; append a reversal or replacement record';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "HrLeaveLedgerEntry_immutable" BEFORE UPDATE OR DELETE ON "HrLeaveLedgerEntry" FOR EACH ROW EXECUTE FUNCTION "hr_unit5_immutable_row"();
CREATE TRIGGER "HrLeaveRequestVersion_immutable" BEFORE UPDATE OR DELETE ON "HrLeaveRequestVersion" FOR EACH ROW EXECUTE FUNCTION "hr_unit5_immutable_row"();
CREATE TRIGGER "HrLeaveRequestSegment_immutable" BEFORE UPDATE OR DELETE ON "HrLeaveRequestSegment" FOR EACH ROW EXECUTE FUNCTION "hr_unit5_immutable_row"();
CREATE TRIGGER "HrLeaveTransition_immutable" BEFORE UPDATE OR DELETE ON "HrLeaveTransition" FOR EACH ROW EXECUTE FUNCTION "hr_unit5_immutable_row"();
CREATE TRIGGER "HrWorkScheduleVersion_immutable" BEFORE UPDATE OR DELETE ON "HrWorkScheduleVersion" FOR EACH ROW EXECUTE FUNCTION "hr_unit5_immutable_row"();
CREATE TRIGGER "HrHolidayCalendarVersion_immutable" BEFORE UPDATE OR DELETE ON "HrHolidayCalendarVersion" FOR EACH ROW EXECUTE FUNCTION "hr_unit5_immutable_row"();
CREATE TRIGGER "HrHolidayOccurrence_immutable" BEFORE UPDATE OR DELETE ON "HrHolidayOccurrence" FOR EACH ROW EXECUTE FUNCTION "hr_unit5_immutable_row"();
