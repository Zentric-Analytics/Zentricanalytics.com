"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { activateDevelopmentPlan, createCalibrationSession, createDevelopmentPlan, createPerformanceCycle, createPromotionWorkforceHandoff, decidePromotionCase, finalizeReadinessAssessment, openPerformanceCycle, recordCalibrationDecision, seedPerformanceFramework, transitionCalibrationSession, transitionPromotionCaseStatus } from "@/lib/hr/performance/commands";
import { performanceContentHash } from "@/lib/hr/performance/domain";
import { appendHrAudit } from "@/lib/hr/audit";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function initializePerformanceFrameworkAction() {
  const auth = await requirePermission("performance.framework.manage");
  await prisma.$transaction((tx) => seedPerformanceFramework(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "TALENT_ADMIN" }), { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/performance");
}

export async function createPerformanceCycleAction(form: FormData) {
  const auth = await requirePermission("performance.review.admin");
  const startsAt = new Date(`${text(form, "startsAt")}T00:00:00Z`);
  const endsAt = new Date(`${text(form, "endsAt")}T23:59:59Z`);
  await prisma.$transaction((tx) => createPerformanceCycle(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "TALENT_ADMIN" }, { code: text(form, "code"), name: text(form, "name"), cycleType: text(form, "cycleType") as "ANNUAL" | "MID_YEAR" | "PROBATION" | "AD_HOC" | "PROMOTION", startsAt, selfReviewOpensAt: startsAt, managerReviewOpensAt: startsAt, calibrationOpensAt: startsAt, endsAt, population: { type: "ALL_ACTIVE" }, reviewTemplateVersionId: text(form, "reviewTemplateVersionId") }));
  revalidatePath("/hr/admin/performance");
}

