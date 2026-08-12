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
  transitionCalibration,
  transitionDevelopmentPlan,
  transitionReview,
  transitionPromotionCase,
  careerTracks,
  companyLevels,
  ratingCategories,
  type SustainedEvidence,
} from "./domain";

export type PerformanceContext = { organizationId: string; actorUserId: string; actorRole?: string };

const json = (value: unknown) => value as Prisma.InputJsonValue;

export async function seedPerformanceFramework(tx: Prisma.TransactionClient, context: PerformanceContext, effectiveFrom = new Date()) {
  const tracks = [];
  for (const code of careerTracks) tracks.push(await tx.hrCareerTrack.upsert({ where: { organizationId_code: { organizationId: context.organizationId, code } }, update: {}, create: { organizationId: context.organizationId, code, name: code === "IC" ? "Individual Contributor" : "People Manager", status: "PUBLISHED", effectiveFrom, createdById: context.actorUserId } }));
  const levels = [];
  for (const item of companyLevels) {
    const level = await tx.hrCompanyLevel.upsert({ where: { organizationId_code: { organizationId: context.organizationId, code: item.code } }, update: {}, create: { organizationId: context.organizationId, code: item.code, name: `Zentric Level ${item.displayOrder}`, displayOrder: item.displayOrder } });
    const version = await tx.hrCompanyLevelVersion.findUnique({ where: { companyLevelId_version: { companyLevelId: level.id, version: 1 } } });
    if (!version) {
      const expectations = { scope: `Configured expectations for ${item.code}`, independence: item.displayOrder, complexity: item.displayOrder, impact: item.displayOrder, collaboration: true };
      await tx.hrCompanyLevelVersion.create({ data: { organizationId: context.organizationId, companyLevelId: level.id, version: 1, status: "PUBLISHED", expectations, effectiveFrom, contentHash: performanceContentHash(expectations), publishedById: context.actorUserId, publishedAt: effectiveFrom } });
    }
    levels.push(level);
  }
  const scale = await tx.hrRatingScale.upsert({ where: { organizationId_code: { organizationId: context.organizationId, code: "ZENTRIC_DESCRIPTIVE_5" } }, update: {}, create: { organizationId: context.organizationId, code: "ZENTRIC_DESCRIPTIVE_5", name: "Zentric descriptive performance scale" } });
  let scaleVersion = await tx.hrRatingScaleVersion.findUnique({ where: { ratingScaleId_version: { ratingScaleId: scale.id, version: 1 } } });
  if (!scaleVersion) {
    scaleVersion = await tx.hrRatingScaleVersion.create({ data: { ratingScaleId: scale.id, version: 1, status: "PUBLISHED", contentHash: performanceContentHash(ratingCategories), publishedById: context.actorUserId, publishedAt: effectiveFrom } });
    await tx.hrRatingScaleItem.createMany({ data: ratingCategories.map((item, index) => ({ ratingScaleVersionId: scaleVersion!.id, code: item.code, label: item.label, description: `${item.label} the published role and level expectations.`, displayOrder: index + 1 })) });
  }
  await appendHrAudit(tx, { ...context, entityType: "HrPerformanceFramework", action: "hr.performance.framework.seeded", newValues: { levelCount: levels.length, trackCount: tracks.length, ratingScaleVersionId: scaleVersion.id }, reason: "Initialize locked Unit 7 framework decisions" });
  return { levels, tracks, ratingScaleVersion: scaleVersion };
}

