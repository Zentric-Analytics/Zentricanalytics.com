CREATE TYPE "HrWorkflowApprovalMode" AS ENUM ('ANY', 'ALL', 'QUORUM');
CREATE TYPE "HrWorkflowAssigneeType" AS ENUM ('USERS', 'SUPERVISOR', 'PERMISSION');
CREATE TYPE "HrWorkflowInstanceStatus" AS ENUM ('ACTIVE', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "HrWorkflowStageRunStatus" AS ENUM ('PENDING', 'ACTIVE', 'APPROVED', 'REJECTED', 'SKIPPED', 'CANCELLED');
CREATE TYPE "HrWorkflowDecision" AS ENUM ('APPROVED', 'REJECTED');

CREATE TABLE "HrWorkflowDefinition" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "key" TEXT NOT NULL, "name" TEXT NOT NULL,
  "description" TEXT, "module" TEXT NOT NULL, "subjectType" TEXT NOT NULL, "version" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrWorkflowDefinition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrWorkflowDefinition_version_check" CHECK ("version" > 0)
);
CREATE TABLE "HrWorkflowDefinitionStage" (
  "id" TEXT NOT NULL, "definitionId" TEXT NOT NULL, "key" TEXT NOT NULL, "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL, "assigneeType" "HrWorkflowAssigneeType" NOT NULL,
  "assigneeUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "assigneePermissionKey" TEXT,
  "approvalMode" "HrWorkflowApprovalMode" NOT NULL DEFAULT 'ANY', "quorum" INTEGER,
  "routingCondition" JSONB, "dueOffsetHours" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrWorkflowDefinitionStage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrWorkflowDefinitionStage_order_check" CHECK ("sortOrder" >= 0),
  CONSTRAINT "HrWorkflowDefinitionStage_quorum_check" CHECK (
    ("approvalMode" = 'QUORUM' AND "quorum" IS NOT NULL AND "quorum" > 0)
    OR ("approvalMode" <> 'QUORUM' AND "quorum" IS NULL)
  ),
  CONSTRAINT "HrWorkflowDefinitionStage_assignee_check" CHECK (
    ("assigneeType" = 'USERS' AND cardinality("assigneeUserIds") > 0 AND "assigneePermissionKey" IS NULL)
    OR ("assigneeType" = 'PERMISSION' AND cardinality("assigneeUserIds") = 0 AND length(trim("assigneePermissionKey")) > 0)
    OR ("assigneeType" = 'SUPERVISOR' AND cardinality("assigneeUserIds") = 0 AND "assigneePermissionKey" IS NULL)
  )
);
CREATE TABLE "HrWorkflowInstance" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "definitionId" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL, "subjectId" TEXT NOT NULL, "subjectEmployeeId" TEXT,
  "context" JSONB NOT NULL, "status" "HrWorkflowInstanceStatus" NOT NULL DEFAULT 'ACTIVE',
  "currentStageOrder" INTEGER, "startedById" TEXT NOT NULL, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3), "cancelledAt" TIMESTAMP(3), "cancellationReason" TEXT,
  CONSTRAINT "HrWorkflowInstance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrWorkflowInstance_terminal_check" CHECK (
    ("status" IN ('APPROVED','REJECTED') AND "completedAt" IS NOT NULL AND "cancelledAt" IS NULL)
    OR ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL AND "completedAt" IS NULL AND length(trim("cancellationReason")) >= 3)
    OR ("status" = 'ACTIVE' AND "completedAt" IS NULL AND "cancelledAt" IS NULL)
  )
);
CREATE TABLE "HrWorkflowStageRun" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "instanceId" TEXT NOT NULL,
  "definitionStageId" TEXT NOT NULL, "stageKey" TEXT NOT NULL, "stageName" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL, "approvalMode" "HrWorkflowApprovalMode" NOT NULL,
  "requiredApprovals" INTEGER NOT NULL, "approverUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "HrWorkflowStageRunStatus" NOT NULL DEFAULT 'PENDING', "activatedAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrWorkflowStageRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrWorkflowStageRun_approver_check" CHECK ("requiredApprovals" > 0 AND "requiredApprovals" <= cardinality("approverUserIds")),
  CONSTRAINT "HrWorkflowStageRun_terminal_check" CHECK (
    ("status" IN ('APPROVED','REJECTED','SKIPPED') AND "completedAt" IS NOT NULL)
    OR ("status" IN ('PENDING','ACTIVE','CANCELLED') AND "completedAt" IS NULL)
  )
);
CREATE TABLE "HrWorkflowApproval" (
  "id" TEXT NOT NULL, "stageRunId" TEXT NOT NULL, "approverId" TEXT NOT NULL,
  "decision" "HrWorkflowDecision" NOT NULL, "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrWorkflowApproval_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrWorkflowApproval_reason_check" CHECK (length(trim("reason")) >= 3)
);