export async function openPerformanceCycleAction(form: FormData) {
  const auth = await requirePermission("performance.review.admin");
  await prisma.$transaction((tx) => openPerformanceCycle(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "TALENT_ADMIN" }, { cycleId: text(form, "cycleId"), expectedVersion: Number(text(form, "expectedVersion")) }), { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/performance");
}

export async function createCalibrationSessionAction(form: FormData) {
  const auth = await requirePermission("performance.calibration.admin");
  await prisma.$transaction((tx) => createCalibrationSession(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "TALENT_ADMIN" }, { cycleId: text(form, "cycleId"), name: text(form, "name"), participantUserIds: [auth.user.id] }), { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/performance");
}

export async function transitionCalibrationSessionAction(form: FormData) {
  const auth = await requirePermission("performance.calibration.admin");
  try {
    await prisma.$transaction((tx) => transitionCalibrationSession(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "TALENT_ADMIN" }, { sessionId: text(form, "sessionId"), expectedVersion: Number(text(form, "expectedVersion")), to: text(form, "to") as "POPULATION_LOCKED" | "IN_SESSION" | "DECISIONS_PENDING" | "FINALIZED" | "CANCELLED", reason: text(form, "reason") }), { isolationLevel: "Serializable" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calibration could not be changed.";
    redirect(`/hr/admin/performance?calibrationError=${encodeURIComponent(message)}`);
  }
  revalidatePath("/hr/admin/performance");
}

export async function recordCalibrationDecisionAction(form: FormData) {
  const auth = await requirePermission("performance.calibration.participate");
  await prisma.$transaction((tx) => recordCalibrationDecision(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "CALIBRATION_PARTICIPANT" }, { sessionId: text(form, "sessionId"), reviewId: text(form, "reviewId"), reviewVersion: Number(text(form, "reviewVersion")), managerRatingItemId: text(form, "managerRatingItemId"), calibratedRatingItemId: text(form, "calibratedRatingItemId"), rationale: text(form, "rationale") }), { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/performance");
}

export async function createDevelopmentPlanAction(form: FormData) {
  const auth = await requirePermission("performance.development.admin");
  const targetDate = new Date(`${text(form, "targetDate")}T12:00:00Z`);
  await prisma.$transaction(async (tx) => {
    const review = await tx.hrPerformanceReview.findFirstOrThrow({ where: { id: text(form, "reviewId"), organizationId: auth.user.organizationId, status: "FINALIZED" } });
    const manager = await tx.hrEmployee.findFirstOrThrow({ where: { id: review.managerEmployeeId, organizationId: auth.user.organizationId, userId: { not: null } } });
    const employee = await tx.hrEmployee.findFirstOrThrow({ where: { id: review.employeeId, organizationId: auth.user.organizationId, userId: { not: null } } });
    const expectationIds = form.getAll("expectationVersionIds").map(String).filter(Boolean);
    const plan = await createDevelopmentPlan(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "TALENT_ADMIN" }, { employeeId: review.employeeId, managerEmployeeId: review.managerEmployeeId, summary: text(form, "summary"), expectationVersionIds: expectationIds, actions: [{ gap: text(form, "gap"), targetCapability: text(form, "targetCapability"), actionType: text(form, "actionType"), ownerUserId: employee.userId!, mentorUserId: manager.userId!, targetDate, evidenceRequired: { description: text(form, "evidenceRequired"), targetJobProfileVersionId: text(form, "targetJobProfileVersionId") } }] });
    await activateDevelopmentPlan(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "TALENT_ADMIN" }, { planId: plan.id, expectedVersion: plan.currentVersion, reason: "Employee and manager agreed the version-bound Unit 7 development plan." });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/performance");
}

export async function publishCareerTargetAction(form: FormData) {
  const auth = await requirePermission("performance.framework.manage");
  await prisma.$transaction(async (tx) => {
    const review = await tx.hrPerformanceReview.findFirstOrThrow({ where: { id: text(form, "reviewId"), organizationId: auth.user.organizationId, status: "FINALIZED" } });
    const current = await tx.hrJobProfileVersion.findFirstOrThrow({ where: { id: review.jobProfileVersionId, organizationId: auth.user.organizationId, status: "PUBLISHED" } });
    const currentLevelVersion = await tx.hrCompanyLevelVersion.findFirstOrThrow({ where: { id: current.companyLevelVersionId, organizationId: auth.user.organizationId, status: "PUBLISHED" } });
    const currentLevel = await tx.hrCompanyLevel.findFirstOrThrow({ where: { id: currentLevelVersion.companyLevelId, organizationId: auth.user.organizationId } });
    const nextLevel = await tx.hrCompanyLevel.findFirstOrThrow({ where: { organizationId: auth.user.organizationId, displayOrder: currentLevel.displayOrder + 1 } });
    const nextLevelVersion = await tx.hrCompanyLevelVersion.findFirstOrThrow({ where: { organizationId: auth.user.organizationId, companyLevelId: nextLevel.id, status: "PUBLISHED", effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] }, orderBy: { version: "desc" } });
    const currentLegacy = await tx.hrJobProfile.findFirstOrThrow({ where: { id: current.jobProfileId, organizationId: auth.user.organizationId }, include: { jobFamily: true } });
    const code = text(form, "code").toUpperCase().replace(/[^A-Z0-9_-]+/g, "-");
    if (!code || !text(form, "title")) throw new Error("A governed target code and title are required.");
    const targetLegacy = await tx.hrJobProfile.upsert({ where: { organizationId_code: { organizationId: auth.user.organizationId, code } }, update: {}, create: { organizationId: auth.user.organizationId, jobFamilyId: currentLegacy.jobFamilyId, code, title: text(form, "title"), description: `Governed ${nextLevel.code} progression target from ${current.title}.`, responsibilities: { sourceProfileVersionId: current.id, targetLevelVersionId: nextLevelVersion.id }, minimumRequirements: { governed: true } } });
    const existing = await tx.hrJobProfileVersion.findUnique({ where: { jobProfileId_version: { jobProfileId: targetLegacy.id, version: 1 } } });
    if (existing) throw new Error("This target profile is already published; use its immutable version.");
    const responsibilities = { sourceProfileVersionId: current.id, scope: text(form, "scope"), impact: text(form, "impact") };
    const requirements = { independence: text(form, "independence"), complexity: text(form, "complexity"), collaboration: text(form, "collaboration"), governed: true };
    const payload = { title: targetLegacy.title, responsibilities, requirements, careerTrackId: current.careerTrackId, companyLevelVersionId: nextLevelVersion.id };
    const target = await tx.hrJobProfileVersion.create({ data: { organizationId: auth.user.organizationId, jobProfileId: targetLegacy.id, jobFunctionId: current.jobFunctionId, careerTrackId: current.careerTrackId, companyLevelVersionId: nextLevelVersion.id, version: 1, title: targetLegacy.title, responsibilities, requirements, status: "PUBLISHED", effectiveFrom: new Date(), contentHash: performanceContentHash(payload), publishedById: auth.user.id, publishedAt: new Date() } });
    for (const [codeValue, name, expectation] of [["SCOPE", "Scope", text(form, "scope")], ["INDEPENDENCE", "Independence", text(form, "independence")], ["COMPLEXITY", "Complexity", text(form, "complexity")], ["IMPACT", "Impact", text(form, "impact")], ["COLLABORATION", "Collaboration and influence", text(form, "collaboration")]] as const) {
      if (!expectation) throw new Error(`The ${name.toLowerCase()} expectation is required.`);
      const competency = await tx.hrCompetency.upsert({ where: { organizationId_code: { organizationId: auth.user.organizationId, code: codeValue } }, update: {}, create: { organizationId: auth.user.organizationId, code: codeValue, name } });
      let competencyVersion = await tx.hrCompetencyVersion.findUnique({ where: { competencyId_version: { competencyId: competency.id, version: 1 } } });
      if (!competencyVersion) competencyVersion = await tx.hrCompetencyVersion.create({ data: { organizationId: auth.user.organizationId, competencyId: competency.id, version: 1, definition: `${name} evidence for governed career decisions.`, evidenceGuide: { requiresSource: true }, status: "PUBLISHED", effectiveFrom: new Date(), contentHash: performanceContentHash({ codeValue, name }), publishedById: auth.user.id, publishedAt: new Date() } });
      await tx.hrCompetencyExpectation.create({ data: { organizationId: auth.user.organizationId, jobProfileVersionId: target.id, competencyVersionId: competencyVersion.id, companyLevelVersionId: nextLevelVersion.id, expectation, evidenceGuide: { requiresSustainedEvidence: true } } });
    }
    const correlationId = crypto.randomUUID();
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "TALENT_ADMIN", entityType: "HrJobProfileVersion", entityId: target.id, action: "hr.performance.career_target.published", newValues: { sourceProfileVersionId: current.id, targetProfileVersionId: target.id, targetLevelVersionId: nextLevelVersion.id, careerTrackId: current.careerTrackId, jobFunctionId: current.jobFunctionId, expectationCount: 5 }, reason: "Publish a compatible next-level career target through governed job architecture.", correlationId });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/performance");
}

export async function finalizeReadinessAssessmentAction(form: FormData) {
  const auth = await requirePermission("performance.readiness.assess");
  await prisma.$transaction(async (tx) => {
    const review = await tx.hrPerformanceReview.findFirstOrThrow({ where: { id: text(form, "reviewId"), organizationId: auth.user.organizationId, status: "FINALIZED" } });
    await finalizeReadinessAssessment(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "TALENT_ADMIN" }, { employeeId: review.employeeId, workRelationshipId: review.workRelationshipId, assignmentId: review.assignmentId, currentJobProfileVersionId: review.jobProfileVersionId, currentLevelVersionId: review.companyLevelVersionId, targetJobProfileVersionId: text(form, "targetJobProfileVersionId"), targetLevelVersionId: text(form, "targetLevelVersionId"), cycleId: review.cycleId, state: text(form, "state") as "NOT_YET_READY" | "DEVELOPING" | "APPROACHING_READY" | "READY_NOW", evidenceIds: form.getAll("evidenceIds").map(String).filter(Boolean), gaps: text(form, "gaps").split("\n").map((value) => value.trim()).filter(Boolean), rationale: text(form, "rationale"), employeeFacingRationale: text(form, "employeeFacingRationale") });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/performance");
}

export async function transitionPromotionCaseAction(form: FormData) {
  const auth = await requirePermission(text(form, "to") === "BUSINESS_APPROVAL" ? "performance.promotion.approve" : "performance.promotion.review");
  await prisma.$transaction((tx) => transitionPromotionCaseStatus(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "TALENT_ADMIN" }, { promotionCaseId: text(form, "promotionCaseId"), expectedVersion: Number(text(form, "expectedVersion")), to: text(form, "to") as "CALIBRATION" | "HR_REVIEW" | "BUSINESS_APPROVAL", reason: text(form, "reason") }), { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/performance");
}

export async function decidePromotionCaseAction(form: FormData) {
  const auth = await requirePermission("performance.promotion.approve");
  await prisma.$transaction((tx) => decidePromotionCase(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "BUSINESS_APPROVER" }, { promotionCaseId: text(form, "promotionCaseId"), expectedVersion: Number(text(form, "expectedVersion")), decision: text(form, "decision") as "APPROVED" | "REJECTED" | "DEFERRED", rationale: text(form, "rationale"), approverUserIds: [auth.user.id] }), { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/performance");
}

export async function createPromotionHandoffAction(form: FormData) {
  const auth = await requirePermission("performance.promotion.approve");
  await prisma.$transaction(async (tx) => {
    const promotionCase = await tx.hrPromotionCase.findFirstOrThrow({ where: { id: text(form, "promotionCaseId"), organizationId: auth.user.organizationId } });
    const decision = await tx.hrPromotionDecision.findUniqueOrThrow({ where: { promotionCaseId: promotionCase.id } });
    const assignment = await tx.hrEmployeeAssignment.findFirstOrThrow({ where: { id: promotionCase.assignmentId, organizationId: auth.user.organizationId, status: "ACTIVE" } });
    const target = await tx.hrJobProfileVersion.findFirstOrThrow({ where: { id: promotionCase.targetJobProfileVersionId, organizationId: auth.user.organizationId, status: "PUBLISHED" } });
    const targetPosition = await tx.hrPosition.findFirstOrThrow({ where: { id: text(form, "targetPositionId"), organizationId: auth.user.organizationId, status: "ACTIVE", lifecycleStatus: { in: ["OPEN", "PARTIALLY_FILLED"] }, jobProfileId: target.jobProfileId } });
    await createPromotionWorkforceHandoff(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "TALENT_ADMIN" }, { promotionCaseId: promotionCase.id, decisionId: decision.id, expectedCaseVersion: promotionCase.version, currentWorkRelationshipId: promotionCase.workRelationshipId, currentAssignmentId: promotionCase.assignmentId, currentJobProfileVersionId: promotionCase.currentJobProfileVersionId, targetJobProfileVersionId: target.id, targetLevelVersionId: promotionCase.targetLevelVersionId, proposedSnapshot: { jobProfileId: target.jobProfileId, positionId: targetPosition.id, departmentId: targetPosition.departmentId, teamId: targetPosition.teamId, locationId: targetPosition.locationId, legalEntityId: targetPosition.legalEntityId, gradeId: targetPosition.gradeId, employmentType: assignment.employmentType } });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/performance");
}
