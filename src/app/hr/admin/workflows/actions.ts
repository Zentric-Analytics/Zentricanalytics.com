"use server";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { assertSafeWorkflowContext, conditionMatches, dueAt, requiredApprovals, workflowCondition, workflowDefinitionInput } from "@/lib/hr/workflow/engine";

const refresh = () => { revalidatePath("/hr/admin/workflows"); revalidatePath("/hr/supervisor/reviews"); };
function parseJson(value: FormDataEntryValue | null, label: string) {
  try { return JSON.parse(String(value ?? "")); } catch { throw new Error(`${label} must be valid JSON.`); }
}

export async function publishWorkflowDefinitionAction(formData: FormData) {
  const auth = await requirePermission("workflow.create");
  const parsed = workflowDefinitionInput.parse({ ...Object.fromEntries(formData), stages: parseJson(formData.get("stages"), "Stages") });
  await prisma.$transaction(async (tx) => {
    const latest = await tx.hrWorkflowDefinition.aggregate({ where: { organizationId: auth.user.organizationId, key: parsed.key }, _max: { version: true } });
    const version = (latest._max.version ?? 0) + 1;
    const requestedUsers = [...new Set(parsed.stages.flatMap(({ assigneeUserIds }) => assigneeUserIds))];
    if (requestedUsers.length) {
      const validUsers = await tx.hrUser.count({ where: { organizationId: auth.user.organizationId, id: { in: requestedUsers }, status: "ACTIVE" } });
      if (validUsers !== requestedUsers.length) throw new Error("Every explicit workflow approver must be an active user in this organization.");
    }
    const definition = await tx.hrWorkflowDefinition.create({ data: {
      organizationId: auth.user.organizationId, key: parsed.key, name: parsed.name, description: parsed.description,
      module: parsed.module, subjectType: parsed.subjectType, version, createdById: auth.user.id,
      stages: { create: parsed.stages.map((stage, sortOrder) => ({ ...stage, sortOrder, routingCondition: stage.routingCondition as Prisma.InputJsonValue | undefined })) },
    } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrWorkflowDefinition", entityId: definition.id, action: "hr.workflow.definition.published", newValues: { key: parsed.key, version, module: parsed.module, subjectType: parsed.subjectType, stageCount: parsed.stages.length } });
  }, { isolationLevel: "Serializable" });
  refresh();
}

const startInput = z.object({
  definitionId: z.string().cuid(), subjectId: z.string().trim().min(1).max(200),
  subjectEmployeeId: z.string().cuid().optional().or(z.literal("")).transform((value) => value || undefined),
});

async function resolveApprovers(tx: Prisma.TransactionClient, organizationId: string, stage: { assigneeType: string; assigneeUserIds: string[]; assigneePermissionKey: string | null }, subjectEmployeeId?: string) {
  if (stage.assigneeType === "USERS") return stage.assigneeUserIds;
  if (stage.assigneeType === "SUPERVISOR") {
    if (!subjectEmployeeId) throw new Error("Supervisor routing requires a subject employee.");
    const assignment = await tx.hrSupervisorAssignment.findFirst({ where: { organizationId, assignedEmployeeId: subjectEmployeeId, status: "ACTIVE", effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] }, include: { supervisorEmployee: true }, orderBy: { effectiveFrom: "desc" } });
    if (!assignment?.supervisorEmployee.userId) throw new Error("The subject employee has no active linked supervisor account.");
    return [assignment.supervisorEmployee.userId];
  }
  const users = await tx.hrUser.findMany({ where: { organizationId, status: "ACTIVE", roles: { some: { revokedAt: null, role: { permissions: { some: { permission: { key: stage.assigneePermissionKey! } } } } } } }, select: { id: true } });
  return users.map(({ id }) => id);
}

export async function startWorkflowAction(formData: FormData) {
  const auth = await requirePermission("workflow.assign");
  const input = startInput.parse(Object.fromEntries(formData));
  const context = parseJson(formData.get("context"), "Context") as Record<string, unknown>;
  assertSafeWorkflowContext(context);
  await prisma.$transaction(async (tx) => {
    const definition = await tx.hrWorkflowDefinition.findFirstOrThrow({ where: { id: input.definitionId, organizationId: auth.user.organizationId, active: true }, include: { stages: { orderBy: { sortOrder: "asc" } } } });
    if (input.subjectEmployeeId) await tx.hrEmployee.findFirstOrThrow({ where: { id: input.subjectEmployeeId, organizationId: auth.user.organizationId } });
    const eligible = definition.stages.filter((stage) => conditionMatches(stage.routingCondition ? workflowCondition.parse(stage.routingCondition) : null, context));
    if (!eligible.length) throw new Error("No workflow stage matched this context.");
    const startedAt = new Date();
    const runs = [];
    for (const stage of eligible) {
      const approverUserIds = [...new Set(await resolveApprovers(tx, auth.user.organizationId, stage, input.subjectEmployeeId))];
      runs.push({ stage, approverUserIds, required: requiredApprovals(stage.approvalMode, approverUserIds.length, stage.quorum) });
    }
    const first = runs[0];
    const instance = await tx.hrWorkflowInstance.create({ data: {
      organizationId: auth.user.organizationId, definitionId: definition.id, subjectType: definition.subjectType,
      subjectId: input.subjectId, subjectEmployeeId: input.subjectEmployeeId, context: context as Prisma.InputJsonValue,
      currentStageOrder: first.stage.sortOrder, startedById: auth.user.id, startedAt,
      stageRuns: { create: runs.map(({ stage, approverUserIds, required }, index) => ({
        organizationId: auth.user.organizationId, definitionStageId: stage.id, stageKey: stage.key, stageName: stage.name,
        sortOrder: stage.sortOrder, approvalMode: stage.approvalMode, requiredApprovals: required, approverUserIds,
        status: index === 0 ? "ACTIVE" : "PENDING", activatedAt: index === 0 ? startedAt : null, dueAt: index === 0 ? dueAt(startedAt, stage.dueOffsetHours) : null,
      })) },
    } });
    const recipients = await tx.hrUser.findMany({ where: { id: { in: first.approverUserIds }, organizationId: auth.user.organizationId }, select: { id: true, email: true } });
    for (const recipient of recipients) await enqueueHrEmail(tx, { organizationId: auth.user.organizationId, recipient: recipient.email, template: "hr-workflow-approval", subject: "Workflow approval requested", payload: { workflowInstanceId: instance.id, workflowStageKey: first.stage.key }, idempotencyKey: `hr-workflow-stage:${instance.id}:${first.stage.key}:${recipient.id}` });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrWorkflowInstance", entityId: instance.id, action: "hr.workflow.started", newValues: { definitionId: definition.id, definitionVersion: definition.version, subjectType: definition.subjectType, subjectId: input.subjectId } });
  }, { isolationLevel: "Serializable" });
  refresh();
}

const decisionInput = z.object({ stageRunId: z.string().cuid(), decision: z.enum(["APPROVED", "REJECTED"]), reason: z.string().trim().min(3).max(2000) });
export async function decideWorkflowStageAction(formData: FormData) {
  const auth = await requirePermission("workflow.task.complete");
  const input = decisionInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => {
    const run = await tx.hrWorkflowStageRun.findFirstOrThrow({ where: { id: input.stageRunId, organizationId: auth.user.organizationId, status: "ACTIVE", instance: { status: "ACTIVE" } }, include: { instance: true } });
    if (!run.approverUserIds.includes(auth.user.id) && !auth.permissions.has("workflow.override")) throw new Error("You are not an approver for this stage.");
    const correlationId = `workflow:${run.instanceId}:${run.id}:${auth.user.id}`;
    await tx.hrWorkflowApproval.create({ data: {
      stageRunId: run.id, approverId: auth.user.id, actorRole: auth.roles[0] ?? "UNKNOWN",
      requestType: run.instance.subjectType, requestId: run.instance.subjectId,
      previousStatus: run.status, newStatus: input.decision, decision: input.decision,
      reason: input.reason, correlationId,
    } });
    const decisions = await tx.hrWorkflowApproval.findMany({ where: { stageRunId: run.id } });
    const rejected = decisions.some(({ decision }) => decision === "REJECTED");
    const approved = decisions.filter(({ decision }) => decision === "APPROVED").length;
    if (rejected) {
      await tx.hrWorkflowStageRun.update({ where: { id: run.id }, data: { status: "REJECTED", completedAt: new Date() } });
      await tx.hrWorkflowStageRun.updateMany({ where: { instanceId: run.instanceId, status: "PENDING" }, data: { status: "CANCELLED" } });
      await tx.hrWorkflowInstance.update({ where: { id: run.instanceId }, data: { status: "REJECTED", completedAt: new Date(), currentStageOrder: null } });
    } else if (approved >= run.requiredApprovals) {
      const completedAt = new Date();
      await tx.hrWorkflowStageRun.update({ where: { id: run.id }, data: { status: "APPROVED", completedAt } });
      const next = await tx.hrWorkflowStageRun.findFirst({ where: { instanceId: run.instanceId, status: "PENDING" }, orderBy: { sortOrder: "asc" } });
      if (!next) await tx.hrWorkflowInstance.update({ where: { id: run.instanceId }, data: { status: "APPROVED", completedAt, currentStageOrder: null } });
      else {
        const definitionStage = await tx.hrWorkflowDefinitionStage.findUniqueOrThrow({ where: { id: next.definitionStageId } });
        await tx.hrWorkflowStageRun.update({ where: { id: next.id }, data: { status: "ACTIVE", activatedAt: completedAt, dueAt: dueAt(completedAt, definitionStage.dueOffsetHours) } });
        await tx.hrWorkflowInstance.update({ where: { id: run.instanceId }, data: { currentStageOrder: next.sortOrder } });
        const recipients = await tx.hrUser.findMany({ where: { id: { in: next.approverUserIds }, organizationId: auth.user.organizationId }, select: { id: true, email: true } });
        for (const recipient of recipients) await enqueueHrEmail(tx, { organizationId: auth.user.organizationId, recipient: recipient.email, template: "hr-workflow-approval", subject: "Workflow approval requested", payload: { workflowInstanceId: run.instanceId, workflowStageKey: next.stageKey }, idempotencyKey: `hr-workflow-stage:${run.instanceId}:${next.stageKey}:${recipient.id}` });
      }
    }
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrWorkflowApproval", entityId: run.id, action: `hr.workflow.${input.decision.toLowerCase()}`, reason: input.reason, correlationId, previousValues: { status: run.status }, newValues: { stageKey: run.stageKey, status: input.decision, requestType: run.instance.subjectType, requestId: run.instance.subjectId } });
  }, { isolationLevel: "Serializable" });
  refresh();
}

const cancelInput = z.object({ instanceId: z.string().cuid(), reason: z.string().trim().min(3).max(1000) });
export async function cancelWorkflowAction(formData: FormData) {
  const auth = await requirePermission("workflow.override");
  const input = cancelInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => {
    const instance = await tx.hrWorkflowInstance.findFirstOrThrow({ where: { id: input.instanceId, organizationId: auth.user.organizationId, status: "ACTIVE" } });
    await tx.hrWorkflowInstance.update({ where: { id: instance.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: input.reason, currentStageOrder: null } });
    await tx.hrWorkflowStageRun.updateMany({ where: { instanceId: instance.id, status: { in: ["ACTIVE", "PENDING"] } }, data: { status: "CANCELLED" } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrWorkflowInstance", entityId: instance.id, action: "hr.workflow.cancelled", reason: input.reason });
  });
  refresh();
}
