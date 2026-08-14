-- Preserve every calculation attempt while allowing one explicitly selected
-- pre-finalization authoritative result for each employee.
ALTER TABLE "HrPayrollAuthoritativeResult"
  ADD COLUMN "authoritativeAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "HrPayrollAuthoritativeResult_payrollRunId_employeeId_key";
CREATE UNIQUE INDEX "HrPayrollAuthoritativeResult_calculationAttemptId_employeeId_key"
  ON "HrPayrollAuthoritativeResult"("calculationAttemptId", "employeeId");
CREATE INDEX "HrPayrollAuthoritativeResult_organizationId_payrollRunId_employeeId_authoritativeAt_idx"
  ON "HrPayrollAuthoritativeResult"("organizationId", "payrollRunId", "employeeId", "authoritativeAt");

-- PostgreSQL enforces the business invariant that at most one result is
-- authoritative for an employee within a run, while retaining prior attempts.
CREATE UNIQUE INDEX "HrPayrollAuthoritativeResult_one_authoritative_per_employee"
  ON "HrPayrollAuthoritativeResult"("payrollRunId", "employeeId")
  WHERE "authoritativeAt" IS NOT NULL;

CREATE TABLE "HrPayrollPaymentDestinationVersion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "bankName" TEXT NOT NULL,
  "accountNameEncrypted" TEXT NOT NULL,
  "accountNumberEncrypted" TEXT NOT NULL,
  "accountNumberLastFour" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "verifiedById" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "supersedesId" TEXT,
  "changedById" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrPayrollPaymentDestinationVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HrPayrollPaymentDestinationVersion_organizationId_employeeId_version_key" ON "HrPayrollPaymentDestinationVersion"("organizationId", "employeeId", "version");
CREATE UNIQUE INDEX "HrPayrollPaymentDestinationVersion_organizationId_correlationId_key" ON "HrPayrollPaymentDestinationVersion"("organizationId", "correlationId");
CREATE INDEX "HrPayrollPaymentDestinationVersion_organizationId_employeeId_effectiveFrom_effectiveTo_idx" ON "HrPayrollPaymentDestinationVersion"("organizationId", "employeeId", "effectiveFrom", "effectiveTo");

ALTER TABLE "HrPayrollPaymentBatch"
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "exportedAt" TIMESTAMP(3),
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "acknowledgedAt" TIMESTAMP(3),
  ADD COLUMN "settledAt" TIMESTAMP(3),
  ADD COLUMN "providerReference" TEXT;

