ALTER TABLE "HrPayrollCalendarPeriod"
  ADD COLUMN "nominalPaymentAt" TIMESTAMP(3),
  ADD COLUMN "paymentCalendarVersionId" TEXT,
  ADD COLUMN "paymentDateRule" TEXT;

CREATE TABLE "HrPayrollComplianceException" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "payGroupId" TEXT NOT NULL,
  "payrollPeriodId" TEXT NOT NULL, "payrollRunId" TEXT NOT NULL, "calculationAttemptId" TEXT NOT NULL,
  "jurisdictionCode" TEXT NOT NULL, "rtaCode" TEXT NOT NULL, "blockerCode" TEXT NOT NULL, "blockerCategory" TEXT NOT NULL,
  "affectedInput" TEXT, "candidateVersion" TEXT NOT NULL, "sourceRequirement" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'OPEN',
  "assignedOwnerId" TEXT, "notesMetadata" JSONB, "resolutionType" TEXT, "authorityEvidenceId" TEXT,
  "approvedRuleVersion" TEXT, "recalculationAttemptId" TEXT, "logicalKey" TEXT NOT NULL, "correlationId" TEXT NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrPayrollComplianceException_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HrPayrollComplianceException_organizationId_logicalKey_key" ON "HrPayrollComplianceException"("organizationId", "logicalKey");
CREATE UNIQUE INDEX "HrPayrollComplianceException_organizationId_correlationId_key" ON "HrPayrollComplianceException"("organizationId", "correlationId");
CREATE INDEX "HrPayrollComplianceException_organizationId_payrollRunId_status_idx" ON "HrPayrollComplianceException"("organizationId", "payrollRunId", "status");
CREATE INDEX "HrPayrollComplianceException_organizationId_employeeId_openedAt_idx" ON "HrPayrollComplianceException"("organizationId", "employeeId", "openedAt");

CREATE TABLE "HrPayrollComplianceExceptionEvent" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "complianceExceptionId" TEXT NOT NULL, "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL, "actorUserId" TEXT NOT NULL, "reason" TEXT, "evidence" JSONB NOT NULL,
  "correlationId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrPayrollComplianceExceptionEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HrPayrollComplianceExceptionEvent_organizationId_correlationId_key" ON "HrPayrollComplianceExceptionEvent"("organizationId", "correlationId");
CREATE INDEX "HrPayrollComplianceExceptionEvent_organizationId_complianceExceptionId_createdAt_idx" ON "HrPayrollComplianceExceptionEvent"("organizationId", "complianceExceptionId", "createdAt");

CREATE TABLE "HrPayrollPopulationPartition" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "payrollRunId" TEXT NOT NULL, "calculationAttemptId" TEXT NOT NULL,
  "originalPopulationCount" INTEGER NOT NULL, "readyCount" INTEGER NOT NULL, "heldCount" INTEGER NOT NULL,
  "readyEmployeeIds" JSONB NOT NULL, "heldPopulation" JSONB NOT NULL, "partitionHash" TEXT NOT NULL,
  "decision" TEXT, "reason" TEXT, "preparedById" TEXT NOT NULL, "approvedById" TEXT, "approvedAt" TIMESTAMP(3),
  "expectedResolutionPath" TEXT, "correlationId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrPayrollPopulationPartition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HrPayrollPopulationPartition_organizationId_payrollRunId_calculationAttemptId_key" ON "HrPayrollPopulationPartition"("organizationId", "payrollRunId", "calculationAttemptId");
CREATE UNIQUE INDEX "HrPayrollPopulationPartition_organizationId_partitionHash_key" ON "HrPayrollPopulationPartition"("organizationId", "partitionHash");
CREATE UNIQUE INDEX "HrPayrollPopulationPartition_organizationId_correlationId_key" ON "HrPayrollPopulationPartition"("organizationId", "correlationId");

CREATE TABLE "HrPayrollCapabilityAssignment" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "subjectUserId" TEXT NOT NULL, "capability" TEXT NOT NULL,
  "effect" TEXT NOT NULL, "effectiveFrom" TIMESTAMP(3) NOT NULL, "expiresAt" TIMESTAMP(3), "reason" TEXT NOT NULL,
  "assignedById" TEXT NOT NULL, "approvedById" TEXT, "beforeState" JSONB NOT NULL, "afterState" JSONB NOT NULL,
  "correlationId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrPayrollCapabilityAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HrPayrollCapabilityAssignment_organizationId_subjectUserId_capability_effectiveFrom_key" ON "HrPayrollCapabilityAssignment"("organizationId", "subjectUserId", "capability", "effectiveFrom");
CREATE UNIQUE INDEX "HrPayrollCapabilityAssignment_organizationId_correlationId_key" ON "HrPayrollCapabilityAssignment"("organizationId", "correlationId");
CREATE INDEX "HrPayrollCapabilityAssignment_organizationId_subjectUserId_expiresAt_idx" ON "HrPayrollCapabilityAssignment"("organizationId", "subjectUserId", "expiresAt");
