"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";
import { createPerformanceFeedback, createPromotionCase, recordPerformanceCheckIn, submitPerformanceReview, transitionGoalStatus, transitionPromotionCaseStatus } from "@/lib/hr/performance/commands";
import { appendHrAudit } from "@/lib/hr/audit";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

async function managerContext(employeeId: string) {
  const auth = await requireAuthenticatedUser();
  if (!auth.user.employee) throw new Error("A manager employee profile is required.");
  await prisma.hrSupervisorAssignment.findFirstOrThrow({ where: { organizationId: auth.user.organizationId, supervisorEmployeeId: auth.user.employee.id, assignedEmployeeId: employeeId, status: "ACTIVE", effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] } });
  return auth;
}

export async function approveTeamGoalAction(form: FormData) {
  const employeeId = text(form, "employeeId");
  const auth = await managerContext(employeeId);
  const goal = await prisma.hrPerformanceGoal.findFirstOrThrow({ where: { id: text(form, "goalId"), organizationId: auth.user.organizationId, employeeId } });
  if (goal.ownerUserId === auth.user.id) throw new Error("A goal owner cannot approve their own goal.");
  await prisma.$transaction((tx) => transitionGoalStatus(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "MANAGER" }, { goalId: goal.id, expectedVersion: Number(text(form, "expectedVersion")), to: "ACTIVE", reason: text(form, "reason") || "Manager approved" }));
  revalidatePath("/hr/supervisor/performance");
}

export async function addTeamFeedbackAction(form: FormData) {
  const employeeId = text(form, "employeeId");
  const auth = await managerContext(employeeId);
  await prisma.$transaction((tx) => createPerformanceFeedback(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "MANAGER" }, { employeeId, kind: text(form, "kind") || "COACHING", visibility: text(form, "visibility") as "EMPLOYEE_VISIBLE" | "MANAGER_EMPLOYEE" | "HR_CONFIDENTIAL", content: { summary: text(form, "summary") } }));
  revalidatePath("/hr/supervisor/performance");
}

export async function recordTeamCheckInAction(form: FormData) {
  const employeeId = text(form, "employeeId");
  const auth = await managerContext(employeeId);
  const occurredAt = new Date(`${text(form, "occurredAt")}T12:00:00Z`);
  if (Number.isNaN(occurredAt.getTime()) || occurredAt.getTime() > Date.now()) throw new Error("Check-in date must be a valid current or historical date.");
  await prisma.$transaction((tx) => recordPerformanceCheckIn(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "MANAGER" }, { employeeId, managerEmployeeId: auth.user.employee!.id, occurredAt, cadence: text(form, "cadence") || "CONTINUOUS", topics: { summary: text(form, "topics") }, blockers: { summary: text(form, "blockers") }, agreedActions: { summary: text(form, "agreedActions") }, followUpAt: text(form, "followUpAt") ? new Date(`${text(form, "followUpAt")}T12:00:00Z`) : undefined }));
  revalidatePath("/hr/supervisor/performance");
}

export async function submitManagerReviewAction(form: FormData) {
  const employeeId = text(form, "employeeId");
  const auth = await managerContext(employeeId);
  await prisma.$transaction((tx) => submitPerformanceReview(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "MANAGER" }, { reviewId: text(form, "reviewId"), expectedVersion: Number(text(form, "expectedVersion")), submissionType: "MANAGER", answers: { results: text(form, "results"), behaviors: text(form, "behaviors"), development: text(form, "development") }, ratingItemId: text(form, "ratingItemId"), rationale: text(form, "rationale") }));
  revalidatePath("/hr/supervisor/performance");
}

export async function sealTeamEvidenceAction(form: FormData) {
  const employeeId = text(form, "employeeId");
  const auth = await managerContext(employeeId);
  const [sourceType, sourceId] = text(form, "source").split("|", 2);
  if (!sourceType || !sourceId) throw new Error("Choose a governed evidence source.");
  await prisma.$transaction(async (tx) => {
    const existing = await tx.hrPerformanceEvidence.findFirst({ where: { organizationId: auth.user.organizationId, employeeId, sourceType, sourceId } });
    if (existing) return existing;
    let occurredFrom: Date;
    let summary: string;
    if (sourceType === "CHECK_IN") {
      const source = await tx.hrPerformanceCheckIn.findFirstOrThrow({ where: { id: sourceId, organizationId: auth.user.organizationId, employeeId, managerEmployeeId: auth.user.employee!.id } });
      occurredFrom = source.occurredAt; summary = `Governed check-in evidence from ${source.occurredAt.toISOString().slice(0, 10)}.`;
    } else if (sourceType === "FEEDBACK") {
      const source = await tx.hrPerformanceFeedback.findFirstOrThrow({ where: { id: sourceId, organizationId: auth.user.organizationId, employeeId, authorUserId: auth.user.id, status: "SUBMITTED" } });
      occurredFrom = source.submittedAt ?? source.createdAt; summary = `Submitted ${source.kind.toLowerCase()} evidence.`;
    } else throw new Error("Unsupported governed evidence source.");
    const correlationId = crypto.randomUUID();
    const evidence = await tx.hrPerformanceEvidence.create({ data: { organizationId: auth.user.organizationId, employeeId, authorUserId: auth.user.id, evidenceType: sourceType, summary, sourceType, sourceId, visibility: "MANAGER_EMPLOYEE", occurredFrom, correlationId, sealedAt: new Date() } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "MANAGER", entityType: "HrPerformanceEvidence", entityId: evidence.id, action: "hr.performance.evidence.sealed", newValues: { employeeId, sourceType, sourceId, occurredFrom }, correlationId });
    return evidence;
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/supervisor/performance");
}

export async function createTeamPromotionCaseAction(form: FormData) {
  const employeeId = text(form, "employeeId");
  const auth = await managerContext(employeeId);
  await prisma.$transaction(async (tx) => {
    const readiness = await tx.hrPromotionReadinessAssessment.findFirstOrThrow({ where: { id: text(form, "readinessAssessmentId"), organizationId: auth.user.organizationId, employeeId, state: "READY_NOW", finalizedAt: { not: null } } });
    const currentProfile = await tx.hrJobProfileVersion.findFirstOrThrow({ where: { id: readiness.currentJobProfileVersionId, organizationId: auth.user.organizationId } });
    const targetProfile = await tx.hrJobProfileVersion.findFirstOrThrow({ where: { id: readiness.targetJobProfileVersionId, organizationId: auth.user.organizationId, status: "PUBLISHED" } });
    const promotionCase = await createPromotionCase(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "MANAGER" }, { employeeId, workRelationshipId: readiness.workRelationshipId, assignmentId: readiness.assignmentId, currentJobProfileVersionId: readiness.currentJobProfileVersionId, currentLevelVersionId: readiness.currentLevelVersionId, currentCareerTrackId: currentProfile.careerTrackId, targetJobProfileVersionId: readiness.targetJobProfileVersionId, targetLevelVersionId: readiness.targetLevelVersionId, targetCareerTrackId: targetProfile.careerTrackId, readinessAssessmentId: readiness.id, businessJustification: text(form, "businessJustification"), proposedEffectiveAt: new Date(`${text(form, "proposedEffectiveAt")}T12:00:00Z`), idempotencyKey: text(form, "idempotencyKey") });
    await transitionPromotionCaseStatus(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "MANAGER" }, { promotionCaseId: promotionCase.id, expectedVersion: promotionCase.version, to: "MANAGER_RECOMMENDED", reason: text(form, "businessJustification") });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/supervisor/performance");
}
