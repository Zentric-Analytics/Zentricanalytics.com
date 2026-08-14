-- CreateTable
CREATE TABLE "HrPayrollCertificationIssue" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT,
    "code" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "message" TEXT NOT NULL,
    "resolvedById" TEXT,
    "resolutionReason" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPayrollCertificationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollReconciliation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "payrollResultId" TEXT,
    "scope" TEXT NOT NULL,
    "populationCount" INTEGER,
    "gross" DECIMAL(20,4) NOT NULL,
    "taxableIncome" DECIMAL(20,4) NOT NULL,
    "paye" DECIMAL(20,4) NOT NULL,
    "employeeDeductions" DECIMAL(20,4) NOT NULL,
    "employerContributions" DECIMAL(20,4) NOT NULL,
    "adjustments" DECIMAL(20,4) NOT NULL,
    "netPay" DECIMAL(20,4) NOT NULL,
    "balanced" BOOLEAN NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPayrollReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollRiskFinding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "payrollResultId" TEXT,
    "ruleCode" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reviewedById" TEXT,
    "resolutionReason" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPayrollRiskFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollRetroTrigger" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "previousVersion" TEXT,
    "affectedFrom" TIMESTAMP(3) NOT NULL,
    "affectedTo" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "treatment" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "correlationId" TEXT NOT NULL,

    CONSTRAINT "HrPayrollRetroTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollRetroImpact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "retroTriggerId" TEXT NOT NULL,
    "originalResultId" TEXT NOT NULL,
    "correctedAttemptId" TEXT NOT NULL,
    "adjustmentResultId" TEXT,
    "deltaManifest" JSONB NOT NULL,
    "deltaHash" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPayrollRetroImpact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollYtdLedgerEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "accumulatorCode" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "payrollResultId" TEXT NOT NULL,
    "retroImpactId" TEXT,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPayrollYtdLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollPayslipVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payrollResultId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "artifactKey" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "supersedesId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "correlationId" TEXT NOT NULL,

    CONSTRAINT "HrPayrollPayslipVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollPaymentBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL,
    "instructionCount" INTEGER NOT NULL,
    "totalAmount" DECIMAL(20,4) NOT NULL,
    "exportHash" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPayrollPaymentBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollJournalBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalDebit" DECIMAL(20,4) NOT NULL,
    "totalCredit" DECIMAL(20,4) NOT NULL,
    "contentHash" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPayrollJournalBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollJournalLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "journalBatchId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "debit" DECIMAL(20,4) NOT NULL,
    "credit" DECIMAL(20,4) NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPayrollJournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollStatutoryLiability" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "payrollResultId" TEXT,
    "jurisdictionVersionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "ruleVersion" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPayrollStatutoryLiability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollRemittanceBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jurisdictionVersionId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(20,4) NOT NULL,
    "externalReference" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPayrollRemittanceBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPayrollRemittanceLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "remittanceBatchId" TEXT NOT NULL,
    "liabilityId" TEXT NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPayrollRemittanceLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HrPayrollCertificationIssue_organizationId_payrollRunId_sev_idx" ON "HrPayrollCertificationIssue"("organizationId", "payrollRunId", "severity", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollCertificationIssue_payrollRunId_employeeId_code_so_key" ON "HrPayrollCertificationIssue"("payrollRunId", "employeeId", "code", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollCertificationIssue_organizationId_correlationId_key" ON "HrPayrollCertificationIssue"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollReconciliation_payrollRunId_payrollResultId_scope_key" ON "HrPayrollReconciliation"("payrollRunId", "payrollResultId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollReconciliation_organizationId_correlationId_key" ON "HrPayrollReconciliation"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrPayrollRiskFinding_organizationId_payrollRunId_severity_s_idx" ON "HrPayrollRiskFinding"("organizationId", "payrollRunId", "severity", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollRiskFinding_payrollRunId_payrollResultId_ruleCode__key" ON "HrPayrollRiskFinding"("payrollRunId", "payrollResultId", "ruleCode", "ruleVersion");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollRiskFinding_organizationId_correlationId_key" ON "HrPayrollRiskFinding"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollRetroTrigger_organizationId_sourceType_sourceId_so_key" ON "HrPayrollRetroTrigger"("organizationId", "sourceType", "sourceId", "sourceVersion");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollRetroTrigger_organizationId_correlationId_key" ON "HrPayrollRetroTrigger"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollRetroImpact_retroTriggerId_originalResultId_key" ON "HrPayrollRetroImpact"("retroTriggerId", "originalResultId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollRetroImpact_organizationId_correlationId_key" ON "HrPayrollRetroImpact"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrPayrollYtdLedgerEntry_organizationId_employeeId_taxYear_a_idx" ON "HrPayrollYtdLedgerEntry"("organizationId", "employeeId", "taxYear", "accumulatorCode", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollYtdLedgerEntry_organizationId_employeeId_accumulat_key" ON "HrPayrollYtdLedgerEntry"("organizationId", "employeeId", "accumulatorCode", "payrollResultId", "entryType");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollYtdLedgerEntry_organizationId_correlationId_key" ON "HrPayrollYtdLedgerEntry"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "HrPayrollPayslipVersion_organizationId_employeeId_published_idx" ON "HrPayrollPayslipVersion"("organizationId", "employeeId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollPayslipVersion_payrollResultId_version_key" ON "HrPayrollPayslipVersion"("payrollResultId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollPayslipVersion_organizationId_correlationId_key" ON "HrPayrollPayslipVersion"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollPaymentBatch_payrollRunId_version_key" ON "HrPayrollPaymentBatch"("payrollRunId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollPaymentBatch_organizationId_correlationId_key" ON "HrPayrollPaymentBatch"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollJournalBatch_payrollRunId_version_key" ON "HrPayrollJournalBatch"("payrollRunId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollJournalBatch_organizationId_correlationId_key" ON "HrPayrollJournalBatch"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollJournalLine_journalBatchId_sequence_key" ON "HrPayrollJournalLine"("journalBatchId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollStatutoryLiability_organizationId_payrollRunId_pay_key" ON "HrPayrollStatutoryLiability"("organizationId", "payrollRunId", "payrollResultId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollStatutoryLiability_organizationId_correlationId_key" ON "HrPayrollStatutoryLiability"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollRemittanceBatch_organizationId_periodKey_category__key" ON "HrPayrollRemittanceBatch"("organizationId", "periodKey", "category", "version");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollRemittanceBatch_organizationId_correlationId_key" ON "HrPayrollRemittanceBatch"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrPayrollRemittanceLine_remittanceBatchId_liabilityId_key" ON "HrPayrollRemittanceLine"("remittanceBatchId", "liabilityId");
