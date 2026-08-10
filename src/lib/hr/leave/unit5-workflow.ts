import { Prisma, type HrWorkflowDecision } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { activeSupervisorForEmployee } from "@/lib/hr/supervisors/scope";
import { conditionMatches, dueAt, requiredApprovals, workflowCondition } from "@/lib/hr/workflow/engine";
import { reserveUnit5RequestInTransaction } from "./unit5-accounting";

type Tx = Prisma.TransactionClient;

function delegationAllowsLeave(scope: Prisma.JsonValue) {
  if (Array.isArray(scope)) return scope.includes("leave") || scope.includes("leave.approve");
  if (!scope || typeof scope !== "object") return false;
  const value = scope as Record<string, unknown>;
  return value.leave === true || value["leave.approve"] === true || (Array.isArray(value.permissions) && value.permissions.includes("leave.approve"));
}

async function resolveApprovers(tx: Tx, organizationId: string, employeeId: string, stage: { assigneeType: string; assigneeUserIds: string[]; assigneePermissionKey: string | null }, effectiveAt: Date) {
  let approverIds: string[];
  if (stage.assigneeType === "USERS") approverIds = stage.assigneeUserIds;
  else if (stage.assigneeType === "SUPERVISOR") {
    const assignment = await activeSupervisorForEmployee(tx, { organizationId, employeeId, now: effectiveAt });
    if (!assignment?.supervisorEmployee.userId) throw new Error("The leave workflow requires an active supervisor account.");
    approverIds = [assignment.supervisorEmployee.userId];
  } else {
    const users = await tx.hrUser.findMany({ where: { organizationId, status: "ACTIVE", roles: { some: { revokedAt: null, role: { permissions: { some: { permission: { key: stage.assigneePermissionKey! } } } } } } }, select: { id: true } });
    approverIds = users.map(({ id }) => id);
  }
  if (!approverIds.length) throw new Error("The configured leave workflow stage has no eligible approver.");
  const delegations = await tx.hrLeaveDelegation.findMany({ where: { organizationId, delegatorUserId: { in: approverIds }, revokedAt: null, effectiveFrom: { lte: effectiveAt }, effectiveTo: { gt: effectiveAt } } });
  const delegated = new Map(delegations.filter(({ scope }) => delegationAllowsLeave(scope)).map((item) => [item.delegatorUserId, item.delegateUserId]));
  return { approverUserIds: [...new Set(approverIds.map((id) => delegated.get(id) ?? id))], delegatedFromUserId: approverIds.length === 1 && delegated.has(approverIds[0]) ? approverIds[0] : null };
}

