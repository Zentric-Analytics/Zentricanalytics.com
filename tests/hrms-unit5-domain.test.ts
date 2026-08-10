import { describe, expect, it } from "vitest";
import { assertCurrentRequestVersion, assertIndependentLeaveApproval, assertUnit5RequestTransition, projectedPeriodBalance, reconstructUnit5Balance, resolveLeavePolicy, usageLabel, validateWeeklyPattern } from "../src/lib/hr/leave/unit5";

describe("Unit 5 leave domain", () => {
  it("resolves policy precedence deterministically and fails closed on ambiguity", () => {
    const context = { countryCode: "NG", legalEntityId: "le1", locationId: "loc1", employmentType: "FULL_TIME", gradeId: "g1" };
    const candidates = [
      { id: "default", priority: 0, explicitEmployee: false },
      { id: "country", priority: 0, explicitEmployee: false, countryCode: "NG" },
      { id: "entity-location", priority: 0, explicitEmployee: false, legalEntityId: "le1", locationId: "loc1" },
    ];
    expect(resolveLeavePolicy(candidates, context).policyId).toBe("entity-location");
    expect(() => resolveLeavePolicy([{ id: "a", priority: 0, explicitEmployee: false }, { id: "b", priority: 0, explicitEmployee: false }], context)).toThrow(/ambiguous/);
  });

  it("validates non-overlapping weekly schedule intervals", () => {
    expect(validateWeeklyPattern([{ weekday: 1, start: "09:00", end: "17:00" }])).toHaveLength(1);
    expect(() => validateWeeklyPattern([{ weekday: 1, start: "09:00", end: "13:00" }, { weekday: 1, start: "12:00", end: "17:00" }])).toThrow(/overlap/);
  });

  it("reconstructs spendable balance without double charging consumption", () => {
    const entries = [{ kind: "GRANT", amount: 20 }, { kind: "RESERVATION", amount: 5 }, { kind: "RESERVATION_RELEASE", amount: 5 }, { kind: "CONSUMPTION", amount: 5 }];
    expect(reconstructUnit5Balance(entries)).toBe(15);
    expect(projectedPeriodBalance({ granted: 20, accrued: 0, carriedOver: 0, adjusted: 0, reserved: 0, consumed: 5, expired: 0 })).toBe(15);
  });

  it("enforces state, version and separation-of-duties rules", () => {
    expect(() => assertUnit5RequestTransition("UNDER_REVIEW", "APPROVED")).not.toThrow();
    expect(() => assertUnit5RequestTransition("COMPLETED", "DRAFT")).toThrow(/Invalid/);
    expect(() => assertIndependentLeaveApproval("u1", "u1")).toThrow(/cannot approve/);
    expect(() => assertCurrentRequestVersion(1, 2)).toThrow(/changed/);
  });

  it("shows usage rather than a fake unlimited balance", () => {
    expect(usageLabel("UNLIMITED", 8, "DAYS")).toBe("Unlimited policy · 8 days used this year");
  });
});
