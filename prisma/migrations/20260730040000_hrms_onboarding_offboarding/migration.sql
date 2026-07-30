CREATE TYPE "HrLifecycleType" AS ENUM ('ONBOARDING', 'OFFBOARDING');
CREATE TYPE "HrLifecycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "HrLifecycleTaskOwnerType" AS ENUM ('HR', 'IT', 'SUPERVISOR', 'EMPLOYEE', 'PAYROLL', 'SPECIFIC_USER');
CREATE TYPE "HrLifecycleTaskStatus" AS ENUM ('BLOCKED', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'CANCELLED');

CREATE TABLE "HrLifecycleTemplate" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "description" TEXT, "type" "HrLifecycleType" NOT NULL, "version" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrLifecycleTemplate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrLifecycleTemplate_version_check" CHECK ("version" > 0)
);

CREATE TABLE "HrLifecycleTemplateTask" (
  "id" TEXT NOT NULL, "templateId" TEXT NOT NULL, "key" TEXT NOT NULL, "title" TEXT NOT NULL,
  "description" TEXT, "ownerType" "HrLifecycleTaskOwnerType" NOT NULL,
  "dueOffsetDays" INTEGER NOT NULL DEFAULT 0, "required" BOOLEAN NOT NULL DEFAULT true,
  "instructions" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "predecessorKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrLifecycleTemplateTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrLifecycleTemplateTask_due_offset_check" CHECK ("dueOffsetDays" BETWEEN -365 AND 3650)
);

CREATE TABLE "HrLifecycleInstance" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "templateId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL, "type" "HrLifecycleType" NOT NULL,
  "status" "HrLifecycleStatus" NOT NULL DEFAULT 'DRAFT', "effectiveDate" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT, "knowledgeTransferToId" TEXT, "exitInterviewNotes" TEXT,
  "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrLifecycleInstance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrLifecycleInstance_terminal_state_check" CHECK (
    ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL AND "cancelledAt" IS NULL)
    OR ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL AND "completedAt" IS NULL AND length(trim("cancellationReason")) >= 3)
    OR ("status" IN ('DRAFT', 'ACTIVE') AND "completedAt" IS NULL AND "cancelledAt" IS NULL)
  )
);

CREATE TABLE "HrLifecycleTask" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "instanceId" TEXT NOT NULL,
  "templateTaskKey" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT,
  "ownerType" "HrLifecycleTaskOwnerType" NOT NULL, "assignedUserId" TEXT,
  "dueAt" TIMESTAMP(3) NOT NULL, "required" BOOLEAN NOT NULL DEFAULT true,
  "status" "HrLifecycleTaskStatus" NOT NULL DEFAULT 'PENDING', "instructions" TEXT,
  "predecessorKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "completionNotes" TEXT,
  "evidenceReference" TEXT, "completedAt" TIMESTAMP(3), "completedById" TEXT,
  "skippedAt" TIMESTAMP(3), "skipReason" TEXT, "reminderSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrLifecycleTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrLifecycleTask_terminal_state_check" CHECK (
    ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL AND "completedById" IS NOT NULL AND length(trim("completionNotes")) >= 3)
    OR ("status" = 'SKIPPED' AND "skippedAt" IS NOT NULL AND length(trim("skipReason")) >= 3)
    OR ("status" IN ('BLOCKED', 'PENDING', 'IN_PROGRESS', 'CANCELLED') AND "completedAt" IS NULL AND "skippedAt" IS NULL)
  )
);

