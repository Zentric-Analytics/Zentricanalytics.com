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
