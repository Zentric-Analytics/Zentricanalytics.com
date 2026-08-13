import { describe, expect, it } from "vitest";
import { assertBudgetAvailable, assertCurrency, assertIndependentCompensationApproval, assertNoConflictingEvent, compensationAccess, compensationHash, parseMoney, payrollHandoffKey, promotionRecommendationFloor, rangePosition, reconcileBudget, transitionCompCycle, transitionCompDecision, transitionRecommendation } from "../src/lib/hr/compensation/domain";

describe("Unit 8 compensation domain", () => {
  it("uses deterministic content hashes", () => {
    expect(compensationHash({ b: 2, a: { d: 4, c: 3 } })).toBe(compensationHash({ a: { c: 3, d: 4 }, b: 2 }));
  });

  it("accepts fixed precision money and rejects floating ambiguity", () => {
    expect(parseMoney("120000.2500")).toBe("120000.2500");
    expect(() => parseMoney("1.00001")).toThrow("four decimal");
    expect(() => parseMoney("1e5")).toThrow("fixed-precision");
  });

  it("normalizes contractual currencies", () => {
    expect(assertCurrency(" ngn ")).toBe("NGN");
    expect(() => assertCurrency("US dollars")).toThrow("three-letter");
  });

  it.each([
    ["80", "BELOW_MINIMUM"], ["89", "LOWER_RANGE"], ["100", "AROUND_MIDPOINT"], ["115", "UPPER_RANGE"], ["130", "ABOVE_MAXIMUM"],
  ])("classifies %s against a band", (amount, category) => {
    expect(rangePosition(amount, "85", "100", "120").category).toBe(category);
  });

  it("requires promotions to reach the target minimum unless an exception is approved", () => {
    expect(promotionRecommendationFloor("100", "120", "120")).toBe("120.0000");
    expect(() => promotionRecommendationFloor("100", "120", "115")).toThrow("approved exception");
    expect(promotionRecommendationFloor("100", "120", "115", true)).toBe("115.0000");
    expect(() => promotionRecommendationFloor("100", "120", "90", true)).toThrow("cannot reduce");
  });

  it("reconciles reserve, consume, release and adjustments without hidden overspend", () => {
    const state = reconcileBudget("10000", [
      { entryType: "RESERVE", amount: "8000" }, { entryType: "RELEASE", amount: "1000" }, { entryType: "CONSUME", amount: "7000" }, { entryType: "ADJUST", amount: "500" },
    ]);
    expect(state).toEqual({ allocated: "10000.0000", adjusted: "500.0000", reserved: "0.0000", consumed: "7000.0000", available: "3500.0000", balanced: true });
  });

  it("rejects a second shared-budget reservation that would overspend", () => {
    const entries = [{ entryType: "RESERVE" as const, amount: "8000" }];
    expect(assertBudgetAvailable("10000", entries, "2000").available).toBe("2000.0000");
    expect(() => assertBudgetAvailable("10000", entries, "7000")).toThrow("Insufficient");
  });

  it("enforces explicit state machines", () => {
    expect(transitionRecommendation("DRAFT", "SUBMITTED")).toBe("SUBMITTED");
    expect(transitionCompCycle("OPEN", "REVIEW")).toBe("REVIEW");
    expect(transitionCompDecision("SCHEDULED", "EFFECTIVE")).toBe("EFFECTIVE");
    expect(() => transitionRecommendation("DRAFT", "APPROVED")).toThrow("Invalid");
    expect(() => transitionCompCycle("CLOSED", "OPEN")).toThrow("Invalid");
  });

  it("requires independent compensation approval", () => {
    expect(() => assertIndependentCompensationApproval({ actorUserId: "manager", managerUserId: "manager" })).toThrow("Independent");
    expect(() => assertIndependentCompensationApproval({ actorUserId: "approver", priorApproverIds: ["approver"] })).toThrow("Independent");
    expect(() => assertIndependentCompensationApproval({ actorUserId: "approver", managerUserId: "manager" })).not.toThrow();
  });

  it("does not give general administrators implicit compensation access", () => {
    const generalAdmin = compensationAccess({ userId: "admin" }, "employee");
    expect(generalAdmin).toEqual({ finalizedPay: false, restrictedNarrative: false, budget: false, payrollFields: false, mutateArchitecture: false });
    expect(compensationAccess({ userId: "comp", hasCompensationGrant: true }, "employee").restrictedNarrative).toBe(true);
    expect(compensationAccess({ userId: "employee-user", employeeId: "employee" }, "employee").finalizedPay).toBe(true);
  });

  it("blocks incompatible unresolved events", () => {
    expect(() => assertNoConflictingEvent(["PROMOTION"], "MERIT")).toThrow("conflicts");
    expect(() => assertNoConflictingEvent(["MARKET_ADJUSTMENT"], "RETENTION_ADJUSTMENT")).not.toThrow();
  });

  it("uses stable payroll handoff idempotency keys", () => {
    expect(payrollHandoffKey("record", "rec-1", 2)).toBe("unit8:record:rec-1:v2");
    expect(() => payrollHandoffKey("award", "")).toThrow("required");
  });
});
