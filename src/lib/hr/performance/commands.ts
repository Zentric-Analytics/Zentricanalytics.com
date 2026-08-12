import crypto from "node:crypto";
import type { HrPerformanceGoalStatus, HrPromotionReadinessState, Prisma } from "@prisma/client";
import { appendHrAudit } from "@/lib/hr/audit";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { createWorkforceEventDraft, submitWorkforceEvent } from "@/lib/hr/workforce/commands";
import type { WorkforceImpactSnapshot } from "@/lib/hr/workforce/events";
import {
  assertExpectedVersion,
  assertIndependentPerformanceDecision,
  assertPromotionSnapshotCurrent,
  assertReadinessDecision,
  performanceContentHash,
  promotionWorkforceIdempotencyKey,
  transitionGoal,
  transitionPromotionCase,
  type SustainedEvidence,
} from "./domain";

export type PerformanceContext = { organizationId: string; actorUserId: string; actorRole?: string };

const json = (value: unknown) => value as Prisma.InputJsonValue;

export async function createGoal(tx: Prisma.TransactionClient, context: PerformanceContext, input: {
  employeeId?: string; ownerUserId: string; cycleId?: string; scopeType: string; scopeId?: string; goalType: string;
  title: string; outcomeDescription: string; measure?: unknown; weight?: number; dueAt: Date; contributors?: string[];
  alignmentGoalId?: string; alignmentVersion?: number; changeReason: string; idempotencyKey: string; correlationId?: string;
}) {
  const replay = await tx.hrPerformanceGoal.findUnique({ where: { organizationId_idempotencyKey: { organizationId: context.organizationId, idempotencyKey: input.idempotencyKey } } });
  if (replay) return replay;
  if (input.employeeId) await tx.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: context.organizationId } });
  if (input.cycleId) await tx.hrPerformanceCycle.findFirstOrThrow({ where: { id: input.cycleId, organizationId: context.organizationId } });
  if (input.alignmentGoalId) {
    const parent = await tx.hrPerformanceGoal.findFirstOrThrow({ where: { id: input.alignmentGoalId, organizationId: context.organizationId } });
    assertExpectedVersion(input.alignmentVersion ?? 0, parent.currentVersion, "aligned goal");
  }
  const correlationId = input.correlationId ?? crypto.randomUUID();
  const versionPayload = { title: input.title, outcomeDescription: input.outcomeDescription, measure: input.measure ?? null, weight: input.weight ?? null, dueAt: input.dueAt.toISOString(), contributors: input.contributors ?? [], alignmentGoalId: input.alignmentGoalId ?? null, alignmentVersion: input.alignmentVersion ?? null };
  const goal = await tx.hrPerformanceGoal.create({ data: {
    organizationId: context.organizationId, employeeId: input.employeeId, ownerUserId: input.ownerUserId,
    cycleId: input.cycleId, scopeType: input.scopeType, scopeId: input.scopeId, goalType: input.goalType,
    idempotencyKey: input.idempotencyKey, correlationId,
  } });
  await tx.hrPerformanceGoalVersion.create({ data: {
    organizationId: context.organizationId, goalId: goal.id, version: 1, title: input.title,
    outcomeDescription: input.outcomeDescription, measure: input.measure == null ? undefined : json(input.measure), weight: input.weight,
    dueAt: input.dueAt, contributors: input.contributors ?? [], alignmentGoalId: input.alignmentGoalId,
    alignmentVersion: input.alignmentVersion, changeReason: input.changeReason, proposedById: context.actorUserId,
    contentHash: performanceContentHash(versionPayload),
  } });
  await appendHrAudit(tx, { ...context, entityType: "HrPerformanceGoal", entityId: goal.id, action: "hr.performance.goal.created", newValues: { status: goal.status, version: 1, scopeType: goal.scopeType }, reason: input.changeReason, correlationId });
  return goal;
}

export async function transitionGoalStatus(tx: Prisma.TransactionClient, context: PerformanceContext, input: { goalId: string; expectedVersion: number; to: HrPerformanceGoalStatus; reason: string }) {
  const goal = await tx.hrPerformanceGoal.findFirstOrThrow({ where: { id: input.goalId, organizationId: context.organizationId } });
  assertExpectedVersion(input.expectedVersion, goal.currentVersion, "goal");
  transitionGoal(goal.status, input.to);
  const result = await tx.hrPerformanceGoal.updateMany({ where: { id: goal.id, status: goal.status, currentVersion: input.expectedVersion }, data: { status: input.to } });
  if (result.count !== 1) throw new Error("Another request changed this goal first.");
  await appendHrAudit(tx, { ...context, entityType: "HrPerformanceGoal", entityId: goal.id, action: `hr.performance.goal.${input.to.toLowerCase()}`, previousValues: { status: goal.status }, newValues: { status: input.to, version: goal.currentVersion }, reason: input.reason, correlationId: goal.correlationId });
  return { ...goal, status: input.to };
}

