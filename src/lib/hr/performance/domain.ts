import { createHash } from "node:crypto";
import type {
  HrCalibrationStatus,
  HrDevelopmentPlanStatus,
  HrPerformanceGoalStatus,
  HrPerformanceReviewStatus,
  HrPerformanceVisibility,
  HrPromotionCaseStatus,
  HrPromotionReadinessState,
} from "@prisma/client";

export function stablePerformanceJson(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item !== null && typeof item === "object") {
      return Object.fromEntries(Object.entries(item as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalize(child)]));
    }
    return item;
  };
  return JSON.stringify(normalize(value));
}

export function performanceContentHash(value: unknown) {
  return createHash("sha256").update(stablePerformanceJson(value)).digest("hex");
}

export function assertExpectedVersion(expected: number, actual: number, aggregate = "record") {
  if (!Number.isInteger(expected) || expected !== actual) {
    throw new Error(`This ${aggregate} changed. Refresh and retry against version ${actual}.`);
  }
}

const goalTransitions: Record<HrPerformanceGoalStatus, readonly HrPerformanceGoalStatus[]> = {
  DRAFT: ["PROPOSED", "CANCELLED"],
  PROPOSED: ["ACTIVE", "RETURNED", "CANCELLED"],
  ACTIVE: ["REVISED", "COMPLETED", "CANCELLED"],
  RETURNED: ["REVISED", "CANCELLED"],
  REVISED: ["PROPOSED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const reviewTransitions: Record<HrPerformanceReviewStatus, readonly HrPerformanceReviewStatus[]> = {
  NOT_STARTED: ["SELF_REVIEW", "SKIPPED_SELF"],
  SELF_REVIEW: ["MANAGER_REVIEW"],
  SKIPPED_SELF: ["MANAGER_REVIEW"],
  MANAGER_REVIEW: ["CALIBRATION", "RETURNED"],
  RETURNED: ["MANAGER_REVIEW"],
  CALIBRATION: ["FINALIZED"],
  FINALIZED: [],
};

const calibrationTransitions: Record<HrCalibrationStatus, readonly HrCalibrationStatus[]> = {
  DRAFT: ["POPULATION_LOCKED", "CANCELLED"],
  POPULATION_LOCKED: ["IN_SESSION", "CANCELLED"],
  IN_SESSION: ["DECISIONS_PENDING", "CANCELLED"],
  DECISIONS_PENDING: ["FINALIZED", "IN_SESSION", "CANCELLED"],
  FINALIZED: [],
  CANCELLED: [],
};

const developmentTransitions: Record<HrDevelopmentPlanStatus, readonly HrDevelopmentPlanStatus[]> = {
  DRAFT: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["REVISED", "COMPLETED", "CANCELLED"],
  REVISED: ["ACTIVE", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const promotionTransitions: Record<HrPromotionCaseStatus, readonly HrPromotionCaseStatus[]> = {
  DRAFT: ["MANAGER_RECOMMENDED", "WITHDRAWN"],
  MANAGER_RECOMMENDED: ["CALIBRATION", "RETURNED", "WITHDRAWN"],
  CALIBRATION: ["HR_REVIEW", "RETURNED", "DEFERRED", "REJECTED"],
  HR_REVIEW: ["BUSINESS_APPROVAL", "RETURNED", "DEFERRED", "REJECTED"],
  BUSINESS_APPROVAL: ["APPROVED", "RETURNED", "DEFERRED", "REJECTED"],
  APPROVED: ["EXECUTION_PENDING", "CONFLICTED"],
  EXECUTION_PENDING: ["APPLIED", "CONFLICTED", "FAILED"],
  RETURNED: ["MANAGER_RECOMMENDED", "WITHDRAWN"],
  DEFERRED: ["MANAGER_RECOMMENDED", "WITHDRAWN"],
  REJECTED: [], WITHDRAWN: [], CONFLICTED: ["HR_REVIEW", "WITHDRAWN"], FAILED: ["EXECUTION_PENDING", "WITHDRAWN"], APPLIED: [],
};

function assertTransition<T extends string>(map: Record<T, readonly T[]>, from: T, to: T, label: string) {
  if (!map[from].includes(to)) throw new Error(`Invalid ${label} transition ${from} -> ${to}.`);
  return to;
}

export const transitionGoal = (from: HrPerformanceGoalStatus, to: HrPerformanceGoalStatus) => assertTransition(goalTransitions, from, to, "goal");
export const transitionReview = (from: HrPerformanceReviewStatus, to: HrPerformanceReviewStatus) => assertTransition(reviewTransitions, from, to, "review");
export const transitionCalibration = (from: HrCalibrationStatus, to: HrCalibrationStatus) => assertTransition(calibrationTransitions, from, to, "calibration");
export const transitionDevelopmentPlan = (from: HrDevelopmentPlanStatus, to: HrDevelopmentPlanStatus) => assertTransition(developmentTransitions, from, to, "development plan");
export const transitionPromotionCase = (from: HrPromotionCaseStatus, to: HrPromotionCaseStatus) => assertTransition(promotionTransitions, from, to, "promotion case");

export function assertIndependentPerformanceDecision(input: { actorUserId: string; employeeUserId?: string | null; submittedById?: string | null; recommendedById?: string | null }) {
  if ([input.employeeUserId, input.submittedById, input.recommendedById].filter(Boolean).includes(input.actorUserId)) {
    throw new Error("Independent approval is required for this performance decision.");
  }
}

export type PerformanceViewer = {
  userId: string;
  employeeId?: string | null;
  isEffectiveManager?: boolean;
  isHr?: boolean;
  isAuditor?: boolean;
  hasCalibrationGrant?: boolean;
};

export function canViewPerformanceItem(visibility: HrPerformanceVisibility, subjectEmployeeId: string, viewer: PerformanceViewer) {
  if (visibility === "CALIBRATION_ONLY") return viewer.hasCalibrationGrant === true || viewer.isAuditor === true;
  if (visibility === "HR_CONFIDENTIAL") return viewer.isHr === true || viewer.isAuditor === true;
  if (visibility === "MANAGER_EMPLOYEE") return viewer.employeeId === subjectEmployeeId || viewer.isEffectiveManager === true || viewer.isHr === true || viewer.isAuditor === true;
  return viewer.employeeId === subjectEmployeeId || viewer.isEffectiveManager === true || viewer.isHr === true || viewer.isAuditor === true;
}

export type SustainedEvidence = { id: string; sourceType: string; sourceId: string; occurredFrom: Date; occurredTo?: Date | null };

export function assertSustainedEvidence(evidence: SustainedEvidence[], minimumPeriods = 2) {
  if (evidence.length < 2) throw new Error("Readiness requires more than one meaningful item of evidence.");
  const sources = new Set(evidence.map((item) => `${item.sourceType}:${item.sourceId}`));
  const periods = new Set(evidence.map((item) => `${item.occurredFrom.getUTCFullYear()}-${item.occurredFrom.getUTCMonth() + 1}`));
  if (sources.size < 2 || periods.size < minimumPeriods) throw new Error("Readiness requires sustained evidence from distinct sources and periods.");
  return { sourceCount: sources.size, periodCount: periods.size };
}

export function assertReadinessDecision(input: {
  state: HrPromotionReadinessState;
  rationale: string;
  employeeFacingRationale: string;
  gaps: unknown[];
  evidence: SustainedEvidence[];
}) {
  if (!input.rationale.trim() || !input.employeeFacingRationale.trim()) throw new Error("Readiness requires internal and employee-facing rationale.");
  if (input.state === "READY_NOW") assertSustainedEvidence(input.evidence);
  if (input.state !== "READY_NOW" && input.gaps.length === 0) throw new Error("Non-ready assessments must explain at least one development gap.");
}

export function promotionWorkforceIdempotencyKey(decisionId: string) {
  if (!decisionId.trim()) throw new Error("A promotion decision ID is required.");
  return `unit7-promotion-decision:${decisionId}`;
}

export function assertPromotionSnapshotCurrent(input: {
  currentWorkRelationshipId: string;
  currentAssignmentId: string;
  currentJobProfileVersionId: string;
  targetJobProfileVersionId: string;
  targetLevelVersionId: string;
  caseSnapshot: {
    workRelationshipId: string;
    assignmentId: string;
    currentJobProfileVersionId: string;
    targetJobProfileVersionId: string;
    targetLevelVersionId: string;
  };
}) {
  const current = [input.currentWorkRelationshipId, input.currentAssignmentId, input.currentJobProfileVersionId, input.targetJobProfileVersionId, input.targetLevelVersionId];
  const captured = [input.caseSnapshot.workRelationshipId, input.caseSnapshot.assignmentId, input.caseSnapshot.currentJobProfileVersionId, input.caseSnapshot.targetJobProfileVersionId, input.caseSnapshot.targetLevelVersionId];
  if (current.some((value, index) => value !== captured[index])) throw new Error("Promotion case is stale because its workforce or target snapshot changed.");
}

export const ratingCategories = [
  { code: "DOES_NOT_MEET", label: "Does Not Meet" },
  { code: "PARTIALLY_MEETS", label: "Partially Meets" },
  { code: "MEETS", label: "Meets" },
  { code: "EXCEEDS", label: "Exceeds" },
  { code: "SIGNIFICANTLY_EXCEEDS", label: "Significantly Exceeds" },
] as const;

export const companyLevels = Array.from({ length: 8 }, (_, index) => ({ code: `Z${index + 1}`, displayOrder: index + 1 }));
export const careerTracks = ["IC", "PEOPLE_MANAGER"] as const;