export async function createPerformanceFeedback(tx: Prisma.TransactionClient, context: PerformanceContext, input: { employeeId: string; kind: string; visibility: "EMPLOYEE_VISIBLE" | "MANAGER_EMPLOYEE" | "HR_CONFIDENTIAL" | "CALIBRATION_ONLY"; content: Record<string, unknown>; correlationId?: string }) {
  await tx.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: context.organizationId } });
  const correlationId = input.correlationId ?? crypto.randomUUID();
  const item = await tx.hrPerformanceFeedback.create({ data: { organizationId: context.organizationId, employeeId: input.employeeId, authorUserId: context.actorUserId, kind: input.kind, visibility: input.visibility, content: json(input.content), status: "SUBMITTED", correlationId, submittedAt: new Date() } });
  await appendHrAudit(tx, { ...context, entityType: "HrPerformanceFeedback", entityId: item.id, action: "hr.performance.feedback.submitted", newValues: { kind: item.kind, visibility: item.visibility, version: item.version }, correlationId });
  if (["EMPLOYEE_VISIBLE", "MANAGER_EMPLOYEE"].includes(item.visibility)) {
    const employee = await tx.hrEmployee.findUniqueOrThrow({ where: { id: item.employeeId } });
    const recipient = employee.preferredNotificationEmail ?? employee.companyEmail ?? employee.personalEmail;
    if (recipient) await enqueueHrEmail(tx, { organizationId: context.organizationId, recipient, template: "hr-performance-feedback-received", subject: "New performance feedback", payload: { recipientName: employee.preferredName ?? employee.legalFirstName, href: "/hr/employee/performance", feedbackId: item.id }, idempotencyKey: `unit7-feedback:${item.id}:v${item.version}` });
  }
  return item;
}

export async function recordPerformanceCheckIn(tx: Prisma.TransactionClient, context: PerformanceContext, input: { employeeId: string; managerEmployeeId: string; occurredAt: Date; cadence?: string; topics: unknown; blockers?: unknown; agreedActions: unknown; followUpAt?: Date; correlationId?: string }) {
  if (input.employeeId === input.managerEmployeeId) throw new Error("An employee cannot conduct their own manager check-in.");
  await tx.hrSupervisorAssignment.findFirstOrThrow({ where: { organizationId: context.organizationId, assignedEmployeeId: input.employeeId, supervisorEmployeeId: input.managerEmployeeId, status: "ACTIVE", effectiveFrom: { lte: input.occurredAt }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.occurredAt } }] } });
  const correlationId = input.correlationId ?? crypto.randomUUID();
  const checkIn = await tx.hrPerformanceCheckIn.create({ data: { organizationId: context.organizationId, employeeId: input.employeeId, managerEmployeeId: input.managerEmployeeId, occurredAt: input.occurredAt, cadence: input.cadence, topics: json(input.topics), blockers: input.blockers == null ? undefined : json(input.blockers), agreedActions: json(input.agreedActions), followUpAt: input.followUpAt, correlationId, createdById: context.actorUserId } });
  await appendHrAudit(tx, { ...context, entityType: "HrPerformanceCheckIn", entityId: checkIn.id, action: "hr.performance.checkin.recorded", newValues: { employeeId: input.employeeId, managerEmployeeId: input.managerEmployeeId, occurredAt: input.occurredAt, visibility: checkIn.visibility, version: checkIn.version }, correlationId });
  return checkIn;
}

