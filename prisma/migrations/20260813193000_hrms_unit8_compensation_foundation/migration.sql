ALTER TYPE "HrRoleKey" ADD VALUE IF NOT EXISTS 'COMPENSATION_ADMIN';
ALTER TYPE "HrRoleKey" ADD VALUE IF NOT EXISTS 'BUDGET_OWNER';
ALTER TYPE "HrRoleKey" ADD VALUE IF NOT EXISTS 'PAYROLL_READER';

-- CreateEnum
CREATE TYPE "HrCompPublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED', 'RETIRED');

-- CreateEnum
CREATE TYPE "HrCompPayBasis" AS ENUM ('SALARIED', 'HOURLY');

-- CreateEnum
CREATE TYPE "HrCompRecordStatus" AS ENUM ('SCHEDULED', 'EFFECTIVE', 'SUPERSEDED', 'CORRECTED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "HrCompEventType" AS ENUM ('INITIAL', 'MERIT', 'PROMOTION', 'MARKET_ADJUSTMENT', 'RETENTION_ADJUSTMENT', 'TRANSFER_ADJUSTMENT', 'LEGAL_ADJUSTMENT', 'CORRECTION');

-- CreateEnum
CREATE TYPE "HrCompCycleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'OPEN', 'REVIEW', 'FINALIZING', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HrCompRecommendationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'HR_REVIEW', 'APPROVED', 'RETURNED', 'REJECTED', 'WITHDRAWN', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "HrCompExceptionStatus" AS ENUM ('REQUESTED', 'REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "HrCompDecisionStatus" AS ENUM ('PENDING', 'APPROVED', 'SCHEDULED', 'EFFECTIVE', 'CANCELLED', 'SUPERSEDED', 'CORRECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "HrCompBudgetEntryType" AS ENUM ('ALLOCATE', 'RESERVE', 'RELEASE', 'CONSUME', 'ADJUST');

-- CreateEnum
CREATE TYPE "HrCompAwardType" AS ENUM ('ANNUAL_BONUS', 'DISCRETIONARY_BONUS', 'RECOGNITION_AWARD', 'RETENTION_AWARD');

-- CreateEnum
CREATE TYPE "HrCompHandoffStatus" AS ENUM ('PENDING', 'CLAIMED', 'READY', 'EXPORTED', 'FAILED');

-- CreateTable
CREATE TABLE "HrCompMarket" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrCompMarket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompMarketVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "countryCode" TEXT NOT NULL,
    "region" TEXT,
    "locality" TEXT,
    "currency" TEXT NOT NULL,
    "applicability" JSONB NOT NULL,
    "differentialPolicy" JSONB,
    "status" "HrCompPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCompMarketVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompBand" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobProfileId" TEXT,
    "jobFamilyId" TEXT,
    "companyLevelId" TEXT,
    "compensationGradeCode" TEXT,
    "marketId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "payBasis" "HrCompPayBasis" NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrCompBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompBandVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bandId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "minimum" DECIMAL(18,4) NOT NULL,
    "midpoint" DECIMAL(18,4) NOT NULL,
    "maximum" DECIMAL(18,4) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "HrCompPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCompBandVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrCompPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompPolicyVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "rules" JSONB NOT NULL,
    "status" "HrCompPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "contentHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCompPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompBenchmarkSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "surveyDate" TIMESTAMP(3) NOT NULL,
    "marketId" TEXT NOT NULL,
    "jobProfileId" TEXT,
    "jobFamilyId" TEXT,
    "companyLevelId" TEXT,
    "percentile" DECIMAL(5,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "confidence" JSONB,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "contentHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCompBenchmarkSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrEmployeeCompensation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workRelationshipId" TEXT NOT NULL,
    "currentRecordId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrEmployeeCompensation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompensationRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeCompensationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workRelationshipId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "previousRecordId" TEXT,
    "correctedRecordId" TEXT,
    "decisionId" TEXT NOT NULL,
    "eventType" "HrCompEventType" NOT NULL,
    "status" "HrCompRecordStatus" NOT NULL DEFAULT 'SCHEDULED',
    "amount" DECIMAL(18,4) NOT NULL,
    "annualizedAmount" DECIMAL(18,4),
    "currency" TEXT NOT NULL,
    "payBasis" "HrCompPayBasis" NOT NULL,
    "marketVersionId" TEXT NOT NULL,
    "bandVersionId" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "payrollReadyAt" TIMESTAMP(3),
    "contentHash" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCompensationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompCycle" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cycleType" TEXT NOT NULL,
    "status" "HrCompCycleStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "populationRule" JSONB NOT NULL,
    "currencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendationOpensAt" TIMESTAMP(3),
    "managerDeadlineAt" TIMESTAMP(3),
    "reviewOpensAt" TIMESTAMP(3),
    "payrollHandoffAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "workflowDefinitionId" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrCompCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompCyclePopulation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workRelationshipId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "managerUserId" TEXT,
    "compensationRecordId" TEXT NOT NULL,
    "bandVersionId" TEXT NOT NULL,
    "performanceReviewId" TEXT,
    "promotionDecisionId" TEXT,
    "eligible" BOOLEAN NOT NULL,
    "eligibilityReasons" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCompCyclePopulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompBudget" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "allocatedAmount" DECIMAL(18,4) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrCompBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompBudgetEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "recommendationId" TEXT,
    "decisionId" TEXT,
    "entryType" "HrCompBudgetEntryType" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "fxContext" JSONB,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCompBudgetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompRecommendation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cyclePopulationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "managerUserId" TEXT NOT NULL,
    "currentRecordId" TEXT NOT NULL,
    "bandVersionId" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "performanceReviewId" TEXT,
    "promotionDecisionId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "HrCompRecommendationStatus" NOT NULL DEFAULT 'DRAFT',
    "currentAmount" DECIMAL(18,4) NOT NULL,
    "proposedAmount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "rangePosition" TEXT NOT NULL,
    "guideline" JSONB NOT NULL,
    "budgetImpact" DECIMAL(18,4) NOT NULL,
    "rationale" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "contentHash" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrCompRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompCalibrationDecision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "recommendationVersion" INTEGER NOT NULL,
    "calibratedAmount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "restrictedRationale" TEXT NOT NULL,
    "participantUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "contentHash" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCompCalibrationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompException" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "recommendationVersion" INTEGER NOT NULL,
    "exceptionType" TEXT NOT NULL,
    "status" "HrCompExceptionStatus" NOT NULL DEFAULT 'REQUESTED',
    "proposedAmount" DECIMAL(18,4) NOT NULL,
    "referenceAmount" DECIMAL(18,4) NOT NULL,
    "varianceAmount" DECIMAL(18,4) NOT NULL,
    "variancePercent" DECIMAL(9,4) NOT NULL,
    "restrictedRationale" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "decidedByIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "decisionReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCompException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompDecision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recommendationId" TEXT,
    "recommendationVersion" INTEGER,
    "exceptionId" TEXT,
    "awardId" TEXT,
    "eventType" TEXT NOT NULL,
    "status" "HrCompDecisionStatus" NOT NULL DEFAULT 'PENDING',
    "oldAmount" DECIMAL(18,4),
    "newAmount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "payBasis" "HrCompPayBasis",
    "marketVersionId" TEXT,
    "bandVersionId" TEXT,
    "policyVersionId" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "approverUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rationale" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCompDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrBonusProgram" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "awardType" "HrCompAwardType" NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrBonusProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrBonusProgramVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "targetMode" TEXT NOT NULL,
    "targetValue" DECIMAL(18,4),
    "currency" TEXT,
    "eligibilityRule" JSONB NOT NULL,
    "status" "HrCompPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "contentHash" TEXT NOT NULL,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrBonusProgramVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrBonusAward" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workRelationshipId" TEXT NOT NULL,
    "programVersionId" TEXT NOT NULL,
    "proposedAmount" DECIMAL(18,4) NOT NULL,
    "approvedAmount" DECIMAL(18,4),
    "currency" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "paymentReferenceAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "approverUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrBonusAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompStatement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "decisionId" TEXT,
    "awardId" TEXT,
    "statementType" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "documentVersionId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCompStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompRetroactiveSignal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "oldRecordId" TEXT NOT NULL,
    "newRecordId" TEXT NOT NULL,
    "affectedFrom" TIMESTAMP(3) NOT NULL,
    "affectedTo" TIMESTAMP(3),
    "payrollRecalculationRequired" BOOLEAN NOT NULL DEFAULT true,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCompRetroactiveSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollCompHandoff" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workRelationshipId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "compensationRecordId" TEXT,
    "bonusAwardId" TEXT,
    "retroactiveSignalId" TEXT,
    "eventType" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "payBasis" "HrCompPayBasis",
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "affectedFrom" TIMESTAMP(3),
    "affectedTo" TIMESTAMP(3),
    "status" "HrCompHandoffStatus" NOT NULL DEFAULT 'PENDING',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "claimTokenHash" TEXT,
    "claimedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "exportedAt" TIMESTAMP(3),
    "safeError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPayrollCompHandoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCompJobRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "windowKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "claimTokenHash" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "checkpoint" JSONB,
    "safeError" TEXT,
    "correlationId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "HrCompJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HrCompMarket_organizationId_name_idx" ON "HrCompMarket"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompMarket_organizationId_code_key" ON "HrCompMarket"("organizationId", "code");

-- CreateIndex
CREATE INDEX "HrCompMarketVersion_organizationId_status_effectiveFrom_eff_idx" ON "HrCompMarketVersion"("organizationId", "status", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompMarketVersion_marketId_version_key" ON "HrCompMarketVersion"("marketId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompMarketVersion_organizationId_contentHash_key" ON "HrCompMarketVersion"("organizationId", "contentHash");

-- CreateIndex
CREATE INDEX "HrCompBand_organizationId_marketId_currency_payBasis_idx" ON "HrCompBand"("organizationId", "marketId", "currency", "payBasis");

-- CreateIndex
CREATE INDEX "HrCompBand_jobProfileId_companyLevelId_marketId_idx" ON "HrCompBand"("jobProfileId", "companyLevelId", "marketId");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompBand_organizationId_code_key" ON "HrCompBand"("organizationId", "code");

-- CreateIndex
CREATE INDEX "HrCompBandVersion_organizationId_status_effectiveFrom_effec_idx" ON "HrCompBandVersion"("organizationId", "status", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompBandVersion_bandId_version_key" ON "HrCompBandVersion"("bandId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompBandVersion_organizationId_contentHash_key" ON "HrCompBandVersion"("organizationId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompPolicy_organizationId_code_key" ON "HrCompPolicy"("organizationId", "code");

-- CreateIndex
CREATE INDEX "HrCompPolicyVersion_organizationId_status_effectiveFrom_eff_idx" ON "HrCompPolicyVersion"("organizationId", "status", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompPolicyVersion_policyId_version_key" ON "HrCompPolicyVersion"("policyId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompPolicyVersion_organizationId_contentHash_key" ON "HrCompPolicyVersion"("organizationId", "contentHash");

-- CreateIndex
CREATE INDEX "HrCompBenchmarkSnapshot_organizationId_marketId_surveyDate_idx" ON "HrCompBenchmarkSnapshot"("organizationId", "marketId", "surveyDate");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompBenchmarkSnapshot_organizationId_contentHash_key" ON "HrCompBenchmarkSnapshot"("organizationId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "HrEmployeeCompensation_currentRecordId_key" ON "HrEmployeeCompensation"("currentRecordId");

-- CreateIndex
CREATE INDEX "HrEmployeeCompensation_organizationId_employeeId_state_idx" ON "HrEmployeeCompensation"("organizationId", "employeeId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "HrEmployeeCompensation_organizationId_workRelationshipId_key" ON "HrEmployeeCompensation"("organizationId", "workRelationshipId");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompensationRecord_decisionId_key" ON "HrCompensationRecord"("decisionId");

-- CreateIndex
CREATE INDEX "HrCompensationRecord_organizationId_employeeId_effectiveFro_idx" ON "HrCompensationRecord"("organizationId", "employeeId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "HrCompensationRecord_workRelationshipId_status_effectiveFro_idx" ON "HrCompensationRecord"("workRelationshipId", "status", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompensationRecord_organizationId_idempotencyKey_key" ON "HrCompensationRecord"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompensationRecord_organizationId_correlationId_key" ON "HrCompensationRecord"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrCompCycle_organizationId_status_effectiveAt_idx" ON "HrCompCycle"("organizationId", "status", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompCycle_organizationId_code_key" ON "HrCompCycle"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompCycle_organizationId_correlationId_key" ON "HrCompCycle"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrCompCyclePopulation_organizationId_managerUserId_eligible_idx" ON "HrCompCyclePopulation"("organizationId", "managerUserId", "eligible");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompCyclePopulation_cycleId_employeeId_key" ON "HrCompCyclePopulation"("cycleId", "employeeId");

-- CreateIndex
CREATE INDEX "HrCompBudget_organizationId_cycleId_currency_idx" ON "HrCompBudget"("organizationId", "cycleId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompBudget_cycleId_scopeType_scopeId_currency_key" ON "HrCompBudget"("cycleId", "scopeType", "scopeId", "currency");

-- CreateIndex
CREATE INDEX "HrCompBudgetEntry_budgetId_createdAt_idx" ON "HrCompBudgetEntry"("budgetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompBudgetEntry_budgetId_idempotencyKey_key" ON "HrCompBudgetEntry"("budgetId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompBudgetEntry_organizationId_correlationId_key" ON "HrCompBudgetEntry"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrCompRecommendation_organizationId_managerUserId_status_idx" ON "HrCompRecommendation"("organizationId", "managerUserId", "status");

-- CreateIndex
CREATE INDEX "HrCompRecommendation_cyclePopulationId_version_idx" ON "HrCompRecommendation"("cyclePopulationId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompRecommendation_organizationId_idempotencyKey_key" ON "HrCompRecommendation"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompRecommendation_organizationId_correlationId_key" ON "HrCompRecommendation"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompCalibrationDecision_recommendationId_version_key" ON "HrCompCalibrationDecision"("recommendationId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompCalibrationDecision_organizationId_correlationId_key" ON "HrCompCalibrationDecision"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrCompException_organizationId_status_createdAt_idx" ON "HrCompException"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompException_organizationId_correlationId_key" ON "HrCompException"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompDecision_recommendationId_key" ON "HrCompDecision"("recommendationId");

-- CreateIndex
CREATE INDEX "HrCompDecision_organizationId_status_effectiveAt_idx" ON "HrCompDecision"("organizationId", "status", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompDecision_organizationId_idempotencyKey_key" ON "HrCompDecision"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompDecision_organizationId_correlationId_key" ON "HrCompDecision"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrBonusProgram_organizationId_code_key" ON "HrBonusProgram"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "HrBonusProgramVersion_programId_version_key" ON "HrBonusProgramVersion"("programId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "HrBonusProgramVersion_organizationId_contentHash_key" ON "HrBonusProgramVersion"("organizationId", "contentHash");

-- CreateIndex
CREATE INDEX "HrBonusAward_organizationId_employeeId_status_effectiveAt_idx" ON "HrBonusAward"("organizationId", "employeeId", "status", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrBonusAward_organizationId_idempotencyKey_key" ON "HrBonusAward"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "HrBonusAward_organizationId_correlationId_key" ON "HrBonusAward"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrCompStatement_organizationId_employeeId_releasedAt_idx" ON "HrCompStatement"("organizationId", "employeeId", "releasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompStatement_organizationId_correlationId_key" ON "HrCompStatement"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompStatement_decisionId_version_key" ON "HrCompStatement"("decisionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompRetroactiveSignal_decisionId_key" ON "HrCompRetroactiveSignal"("decisionId");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompRetroactiveSignal_organizationId_correlationId_key" ON "HrCompRetroactiveSignal"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollCompHandoff_claimTokenHash_key" ON "HrPayrollCompHandoff"("claimTokenHash");

-- CreateIndex
CREATE INDEX "HrPayrollCompHandoff_organizationId_status_effectiveAt_idx" ON "HrPayrollCompHandoff"("organizationId", "status", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollCompHandoff_organizationId_idempotencyKey_key" ON "HrPayrollCompHandoff"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollCompHandoff_organizationId_correlationId_key" ON "HrPayrollCompHandoff"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompJobRun_claimTokenHash_key" ON "HrCompJobRun"("claimTokenHash");

-- CreateIndex
CREATE INDEX "HrCompJobRun_organizationId_status_startedAt_idx" ON "HrCompJobRun"("organizationId", "status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompJobRun_organizationId_jobType_windowKey_key" ON "HrCompJobRun"("organizationId", "jobType", "windowKey");

-- CreateIndex
CREATE UNIQUE INDEX "HrCompJobRun_organizationId_correlationId_key" ON "HrCompJobRun"("organizationId", "correlationId");

-- Unit 8 monetary and effective-date invariants.
ALTER TABLE "HrCompMarketVersion" ADD CONSTRAINT "HrCompMarketVersion_effective_range_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");
ALTER TABLE "HrCompBandVersion" ADD CONSTRAINT "HrCompBandVersion_range_check" CHECK ("minimum" >= 0 AND "minimum" <= "midpoint" AND "midpoint" <= "maximum");
ALTER TABLE "HrCompBandVersion" ADD CONSTRAINT "HrCompBandVersion_effective_range_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");
ALTER TABLE "HrCompPolicyVersion" ADD CONSTRAINT "HrCompPolicyVersion_effective_range_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");
ALTER TABLE "HrCompensationRecord" ADD CONSTRAINT "HrCompensationRecord_amount_check" CHECK ("amount" >= 0 AND ("annualizedAmount" IS NULL OR "annualizedAmount" >= 0));
ALTER TABLE "HrCompensationRecord" ADD CONSTRAINT "HrCompensationRecord_effective_range_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");
ALTER TABLE "HrCompBudget" ADD CONSTRAINT "HrCompBudget_allocation_check" CHECK ("allocatedAmount" >= 0);
ALTER TABLE "HrCompBudgetEntry" ADD CONSTRAINT "HrCompBudgetEntry_amount_check" CHECK ("amount" > 0);
ALTER TABLE "HrCompRecommendation" ADD CONSTRAINT "HrCompRecommendation_amount_check" CHECK ("currentAmount" >= 0 AND "proposedAmount" >= 0 AND "budgetImpact" >= 0);
ALTER TABLE "HrCompException" ADD CONSTRAINT "HrCompException_amount_check" CHECK ("proposedAmount" >= 0 AND "referenceAmount" >= 0 AND "varianceAmount" >= 0);
ALTER TABLE "HrCompDecision" ADD CONSTRAINT "HrCompDecision_amount_check" CHECK (("oldAmount" IS NULL OR "oldAmount" >= 0) AND "newAmount" >= 0);
ALTER TABLE "HrBonusAward" ADD CONSTRAINT "HrBonusAward_amount_check" CHECK ("proposedAmount" >= 0 AND ("approvedAmount" IS NULL OR "approvedAmount" >= 0));
ALTER TABLE "HrPayrollCompHandoff" ADD CONSTRAINT "HrPayrollCompHandoff_subject_check" CHECK (("compensationRecordId" IS NOT NULL)::int + ("bonusAwardId" IS NOT NULL)::int = 1);

CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "HrCompensationRecord" ADD CONSTRAINT "HrCompensationRecord_no_authoritative_overlap" EXCLUDE USING gist (
  "organizationId" WITH =,
  "workRelationshipId" WITH =,
  tsrange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::timestamp), '[)') WITH &&
) WHERE ("status" IN ('SCHEDULED', 'EFFECTIVE'));

-- Published/approved financial evidence is append-only. Operational claim fields are explicitly exempted.
CREATE OR REPLACE FUNCTION hr_comp_protect_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND TG_TABLE_NAME IN ('HrCompBudgetEntry','HrCompCalibrationDecision','HrCompDecision','HrCompRetroactiveSignal','HrCompensationRecord') THEN
    RAISE EXCEPTION 'Authoritative compensation evidence cannot be deleted';
  END IF;
  IF TG_TABLE_NAME IN ('HrCompMarketVersion','HrCompBandVersion','HrCompPolicyVersion','HrBonusProgramVersion')
     AND OLD."status" <> 'DRAFT' THEN
    RAISE EXCEPTION 'Published compensation versions are immutable';
  END IF;
  IF TG_TABLE_NAME IN ('HrCompBudgetEntry','HrCompCalibrationDecision','HrCompRetroactiveSignal') THEN
    RAISE EXCEPTION 'Approved compensation evidence is immutable';
  END IF;
  IF TG_TABLE_NAME = 'HrCompDecision' AND TG_OP = 'UPDATE' AND (
    NEW."organizationId" <> OLD."organizationId" OR NEW."recommendationId" IS DISTINCT FROM OLD."recommendationId" OR
    NEW."recommendationVersion" IS DISTINCT FROM OLD."recommendationVersion" OR NEW."exceptionId" IS DISTINCT FROM OLD."exceptionId" OR
    NEW."eventType" <> OLD."eventType" OR NEW."oldAmount" IS DISTINCT FROM OLD."oldAmount" OR NEW."newAmount" <> OLD."newAmount" OR
    NEW."currency" <> OLD."currency" OR NEW."payBasis" IS DISTINCT FROM OLD."payBasis" OR
    NEW."marketVersionId" IS DISTINCT FROM OLD."marketVersionId" OR NEW."bandVersionId" IS DISTINCT FROM OLD."bandVersionId" OR
    NEW."policyVersionId" <> OLD."policyVersionId" OR NEW."effectiveAt" <> OLD."effectiveAt" OR
    NEW."approverUserIds" <> OLD."approverUserIds" OR NEW."rationale" <> OLD."rationale" OR
    NEW."idempotencyKey" <> OLD."idempotencyKey" OR NEW."correlationId" <> OLD."correlationId"
  ) THEN RAISE EXCEPTION 'Approved compensation decision content is immutable'; END IF;
  IF TG_TABLE_NAME = 'HrCompensationRecord' AND (
    NEW."organizationId" <> OLD."organizationId" OR NEW."employeeId" <> OLD."employeeId" OR
    NEW."workRelationshipId" <> OLD."workRelationshipId" OR NEW."assignmentId" <> OLD."assignmentId" OR
    NEW."decisionId" <> OLD."decisionId" OR NEW."eventType" <> OLD."eventType" OR
    NEW."amount" <> OLD."amount" OR NEW."currency" <> OLD."currency" OR NEW."payBasis" <> OLD."payBasis" OR
    NEW."marketVersionId" <> OLD."marketVersionId" OR NEW."bandVersionId" <> OLD."bandVersionId" OR
    NEW."policyVersionId" <> OLD."policyVersionId" OR NEW."effectiveFrom" <> OLD."effectiveFrom" OR
    NEW."contentHash" <> OLD."contentHash" OR NEW."correlationId" <> OLD."correlationId"
  ) THEN RAISE EXCEPTION 'Authoritative compensation content is immutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER hr_comp_market_version_immutable BEFORE UPDATE OR DELETE ON "HrCompMarketVersion" FOR EACH ROW EXECUTE FUNCTION hr_comp_protect_immutable();
CREATE TRIGGER hr_comp_band_version_immutable BEFORE UPDATE OR DELETE ON "HrCompBandVersion" FOR EACH ROW EXECUTE FUNCTION hr_comp_protect_immutable();
CREATE TRIGGER hr_comp_policy_version_immutable BEFORE UPDATE OR DELETE ON "HrCompPolicyVersion" FOR EACH ROW EXECUTE FUNCTION hr_comp_protect_immutable();
CREATE TRIGGER hr_comp_bonus_program_version_immutable BEFORE UPDATE OR DELETE ON "HrBonusProgramVersion" FOR EACH ROW EXECUTE FUNCTION hr_comp_protect_immutable();
CREATE TRIGGER hr_comp_budget_entry_immutable BEFORE UPDATE OR DELETE ON "HrCompBudgetEntry" FOR EACH ROW EXECUTE FUNCTION hr_comp_protect_immutable();
CREATE TRIGGER hr_comp_calibration_immutable BEFORE UPDATE OR DELETE ON "HrCompCalibrationDecision" FOR EACH ROW EXECUTE FUNCTION hr_comp_protect_immutable();
CREATE TRIGGER hr_comp_decision_immutable BEFORE UPDATE OR DELETE ON "HrCompDecision" FOR EACH ROW EXECUTE FUNCTION hr_comp_protect_immutable();
CREATE TRIGGER hr_comp_retroactive_signal_immutable BEFORE UPDATE OR DELETE ON "HrCompRetroactiveSignal" FOR EACH ROW EXECUTE FUNCTION hr_comp_protect_immutable();
CREATE TRIGGER hr_comp_record_content_immutable BEFORE UPDATE OR DELETE ON "HrCompensationRecord" FOR EACH ROW EXECUTE FUNCTION hr_comp_protect_immutable();