export async function startConfiguredLeaveWorkflow(tx: Tx, input: { organizationId: string; workflowKey: string | null; requestVersionId: string; employeeId: string; requesterUserId: string; correlationId: string; context: Record<string, unknown>; effectiveAt: Date }) {
  if (!input.workflowKey) return null;
  const definition = await tx.hrWorkflowDefinition.findFirst({ where: { organizationId: input.organizationId, key: input.workflowKey, subjectType: "HrLeaveRequestVersion", active: true }, include: { stages: { orderBy: { sortOrder: "asc" } } }, orderBy: { version: "desc" } });
  if (!definition) throw new Error(`The configured leave workflow '${input.workflowKey}' is not published for leave request versions.`);
  const eligible = definition.stages.filter((stage) => conditionMatches(stage.routingCondition ? workflowCondition.parse(stage.routingCondition) : null, input.context));
  if (!eligible.length) throw new Error("No configured leave workflow stage matches this request.");
  const startedAt = new Date();
  const runs = [];
  for (const stage of eligible) {
    const routed = await resolveApprovers(tx, input.organizationId, input.employeeId, stage, input.effectiveAt);
    if (routed.approverUserIds.includes(input.requesterUserId)) throw new Error("A leave requester cannot be an approver in their own workflow.");
    runs.push({ stage, ...routed, required: requiredApprovals(stage.approvalMode, routed.approverUserIds.length, stage.quorum) });
  }
  const first = runs[0];
  const instance = await tx.hrWorkflowInstance.create({ data: { organizationId: input.organizationId, definitionId: definition.id, subjectType: definition.subjectType, subjectId: input.requestVersionId, subjectEmployeeId: input.employeeId, context: input.context as Prisma.InputJsonValue, currentStageOrder: first.stage.sortOrder, startedById: input.requesterUserId, startedAt, stageRuns: { create: runs.map((run, index) => ({ organizationId: input.organizationId, definitionStageId: run.stage.id, stageKey: run.stage.key, stageName: run.stage.name, sortOrder: run.stage.sortOrder, approvalMode: run.stage.approvalMode, requiredApprovals: run.required, approverUserIds: run.approverUserIds, delegatedFromUserId: run.delegatedFromUserId, status: index === 0 ? "ACTIVE" : "PENDING", activatedAt: index === 0 ? startedAt : null, dueAt: index === 0 ? dueAt(startedAt, run.stage.dueOffsetHours) : null })) } } });
  const recipients = await tx.hrUser.findMany({ where: { organizationId: input.organizationId, id: { in: first.approverUserIds } }, select: { id: true, email: true } });
  for (const recipient of recipients) await enqueueHrEmail(tx, { organizationId: input.organizationId, recipient: recipient.email, template: "hr-leave-review-requested", subject: "Leave request awaiting review", payload: { leaveRequestVersionId: input.requestVersionId, workflowInstanceId: instance.id }, idempotencyKey: `hr-leave-workflow:${instance.id}:${first.stage.key}:${recipient.id}` });
  await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.requesterUserId, entityType: "HrWorkflowInstance", entityId: instance.id, action: "hr.leave.workflow.started", newValues: { definitionId: definition.id, definitionVersion: definition.version, requestVersionId: input.requestVersionId, stages: runs.length }, correlationId: input.correlationId });
  return { instanceId: instance.id, firstApproverId: first.approverUserIds[0] ?? null };
}

