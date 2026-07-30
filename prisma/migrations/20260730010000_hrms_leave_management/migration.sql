CREATE TYPE "HrLeaveUnit" AS ENUM ('DAYS', 'HOURS');
CREATE TYPE "HrLeaveAccrualFrequency" AS ENUM ('NONE', 'MONTHLY', 'QUARTERLY', 'ANNUALLY');
CREATE TYPE "HrLeaveRequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'WITHDRAWN');
CREATE TYPE "HrLeaveLedgerType" AS ENUM ('OPENING', 'ACCRUAL', 'CARRY_OVER', 'ADJUSTMENT', 'REQUEST_RESERVED', 'REQUEST_RELEASED', 'LEAVE_TAKEN', 'LEAVE_RESTORED', 'EXPIRY');

CREATE TABLE "HrLeaveType" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "unit" "HrLeaveUnit" NOT NULL DEFAULT 'DAYS',
  "paid" BOOLEAN NOT NULL DEFAULT true,
  "requiresAttachment" BOOLEAN NOT NULL DEFAULT false,
  "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "HrLeaveType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrLeavePolicy" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "leaveTypeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "entitlement" DECIMAL(10,2) NOT NULL,
  "accrualFrequency" "HrLeaveAccrualFrequency" NOT NULL DEFAULT 'ANNUALLY',
  "accrualAmount" DECIMAL(10,2),
  "maximumBalance" DECIMAL(10,2),
  "carryOverLimit" DECIMAL(10,2),
  "carryOverExpiryMonth" INTEGER,
  "minimumNoticeDays" INTEGER NOT NULL DEFAULT 0,
  "maximumConsecutive" DECIMAL(10,2),
  "probationMonths" INTEGER NOT NULL DEFAULT 0,
  "allowNegativeBalance" BOOLEAN NOT NULL DEFAULT false,
  "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrLeavePolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrLeavePolicy_dates_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"),
  CONSTRAINT "HrLeavePolicy_values_check" CHECK ("entitlement" >= 0 AND "minimumNoticeDays" >= 0 AND "probationMonths" >= 0 AND ("carryOverExpiryMonth" IS NULL OR "carryOverExpiryMonth" BETWEEN 1 AND 12))
);

CREATE TABLE "HrEmployeeLeavePolicy" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "leavePolicyId" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "status" "HrAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "reason" TEXT NOT NULL,
  "assignedById" TEXT NOT NULL,
  "endedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrEmployeeLeavePolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrEmployeeLeavePolicy_dates_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE TABLE "HrLeaveBalance" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "leaveTypeId" TEXT NOT NULL,
  "leavePolicyId" TEXT NOT NULL,
  "periodYear" INTEGER NOT NULL,
  "opening" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "accrued" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "carriedOver" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "adjusted" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "reserved" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "used" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "expired" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrLeaveBalance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrLeaveBalance_year_check" CHECK ("periodYear" BETWEEN 1900 AND 9999)
);

CREATE TABLE "HrLeaveRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "leaveTypeId" TEXT NOT NULL,
  "leavePolicyId" TEXT NOT NULL,
  "balanceId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "HrLeaveRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "requestedById" TEXT NOT NULL,
  "currentReviewerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrLeaveRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrLeaveRequest_dates_check" CHECK ("endDate" >= "startDate"),
  CONSTRAINT "HrLeaveRequest_amount_check" CHECK ("amount" > 0)
);

