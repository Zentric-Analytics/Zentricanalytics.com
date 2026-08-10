-- Temporary primary-administrator physical deletion support.
-- The application sets this transaction-local flag only after primary-admin
-- authorization and only while releasing a soft-deleted user's references.

CREATE OR REPLACE FUNCTION "hr_prevent_immutable_mutation"()
RETURNS trigger AS $$
BEGIN
  IF current_setting('zentric.primary_admin_hard_delete', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '% records are immutable', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION hr_protect_approved_salary()
RETURNS trigger AS $$
BEGIN
  IF current_setting('zentric.primary_admin_hard_delete', true) = 'on' THEN RETURN NEW; END IF;
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

CREATE OR REPLACE FUNCTION hr_protect_payroll_item_snapshot()
RETURNS trigger AS $$
BEGIN
  IF current_setting('zentric.primary_admin_hard_delete', true) = 'on' THEN RETURN NEW; END IF;
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

CREATE OR REPLACE FUNCTION hr_protect_document_version()
RETURNS trigger AS $$
BEGIN
  IF current_setting('zentric.primary_admin_hard_delete', true) = 'on' THEN RETURN NEW; END IF;
  IF OLD."scanStatus" <> 'PENDING'
     OR NEW."organizationId" <> OLD."organizationId"
     OR NEW."documentId" <> OLD."documentId"
     OR NEW."version" <> OLD."version"
     OR NEW."originalFileName" <> OLD."originalFileName"
     OR NEW."displayFileName" <> OLD."displayFileName"
     OR NEW."contentType" <> OLD."contentType"
     OR NEW."sizeBytes" <> OLD."sizeBytes"
     OR NEW."storageProvider" <> OLD."storageProvider"
     OR NEW."storageKey" <> OLD."storageKey"
     OR NEW."checksum" <> OLD."checksum"
     OR NEW."uploadedById" <> OLD."uploadedById"
     OR NEW."uploadedAt" <> OLD."uploadedAt"
     OR NEW."scanStatus" = 'PENDING'
     OR NEW."scanCompletedAt" IS NULL THEN
    RAISE EXCEPTION 'Document versions are immutable except for one terminal scan result';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION hr_protect_asset_assignment()
RETURNS trigger AS $$
BEGIN
  IF current_setting('zentric.primary_admin_hard_delete', true) = 'on' THEN RETURN NEW; END IF;
  IF OLD."status" <> 'ACTIVE'
     OR NEW."organizationId" <> OLD."organizationId"
     OR NEW."assetId" <> OLD."assetId"
     OR NEW."employeeId" <> OLD."employeeId"
     OR NEW."assignedAt" <> OLD."assignedAt"
     OR NEW."expectedReturnAt" IS DISTINCT FROM OLD."expectedReturnAt"
     OR NEW."issueCondition" <> OLD."issueCondition"
     OR NEW."issueNotes" IS DISTINCT FROM OLD."issueNotes"
     OR NEW."assignedById" <> OLD."assignedById"
     OR NEW."createdAt" <> OLD."createdAt"
     OR (OLD."acknowledgedAt" IS NOT NULL AND NEW."acknowledgedAt" IS DISTINCT FROM OLD."acknowledgedAt") THEN
    RAISE EXCEPTION 'Asset assignment custody history is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION hr_prevent_lifecycle_template_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('zentric.primary_admin_hard_delete', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'HR lifecycle templates and template tasks are immutable; create a new version';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION hr_prevent_lifecycle_delete() RETURNS trigger AS $$
BEGIN
  IF current_setting('zentric.primary_admin_hard_delete', true) = 'on' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'HR lifecycle history cannot be deleted';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION hr_prevent_workflow_definition_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('zentric.primary_admin_hard_delete', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Workflow definitions and stages are immutable; publish a new version';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION hr_prevent_workflow_history_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('zentric.primary_admin_hard_delete', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Workflow decisions are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION hr_prevent_delivery_attempt_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('zentric.primary_admin_hard_delete', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Email delivery attempts are immutable';
END;
$$ LANGUAGE plpgsql;
