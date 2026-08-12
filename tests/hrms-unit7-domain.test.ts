import { describe, expect, it } from "vitest";
import {
  assertExpectedVersion,
  assertIndependentPerformanceDecision,
  assertPromotionSnapshotCurrent,
  assertReadinessDecision,
  assertSustainedEvidence,
  canViewPerformanceItem,
  careerTracks,
  companyLevels,
  performanceContentHash,
  promotionWorkforceIdempotencyKey,
  ratingCategories,
  stablePerformanceJson,
  transitionCalibration,
  transitionDevelopmentPlan,
  transitionGoal,
  transitionPromotionCase,
  transitionReview,
} from "../src/lib/hr/performance/domain";

const evidence = [
  { id: "e1", sourceType: "GOAL", sourceId: "g1", occurredFrom: new Date("2026-01-10T00:00:00Z") },
  { id: "e2", sourceType: "FEEDBACK", sourceId: "f1", occurredFrom: new Date("2026-03-10T00:00:00Z") },
];

describe("Unit 7 performance and career domain", () => {
  it("uses the locked Z1-Z8, parallel-track and descriptive-rating decisions", () => {
    expect(companyLevels.map(({ code }) => code)).toEqual(["Z1", "Z2", "Z3", "Z4", "Z5", "Z6", "Z7", "Z8"]);
    expect(careerTracks).toEqual(["IC", "PEOPLE_MANAGER"]);
    expect(ratingCategories.map(({ label }) => label)).toEqual(["Does Not Meet", "Partially Meets", "Meets", "Exceeds", "Significantly Exceeds"]);
  });

  it("hashes immutable published content independently of key order", () => {
    expect(stablePerformanceJson({ b: 2, a: { y: 2, x: 1 } })).toBe(stablePerformanceJson({ a: { x: 1, y: 2 }, b: 2 }));
    expect(performanceContentHash({ b: 2, a: 1 })).toBe(performanceContentHash({ a: 1, b: 2 }));
  });

  it("enforces governed state transitions", () => {
    expect(transitionGoal("DRAFT", "PROPOSED")).toBe("PROPOSED");
    expect(() => transitionGoal("DRAFT", "COMPLETED")).toThrow(/Invalid goal/);
    expect(transitionReview("SELF_REVIEW", "MANAGER_REVIEW")).toBe("MANAGER_REVIEW");
    expect(() => transitionReview("FINALIZED", "MANAGER_REVIEW")).toThrow(/Invalid review/);
    expect(transitionCalibration("DRAFT", "POPULATION_LOCKED")).toBe("POPULATION_LOCKED");
    expect(transitionDevelopmentPlan("ACTIVE", "REVISED")).toBe("REVISED");
    expect(transitionPromotionCase("APPROVED", "EXECUTION_PENDING")).toBe("EXECUTION_PENDING");
    expect(() => transitionPromotionCase("APPROVED", "APPLIED")).toThrow(/Invalid promotion case/);
  });

  it("rejects stale versions and non-independent official decisions", () => {
    expect(() => assertExpectedVersion(2, 3, "goal")).toThrow(/changed/);
    expect(() => assertIndependentPerformanceDecision({ actorUserId: "manager", recommendedById: "manager" })).toThrow(/Independent/);
    expect(() => assertIndependentPerformanceDecision({ actorUserId: "hr", recommendedById: "manager" })).not.toThrow();
  });

  it("requires sustained, explainable evidence without computing a hidden score", () => {
    expect(assertSustainedEvidence(evidence)).toEqual({ sourceCount: 2, periodCount: 2 });
    expect(() => assertSustainedEvidence([evidence[0]])).toThrow(/more than one/);
    expect(() => assertReadinessDecision({ state: "READY_NOW", rationale: "Consistent target-level delivery.", employeeFacingRationale: "You consistently demonstrate the target scope.", gaps: [], evidence })).not.toThrow();
    expect(() => assertReadinessDecision({ state: "DEVELOPING", rationale: "Growing", employeeFacingRationale: "Keep growing", gaps: [], evidence })).toThrow(/gap/);
  });

  it("enforces field-level visibility and session-specific calibration access", () => {
    const employee = { userId: "u1", employeeId: "e1" };
    expect(canViewPerformanceItem("EMPLOYEE_VISIBLE", "e1", employee)).toBe(true);
    expect(canViewPerformanceItem("HR_CONFIDENTIAL", "e1", employee)).toBe(false);
    expect(canViewPerformanceItem("CALIBRATION_ONLY", "e1", { ...employee, isEffectiveManager: true })).toBe(false);
    expect(canViewPerformanceItem("CALIBRATION_ONLY", "e1", { userId: "panel", hasCalibrationGrant: true })).toBe(true);
    expect(canViewPerformanceItem("HR_CONFIDENTIAL", "e1", { userId: "hr", isHr: true })).toBe(true);
  });

  it("detects workforce or target snapshot drift before promotion handoff", () => {
    const input = { currentWorkRelationshipId: "wr1", currentAssignmentId: "a1", currentJobProfileVersionId: "jp1", targetJobProfileVersionId: "jp2", targetLevelVersionId: "z2", caseSnapshot: { workRelationshipId: "wr1", assignmentId: "a1", currentJobProfileVersionId: "jp1", targetJobProfileVersionId: "jp2", targetLevelVersionId: "z2" } };
    expect(() => assertPromotionSnapshotCurrent(input)).not.toThrow();
    expect(() => assertPromotionSnapshotCurrent({ ...input, currentAssignmentId: "a2" })).toThrow(/stale/);
    expect(promotionWorkforceIdempotencyKey("decision-1")).toBe("unit7-promotion-decision:decision-1");
  });
});
