-- Additive HRMS payroll: effective-dated compensation, immutable payroll snapshots,
-- controlled approvals, payslips, payment history, and audited exports.
CREATE TYPE "HrPayFrequency" AS ENUM ('MONTHLY', 'BIWEEKLY', 'WEEKLY');
CREATE TYPE "HrPayrollComponentType" AS ENUM ('EARNING', 'DEDUCTION', 'TAX', 'BENEFIT');
CREATE TYPE "HrPayrollCalculationType" AS ENUM ('FIXED', 'PERCENTAGE_OF_BASE', 'PERCENTAGE_OF_GROSS');
CREATE TYPE "HrPayrollRunStatus" AS ENUM ('DRAFT', 'CALCULATED', 'REVIEWED', 'APPROVED', 'LOCKED', 'PAID', 'CANCELLED');
CREATE TYPE "HrPayrollPaymentStatus" AS ENUM ('NOT_PAID', 'PROCESSING', 'PAID', 'FAILED');

CREATE TABLE "HrSalaryRecord" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "payFrequency" "HrPayFrequency" NOT NULL DEFAULT 'MONTHLY',
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "reason" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrSalaryRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrSalaryRecord_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "HrSalaryRecord_dates_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE TABLE "HrPayrollComponent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "HrPayrollComponentType" NOT NULL,
  "calculationType" "HrPayrollCalculationType" NOT NULL DEFAULT 'FIXED',
  "taxable" BOOLEAN NOT NULL DEFAULT false,
  "pensionable" BOOLEAN NOT NULL DEFAULT false,
  "status" "HrRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "HrPayrollComponent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrEmployeePayrollComponent" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "componentId" TEXT NOT NULL,
  "amount" DECIMAL(18,4) NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "status" "HrAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "reason" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrEmployeePayrollComponent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrEmployeePayrollComponent_amount_check" CHECK ("amount" >= 0),
  CONSTRAINT "HrEmployeePayrollComponent_dates_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE TABLE "HrPayrollPeriod" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "payDate" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL,
  "payFrequency" "HrPayFrequency" NOT NULL DEFAULT 'MONTHLY',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrPayrollPeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrPayrollPeriod_dates_check" CHECK ("endsAt" >= "startsAt")
);

CREATE TABLE "HrPayrollRun" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "HrPayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
  "calculationKey" TEXT NOT NULL,
  "calculatedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "lockedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrPayrollRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrPayrollItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "salaryRecordId" TEXT NOT NULL,
  "employeeNumber" TEXT NOT NULL,
  "employeeName" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "baseSalary" DECIMAL(18,2) NOT NULL,
  "grossEarnings" DECIMAL(18,2) NOT NULL,
  "totalDeductions" DECIMAL(18,2) NOT NULL,
  "employerBenefits" DECIMAL(18,2) NOT NULL,
  "netPay" DECIMAL(18,2) NOT NULL,
  "paymentStatus" "HrPayrollPaymentStatus" NOT NULL DEFAULT 'NOT_PAID',
  "paymentReference" TEXT,
  "paymentMarkedAt" TIMESTAMP(3),
  "paymentMarkedById" TEXT,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrPayrollItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrPayrollItem_amounts_check" CHECK ("baseSalary" >= 0 AND "grossEarnings" >= 0 AND "totalDeductions" >= 0 AND "employerBenefits" >= 0 AND "netPay" >= 0),
  CONSTRAINT "HrPayrollItem_net_check" CHECK ("netPay" = "grossEarnings" - "totalDeductions")
);

CREATE TABLE "HrPayrollItemComponent" (
  "id" TEXT NOT NULL,
  "payrollItemId" TEXT NOT NULL,
  "componentId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "HrPayrollComponentType" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "sourceAmount" DECIMAL(18,4),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrPayrollItemComponent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrPayrollItemComponent_amount_check" CHECK ("amount" >= 0)
);

CREATE TABLE "HrPayrollApproval" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "fromStatus" "HrPayrollRunStatus" NOT NULL,
  "toStatus" "HrPayrollRunStatus" NOT NULL,
  "comment" TEXT,
  "correlationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrPayrollApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrPayrollAdjustment" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "componentType" "HrPayrollComponentType" NOT NULL,
  "name" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrPayrollAdjustment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrPayrollAdjustment_amount_check" CHECK ("amount" >= 0)
);

CREATE TABLE "HrPayslip" (
  "id" TEXT NOT NULL,
  "payrollItemId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "storageKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL DEFAULT 'application/pdf',
  "sizeBytes" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrPayslip_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrPayslip_size_check" CHECK ("sizeBytes" > 0)
);

CREATE TABLE "HrPayrollExport" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "storageKey" TEXT,
  "fileName" TEXT NOT NULL,
  "checksum" TEXT,
  "rowCount" INTEGER NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrPayrollExport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrPayrollExport_row_count_check" CHECK ("rowCount" >= 0)
);