export async function reviseGoal(tx: Prisma.TransactionClient, context: PerformanceContext, input: {
  goalId: string; expectedVersion: number; title: string; outcomeDescription: string; measure?: unknown; weight?: number; dueAt: Date; contributors?: string[]; reason: string;
}) {
  const goal = await tx.hrPerformanceGoal.findFirstOrThrow({ where: { id: input.goalId, organizationId: context.organizationId } });
  assertExpectedVersion(input.expectedVersion, goal.currentVersion, "goal");
  if (!["ACTIVE", "RETURNED"].includes(goal.status)) throw new Error("Only active or returned goals can be materially revised.");
  const nextVersion = goal.currentVersion + 1;
  const prior = await tx.hrPerformanceGoalVersion.findUniqueOrThrow({ where: { goalId_version: { goalId: goal.id, version: goal.currentVersion } } });
  const payload = { title: input.title, outcomeDescription: input.outcomeDescription, measure: input.measure ?? null, weight: input.weight ?? null, dueAt: input.dueAt.toISOString(), contributors: input.contributors ?? [], alignmentGoalId: prior.alignmentGoalId, alignmentVersion: prior.alignmentVersion };
  const claim = await tx.hrPerformanceGoal.updateMany({ where: { id: goal.id, currentVersion: input.expectedVersion, status: goal.status }, data: { currentVersion: nextVersion, status: "REVISED" } });
  if (claim.count !== 1) throw new Error("Another request revised this goal first.");
  await tx.hrPerformanceGoalVersion.create({ data: { organizationId: context.organizationId, goalId: goal.id, version: nextVersion, title: input.title, outcomeDescription: input.outcomeDescription, measure: input.measure == null ? undefined : json(input.measure), weight: input.weight, dueAt: input.dueAt, contributors: input.contributors ?? [], alignmentGoalId: prior.alignmentGoalId, alignmentVersion: prior.alignmentVersion, changeReason: input.reason, proposedById: context.actorUserId, supersedesId: prior.id, contentHash: performanceContentHash(payload) } });
  await appendHrAudit(tx, { ...context, entityType: "HrPerformanceGoal", entityId: goal.id, action: "hr.performance.goal.revised", previousValues: { version: goal.currentVersion }, newValues: { version: nextVersion, status: "REVISED" }, reason: input.reason, correlationId: goal.correlationId });
  return tx.hrPerformanceGoal.findUniqueOrThrow({ where: { id: goal.id } });
}

export async function recordGoalProgress(tx: Prisma.TransactionClient, context: PerformanceContext, input: { goalId: string; expectedGoalVersion: number; progress: number; note?: string; correlationId?: string }) {
  if (!Number.isInteger(input.progress) || input.progress < 0 || input.progress > 100) throw new Error("Goal progress must be a whole percentage from 0 to 100.");
  const goal = await tx.hrPerformanceGoal.findFirstOrThrow({ where: { id: input.goalId, organizationId: context.organizationId } });
  assertExpectedVersion(input.expectedGoalVersion, goal.currentVersion, "goal");
  if (goal.status !== "ACTIVE") throw new Error("Progress can only be recorded for an active goal.");
  const correlationId = input.correlationId ?? crypto.randomUUID();
  const progress = await tx.hrGoalProgress.create({ data: { organizationId: context.organizationId, goalId: goal.id, goalVersion: goal.currentVersion, progress: input.progress, note: input.note, recordedById: context.actorUserId, correlationId } });
  await appendHrAudit(tx, { ...context, entityType: "HrGoalProgress", entityId: progress.id, action: "hr.performance.goal.progress_recorded", newValues: { goalId: goal.id, goalVersion: goal.currentVersion, progress: input.progress }, correlationId });
  return progress;
}

export async function finalizeReadinessAssessment(tx: Prisma.TransactionClient, context: PerformanceContext, input: {
  employeeId: string; workRelationshipId: string; assignmentId: string; currentJobProfileVersionId: string; currentLevelVersionId: string;
  targetJobProfileVersionId: string; targetLevelVersionId: string; cycleId?: string; state: HrPromotionReadinessState;
  evidenceIds: string[]; gaps: unknown[]; rationale: string; employeeFacingRationale: string; supersedesId?: string; correlationId?: string;
}) {
  const evidence = await tx.hrPerformanceEvidence.findMany({ where: { organizationId: context.organizationId, employeeId: input.employeeId, id: { in: input.evidenceIds } } });
  if (evidence.length !== new Set(input.evidenceIds).size) throw new Error("Readiness evidence must exist for the same employee and tenant.");
  assertReadinessDecision({ state: input.state, rationale: input.rationale, employeeFacingRationale: input.employeeFacingRationale, gaps: input.gaps, evidence: evidence as SustainedEvidence[] });
  const prior = input.supersedesId ? await tx.hrPromotionReadinessAssessment.findFirstOrThrow({ where: { id: input.supersedesId, organizationId: context.organizationId, employeeId: input.employeeId } }) : null;
  const correlationId = input.correlationId ?? crypto.randomUUID();
  const assessment = await tx.hrPromotionReadinessAssessment.create({ data: { organizationId: context.organizationId, employeeId: input.employeeId, workRelationshipId: input.workRelationshipId, assignmentId: input.assignmentId, currentJobProfileVersionId: input.currentJobProfileVersionId, currentLevelVersionId: input.currentLevelVersionId, targetJobProfileVersionId: input.targetJobProfileVersionId, targetLevelVersionId: input.targetLevelVersionId, assessorUserId: context.actorUserId, cycleId: input.cycleId, state: input.state, evidenceIds: input.evidenceIds, gaps: json(input.gaps), rationale: input.rationale, employeeFacingRationale: input.employeeFacingRationale, version: (prior?.version ?? 0) + 1, supersedesId: prior?.id, correlationId, finalizedAt: new Date() } });
  await appendHrAudit(tx, { ...context, entityType: "HrPromotionReadinessAssessment", entityId: assessment.id, action: "hr.performance.readiness.finalized", newValues: { state: assessment.state, version: assessment.version, targetJobProfileVersionId: assessment.targetJobProfileVersionId, evidenceCount: evidence.length }, reason: input.rationale, correlationId });
  return assessment;
}