CREATE UNIQUE INDEX "HrLifecycleTemplate_organizationId_name_type_version_key" ON "HrLifecycleTemplate"("organizationId", "name", "type", "version");
CREATE INDEX "HrLifecycleTemplate_organizationId_type_active_idx" ON "HrLifecycleTemplate"("organizationId", "type", "active");
CREATE UNIQUE INDEX "HrLifecycleTemplateTask_templateId_key_key" ON "HrLifecycleTemplateTask"("templateId", "key");
CREATE INDEX "HrLifecycleTemplateTask_templateId_sortOrder_idx" ON "HrLifecycleTemplateTask"("templateId", "sortOrder");
CREATE INDEX "HrLifecycleInstance_organizationId_type_status_effectiveDate_idx" ON "HrLifecycleInstance"("organizationId", "type", "status", "effectiveDate");
CREATE INDEX "HrLifecycleInstance_employeeId_type_status_idx" ON "HrLifecycleInstance"("employeeId", "type", "status");
CREATE UNIQUE INDEX "HrLifecycleInstance_one_open_per_employee_type" ON "HrLifecycleInstance"("employeeId", "type") WHERE "status" IN ('DRAFT', 'ACTIVE');
CREATE UNIQUE INDEX "HrLifecycleTask_instanceId_templateTaskKey_key" ON "HrLifecycleTask"("instanceId", "templateTaskKey");
CREATE INDEX "HrLifecycleTask_organizationId_status_dueAt_idx" ON "HrLifecycleTask"("organizationId", "status", "dueAt");
CREATE INDEX "HrLifecycleTask_assignedUserId_status_dueAt_idx" ON "HrLifecycleTask"("assignedUserId", "status", "dueAt");

ALTER TABLE "HrLifecycleTemplate" ADD CONSTRAINT "HrLifecycleTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLifecycleTemplateTask" ADD CONSTRAINT "HrLifecycleTemplateTask_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "HrLifecycleTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLifecycleInstance" ADD CONSTRAINT "HrLifecycleInstance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLifecycleInstance" ADD CONSTRAINT "HrLifecycleInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "HrLifecycleTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLifecycleInstance" ADD CONSTRAINT "HrLifecycleInstance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLifecycleInstance" ADD CONSTRAINT "HrLifecycleInstance_knowledgeTransferToId_fkey" FOREIGN KEY ("knowledgeTransferToId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLifecycleInstance" ADD CONSTRAINT "HrLifecycleInstance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLifecycleTask" ADD CONSTRAINT "HrLifecycleTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLifecycleTask" ADD CONSTRAINT "HrLifecycleTask_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "HrLifecycleInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLifecycleTask" ADD CONSTRAINT "HrLifecycleTask_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrLifecycleTask" ADD CONSTRAINT "HrLifecycleTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION hr_prevent_lifecycle_template_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'HR lifecycle templates and template tasks are immutable; create a new version'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "HrLifecycleTemplate_immutable" BEFORE UPDATE OR DELETE ON "HrLifecycleTemplate" FOR EACH ROW EXECUTE FUNCTION hr_prevent_lifecycle_template_mutation();
CREATE TRIGGER "HrLifecycleTemplateTask_immutable" BEFORE UPDATE OR DELETE ON "HrLifecycleTemplateTask" FOR EACH ROW EXECUTE FUNCTION hr_prevent_lifecycle_template_mutation();

CREATE OR REPLACE FUNCTION hr_prevent_lifecycle_delete() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'HR lifecycle history cannot be deleted'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "HrLifecycleInstance_no_delete" BEFORE DELETE ON "HrLifecycleInstance" FOR EACH ROW EXECUTE FUNCTION hr_prevent_lifecycle_delete();
CREATE TRIGGER "HrLifecycleTask_no_delete" BEFORE DELETE ON "HrLifecycleTask" FOR EACH ROW EXECUTE FUNCTION hr_prevent_lifecycle_delete();

-- Existing initialized organizations must receive the new least-privilege task permission.
INSERT INTO "HrPermission" ("id", "organizationId", "key", "createdAt")
SELECT 'perm_' || md5(random()::text || o."id"), o."id", 'workflow.task.complete', CURRENT_TIMESTAMP
FROM "HrOrganization" o
ON CONFLICT ("organizationId", "key") DO NOTHING;

INSERT INTO "HrRolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT 'rp_' || md5(random()::text || r."id"), r."id", p."id", CURRENT_TIMESTAMP
FROM "HrRole" r
JOIN "HrPermission" p ON p."organizationId" = r."organizationId" AND p."key" = 'workflow.task.complete'
WHERE r."key" IN ('ADMIN', 'HR_ADMIN', 'PAYROLL_ADMIN', 'EMPLOYEE')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
