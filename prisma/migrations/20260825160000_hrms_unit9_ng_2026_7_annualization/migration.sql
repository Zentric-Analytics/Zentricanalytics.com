CREATE TABLE "HrPayrollAnnualizationRuleVersion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "jurisdictionVersion" TEXT NOT NULL,
  "taxYear" INTEGER NOT NULL,
  "frequency" TEXT NOT NULL,
  "periodsInTaxYear" INTEGER NOT NULL,
  "method" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "certificationStatus" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "ownerDecisionRef" TEXT NOT NULL,
  "sourceReference" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "supersedesId" TEXT,
  "correlationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrPayrollAnnualizationRuleVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrPayrollAnnualizationRuleVersion_periods_check" CHECK ("periodsInTaxYear" > 0)
);
CREATE UNIQUE INDEX "HrPayrollAnnualizationRuleVersion_org_jurisdiction_year_frequency_version_key" ON "HrPayrollAnnualizationRuleVersion"("organizationId", "jurisdictionVersion", "taxYear", "frequency", "version");
CREATE UNIQUE INDEX "HrPayrollAnnualizationRuleVersion_org_correlation_key" ON "HrPayrollAnnualizationRuleVersion"("organizationId", "correlationId");
CREATE INDEX "HrPayrollAnnualizationRuleVersion_lookup_idx" ON "HrPayrollAnnualizationRuleVersion"("organizationId", "jurisdictionVersion", "taxYear", "frequency", "certificationStatus", "effectiveFrom", "effectiveTo");
