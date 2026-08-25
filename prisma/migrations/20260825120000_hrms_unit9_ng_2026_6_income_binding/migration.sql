ALTER TABLE "HrPayrollInputSnapshot"
  ADD COLUMN "employmentIncomeBinding" JSONB,
  ADD COLUMN "employmentIncomeBindingHash" TEXT;

ALTER TABLE "HrPayrollAuthoritativeResult"
  ADD COLUMN "employmentIncomeBindingHash" TEXT;

ALTER TABLE "HrPayrollPopulationPartition"
  ADD COLUMN "employmentIncomeBindingHashes" JSONB;

CREATE INDEX "HrPayrollInputSnapshot_organizationId_employmentIncomeBindingHash_idx"
  ON "HrPayrollInputSnapshot"("organizationId", "employmentIncomeBindingHash");

CREATE INDEX "HrPayrollAuthoritativeResult_organizationId_employmentIncomeBindingHash_idx"
  ON "HrPayrollAuthoritativeResult"("organizationId", "employmentIncomeBindingHash");