export async function submitPerformanceReview(tx: Prisma.TransactionClient, context: PerformanceContext, input: { reviewId: string; expectedVersion: number; submissionType: "SELF" | "MANAGER"; answers: unknown; ratingItemId?: string; rationale?: string; evidenceIds?: string[] }) {
  const review = await tx.hrPerformanceReview.findFirstOrThrow({ where: { id: input.reviewId, organizationId: context.organizationId } });
  assertExpectedVersion(input.expectedVersion, review.version, "review");
  const employee = await tx.hrEmployee.findUniqueOrThrow({ where: { id: review.employeeId } });
  if (input.submissionType === "SELF") {
    if (employee.userId !== context.actorUserId) throw new Error("Employees may submit only their own self-review.");
    if (review.status !== "SELF_REVIEW") throw new Error("This review is not accepting a self-review.");
  } else {
    if (review.reviewerUserId !== context.actorUserId) throw new Error("Only the snapshotted review owner may submit the manager review.");
    if (review.status !== "MANAGER_REVIEW") throw new Error("This review is not accepting a manager review.");
    if (!input.ratingItemId || !input.rationale?.trim()) throw new Error("Manager review requires an explicit descriptive rating and rationale.");
  }
  const priorCount = await tx.hrPerformanceReviewSubmission.count({ where: { reviewId: review.id, submissionType: input.submissionType } });
  const content = { answers: input.answers, ratingItemId: input.ratingItemId ?? null, rationale: input.rationale ?? null, evidenceIds: input.evidenceIds ?? [] };
  const submission = await tx.hrPerformanceReviewSubmission.create({ data: { organizationId: context.organizationId, reviewId: review.id, submissionType: input.submissionType, version: priorCount + 1, submittedById: context.actorUserId, answers: json(input.answers), ratingItemId: input.ratingItemId, rationale: input.rationale, evidenceIds: input.evidenceIds ?? [], contentHash: performanceContentHash(content) } });
  const nextStatus = input.submissionType === "SELF" ? "MANAGER_REVIEW" : "CALIBRATION";
  transitionReview(review.status, nextStatus);
  const updated = await tx.hrPerformanceReview.updateMany({ where: { id: review.id, version: review.version, status: review.status }, data: { status: nextStatus, version: { increment: 1 } } });
  if (updated.count !== 1) throw new Error("Another request changed this review first.");
  await appendHrAudit(tx, { ...context, entityType: "HrPerformanceReview", entityId: review.id, action: `hr.performance.review.${input.submissionType.toLowerCase()}_submitted`, previousValues: { status: review.status, version: review.version }, newValues: { status: nextStatus, version: review.version + 1, submissionId: submission.id, submissionVersion: submission.version }, correlationId: review.correlationId });
  return submission;
}

export async function transitionCalibrationSession(tx: Prisma.TransactionClient, context: PerformanceContext, input: { sessionId: string; expectedVersion: number; to: "POPULATION_LOCKED" | "IN_SESSION" | "DECISIONS_PENDING" | "FINALIZED" | "CANCELLED"; reason: string }) {
  const session = await tx.hrCalibrationSession.findFirstOrThrow({ where: { id: input.sessionId, organizationId: context.organizationId } });
  assertExpectedVersion(input.expectedVersion, session.version, "calibration session");
  transitionCalibration(session.status, input.to);
  const result = await tx.hrCalibrationSession.updateMany({ where: { id: session.id, status: session.status, version: session.version }, data: { status: input.to, version: { increment: 1 }, finalizedAt: input.to === "FINALIZED" ? new Date() : undefined } });
  if (result.count !== 1) throw new Error("Another request changed this calibration session first.");
  await appendHrAudit(tx, { ...context, entityType: "HrCalibrationSession", entityId: session.id, action: `hr.performance.calibration.${input.to.toLowerCase()}`, previousValues: { status: session.status, version: session.version }, newValues: { status: input.to, version: session.version + 1 }, reason: input.reason, correlationId: session.correlationId });
}

export async function recordCalibrationDecision(tx: Prisma.TransactionClient, context: PerformanceContext, input: { sessionId: string; reviewId: string; reviewVersion: number; managerRatingItemId: string; calibratedRatingItemId: string; rationale: string; correlationId?: string }) {
  const session = await tx.hrCalibrationSession.findFirstOrThrow({ where: { id: input.sessionId, organizationId: context.organizationId, status: { in: ["IN_SESSION", "DECISIONS_PENDING"] } } });
  const grant = await tx.hrCalibrationGrant.findFirst({ where: { sessionId: session.id, organizationId: context.organizationId, userId: context.actorUserId, effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] } });
  if (!grant) throw new Error("A current session-specific calibration grant is required.");
  const review = await tx.hrPerformanceReview.findFirstOrThrow({ where: { id: input.reviewId, organizationId: context.organizationId, cycleId: session.cycleId } });
  assertExpectedVersion(input.reviewVersion, review.version, "review");
  if (!input.rationale.trim()) throw new Error("Calibration adjustments require rationale.");
  const prior = await tx.hrCalibrationDecision.findFirst({ where: { sessionId: session.id, reviewId: review.id }, orderBy: { version: "desc" } });
  const correlationId = input.correlationId ?? crypto.randomUUID();
  const decision = await tx.hrCalibrationDecision.create({ data: { organizationId: context.organizationId, sessionId: session.id, reviewId: review.id, reviewVersion: review.version, managerRatingItemId: input.managerRatingItemId, calibratedRatingItemId: input.calibratedRatingItemId, rationale: input.rationale, decidedById: context.actorUserId, correlationId, version: (prior?.version ?? 0) + 1 } });
  await appendHrAudit(tx, { ...context, entityType: "HrCalibrationDecision", entityId: decision.id, action: "hr.performance.calibration.decision_recorded", newValues: { sessionId: session.id, reviewId: review.id, reviewVersion: review.version, managerRatingItemId: input.managerRatingItemId, calibratedRatingItemId: input.calibratedRatingItemId, decisionVersion: decision.version }, reason: input.rationale, correlationId });
  return decision;
}

