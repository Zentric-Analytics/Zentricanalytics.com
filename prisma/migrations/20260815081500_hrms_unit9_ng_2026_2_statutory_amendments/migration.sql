CREATE TABLE "HrPayrollStatutoryAmendment" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "originalRemittanceBatchId" TEXT NOT NULL,
  "supersedesAmendmentId" TEXT,
  "version" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "deltaManifest" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "simulationOnly" BOOLEAN NOT NULL DEFAULT TRUE,
  "correlationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "HrPayrollStatutoryAmendment_org_idempotency_key" ON "HrPayrollStatutoryAmendment"("organizationId", "idempotencyKey");
CREATE UNIQUE INDEX "HrPayrollStatutoryAmendment_batch_version_key" ON "HrPayrollStatutoryAmendment"("originalRemittanceBatchId", "version");
CREATE UNIQUE INDEX "HrPayrollStatutoryAmendment_org_correlation_key" ON "HrPayrollStatutoryAmendment"("organizationId", "correlationId");
CREATE INDEX "HrPayrollStatutoryAmendment_lineage_idx" ON "HrPayrollStatutoryAmendment"("organizationId", "originalRemittanceBatchId", "createdAt");

CREATE TRIGGER "HrPayrollStatutoryAmendment_immutable"
  BEFORE UPDATE OR DELETE ON "HrPayrollStatutoryAmendment"
  FOR EACH ROW EXECUTE FUNCTION "hr_payroll_reject_evidence_mutation"();