CREATE UNIQUE INDEX "HrWorkflowDefinition_organizationId_key_version_key" ON "HrWorkflowDefinition"("organizationId","key","version");
CREATE INDEX "HrWorkflowDefinition_organizationId_module_subjectType_active_idx" ON "HrWorkflowDefinition"("organizationId","module","subjectType","active");
CREATE UNIQUE INDEX "HrWorkflowDefinitionStage_definitionId_key_key" ON "HrWorkflowDefinitionStage"("definitionId","key");
CREATE UNIQUE INDEX "HrWorkflowDefinitionStage_definitionId_sortOrder_key" ON "HrWorkflowDefinitionStage"("definitionId","sortOrder");
CREATE INDEX "HrWorkflowInstance_organizationId_status_startedAt_idx" ON "HrWorkflowInstance"("organizationId","status","startedAt");
CREATE INDEX "HrWorkflowInstance_organizationId_subjectType_subjectId_idx" ON "HrWorkflowInstance"("organizationId","subjectType","subjectId");
CREATE INDEX "HrWorkflowInstance_subjectEmployeeId_status_idx" ON "HrWorkflowInstance"("subjectEmployeeId","status");
CREATE UNIQUE INDEX "HrWorkflowInstance_one_active_definition_subject" ON "HrWorkflowInstance"("definitionId","subjectType","subjectId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "HrWorkflowStageRun_instanceId_sortOrder_key" ON "HrWorkflowStageRun"("instanceId","sortOrder");
CREATE INDEX "HrWorkflowStageRun_organizationId_status_dueAt_idx" ON "HrWorkflowStageRun"("organizationId","status","dueAt");
CREATE UNIQUE INDEX "HrWorkflowApproval_stageRunId_approverId_key" ON "HrWorkflowApproval"("stageRunId","approverId");
CREATE INDEX "HrWorkflowApproval_approverId_createdAt_idx" ON "HrWorkflowApproval"("approverId","createdAt");

ALTER TABLE "HrWorkflowDefinition" ADD CONSTRAINT "HrWorkflowDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrWorkflowDefinition" ADD CONSTRAINT "HrWorkflowDefinition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrWorkflowDefinitionStage" ADD CONSTRAINT "HrWorkflowDefinitionStage_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "HrWorkflowDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrWorkflowInstance" ADD CONSTRAINT "HrWorkflowInstance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrWorkflowInstance" ADD CONSTRAINT "HrWorkflowInstance_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "HrWorkflowDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrWorkflowInstance" ADD CONSTRAINT "HrWorkflowInstance_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrWorkflowInstance" ADD CONSTRAINT "HrWorkflowInstance_subjectEmployeeId_fkey" FOREIGN KEY ("subjectEmployeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrWorkflowStageRun" ADD CONSTRAINT "HrWorkflowStageRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "HrOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrWorkflowStageRun" ADD CONSTRAINT "HrWorkflowStageRun_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "HrWorkflowInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrWorkflowStageRun" ADD CONSTRAINT "HrWorkflowStageRun_definitionStageId_fkey" FOREIGN KEY ("definitionStageId") REFERENCES "HrWorkflowDefinitionStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrWorkflowApproval" ADD CONSTRAINT "HrWorkflowApproval_stageRunId_fkey" FOREIGN KEY ("stageRunId") REFERENCES "HrWorkflowStageRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrWorkflowApproval" ADD CONSTRAINT "HrWorkflowApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION hr_prevent_workflow_definition_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'Workflow definitions and stages are immutable; publish a new version'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "HrWorkflowDefinition_immutable" BEFORE UPDATE OR DELETE ON "HrWorkflowDefinition" FOR EACH ROW EXECUTE FUNCTION hr_prevent_workflow_definition_mutation();
CREATE TRIGGER "HrWorkflowDefinitionStage_immutable" BEFORE UPDATE OR DELETE ON "HrWorkflowDefinitionStage" FOR EACH ROW EXECUTE FUNCTION hr_prevent_workflow_definition_mutation();

CREATE OR REPLACE FUNCTION hr_prevent_workflow_history_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'Workflow decisions are immutable'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "HrWorkflowApproval_immutable" BEFORE UPDATE OR DELETE ON "HrWorkflowApproval" FOR EACH ROW EXECUTE FUNCTION hr_prevent_workflow_history_mutation();
CREATE TRIGGER "HrWorkflowInstance_no_delete" BEFORE DELETE ON "HrWorkflowInstance" FOR EACH ROW EXECUTE FUNCTION hr_prevent_workflow_history_mutation();
CREATE TRIGGER "HrWorkflowStageRun_no_delete" BEFORE DELETE ON "HrWorkflowStageRun" FOR EACH ROW EXECUTE FUNCTION hr_prevent_workflow_history_mutation();