export async function createDevelopmentPlan(tx: Prisma.TransactionClient, context: PerformanceContext, input: { employeeId: string; managerEmployeeId: string; summary: string; expectationVersionIds: string[]; actions: Array<{ gap: string; targetCapability: string; actionType: string; ownerUserId: string; mentorUserId?: string; targetDate: Date; reviewDate?: Date; evidenceRequired: unknown }>; correlationId?: string }) {
  await tx.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: context.organizationId } });
  const correlationId = input.correlationId ?? crypto.randomUUID();
  const payload = { summary: input.summary, expectationVersionIds: input.expectationVersionIds, actions: input.actions };
  const plan = await tx.hrDevelopmentPlan.create({ data: { organizationId: context.organizationId, employeeId: input.employeeId, managerEmployeeId: input.managerEmployeeId, correlationId, createdById: context.actorUserId } });
  const version = await tx.hrDevelopmentPlanVersion.create({ data: { organizationId: context.organizationId, planId: plan.id, version: 1, summary: input.summary, expectationVersionIds: input.expectationVersionIds, changeReason: "Initial development plan", contentHash: performanceContentHash(payload), createdById: context.actorUserId } });
  if (input.actions.length) await tx.hrDevelopmentAction.createMany({ data: input.actions.map((action, index) => ({ organizationId: context.organizationId, planVersionId: version.id, sequence: index + 1, gap: action.gap, targetCapability: action.targetCapability, actionType: action.actionType, ownerUserId: action.ownerUserId, mentorUserId: action.mentorUserId, targetDate: action.targetDate, reviewDate: action.reviewDate, evidenceRequired: json(action.evidenceRequired) })) });
  await appendHrAudit(tx, { ...context, entityType: "HrDevelopmentPlan", entityId: plan.id, action: "hr.performance.development.created", newValues: { version: 1, actionCount: input.actions.length, expectationVersionCount: input.expectationVersionIds.length }, correlationId });
  return plan;
}

export async function activateDevelopmentPlan(tx: Prisma.TransactionClient, context: PerformanceContext, input: { planId: string; expectedVersion: number; reason: string }) {
  const plan = await tx.hrDevelopmentPlan.findFirstOrThrow({ where: { id: input.planId, organizationId: context.organizationId } });
  assertExpectedVersion(input.expectedVersion, plan.currentVersion, "development plan");
  transitionDevelopmentPlan(plan.status, "ACTIVE");
  const result = await tx.hrDevelopmentPlan.updateMany({ where: { id: plan.id, status: plan.status, currentVersion: plan.currentVersion }, data: { status: "ACTIVE" } });
  if (result.count !== 1) throw new Error("Another request changed this development plan first.");
  await appendHrAudit(tx, { ...context, entityType: "HrDevelopmentPlan", entityId: plan.id, action: "hr.performance.development.activated", previousValues: { status: plan.status, version: plan.currentVersion }, newValues: { status: "ACTIVE", version: plan.currentVersion }, reason: input.reason, correlationId: plan.correlationId });
}