CREATE UNIQUE INDEX "HrPayrollComponent_organizationId_code_key" ON "HrPayrollComponent"("organizationId", "code");
CREATE INDEX "HrPayrollComponent_organizationId_status_type_idx" ON "HrPayrollComponent"("organizationId", "status", "type");
CREATE INDEX "HrSalaryRecord_organizationId_employeeId_effectiveFrom_effectiveTo_idx" ON "HrSalaryRecord"("organizationId", "employeeId", "effectiveFrom", "effectiveTo");
CREATE UNIQUE INDEX "HrSalaryRecord_employeeId_effectiveFrom_key" ON "HrSalaryRecord"("employeeId", "effectiveFrom");
CREATE INDEX "HrEmployeePayrollComponent_employeeId_status_effectiveFrom_effectiveTo_idx" ON "HrEmployeePayrollComponent"("employeeId", "status", "effectiveFrom", "effectiveTo");
CREATE INDEX "HrEmployeePayrollComponent_componentId_status_idx" ON "HrEmployeePayrollComponent"("componentId", "status");
CREATE UNIQUE INDEX "HrEmployeePayrollComponent_employeeId_componentId_effectiveFrom_key" ON "HrEmployeePayrollComponent"("employeeId", "componentId", "effectiveFrom");
CREATE UNIQUE INDEX "HrPayrollPeriod_organizationId_startsAt_endsAt_key" ON "HrPayrollPeriod"("organizationId", "startsAt", "endsAt");
CREATE INDEX "HrPayrollPeriod_organizationId_payDate_idx" ON "HrPayrollPeriod"("organizationId", "payDate");
CREATE UNIQUE INDEX "HrPayrollRun_calculationKey_key" ON "HrPayrollRun"("calculationKey");
CREATE UNIQUE INDEX "HrPayrollRun_periodId_version_key" ON "HrPayrollRun"("periodId", "version");
CREATE INDEX "HrPayrollRun_organizationId_status_createdAt_idx" ON "HrPayrollRun"("organizationId", "status", "createdAt");
CREATE UNIQUE INDEX "HrPayrollItem_runId_employeeId_key" ON "HrPayrollItem"("runId", "employeeId");
CREATE INDEX "HrPayrollItem_organizationId_employeeId_createdAt_idx" ON "HrPayrollItem"("organizationId", "employeeId", "createdAt");
CREATE INDEX "HrPayrollItem_runId_paymentStatus_idx" ON "HrPayrollItem"("runId", "paymentStatus");
CREATE UNIQUE INDEX "HrPayrollItemComponent_payrollItemId_code_key" ON "HrPayrollItemComponent"("payrollItemId", "code");
CREATE INDEX "HrPayrollItemComponent_payrollItemId_type_idx" ON "HrPayrollItemComponent"("payrollItemId", "type");
CREATE INDEX "HrPayrollApproval_runId_createdAt_idx" ON "HrPayrollApproval"("runId", "createdAt");
CREATE INDEX "HrPayrollApproval_actorUserId_createdAt_idx" ON "HrPayrollApproval"("actorUserId", "createdAt");
CREATE INDEX "HrPayrollAdjustment_runId_employeeId_idx" ON "HrPayrollAdjustment"("runId", "employeeId");
CREATE UNIQUE INDEX "HrPayslip_payrollItemId_key" ON "HrPayslip"("payrollItemId");
CREATE INDEX "HrPayrollExport_organizationId_runId_createdAt_idx" ON "HrPayrollExport"("organizationId", "runId", "createdAt");