export async function decideConfiguredLeaveWorkflow(input: { organizationId: string; requestId: string; expectedRequestVersion: number; reviewerUserId: string; actorRole?: string; decision: HrWorkflowDecision; reason: string }) {
  return prisma.$transaction(async (tx) => {
    const version = await tx.hrLeaveRequestVersion.findFirstOrThrow({ where: { requestId: input.requestId, organizationId: input.organizationId, version: input.expectedRequestVersion }, include: { request: { include: { requestedBy: true } } } });
    const latest = await tx.hrLeaveRequestVersion.aggregate({ where: { requestId: input.requestId }, _max: { version: true } });
    if (latest._max.version !== input.expectedRequestVersion) throw new Error("This leave request changed after the page loaded; review the latest version.");
    if (!version.workflowInstanceId) throw new Error("This leave request is not attached to a configured approval workflow.");
    const candidate = await tx.hrWorkflowStageRun.findFirstOrThrow({ where: { instanceId: version.workflowInstanceId, organizationId: input.organizationId, status: "ACTIVE", instance: { status: "ACTIVE", subjectType: "HrLeaveRequestVersion", subjectId: version.id } }, select: { id: true } });
    await tx.$queryRaw`SELECT id FROM "HrWorkflowStageRun" WHERE id = ${candidate.id} FOR UPDATE`;
    const run = await tx.hrWorkflowStageRun.findFirstOrThrow({ where: { id: candidate.id, status: "ACTIVE", instance: { status: "ACTIVE" } }, include: { instance: true } });
    if (!run.approverUserIds.includes(input.reviewerUserId)) throw new Error("You are not an approver for the current leave workflow stage.");
    if (version.createdById === input.reviewerUserId) throw new Error("The leave requester cannot approve their own request.");
    const correlationId = `unit5-workflow:${run.id}:${input.reviewerUserId}`;
    const existing = await tx.hrWorkflowApproval.findUnique({ where: { stageRunId_approverId: { stageRunId: run.id, approverId: input.reviewerUserId } } });
    if (existing) return { applied: false, final: run.instance.status === "APPROVED", status: run.instance.status };
    await tx.hrWorkflowApproval.create({ data: { stageRunId: run.id, approverId: input.reviewerUserId, actorRole: input.actorRole ?? "LEAVE_APPROVER", requestType: "HrLeaveRequestVersion", requestId: version.id, previousStatus: run.status, newStatus: input.decision, decision: input.decision, reason: input.reason, correlationId } });
    await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.reviewerUserId, actorRole: input.actorRole, entityType: "HrWorkflowApproval", entityId: run.id, action: `hr.leave.workflow.${input.decision.toLowerCase()}`, previousValues: { stageStatus: run.status, requestVersion: version.version }, newValues: { stageKey: run.stageKey, decision: input.decision }, reason: input.reason, correlationId: version.correlationId });
    const decisions = await tx.hrWorkflowApproval.findMany({ where: { stageRunId: run.id } });
    if (input.decision === "REJECTED") {
      await tx.hrWorkflowStageRun.update({ where: { id: run.id }, data: { status: "REJECTED", completedAt: new Date() } });
      await tx.hrWorkflowStageRun.updateMany({ where: { instanceId: run.instanceId, status: "PENDING" }, data: { status: "CANCELLED" } });
      await tx.hrWorkflowInstance.update({ where: { id: run.instanceId }, data: { status: "REJECTED", completedAt: new Date(), currentStageOrder: null } });
      await tx.hrLeaveTransition.create({ data: { requestVersionId: version.id, fromStatus: "UNDER_REVIEW", toStatus: "REJECTED", actorUserId: input.reviewerUserId, reason: input.reason, idempotencyKey: `unit5-workflow-rejected:${version.id}`, correlationId: version.correlationId } });
      await tx.hrLeaveRequest.update({ where: { id: version.requestId }, data: { status: "REJECTED", decidedAt: new Date(), currentReviewerId: null } });
      await enqueueHrEmail(tx, { organizationId: input.organizationId, recipient: version.request.requestedBy.email, template: "hr-leave-rejected", subject: "Leave request rejected", payload: { leaveRequestId: version.requestId, requestVersionId: version.id }, idempotencyKey: `hr-leave-decision:${version.requestId}:REJECTED` });
      return { applied: true, final: true, status: "REJECTED" as const };
    }
    const approved = decisions.filter(({ decision }) => decision === "APPROVED").length;
    if (approved < run.requiredApprovals) return { applied: true, final: false, status: "ACTIVE" as const };
    const completedAt = new Date();
    await tx.hrWorkflowStageRun.update({ where: { id: run.id }, data: { status: "APPROVED", completedAt } });
    const next = await tx.hrWorkflowStageRun.findFirst({ where: { instanceId: run.instanceId, status: "PENDING" }, orderBy: { sortOrder: "asc" } });
    if (next) {
      const stage = await tx.hrWorkflowDefinitionStage.findUniqueOrThrow({ where: { id: next.definitionStageId } });
      await tx.hrWorkflowStageRun.update({ where: { id: next.id }, data: { status: "ACTIVE", activatedAt: completedAt, dueAt: dueAt(completedAt, stage.dueOffsetHours) } });
      await tx.hrWorkflowInstance.update({ where: { id: run.instanceId }, data: { currentStageOrder: next.sortOrder } });
      const recipients = await tx.hrUser.findMany({ where: { organizationId: input.organizationId, id: { in: next.approverUserIds } }, select: { id: true, email: true } });
      for (const recipient of recipients) await enqueueHrEmail(tx, { organizationId: input.organizationId, recipient: recipient.email, template: "hr-leave-review-requested", subject: "Leave request awaiting review", payload: { leaveRequestVersionId: version.id, workflowInstanceId: run.instanceId }, idempotencyKey: `hr-leave-workflow:${run.instanceId}:${next.stageKey}:${recipient.id}` });
      await tx.hrLeaveRequest.update({ where: { id: version.requestId }, data: { currentReviewerId: next.approverUserIds[0] ?? null } });
      return { applied: true, final: false, status: "ACTIVE" as const };
    }
    await reserveUnit5RequestInTransaction(tx, { organizationId: input.organizationId, requestVersionId: version.id, reviewerUserId: input.reviewerUserId, reason: input.reason, idempotencyKey: `unit5-final-approval:${version.id}:${version.version}` });
    await tx.hrWorkflowInstance.update({ where: { id: run.instanceId }, data: { status: "APPROVED", completedAt, currentStageOrder: null } });
    await tx.hrLeaveRequest.update({ where: { id: version.requestId }, data: { status: "APPROVED", decidedAt: completedAt, currentReviewerId: null } });
    await enqueueHrEmail(tx, { organizationId: input.organizationId, recipient: version.request.requestedBy.email, template: "hr-leave-approved", subject: "Leave request approved", payload: { leaveRequestId: version.requestId, requestVersionId: version.id }, idempotencyKey: `hr-leave-decision:${version.requestId}:APPROVED` });
    await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.reviewerUserId, actorRole: input.actorRole, entityType: "HrLeaveRequestVersion", entityId: version.id, action: "hr.leave.workflow.final_approved", newValues: { workflowInstanceId: run.instanceId, requestVersion: version.version }, reason: input.reason, correlationId: version.correlationId });
    return { applied: true, final: true, status: "APPROVED" as const };
  }, { isolationLevel: "Serializable" });
}

