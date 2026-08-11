-- CreateEnum
CREATE TYPE "HrTimeTrackingMode" AS ENUM ('NONE', 'EXCEPTION_BASED', 'CLOCK', 'TIMESHEET');

-- CreateEnum
CREATE TYPE "HrTimeEventType" AS ENUM ('CLOCK_IN', 'CLOCK_OUT', 'BREAK_START', 'BREAK_END', 'INVALID_EVIDENCE', 'CORRECTION');

-- CreateEnum
CREATE TYPE "HrTimeEventSource" AS ENUM ('EMPLOYEE_WEB', 'MANAGER', 'HR', 'OFFLINE_REPLAY', 'WORKER');

-- CreateEnum
CREATE TYPE "HrClockSessionStatus" AS ENUM ('CLOCKED_IN', 'ON_BREAK', 'CLOCKED_OUT', 'CORRECTION_REQUIRED');

-- CreateEnum
CREATE TYPE "HrTimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'RETURNED', 'REJECTED', 'APPROVED', 'LOCKED', 'WITHDRAWN', 'CORRECTED_AFTER_LOCK');

-- CreateEnum
CREATE TYPE "HrAttendanceOutcome" AS ENUM ('PRESENT', 'LATE', 'EARLY_DEPARTURE', 'MISSED_CLOCK_IN', 'MISSED_CLOCK_OUT', 'ABSENT', 'APPROVED_LEAVE', 'HOLIDAY', 'NON_WORKING_DAY', 'OVERTIME_CANDIDATE', 'UNDER_TIME', 'BREAK_EXCEPTION', 'SCHEDULE_EXCEPTION', 'PENDING_CORRECTION');

-- CreateEnum
CREATE TYPE "HrTimeCorrectionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'RETURNED', 'REJECTED', 'APPROVED', 'APPLIED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "HrAttendancePeriodStatus" AS ENUM ('OPEN', 'SUBMITTED', 'APPROVED', 'LOCKED', 'CORRECTED_AFTER_LOCK');

-- CreateEnum
CREATE TYPE "HrTimeWorkerStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DEAD_LETTER');