export async function createPromotionCase(tx: Prisma.TransactionClient, context: PerformanceContext, input: {
  employeeId: string; workRelationshipId: string; assignmentId: string; currentJobProfileVersionId: string; currentLevelVersionId: string; currentCareerTrackId: string;
  targetJobProfileVersionId: string; targetLevelVersionId: string; targetCareerTrackId: string; readinessAssessmentId: string; businessJustification: string;
  proposedEffectiveAt: Date; idempotencyKey: string; correlationId?: string;
}) {
  const replay = await tx.hrPromotionCase.findUnique({ where: { organizationId_idempotencyKey: { organizationId: context.organizationId, idempotencyKey: input.idempotencyKey } } });
  if (replay) return replay;
  const readiness = await tx.hrPromotionReadinessAssessment.findFirstOrThrow({ where: { id: input.readinessAssessmentId, organizationId: context.organizationId, employeeId: input.employeeId, workRelationshipId: input.workRelationshipId, assignmentId: input.assignmentId, targetJobProfileVersionId: input.targetJobProfileVersionId, targetLevelVersionId: input.targetLevelVersionId, state: "READY_NOW", finalizedAt: { not: null } } });
  const activeDuplicate = await tx.hrPromotionCase.findFirst({ where: { organizationId: context.organizationId, employeeId: input.employeeId, targetJobProfileVersionId: input.targetJobProfileVersionId, targetLevelVersionId: input.targetLevelVersionId, proposedEffectiveAt: input.proposedEffectiveAt, status: { notIn: ["APPLIED", "REJECTED", "WITHDRAWN", "FAILED"] } } });
  if (activeDuplicate) throw new Error("An active promotion case already owns this target and effective date.");
  const correlationId = input.correlationId ?? crypto.randomUUID();
  const promotionCase = await tx.hrPromotionCase.create({ data: { organizationId: context.organizationId, employeeId: input.employeeId, workRelationshipId: input.workRelationshipId, assignmentId: input.assignmentId, currentJobProfileVersionId: input.currentJobProfileVersionId, currentLevelVersionId: input.currentLevelVersionId, currentCareerTrackId: input.currentCareerTrackId, targetJobProfileVersionId: input.targetJobProfileVersionId, targetLevelVersionId: input.targetLevelVersionId, targetCareerTrackId: input.targetCareerTrackId, readinessAssessmentId: readiness.id, businessJustification: input.businessJustification, proposedEffectiveAt: input.proposedEffectiveAt, idempotencyKey: input.idempotencyKey, correlationId, createdById: context.actorUserId } });
  await appendHrAudit(tx, { ...context, entityType: "HrPromotionCase", entityId: promotionCase.id, action: "hr.performance.promotion.created", newValues: { status: promotionCase.status, version: promotionCase.version, readinessAssessmentId: readiness.id, targetJobProfileVersionId: input.targetJobProfileVersionId, targetLevelVersionId: input.targetLevelVersionId, proposedEffectiveAt: input.proposedEffectiveAt }, reason: input.businessJustification, correlationId });
  return promotionCase;
}

export async function transitionPromotionCaseStatus(tx: Prisma.TransactionClient, context: PerformanceContext, input: { promotionCaseId: string; expectedVersion: number; to: "MANAGER_RECOMMENDED" | "CALIBRATION" | "HR_REVIEW" | "BUSINESS_APPROVAL" | "RETURNED" | "DEFERRED" | "REJECTED" | "WITHDRAWN"; reason: string }) {
  const promotionCase = await tx.hrPromotionCase.findFirstOrThrow({ where: { id: input.promotionCaseId, organizationId: context.organizationId } });
  assertExpectedVersion(input.expectedVersion, promotionCase.version, "promotion case");
  transitionPromotionCase(promotionCase.status, input.to);
  if (input.to === "MANAGER_RECOMMENDED" && promotionCase.createdById !== context.actorUserId) throw new Error("Only the case creator may submit the manager recommendation.");
  const result = await tx.hrPromotionCase.updateMany({ where: { id: promotionCase.id, status: promotionCase.status, version: promotionCase.version }, data: { status: input.to, version: { increment: 1 } } });
  if (result.count !== 1) throw new Error("Another request changed this promotion case first.");
  await appendHrAudit(tx, { ...context, entityType: "HrPromotionCase", entityId: promotionCase.id, action: `hr.performance.promotion.${input.to.toLowerCase()}`, previousValues: { status: promotionCase.status, version: promotionCase.version }, newValues: { status: input.to, version: promotionCase.version + 1 }, reason: input.reason, correlationId: promotionCase.correlationId });
}