export async function createPromotionWorkforceHandoff(tx: Prisma.TransactionClient, context: PerformanceContext, input: {
  promotionCaseId: string; decisionId: string; expectedCaseVersion: number; currentWorkRelationshipId: string; currentAssignmentId: string;
  currentJobProfileVersionId: string; targetJobProfileVersionId: string; targetLevelVersionId: string; proposedSnapshot: WorkforceImpactSnapshot;
}) {
  const promotionCase = await tx.hrPromotionCase.findFirstOrThrow({ where: { id: input.promotionCaseId, organizationId: context.organizationId } });
  const decision = await tx.hrPromotionDecision.findFirstOrThrow({ where: { id: input.decisionId, promotionCaseId: promotionCase.id, organizationId: context.organizationId, decision: "APPROVED" } });
  assertExpectedVersion(input.expectedCaseVersion, promotionCase.version, "promotion case");
  if (promotionCase.status === "EXECUTION_PENDING" || promotionCase.status === "APPLIED") {
    if (!promotionCase.workforceEventId) throw new Error("Promotion handoff state is inconsistent with its workforce event.");
    return tx.hrWorkforceEvent.findUniqueOrThrow({ where: { id: promotionCase.workforceEventId } });
  }
  if (promotionCase.status !== "APPROVED") throw new Error("Only an approved promotion case can create a workforce event.");
  assertPromotionSnapshotCurrent({ ...input, caseSnapshot: promotionCase });
  assertIndependentPerformanceDecision({ actorUserId: context.actorUserId, recommendedById: promotionCase.createdById });
  transitionPromotionCase("APPROVED", "EXECUTION_PENDING");
  const event = await createWorkforceEventDraft(tx, context, { employeeId: promotionCase.employeeId, workRelationshipId: promotionCase.workRelationshipId, type: "PROMOTION", reason: promotionCase.businessJustification, proposedSnapshot: input.proposedSnapshot, requestedEffectiveAt: decision.proposedEffectiveAt, idempotencyKey: promotionWorkforceIdempotencyKey(decision.id), correlationId: promotionCase.correlationId });
  await submitWorkforceEvent(tx, context, event.id, event.version);
  const claimed = await tx.hrPromotionCase.updateMany({ where: { id: promotionCase.id, organizationId: context.organizationId, version: input.expectedCaseVersion, status: "APPROVED", workforceEventId: null }, data: { status: "EXECUTION_PENDING", version: { increment: 1 }, workforceEventId: event.id, workforceEventVersion: event.version } });
  if (claimed.count !== 1) throw new Error("Another request created or changed this promotion handoff first.");
  await appendHrAudit(tx, { ...context, entityType: "HrPromotionCase", entityId: promotionCase.id, action: "hr.performance.promotion.handed_off", previousValues: { status: promotionCase.status, version: promotionCase.version }, newValues: { status: "EXECUTION_PENDING", version: promotionCase.version + 1, workforceEventId: event.id, workforceEventVersion: event.version }, reason: promotionCase.businessJustification, correlationId: promotionCase.correlationId });
  const employee = await tx.hrEmployee.findUniqueOrThrow({ where: { id: promotionCase.employeeId } });
  const recipient = employee.preferredNotificationEmail ?? employee.companyEmail ?? employee.personalEmail;
  if (recipient) await enqueueHrEmail(tx, { organizationId: context.organizationId, recipient, template: "hr-promotion-approved", subject: "Your promotion has been approved", payload: { recipientName: employee.preferredName ?? employee.legalFirstName, href: "/hr/employee/performance", promotionCaseId: promotionCase.id }, idempotencyKey: `unit7-promotion-approved:${promotionCase.id}:v${promotionCase.version + 1}` });
  return event;
}