ALTER TABLE "HrSalaryRecord" ADD CONSTRAINT "HrSalaryRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrSalaryRecord" ADD CONSTRAINT "HrSalaryRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrSalaryRecord" ADD CONSTRAINT "HrSalaryRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrSalaryRecord" ADD CONSTRAINT "HrSalaryRecord_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPayrollComponent" ADD CONSTRAINT "HrPayrollComponent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeePayrollComponent" ADD CONSTRAINT "HrEmployeePayrollComponent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeePayrollComponent" ADD CONSTRAINT "HrEmployeePayrollComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "HrPayrollComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrEmployeePayrollComponent" ADD CONSTRAINT "HrEmployeePayrollComponent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPayrollPeriod" ADD CONSTRAINT "HrPayrollPeriod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPayrollRun" ADD CONSTRAINT "HrPayrollRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPayrollRun" ADD CONSTRAINT "HrPayrollRun_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "HrPayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPayrollRun" ADD CONSTRAINT "HrPayrollRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPayrollItem" ADD CONSTRAINT "HrPayrollItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPayrollItem" ADD CONSTRAINT "HrPayrollItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "HrPayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPayrollItem" ADD CONSTRAINT "HrPayrollItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPayrollItem" ADD CONSTRAINT "HrPayrollItem_salaryRecordId_fkey" FOREIGN KEY ("salaryRecordId") REFERENCES "HrSalaryRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPayrollItem" ADD CONSTRAINT "HrPayrollItem_paymentMarkedById_fkey" FOREIGN KEY ("paymentMarkedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPayrollItemComponent" ADD CONSTRAINT "HrPayrollItemComponent_payrollItemId_fkey" FOREIGN KEY ("payrollItemId") REFERENCES "HrPayrollItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPayrollItemComponent" ADD CONSTRAINT "HrPayrollItemComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "HrPayrollComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPayrollApproval" ADD CONSTRAINT "HrPayrollApproval_runId_fkey" FOREIGN KEY ("runId") REFERENCES "HrPayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPayrollApproval" ADD CONSTRAINT "HrPayrollApproval_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPayrollAdjustment" ADD CONSTRAINT "HrPayrollAdjustment_runId_fkey" FOREIGN KEY ("runId") REFERENCES "HrPayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPayrollAdjustment" ADD CONSTRAINT "HrPayrollAdjustment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPayrollAdjustment" ADD CONSTRAINT "HrPayrollAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPayslip" ADD CONSTRAINT "HrPayslip_payrollItemId_fkey" FOREIGN KEY ("payrollItemId") REFERENCES "HrPayrollItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPayrollExport" ADD CONSTRAINT "HrPayrollExport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPayrollExport" ADD CONSTRAINT "HrPayrollExport_runId_fkey" FOREIGN KEY ("runId") REFERENCES "HrPayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrPayrollExport" ADD CONSTRAINT "HrPayrollExport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "HrPayrollItem_immutable"
BEFORE DELETE ON "HrPayrollItem" FOR EACH ROW EXECUTE FUNCTION hr_prevent_immutable_mutation();
CREATE TRIGGER "HrPayrollItemComponent_immutable"
BEFORE UPDATE OR DELETE ON "HrPayrollItemComponent" FOR EACH ROW EXECUTE FUNCTION hr_prevent_immutable_mutation();
CREATE TRIGGER "HrPayrollApproval_immutable"
BEFORE UPDATE OR DELETE ON "HrPayrollApproval" FOR EACH ROW EXECUTE FUNCTION hr_prevent_immutable_mutation();
CREATE TRIGGER "HrPayrollAdjustment_immutable"
BEFORE UPDATE OR DELETE ON "HrPayrollAdjustment" FOR EACH ROW EXECUTE FUNCTION hr_prevent_immutable_mutation();
CREATE TRIGGER "HrPayslip_immutable"
BEFORE UPDATE OR DELETE ON "HrPayslip" FOR EACH ROW EXECUTE FUNCTION hr_prevent_immutable_mutation();
CREATE TRIGGER "HrPayrollExport_immutable"
BEFORE UPDATE OR DELETE ON "HrPayrollExport" FOR EACH ROW EXECUTE FUNCTION hr_prevent_immutable_mutation();
CREATE TRIGGER "HrSalaryRecord_no_delete"
BEFORE DELETE ON "HrSalaryRecord" FOR EACH ROW EXECUTE FUNCTION hr_prevent_immutable_mutation();
CREATE TRIGGER "HrEmployeePayrollComponent_no_delete"
BEFORE DELETE ON "HrEmployeePayrollComponent" FOR EACH ROW EXECUTE FUNCTION hr_prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION hr_protect_approved_salary()
RETURNS trigger AS $$
BEGIN
  IF OLD."approvedAt" IS NOT NULL AND (
     NEW."organizationId" <> OLD."organizationId"
     OR NEW."employeeId" <> OLD."employeeId"
     OR NEW."amount" <> OLD."amount"
     OR NEW."currency" <> OLD."currency"
     OR NEW."payFrequency" <> OLD."payFrequency"
     OR NEW."effectiveFrom" <> OLD."effectiveFrom"
     OR NEW."reason" <> OLD."reason"
     OR NEW."createdById" <> OLD."createdById"
     OR NEW."approvedById" IS DISTINCT FROM OLD."approvedById"
     OR NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt") THEN
    RAISE EXCEPTION 'Approved salary history is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "HrSalaryRecord_approved_immutable"
BEFORE UPDATE ON "HrSalaryRecord" FOR EACH ROW EXECUTE FUNCTION hr_protect_approved_salary();

CREATE OR REPLACE FUNCTION hr_protect_payroll_item_snapshot()
RETURNS trigger AS $$
BEGIN
  IF NEW."organizationId" <> OLD."organizationId"
     OR NEW."runId" <> OLD."runId"
     OR NEW."employeeId" <> OLD."employeeId"
     OR NEW."salaryRecordId" <> OLD."salaryRecordId"
     OR NEW."employeeNumber" <> OLD."employeeNumber"
     OR NEW."employeeName" <> OLD."employeeName"
     OR NEW."currency" <> OLD."currency"
     OR NEW."baseSalary" <> OLD."baseSalary"
     OR NEW."grossEarnings" <> OLD."grossEarnings"
     OR NEW."totalDeductions" <> OLD."totalDeductions"
     OR NEW."employerBenefits" <> OLD."employerBenefits"
     OR NEW."netPay" <> OLD."netPay"
     OR NEW."snapshot" <> OLD."snapshot" THEN
    RAISE EXCEPTION 'Payroll calculation snapshots are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "HrPayrollItem_snapshot_immutable"
BEFORE UPDATE ON "HrPayrollItem" FOR EACH ROW EXECUTE FUNCTION hr_protect_payroll_item_snapshot();