CREATE TABLE "HrLeaveLedger" (
  "id" TEXT NOT NULL,
  "balanceId" TEXT NOT NULL,
  "requestId" TEXT,
  "type" "HrLeaveLedgerType" NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "actorUserId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrLeaveLedger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrLeaveApproval" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "fromStatus" "HrLeaveRequestStatus" NOT NULL,
  "toStatus" "HrLeaveRequestStatus" NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrLeaveApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrLeaveAttachment" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrLeaveAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrPublicHoliday" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "country" TEXT,
  "region" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrPublicHoliday_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HrLeaveType_organizationId_code_key" ON "HrLeaveType"("organizationId", "code");
CREATE UNIQUE INDEX "HrLeaveType_organizationId_name_key" ON "HrLeaveType"("organizationId", "name");
CREATE INDEX "HrLeaveType_organizationId_status_idx" ON "HrLeaveType"("organizationId", "status");
CREATE UNIQUE INDEX "HrLeavePolicy_organizationId_leaveTypeId_version_key" ON "HrLeavePolicy"("organizationId", "leaveTypeId", "version");
CREATE INDEX "HrLeavePolicy_organizationId_status_effectiveFrom_effectiveTo_idx" ON "HrLeavePolicy"("organizationId", "status", "effectiveFrom", "effectiveTo");
CREATE INDEX "HrEmployeeLeavePolicy_employeeId_status_effectiveFrom_effectiveTo_idx" ON "HrEmployeeLeavePolicy"("employeeId", "status", "effectiveFrom", "effectiveTo");
CREATE INDEX "HrEmployeeLeavePolicy_leavePolicyId_status_idx" ON "HrEmployeeLeavePolicy"("leavePolicyId", "status");
CREATE UNIQUE INDEX "HrLeaveBalance_employeeId_leaveTypeId_periodYear_key" ON "HrLeaveBalance"("employeeId", "leaveTypeId", "periodYear");
CREATE INDEX "HrLeaveBalance_organizationId_periodYear_idx" ON "HrLeaveBalance"("organizationId", "periodYear");
CREATE UNIQUE INDEX "HrLeaveLedger_idempotencyKey_key" ON "HrLeaveLedger"("idempotencyKey");
CREATE INDEX "HrLeaveLedger_balanceId_effectiveAt_idx" ON "HrLeaveLedger"("balanceId", "effectiveAt");
CREATE INDEX "HrLeaveLedger_requestId_idx" ON "HrLeaveLedger"("requestId");
CREATE INDEX "HrLeaveRequest_organizationId_status_startDate_idx" ON "HrLeaveRequest"("organizationId", "status", "startDate");
CREATE INDEX "HrLeaveRequest_employeeId_createdAt_idx" ON "HrLeaveRequest"("employeeId", "createdAt");
CREATE INDEX "HrLeaveRequest_currentReviewerId_status_idx" ON "HrLeaveRequest"("currentReviewerId", "status");
CREATE INDEX "HrLeaveApproval_requestId_createdAt_idx" ON "HrLeaveApproval"("requestId", "createdAt");
CREATE INDEX "HrLeaveApproval_reviewerId_createdAt_idx" ON "HrLeaveApproval"("reviewerId", "createdAt");
CREATE INDEX "HrLeaveAttachment_requestId_createdAt_idx" ON "HrLeaveAttachment"("requestId", "createdAt");
CREATE UNIQUE INDEX "HrPublicHoliday_organizationId_date_name_key" ON "HrPublicHoliday"("organizationId", "date", "name");
CREATE INDEX "HrPublicHoliday_organizationId_date_idx" ON "HrPublicHoliday"("organizationId", "date");

ALTER TABLE "HrLeaveType" ADD CONSTRAINT "HrLeaveType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLeavePolicy" ADD CONSTRAINT "HrLeavePolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLeavePolicy" ADD CONSTRAINT "HrLeavePolicy_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "HrLeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeLeavePolicy" ADD CONSTRAINT "HrEmployeeLeavePolicy_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeLeavePolicy" ADD CONSTRAINT "HrEmployeeLeavePolicy_leavePolicyId_fkey" FOREIGN KEY ("leavePolicyId") REFERENCES "HrLeavePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeLeavePolicy" ADD CONSTRAINT "HrEmployeeLeavePolicy_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeeLeavePolicy" ADD CONSTRAINT "HrEmployeeLeavePolicy_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLeaveBalance" ADD CONSTRAINT "HrLeaveBalance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLeaveBalance" ADD CONSTRAINT "HrLeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLeaveBalance" ADD CONSTRAINT "HrLeaveBalance_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "HrLeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLeaveBalance" ADD CONSTRAINT "HrLeaveBalance_leavePolicyId_fkey" FOREIGN KEY ("leavePolicyId") REFERENCES "HrLeavePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLeaveRequest" ADD CONSTRAINT "HrLeaveRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLeaveRequest" ADD CONSTRAINT "HrLeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLeaveRequest" ADD CONSTRAINT "HrLeaveRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "HrLeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLeaveRequest" ADD CONSTRAINT "HrLeaveRequest_leavePolicyId_fkey" FOREIGN KEY ("leavePolicyId") REFERENCES "HrLeavePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLeaveRequest" ADD CONSTRAINT "HrLeaveRequest_balanceId_fkey" FOREIGN KEY ("balanceId") REFERENCES "HrLeaveBalance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLeaveRequest" ADD CONSTRAINT "HrLeaveRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLeaveRequest" ADD CONSTRAINT "HrLeaveRequest_currentReviewerId_fkey" FOREIGN KEY ("currentReviewerId") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLeaveLedger" ADD CONSTRAINT "HrLeaveLedger_balanceId_fkey" FOREIGN KEY ("balanceId") REFERENCES "HrLeaveBalance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLeaveLedger" ADD CONSTRAINT "HrLeaveLedger_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "HrLeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLeaveLedger" ADD CONSTRAINT "HrLeaveLedger_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "HrUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HrLeaveApproval" ADD CONSTRAINT "HrLeaveApproval_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "HrLeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLeaveApproval" ADD CONSTRAINT "HrLeaveApproval_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLeaveAttachment" ADD CONSTRAINT "HrLeaveAttachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "HrLeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLeaveAttachment" ADD CONSTRAINT "HrLeaveAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPublicHoliday" ADD CONSTRAINT "HrPublicHoliday_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "hr_prevent_immutable_mutation"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% records are immutable', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "HrLeaveLedger_immutable"
BEFORE UPDATE OR DELETE ON "HrLeaveLedger"
FOR EACH ROW EXECUTE FUNCTION "hr_prevent_immutable_mutation"();

CREATE TRIGGER "HrAuditEvent_immutable"
BEFORE UPDATE OR DELETE ON "HrAuditEvent"
FOR EACH ROW EXECUTE FUNCTION "hr_prevent_immutable_mutation"();