export async function returnConfiguredLeaveForChanges(input: { organizationId: string; requestId: string; expectedRequestVersion: number; reviewerUserId: string; actorRole?: string; reason: string }) {
  return prisma.$transaction(async (tx) => {
    const version = await tx.hrLeaveRequestVersion.findFirstOrThrow({ where: { requestId: input.requestId, organizationId: input.organizationId, version: input.expectedRequestVersion }, include: { request: { include: { requestedBy: true } } } });
    const latest = await tx.hrLeaveRequestVersion.aggregate({ where: { requestId: input.requestId }, _max: { version: true } });
    if (latest._max.version !== input.expectedRequestVersion) throw new Error("This leave request changed after the page loaded; review the latest version.");
    if (!version.workflowInstanceId) throw new Error("This leave request is not attached to a configured approval workflow.");
    const candidate = await tx.hrWorkflowStageRun.findFirstOrThrow({ where: { instanceId: version.workflowInstanceId, organizationId: input.organizationId, status: "ACTIVE", instance: { status: "ACTIVE" } }, select: { id: true } });
    await tx.$queryRaw`SELECT id FROM "HrWorkflowStageRun" WHERE id = ${candidate.id} FOR UPDATE`;
    const run = await tx.hrWorkflowStageRun.findFirstOrThrow({ where: { id: candidate.id, status: "ACTIVE", instance: { status: "ACTIVE" } } });
    if (!run.approverUserIds.includes(input.reviewerUserId)) throw new Error("You are not an approver for the current leave workflow stage.");
    await tx.hrWorkflowStageRun.updateMany({ where: { instanceId: version.workflowInstanceId, status: { in: ["ACTIVE", "PENDING"] } }, data: { status: "CANCELLED" } });
    await tx.hrWorkflowInstance.update({ where: { id: version.workflowInstanceId }, data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: input.reason, currentStageOrder: null } });
    await tx.hrLeaveTransition.create({ data: { requestVersionId: version.id, fromStatus: "UNDER_REVIEW", toStatus: "RETURNED", actorUserId: input.reviewerUserId, reason: input.reason, idempotencyKey: `unit5-returned:${version.id}`, correlationId: version.correlationId } });
    await tx.hrLeaveRequest.update({ where: { id: version.requestId }, data: { currentReviewerId: null } });
    await enqueueHrEmail(tx, { organizationId: input.organizationId, recipient: version.request.requestedBy.email, template: "hr-leave-returned", subject: "Leave request returned for changes", payload: { leaveRequestId: version.requestId, requestVersionId: version.id }, idempotencyKey: `hr-leave-returned:${version.requestId}:${version.version}` });
    await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.reviewerUserId, actorRole: input.actorRole, entityType: "HrLeaveRequestVersion", entityId: version.id, action: "hr.leave.workflow.returned", previousValues: { status: "UNDER_REVIEW", workflowInstanceId: version.workflowInstanceId }, newValues: { status: "RETURNED" }, reason: input.reason, correlationId: version.correlationId });
    return { applied: true, status: "RETURNED" as const };
  }, { isolationLevel: "Serializable" });
}
