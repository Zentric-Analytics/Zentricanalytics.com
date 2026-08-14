-- CreateEnum
CREATE TYPE "HrPayrollJurisdictionStatus" AS ENUM ('DRAFT', 'REVIEW_REQUIRED', 'TESTING', 'CERTIFIED', 'SCHEDULED', 'ACTIVE', 'SUPERSEDED', 'RETIRED');

-- CreateEnum
ALTER TYPE "HrRoleKey" ADD VALUE 'PAYROLL_PROCESSOR';
ALTER TYPE "HrRoleKey" ADD VALUE 'PAYROLL_APPROVER';
ALTER TYPE "HrRoleKey" ADD VALUE 'PAYROLL_COMPLIANCE_ADMIN';
ALTER TYPE "HrRoleKey" ADD VALUE 'PAYMENT_OPERATOR';
ALTER TYPE "HrRoleKey" ADD VALUE 'PAYMENT_APPROVER';
ALTER TYPE "HrRoleKey" ADD VALUE 'FINANCE_READER';
ALTER TYPE "HrRoleKey" ADD VALUE 'PAYROLL_AUDITOR';
ALTER TYPE "HrRoleKey" ADD VALUE 'STATUTORY_COMPLIANCE_OPERATOR';

CREATE TYPE "HrPayrollAuthoritativeRunStatus" AS ENUM ('DRAFT', 'CERTIFYING', 'BLOCKED', 'CERTIFIED', 'FROZEN', 'CALCULATING', 'CALCULATED', 'RECONCILED', 'APPROVED', 'FINALIZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HrPayrollRunKind" AS ENUM ('REGULAR', 'OFF_CYCLE', 'EMERGENCY', 'CORRECTION');

-- CreateEnum
CREATE TYPE "HrPayrollLineCategory" AS ENUM ('EARNING', 'TAXABLE_BASE', 'PAYE', 'EMPLOYEE_DEDUCTION', 'EMPLOYER_CONTRIBUTION', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "HrPayrollRegulatoryChangeStatus" AS ENUM ('DETECTED', 'REVIEW_REQUIRED', 'INTERPRETED', 'RULE_DRAFTED', 'TESTING', 'APPROVAL_REQUIRED', 'CERTIFIED', 'SCHEDULED', 'ACTIVE', 'SUPERSEDED', 'RETIRED');

-- CreateTable
CREATE TABLE "HrPayrollJurisdiction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrPayrollJurisdiction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollJurisdictionVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "HrPayrollJurisdictionStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "ruleManifest" JSONB NOT NULL,
    "ruleHash" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "certifiedById" TEXT,
    "certifiedAt" TIMESTAMP(3),
    "supersedesId" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPayrollJurisdictionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollRegulatorySource" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jurisdictionCode" TEXT NOT NULL,
    "authorityName" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "approvedHost" TEXT NOT NULL,
    "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastCheckedAt" TIMESTAMP(3),
    "lastContentHash" TEXT,
    "monitoringHealth" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrPayrollRegulatorySource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollRegulatoryEvidence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jurisdictionVersionId" TEXT NOT NULL,
    "regulatorySourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publicationDate" TIMESTAMP(3),
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "contentHash" TEXT NOT NULL,
    "durableObjectKey" TEXT,
    "reviewerUserId" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPayrollRegulatoryEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollRegulatoryChange" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "regulatorySourceId" TEXT NOT NULL,
    "previousContentHash" TEXT,
    "detectedContentHash" TEXT NOT NULL,
    "status" "HrPayrollRegulatoryChangeStatus" NOT NULL DEFAULT 'DETECTED',
    "impactClassification" TEXT,
    "interpretation" JSONB,
    "proposedJurisdictionVersionId" TEXT,
    "reviewedById" TEXT,
    "approvedById" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "correlationId" TEXT NOT NULL,

    CONSTRAINT "HrPayrollRegulatoryChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollPayGroup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workerType" TEXT NOT NULL,
    "frequency" "HrPayFrequency" NOT NULL DEFAULT 'MONTHLY',
    "jurisdictionId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "timezone" TEXT NOT NULL,
    "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrPayrollPayGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollCalendarPeriod" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payGroupId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "cutoffAt" TIMESTAMP(3) NOT NULL,
    "freezeAt" TIMESTAMP(3) NOT NULL,
    "calculationOpensAt" TIMESTAMP(3) NOT NULL,
    "approvalDueAt" TIMESTAMP(3) NOT NULL,
    "intendedPaymentAt" TIMESTAMP(3) NOT NULL,
    "accountingDate" TIMESTAMP(3) NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "taxPeriod" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPayrollCalendarPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollAuthoritativeRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payGroupId" TEXT NOT NULL,
    "calendarPeriodId" TEXT NOT NULL,
    "jurisdictionVersionId" TEXT NOT NULL,
    "kind" "HrPayrollRunKind" NOT NULL DEFAULT 'REGULAR',
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "status" "HrPayrollAuthoritativeRunStatus" NOT NULL DEFAULT 'DRAFT',
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "calculatedById" TEXT,
    "reconciledById" TEXT,
    "approvedById" TEXT,
    "finalizedById" TEXT,
    "frozenAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrPayrollAuthoritativeRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollInputSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "workRelationshipId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "sourceManifest" JSONB NOT NULL,
    "inputHash" TEXT NOT NULL,
    "certificationStatus" TEXT NOT NULL,
    "blockerCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "frozenAt" TIMESTAMP(3) NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPayrollInputSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollCalculationAttempt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "inputSetHash" TEXT NOT NULL,
    "ruleSetHash" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "outputHash" TEXT,
    "manifest" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "claimTokenHash" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "safeError" TEXT,
    "correlationId" TEXT NOT NULL,

    CONSTRAINT "HrPayrollCalculationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollAuthoritativeResult" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "calculationAttemptId" TEXT NOT NULL,
    "inputSnapshotId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "grossEarnings" DECIMAL(20,4) NOT NULL,
    "taxableIncome" DECIMAL(20,4) NOT NULL,
    "paye" DECIMAL(20,4) NOT NULL,
    "employeeDeductions" DECIMAL(20,4) NOT NULL,
    "employerContributions" DECIMAL(20,4) NOT NULL,
    "adjustments" DECIMAL(20,4) NOT NULL,
    "netPay" DECIMAL(20,4) NOT NULL,
    "outputHash" TEXT NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "supersedesResultId" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPayrollAuthoritativeResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollResultLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payrollResultId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "HrPayrollLineCategory" NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "taxableBaseCode" TEXT,
    "sourceReference" TEXT,
    "ruleVersionReference" TEXT NOT NULL,
    "explanation" JSONB NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPayrollResultLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollRunApproval" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "inputHash" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPayrollRunApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollPaymentInstruction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payrollResultId" TEXT NOT NULL,
    "destinationVersionId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "logicalKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerReference" TEXT,
    "submittedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPayrollPaymentInstruction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HrPayrollJurisdiction_organizationId_status_idx" ON "HrPayrollJurisdiction"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollJurisdiction_organizationId_code_key" ON "HrPayrollJurisdiction"("organizationId", "code");

-- CreateIndex
CREATE INDEX "HrPayrollJurisdictionVersion_organizationId_jurisdictionId__idx" ON "HrPayrollJurisdictionVersion"("organizationId", "jurisdictionId", "status", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollJurisdictionVersion_jurisdictionId_version_key" ON "HrPayrollJurisdictionVersion"("jurisdictionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollJurisdictionVersion_organizationId_correlationId_key" ON "HrPayrollJurisdictionVersion"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollJurisdictionVersion_organizationId_ruleHash_key" ON "HrPayrollJurisdictionVersion"("organizationId", "ruleHash");

-- CreateIndex
CREATE INDEX "HrPayrollRegulatorySource_organizationId_jurisdictionCode_s_idx" ON "HrPayrollRegulatorySource"("organizationId", "jurisdictionCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollRegulatorySource_organizationId_url_key" ON "HrPayrollRegulatorySource"("organizationId", "url");

-- CreateIndex
CREATE INDEX "HrPayrollRegulatoryEvidence_organizationId_jurisdictionVers_idx" ON "HrPayrollRegulatoryEvidence"("organizationId", "jurisdictionVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollRegulatoryEvidence_jurisdictionVersionId_regulator_key" ON "HrPayrollRegulatoryEvidence"("jurisdictionVersionId", "regulatorySourceId", "contentHash");

-- CreateIndex
CREATE INDEX "HrPayrollRegulatoryChange_organizationId_status_detectedAt_idx" ON "HrPayrollRegulatoryChange"("organizationId", "status", "detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollRegulatoryChange_organizationId_regulatorySourceId_key" ON "HrPayrollRegulatoryChange"("organizationId", "regulatorySourceId", "detectedContentHash");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollRegulatoryChange_organizationId_correlationId_key" ON "HrPayrollRegulatoryChange"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrPayrollPayGroup_organizationId_jurisdictionId_status_idx" ON "HrPayrollPayGroup"("organizationId", "jurisdictionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollPayGroup_organizationId_code_key" ON "HrPayrollPayGroup"("organizationId", "code");

-- CreateIndex
CREATE INDEX "HrPayrollCalendarPeriod_organizationId_intendedPaymentAt_idx" ON "HrPayrollCalendarPeriod"("organizationId", "intendedPaymentAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollCalendarPeriod_payGroupId_periodKey_key" ON "HrPayrollCalendarPeriod"("payGroupId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollCalendarPeriod_organizationId_payGroupId_startsAt__key" ON "HrPayrollCalendarPeriod"("organizationId", "payGroupId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "HrPayrollAuthoritativeRun_organizationId_status_createdAt_idx" ON "HrPayrollAuthoritativeRun"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollAuthoritativeRun_organizationId_idempotencyKey_key" ON "HrPayrollAuthoritativeRun"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollAuthoritativeRun_organizationId_correlationId_key" ON "HrPayrollAuthoritativeRun"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollAuthoritativeRun_payGroupId_calendarPeriodId_kind__key" ON "HrPayrollAuthoritativeRun"("payGroupId", "calendarPeriodId", "kind", "sequence");

-- CreateIndex
CREATE INDEX "HrPayrollInputSnapshot_organizationId_payrollRunId_certific_idx" ON "HrPayrollInputSnapshot"("organizationId", "payrollRunId", "certificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollInputSnapshot_payrollRunId_employeeId_key" ON "HrPayrollInputSnapshot"("payrollRunId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollInputSnapshot_organizationId_correlationId_key" ON "HrPayrollInputSnapshot"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollCalculationAttempt_claimTokenHash_key" ON "HrPayrollCalculationAttempt"("claimTokenHash");

-- CreateIndex
CREATE INDEX "HrPayrollCalculationAttempt_organizationId_payrollRunId_sta_idx" ON "HrPayrollCalculationAttempt"("organizationId", "payrollRunId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollCalculationAttempt_payrollRunId_attemptNumber_key" ON "HrPayrollCalculationAttempt"("payrollRunId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollCalculationAttempt_organizationId_correlationId_key" ON "HrPayrollCalculationAttempt"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrPayrollAuthoritativeResult_organizationId_employeeId_crea_idx" ON "HrPayrollAuthoritativeResult"("organizationId", "employeeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollAuthoritativeResult_payrollRunId_employeeId_key" ON "HrPayrollAuthoritativeResult"("payrollRunId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollAuthoritativeResult_organizationId_correlationId_key" ON "HrPayrollAuthoritativeResult"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrPayrollResultLine_organizationId_payrollResultId_category_idx" ON "HrPayrollResultLine"("organizationId", "payrollResultId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollResultLine_payrollResultId_code_sequence_key" ON "HrPayrollResultLine"("payrollResultId", "code", "sequence");

-- CreateIndex
CREATE INDEX "HrPayrollRunApproval_organizationId_payrollRunId_createdAt_idx" ON "HrPayrollRunApproval"("organizationId", "payrollRunId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollRunApproval_payrollRunId_actorUserId_decision_key" ON "HrPayrollRunApproval"("payrollRunId", "actorUserId", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollRunApproval_organizationId_correlationId_key" ON "HrPayrollRunApproval"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrPayrollPaymentInstruction_organizationId_status_createdAt_idx" ON "HrPayrollPaymentInstruction"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollPaymentInstruction_organizationId_logicalKey_key" ON "HrPayrollPaymentInstruction"("organizationId", "logicalKey");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollPaymentInstruction_organizationId_correlationId_key" ON "HrPayrollPaymentInstruction"("organizationId", "correlationId");

-- Payroll dates and amounts must remain internally coherent even when writes bypass application code.
ALTER TABLE "HrPayrollJurisdictionVersion" ADD CONSTRAINT "HrPayrollJurisdictionVersion_effective_range_check"
  CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom");
ALTER TABLE "HrPayrollCalendarPeriod" ADD CONSTRAINT "HrPayrollCalendarPeriod_timeline_check"
  CHECK ("startsAt" <= "endsAt" AND "cutoffAt" <= "freezeAt" AND "freezeAt" <= "approvalDueAt");
ALTER TABLE "HrPayrollInputSnapshot" ADD CONSTRAINT "HrPayrollInputSnapshot_counts_check"
  CHECK ("blockerCount" >= 0 AND "warningCount" >= 0);
ALTER TABLE "HrPayrollAuthoritativeResult" ADD CONSTRAINT "HrPayrollAuthoritativeResult_money_check"
  CHECK ("grossEarnings" >= 0 AND "taxableIncome" >= 0 AND "paye" >= 0 AND "employeeDeductions" >= 0 AND "employerContributions" >= 0 AND "netPay" >= 0);
ALTER TABLE "HrPayrollPaymentInstruction" ADD CONSTRAINT "HrPayrollPaymentInstruction_amount_check"
  CHECK ("amount" > 0);

-- Frozen inputs, result lines, approvals and finalized results are append-only evidence.
CREATE OR REPLACE FUNCTION "hr_unit9_reject_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Unit 9 authoritative payroll evidence is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "HrPayrollInputSnapshot_immutable"
  BEFORE UPDATE OR DELETE ON "HrPayrollInputSnapshot"
  FOR EACH ROW EXECUTE FUNCTION "hr_unit9_reject_mutation"();
CREATE TRIGGER "HrPayrollResultLine_immutable"
  BEFORE UPDATE OR DELETE ON "HrPayrollResultLine"
  FOR EACH ROW EXECUTE FUNCTION "hr_unit9_reject_mutation"();
CREATE TRIGGER "HrPayrollRunApproval_immutable"
  BEFORE UPDATE OR DELETE ON "HrPayrollRunApproval"
  FOR EACH ROW EXECUTE FUNCTION "hr_unit9_reject_mutation"();

CREATE OR REPLACE FUNCTION "hr_unit9_finalized_result_immutable"() RETURNS trigger AS $$
BEGIN
  IF OLD."finalizedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Finalized Unit 9 payroll results are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "HrPayrollAuthoritativeResult_finalized_immutable"
  BEFORE UPDATE OR DELETE ON "HrPayrollAuthoritativeResult"
  FOR EACH ROW EXECUTE FUNCTION "hr_unit9_finalized_result_immutable"();