CREATE TABLE "HrPayrollTaxableBaseDefinition" ("id" TEXT NOT NULL,"organizationId" TEXT NOT NULL,"jurisdictionVersionId" TEXT NOT NULL,"code" TEXT NOT NULL,"version" INTEGER NOT NULL,"ruleManifest" JSONB NOT NULL,"effectiveFrom" TIMESTAMP(3) NOT NULL,"effectiveTo" TIMESTAMP(3),"correlationId" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "HrPayrollTaxableBaseDefinition_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "HrPayrollTaxableBaseDefinition_scope_key" ON "HrPayrollTaxableBaseDefinition"("organizationId","jurisdictionVersionId","code","version");
CREATE UNIQUE INDEX "HrPayrollTaxableBaseDefinition_correlation_key" ON "HrPayrollTaxableBaseDefinition"("organizationId","correlationId");
CREATE TABLE "HrPayrollEarningDefinition" ("id" TEXT NOT NULL,"organizationId" TEXT NOT NULL,"jurisdictionVersionId" TEXT NOT NULL,"code" TEXT NOT NULL,"version" INTEGER NOT NULL,"taxableBaseCode" TEXT NOT NULL,"ruleManifest" JSONB NOT NULL,"effectiveFrom" TIMESTAMP(3) NOT NULL,"effectiveTo" TIMESTAMP(3),"correlationId" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "HrPayrollEarningDefinition_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "HrPayrollEarningDefinition_scope_key" ON "HrPayrollEarningDefinition"("organizationId","jurisdictionVersionId","code","version");
CREATE UNIQUE INDEX "HrPayrollEarningDefinition_correlation_key" ON "HrPayrollEarningDefinition"("organizationId","correlationId");
CREATE TABLE "HrPayrollDeductionDefinition" ("id" TEXT NOT NULL,"organizationId" TEXT NOT NULL,"jurisdictionVersionId" TEXT NOT NULL,"code" TEXT NOT NULL,"version" INTEGER NOT NULL,"category" TEXT NOT NULL,"method" TEXT NOT NULL,"ruleManifest" JSONB NOT NULL,"effectiveFrom" TIMESTAMP(3) NOT NULL,"effectiveTo" TIMESTAMP(3),"correlationId" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "HrPayrollDeductionDefinition_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "HrPayrollDeductionDefinition_scope_key" ON "HrPayrollDeductionDefinition"("organizationId","jurisdictionVersionId","code","version");
CREATE UNIQUE INDEX "HrPayrollDeductionDefinition_correlation_key" ON "HrPayrollDeductionDefinition"("organizationId","correlationId");
CREATE TABLE "HrPayrollEmployeeDeductionElection" ("id" TEXT NOT NULL,"organizationId" TEXT NOT NULL,"employeeId" TEXT NOT NULL,"deductionDefinitionId" TEXT NOT NULL,"version" INTEGER NOT NULL,"electionManifest" JSONB NOT NULL,"approvedById" TEXT NOT NULL,"effectiveFrom" TIMESTAMP(3) NOT NULL,"effectiveTo" TIMESTAMP(3),"supersedesId" TEXT,"correlationId" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "HrPayrollEmployeeDeductionElection_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "HrPayrollEmployeeDeductionElection_scope_key" ON "HrPayrollEmployeeDeductionElection"("organizationId","employeeId","deductionDefinitionId","version");
CREATE UNIQUE INDEX "HrPayrollEmployeeDeductionElection_correlation_key" ON "HrPayrollEmployeeDeductionElection"("organizationId","correlationId");
CREATE TABLE "HrPayrollEmployerContributionDefinition" ("id" TEXT NOT NULL,"organizationId" TEXT NOT NULL,"jurisdictionVersionId" TEXT NOT NULL,"code" TEXT NOT NULL,"version" INTEGER NOT NULL,"liabilityCategory" TEXT NOT NULL,"ruleManifest" JSONB NOT NULL,"effectiveFrom" TIMESTAMP(3) NOT NULL,"effectiveTo" TIMESTAMP(3),"correlationId" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "HrPayrollEmployerContributionDefinition_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "HrPayrollEmployerContributionDefinition_scope_key" ON "HrPayrollEmployerContributionDefinition"("organizationId","jurisdictionVersionId","code","version");
CREATE UNIQUE INDEX "HrPayrollEmployerContributionDefinition_correlation_key" ON "HrPayrollEmployerContributionDefinition"("organizationId","correlationId");
CREATE TABLE "HrPayrollManualAdjustment" ("id" TEXT NOT NULL,"organizationId" TEXT NOT NULL,"payrollRunId" TEXT NOT NULL,"employeeId" TEXT NOT NULL,"category" TEXT NOT NULL,"amount" DECIMAL(20,4) NOT NULL,"reason" TEXT NOT NULL,"evidence" JSONB NOT NULL,"createdById" TEXT NOT NULL,"approvedById" TEXT,"approvedAt" TIMESTAMP(3),"status" TEXT NOT NULL DEFAULT 'PENDING',"correlationId" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "HrPayrollManualAdjustment_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "HrPayrollManualAdjustment_correlation_key" ON "HrPayrollManualAdjustment"("organizationId","correlationId");
CREATE INDEX "HrPayrollManualAdjustment_scope_idx" ON "HrPayrollManualAdjustment"("organizationId","payrollRunId","employeeId","status");