export async function decidePromotionCase(tx: Prisma.TransactionClient, context: PerformanceContext, input: { promotionCaseId: string; expectedVersion: number; decision: "APPROVED" | "REJECTED" | "DEFERRED"; rationale: string; approverUserIds: string[] }) {
  const promotionCase = await tx.hrPromotionCase.findFirstOrThrow({ where: { id: input.promotionCaseId, organizationId: context.organizationId } });
  assertExpectedVersion(input.expectedVersion, promotionCase.version, "promotion case");
  if (promotionCase.status !== "BUSINESS_APPROVAL") throw new Error("Promotion decision requires the business-approval stage.");
  if (!input.rationale.trim() || input.approverUserIds.length === 0) throw new Error("Promotion decision requires rationale and identified approvers.");
  assertIndependentPerformanceDecision({ actorUserId: context.actorUserId, recommendedById: promotionCase.createdById });
  const readiness = await tx.hrPromotionReadinessAssessment.findFirstOrThrow({ where: { id: promotionCase.readinessAssessmentId, organizationId: context.organizationId } });
  const currentSnapshot = { workRelationshipId: promotionCase.workRelationshipId, assignmentId: promotionCase.assignmentId, jobProfileVersionId: promotionCase.currentJobProfileVersionId, levelVersionId: promotionCase.currentLevelVersionId, careerTrackId: promotionCase.currentCareerTrackId };
  const targetSnapshot = { jobProfileVersionId: promotionCase.targetJobProfileVersionId, levelVersionId: promotionCase.targetLevelVersionId, careerTrackId: promotionCase.targetCareerTrackId };
  const decision = await tx.hrPromotionDecision.create({ data: { organizationId: context.organizationId, promotionCaseId: promotionCase.id, caseVersion: promotionCase.version, decision: input.decision, rationale: input.rationale, readinessAssessmentId: readiness.id, currentSnapshot, targetSnapshot, proposedEffectiveAt: promotionCase.proposedEffectiveAt, decidedByIds: input.approverUserIds, correlationId: promotionCase.correlationId } });
  const nextStatus = input.decision;
  transitionPromotionCase(promotionCase.status, nextStatus);
  const result = await tx.hrPromotionCase.updateMany({ where: { id: promotionCase.id, status: promotionCase.status, version: promotionCase.version }, data: { status: nextStatus, version: { increment: 1 } } });
  if (result.count !== 1) throw new Error("Another request decided this promotion case first.");
  await appendHrAudit(tx, { ...context, entityType: "HrPromotionDecision", entityId: decision.id, action: `hr.performance.promotion.decision_${input.decision.toLowerCase()}`, newValues: { promotionCaseId: promotionCase.id, caseVersion: promotionCase.version, decision: input.decision, readinessAssessmentId: readiness.id, proposedEffectiveAt: promotionCase.proposedEffectiveAt }, reason: input.rationale, correlationId: promotionCase.correlationId });
  const employee = await tx.hrEmployee.findUniqueOrThrow({ where: { id: promotionCase.employeeId } });
  const recipient = employee.preferredNotificationEmail ?? employee.companyEmail ?? employee.personalEmail;
  if (recipient) await enqueueHrEmail(tx, { organizationId: context.organizationId, recipient, template: `hr-promotion-${input.decision.toLowerCase()}`, subject: `Promotion decision: ${input.decision.toLowerCase()}`, payload: { recipientName: employee.preferredName ?? employee.legalFirstName, href: "/hr/employee/performance", promotionCaseId: promotionCase.id }, idempotencyKey: `unit7-promotion-decision:${decision.id}` });
  return decision;
}

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