-- CreateTable
CREATE TABLE "HrTimePolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrTimePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrTimePolicyVersion" (
    "id" TEXT NOT NULL,
    "timePolicyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "trackingMode" "HrTimeTrackingMode" NOT NULL,
    "timezone" TEXT NOT NULL,
    "graceBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
    "graceAfterMinutes" INTEGER NOT NULL DEFAULT 0,
    "maximumOfflineDelayMin" INTEGER NOT NULL DEFAULT 1440,
    "maximumFutureSkewMin" INTEGER NOT NULL DEFAULT 5,
    "dailyOvertimeMinutes" INTEGER,
    "weeklyOvertimeMinutes" INTEGER,
    "allowCategoryStacking" BOOLEAN NOT NULL DEFAULT false,
    "breakRules" JSONB,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrTimePolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrTimePolicyApplicability" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "timePolicyId" TEXT NOT NULL,
    "legalEntityId" TEXT,
    "countryCode" TEXT,
    "employeeType" "HrEmploymentType",
    "positionId" TEXT,
    "gradeId" TEXT,
    "departmentId" TEXT,
    "locationId" TEXT,
    "workMode" "HrWorkMode",
    "priority" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "HrTimePolicyApplicability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrTimePolicyAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workRelationshipId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "timePolicyId" TEXT NOT NULL,
    "timePolicyVersionId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrTimePolicyAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrScheduleInterval" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workScheduleVersionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startLocalMinute" INTEGER NOT NULL,
    "endLocalMinute" INTEGER NOT NULL,
    "endDayOffset" INTEGER NOT NULL DEFAULT 0,
    "expectedMinutes" INTEGER NOT NULL,
    "flexibleStartMinute" INTEGER,
    "flexibleEndMinute" INTEGER,
    "paidBreakMinutes" INTEGER NOT NULL DEFAULT 0,
    "unpaidBreakMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrScheduleInterval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrShiftTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrShiftTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrShiftTemplateVersion" (
    "id" TEXT NOT NULL,
    "shiftTemplateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "segments" JSONB NOT NULL,
    "graceBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
    "graceAfterMinutes" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrShiftTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrShiftAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workRelationshipId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "shiftTemplateId" TEXT NOT NULL,
    "shiftTemplateVersionId" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "assignedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrShiftAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrTimeEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workRelationshipId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "eventType" "HrTimeEventType" NOT NULL,
    "source" "HrTimeEventSource" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timezone" TEXT NOT NULL,
    "localDate" TIMESTAMP(3) NOT NULL,
    "localTime" TEXT NOT NULL,
    "utcOffsetMinutes" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "userAgentHash" TEXT,
    "replayed" BOOLEAN NOT NULL DEFAULT false,
    "authoritative" BOOLEAN NOT NULL DEFAULT false,
    "invalidReason" TEXT,
    "correctsEventId" TEXT,
    "actorUserId" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrTimeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrClockSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workRelationshipId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "timePolicyVersionId" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "openedByEventId" TEXT NOT NULL,
    "closedByEventId" TEXT,
    "status" "HrClockSessionStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "workedMinutes" INTEGER,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrClockSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrTimesheet" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workRelationshipId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "HrTimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "lockedAt" TIMESTAMP(3),
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrTimesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrTimesheetVersion" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "entries" JSONB NOT NULL,
    "totalMinutes" INTEGER NOT NULL,
    "comment" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "HrTimesheetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrAttendanceDay" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workRelationshipId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "currentOutcome" "HrAttendanceOutcome" NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrAttendanceDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrAttendanceInterpretation" (
    "id" TEXT NOT NULL,
    "attendanceDayId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "outcome" "HrAttendanceOutcome" NOT NULL,
    "scheduledMinutes" INTEGER NOT NULL,
    "workedMinutes" INTEGER NOT NULL,
    "paidLeaveMinutes" INTEGER NOT NULL DEFAULT 0,
    "unpaidAbsenceMinutes" INTEGER NOT NULL DEFAULT 0,
    "underTimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "inputSnapshot" JSONB NOT NULL,
    "supersedesId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrAttendanceInterpretation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrTimeCorrection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceDayId" TEXT,
    "timesheetId" TEXT,
    "sourceEventId" TEXT,
    "status" "HrTimeCorrectionStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedChanges" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "appliedInterpretationId" TEXT,
    "payrollImpact" BOOLEAN NOT NULL DEFAULT false,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrTimeCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrAttendancePeriod" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "periodType" TEXT NOT NULL DEFAULT 'WEEKLY',
    "timezone" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "status" "HrAttendancePeriodStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "lockHash" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrAttendancePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrAuthoritativeTimeEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "attendancePeriodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workRelationshipId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "correctionDelta" BOOLEAN NOT NULL DEFAULT false,
    "exportedAt" TIMESTAMP(3),
    "exportClaimKey" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrAuthoritativeTimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrTimeWorkerRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "windowKey" TEXT NOT NULL,
    "status" "HrTimeWorkerStatus" NOT NULL DEFAULT 'PENDING',
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "checkpoint" JSONB,
    "safeError" TEXT,
    "correlationId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrTimeWorkerRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HrTimePolicy_organizationId_status_idx" ON "HrTimePolicy"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HrTimePolicy_organizationId_code_key" ON "HrTimePolicy"("organizationId", "code");

-- CreateIndex
CREATE INDEX "HrTimePolicyVersion_timePolicyId_effectiveFrom_effectiveTo_idx" ON "HrTimePolicyVersion"("timePolicyId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "HrTimePolicyVersion_timePolicyId_version_key" ON "HrTimePolicyVersion"("timePolicyId", "version");

-- CreateIndex
CREATE INDEX "HrTimePolicyApplicability_organizationId_effectiveFrom_effe_idx" ON "HrTimePolicyApplicability"("organizationId", "effectiveFrom", "effectiveTo", "priority");

-- CreateIndex
CREATE INDEX "HrTimePolicyApplicability_timePolicyId_effectiveFrom_effect_idx" ON "HrTimePolicyApplicability"("timePolicyId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "HrTimePolicyAssignment_organizationId_employeeId_effectiveF_idx" ON "HrTimePolicyAssignment"("organizationId", "employeeId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "HrTimePolicyAssignment_workRelationshipId_assignmentId_effe_idx" ON "HrTimePolicyAssignment"("workRelationshipId", "assignmentId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "HrScheduleInterval_organizationId_workScheduleVersionId_wee_idx" ON "HrScheduleInterval"("organizationId", "workScheduleVersionId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "HrScheduleInterval_workScheduleVersionId_sequence_key" ON "HrScheduleInterval"("workScheduleVersionId", "sequence");

-- CreateIndex
CREATE INDEX "HrShiftTemplate_organizationId_status_idx" ON "HrShiftTemplate"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HrShiftTemplate_organizationId_code_key" ON "HrShiftTemplate"("organizationId", "code");

-- CreateIndex
CREATE INDEX "HrShiftTemplateVersion_shiftTemplateId_effectiveFrom_effect_idx" ON "HrShiftTemplateVersion"("shiftTemplateId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "HrShiftTemplateVersion_shiftTemplateId_version_key" ON "HrShiftTemplateVersion"("shiftTemplateId", "version");

-- CreateIndex
CREATE INDEX "HrShiftAssignment_organizationId_employeeId_businessDate_st_idx" ON "HrShiftAssignment"("organizationId", "employeeId", "businessDate", "status");

-- CreateIndex
CREATE INDEX "HrShiftAssignment_assignmentId_startsAt_endsAt_idx" ON "HrShiftAssignment"("assignmentId", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrShiftAssignment_organizationId_employeeId_startsAt_endsAt_key" ON "HrShiftAssignment"("organizationId", "employeeId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "HrTimeEvent_organizationId_employeeId_occurredAt_idx" ON "HrTimeEvent"("organizationId", "employeeId", "occurredAt");

-- CreateIndex
CREATE INDEX "HrTimeEvent_assignmentId_localDate_occurredAt_idx" ON "HrTimeEvent"("assignmentId", "localDate", "occurredAt");

-- CreateIndex
CREATE INDEX "HrTimeEvent_correlationId_idx" ON "HrTimeEvent"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrTimeEvent_organizationId_idempotencyKey_key" ON "HrTimeEvent"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "HrClockSession_organizationId_employeeId_status_startedAt_idx" ON "HrClockSession"("organizationId", "employeeId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "HrClockSession_assignmentId_businessDate_idx" ON "HrClockSession"("assignmentId", "businessDate");

-- CreateIndex
CREATE INDEX "HrTimesheet_organizationId_status_periodEnd_idx" ON "HrTimesheet"("organizationId", "status", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "HrTimesheet_organizationId_employeeId_workRelationshipId_pe_key" ON "HrTimesheet"("organizationId", "employeeId", "workRelationshipId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "HrTimesheetVersion_timesheetId_version_key" ON "HrTimesheetVersion"("timesheetId", "version");

-- CreateIndex
CREATE INDEX "HrAttendanceDay_organizationId_employeeId_businessDate_idx" ON "HrAttendanceDay"("organizationId", "employeeId", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "HrAttendanceDay_organizationId_assignmentId_businessDate_key" ON "HrAttendanceDay"("organizationId", "assignmentId", "businessDate");

-- CreateIndex
CREATE INDEX "HrAttendanceInterpretation_outcome_createdAt_idx" ON "HrAttendanceInterpretation"("outcome", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrAttendanceInterpretation_attendanceDayId_version_key" ON "HrAttendanceInterpretation"("attendanceDayId", "version");

-- CreateIndex
CREATE INDEX "HrTimeCorrection_organizationId_employeeId_status_createdAt_idx" ON "HrTimeCorrection"("organizationId", "employeeId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "HrTimeCorrection_correlationId_idx" ON "HrTimeCorrection"("correlationId");

-- CreateIndex
CREATE INDEX "HrAttendancePeriod_organizationId_status_endsOn_idx" ON "HrAttendancePeriod"("organizationId", "status", "endsOn");

-- CreateIndex
CREATE UNIQUE INDEX "HrAttendancePeriod_organizationId_periodType_timezone_start_key" ON "HrAttendancePeriod"("organizationId", "periodType", "timezone", "startsOn", "endsOn");

-- CreateIndex
CREATE INDEX "HrAuthoritativeTimeEntry_organizationId_attendancePeriodId__idx" ON "HrAuthoritativeTimeEntry"("organizationId", "attendancePeriodId", "employeeId");

-- CreateIndex
CREATE INDEX "HrAuthoritativeTimeEntry_exportClaimKey_idx" ON "HrAuthoritativeTimeEntry"("exportClaimKey");

-- CreateIndex
CREATE UNIQUE INDEX "HrAuthoritativeTimeEntry_attendancePeriodId_employeeId_assi_key" ON "HrAuthoritativeTimeEntry"("attendancePeriodId", "employeeId", "assignmentId", "businessDate", "category", "sourceId");

-- CreateIndex
CREATE INDEX "HrTimeWorkerRun_status_leaseExpiresAt_createdAt_idx" ON "HrTimeWorkerRun"("status", "leaseExpiresAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrTimeWorkerRun_organizationId_jobType_windowKey_key" ON "HrTimeWorkerRun"("organizationId", "jobType", "windowKey");

-- AddForeignKey
ALTER TABLE "HrTimePolicy" ADD CONSTRAINT "HrTimePolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrTimePolicyVersion" ADD CONSTRAINT "HrTimePolicyVersion_timePolicyId_fkey" FOREIGN KEY ("timePolicyId") REFERENCES "HrTimePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrTimePolicyApplicability" ADD CONSTRAINT "HrTimePolicyApplicability_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrTimePolicyApplicability" ADD CONSTRAINT "HrTimePolicyApplicability_timePolicyId_fkey" FOREIGN KEY ("timePolicyId") REFERENCES "HrTimePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrTimePolicyAssignment" ADD CONSTRAINT "HrTimePolicyAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrTimePolicyAssignment" ADD CONSTRAINT "HrTimePolicyAssignment_timePolicyId_fkey" FOREIGN KEY ("timePolicyId") REFERENCES "HrTimePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrScheduleInterval" ADD CONSTRAINT "HrScheduleInterval_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrShiftTemplate" ADD CONSTRAINT "HrShiftTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrShiftTemplateVersion" ADD CONSTRAINT "HrShiftTemplateVersion_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "HrShiftTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrShiftAssignment" ADD CONSTRAINT "HrShiftAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrShiftAssignment" ADD CONSTRAINT "HrShiftAssignment_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "HrShiftTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrTimeEvent" ADD CONSTRAINT "HrTimeEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrClockSession" ADD CONSTRAINT "HrClockSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrTimesheet" ADD CONSTRAINT "HrTimesheet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrTimesheetVersion" ADD CONSTRAINT "HrTimesheetVersion_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "HrTimesheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrAttendanceDay" ADD CONSTRAINT "HrAttendanceDay_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrAttendanceInterpretation" ADD CONSTRAINT "HrAttendanceInterpretation_attendanceDayId_fkey" FOREIGN KEY ("attendanceDayId") REFERENCES "HrAttendanceDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrTimeCorrection" ADD CONSTRAINT "HrTimeCorrection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrAttendancePeriod" ADD CONSTRAINT "HrAttendancePeriod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrAuthoritativeTimeEntry" ADD CONSTRAINT "HrAuthoritativeTimeEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrAuthoritativeTimeEntry" ADD CONSTRAINT "HrAuthoritativeTimeEntry_attendancePeriodId_fkey" FOREIGN KEY ("attendancePeriodId") REFERENCES "HrAttendancePeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrTimeWorkerRun" ADD CONSTRAINT "HrTimeWorkerRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain integrity not expressible by Prisma's portable schema.
ALTER TABLE "HrTimePolicyVersion" ADD CONSTRAINT "HrTimePolicyVersion_effective_range_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");
ALTER TABLE "HrTimePolicyVersion" ADD CONSTRAINT "HrTimePolicyVersion_grace_check" CHECK ("graceBeforeMinutes" >= 0 AND "graceAfterMinutes" >= 0 AND "maximumOfflineDelayMin" >= 0 AND "maximumFutureSkewMin" >= 0);
ALTER TABLE "HrTimePolicyApplicability" ADD CONSTRAINT "HrTimePolicyApplicability_effective_range_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");
ALTER TABLE "HrTimePolicyAssignment" ADD CONSTRAINT "HrTimePolicyAssignment_effective_range_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");
ALTER TABLE "HrScheduleInterval" ADD CONSTRAINT "HrScheduleInterval_bounds_check" CHECK ("weekday" BETWEEN 0 AND 6 AND "startLocalMinute" BETWEEN 0 AND 1439 AND "endLocalMinute" BETWEEN 0 AND 1439 AND "endDayOffset" BETWEEN 0 AND 1 AND "expectedMinutes" > 0 AND "paidBreakMinutes" >= 0 AND "unpaidBreakMinutes" >= 0);
ALTER TABLE "HrShiftAssignment" ADD CONSTRAINT "HrShiftAssignment_range_check" CHECK ("endsAt" > "startsAt");
ALTER TABLE "HrTimesheet" ADD CONSTRAINT "HrTimesheet_period_check" CHECK ("periodEnd" > "periodStart");
ALTER TABLE "HrTimesheetVersion" ADD CONSTRAINT "HrTimesheetVersion_minutes_check" CHECK ("totalMinutes" >= 0);
ALTER TABLE "HrAttendanceInterpretation" ADD CONSTRAINT "HrAttendanceInterpretation_minutes_check" CHECK ("scheduledMinutes" >= 0 AND "workedMinutes" >= 0 AND "paidLeaveMinutes" >= 0 AND "unpaidAbsenceMinutes" >= 0 AND "underTimeMinutes" >= 0 AND "overtimeMinutes" >= 0 AND "breakMinutes" >= 0);
ALTER TABLE "HrAttendancePeriod" ADD CONSTRAINT "HrAttendancePeriod_range_check" CHECK ("endsOn" > "startsOn");
ALTER TABLE "HrAuthoritativeTimeEntry" ADD CONSTRAINT "HrAuthoritativeTimeEntry_minutes_check" CHECK ("minutes" <> 0);

-- One open clock session per assignment. Closed/correction history remains unlimited.
CREATE UNIQUE INDEX "HrClockSession_one_open_assignment_key" ON "HrClockSession"("organizationId", "assignmentId") WHERE "status" IN ('CLOCKED_IN', 'ON_BREAK');

-- Unit 6 records may never outlive or cross-link their authoritative employment chain.
ALTER TABLE "HrTimePolicyAssignment" ADD CONSTRAINT "HrTimePolicyAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrTimePolicyAssignment" ADD CONSTRAINT "HrTimePolicyAssignment_workRelationshipId_fkey" FOREIGN KEY ("workRelationshipId") REFERENCES "HrWorkRelationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrTimePolicyAssignment" ADD CONSTRAINT "HrTimePolicyAssignment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HrEmployeeAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrTimePolicyAssignment" ADD CONSTRAINT "HrTimePolicyAssignment_timePolicyVersionId_fkey" FOREIGN KEY ("timePolicyVersionId") REFERENCES "HrTimePolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrScheduleInterval" ADD CONSTRAINT "HrScheduleInterval_workScheduleVersionId_fkey" FOREIGN KEY ("workScheduleVersionId") REFERENCES "HrWorkScheduleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrShiftAssignment" ADD CONSTRAINT "HrShiftAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrShiftAssignment" ADD CONSTRAINT "HrShiftAssignment_workRelationshipId_fkey" FOREIGN KEY ("workRelationshipId") REFERENCES "HrWorkRelationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrShiftAssignment" ADD CONSTRAINT "HrShiftAssignment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HrEmployeeAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrShiftAssignment" ADD CONSTRAINT "HrShiftAssignment_shiftTemplateVersionId_fkey" FOREIGN KEY ("shiftTemplateVersionId") REFERENCES "HrShiftTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrTimeEvent" ADD CONSTRAINT "HrTimeEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrTimeEvent" ADD CONSTRAINT "HrTimeEvent_workRelationshipId_fkey" FOREIGN KEY ("workRelationshipId") REFERENCES "HrWorkRelationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrTimeEvent" ADD CONSTRAINT "HrTimeEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HrEmployeeAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrClockSession" ADD CONSTRAINT "HrClockSession_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrClockSession" ADD CONSTRAINT "HrClockSession_workRelationshipId_fkey" FOREIGN KEY ("workRelationshipId") REFERENCES "HrWorkRelationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrClockSession" ADD CONSTRAINT "HrClockSession_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HrEmployeeAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrClockSession" ADD CONSTRAINT "HrClockSession_timePolicyVersionId_fkey" FOREIGN KEY ("timePolicyVersionId") REFERENCES "HrTimePolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrTimesheet" ADD CONSTRAINT "HrTimesheet_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrTimesheet" ADD CONSTRAINT "HrTimesheet_workRelationshipId_fkey" FOREIGN KEY ("workRelationshipId") REFERENCES "HrWorkRelationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrTimesheet" ADD CONSTRAINT "HrTimesheet_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HrEmployeeAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrAttendanceDay" ADD CONSTRAINT "HrAttendanceDay_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrAttendanceDay" ADD CONSTRAINT "HrAttendanceDay_workRelationshipId_fkey" FOREIGN KEY ("workRelationshipId") REFERENCES "HrWorkRelationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrAttendanceDay" ADD CONSTRAINT "HrAttendanceDay_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HrEmployeeAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrTimeCorrection" ADD CONSTRAINT "HrTimeCorrection_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrAuthoritativeTimeEntry" ADD CONSTRAINT "HrAuthoritativeTimeEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrAuthoritativeTimeEntry" ADD CONSTRAINT "HrAuthoritativeTimeEntry_workRelationshipId_fkey" FOREIGN KEY ("workRelationshipId") REFERENCES "HrWorkRelationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrAuthoritativeTimeEntry" ADD CONSTRAINT "HrAuthoritativeTimeEntry_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HrEmployeeAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed Unit 6 authorization keys into every existing tenant without broadening payroll authority.
WITH permission_keys("key") AS (VALUES
  ('time.capture_self'), ('time.read_self'), ('time.read_team'), ('time.read_all'),
  ('time.schedule.manage'), ('time.policy.manage'), ('time.correction.request'), ('time.correction.review'),
  ('time.timesheet.submit'), ('time.timesheet.approve'), ('time.period.lock'),
  ('time.authoritative.read'), ('time.authoritative.export')
)
INSERT INTO "HrPermission" ("id", "organizationId", "key", "description", "createdAt")
SELECT 'unit6_permission_' || md5(o."id" || ':' || p."key"), o."id", p."key", 'Unit 6 time and attendance permission', CURRENT_TIMESTAMP
FROM "HrOrganization" o CROSS JOIN permission_keys p
ON CONFLICT ("organizationId", "key") DO NOTHING;

INSERT INTO "HrRolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT 'unit6_role_permission_' || md5(r."id" || ':' || p."id"), r."id", p."id", CURRENT_TIMESTAMP
FROM "HrRole" r JOIN "HrPermission" p ON p."organizationId" = r."organizationId"
WHERE p."key" LIKE 'time.%' AND (
  r."key" IN ('ADMIN', 'HR_ADMIN')
  OR (r."key" = 'EMPLOYEE' AND p."key" IN ('time.capture_self', 'time.read_self', 'time.correction.request', 'time.timesheet.submit'))
  OR (r."key" = 'PAYROLL_ADMIN' AND p."key" IN ('time.authoritative.read', 'time.authoritative.export'))
)
ON CONFLICT ("roleId", "permissionId") DO NOTHING;


