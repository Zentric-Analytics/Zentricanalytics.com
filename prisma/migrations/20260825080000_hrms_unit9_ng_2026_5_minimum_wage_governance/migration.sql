ALTER TABLE "HrPayrollInputSnapshot"
  ADD COLUMN "minimumWageEvidence" JSONB,
  ADD COLUMN "minimumWageDecisionHash" TEXT,
  ADD COLUMN "minimumWageClassification" TEXT;

ALTER TABLE "HrPayrollAuthoritativeResult"
  ADD COLUMN "minimumWageDecisionHash" TEXT,
  ADD COLUMN "minimumWageClassification" TEXT;

ALTER TABLE "HrPayrollPopulationPartition"
  ADD COLUMN "minimumWageDecisionHashes" JSONB;

CREATE INDEX "HrPayrollInputSnapshot_organizationId_minimumWageDecisionHash_idx"
  ON "HrPayrollInputSnapshot"("organizationId", "minimumWageDecisionHash");

CREATE INDEX "HrPayrollAuthoritativeResult_organizationId_minimumWageDecisionHash_idx"
  ON "HrPayrollAuthoritativeResult"("organizationId", "minimumWageDecisionHash");
