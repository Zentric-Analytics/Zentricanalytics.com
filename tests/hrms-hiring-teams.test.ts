import { describe, expect, it } from "vitest";
import {
  assertHiringTeamPermission,
  assertOptimisticVersion,
  effectiveHiringTeamPermissions,
  selectRecruitmentRoute,
} from "../src/lib/hr/recruitment/hiring-teams";

describe("Hiring Team permission boundaries", () => {
  it("requires both organization permission and active team-specific grant", () => {
    expect(effectiveHiringTeamPermissions({
      organizationPermissions: new Set(["application.view", "application.review"]),
      membershipActive: true,
      teamPermissions: ["application.view", "offer.issue"],
    })).toEqual(new Set(["application.view"]));
    expect(() => assertHiringTeamPermission({
      organizationPermissions: new Set(["application.view"]),
      membershipActive: true,
      teamPermissions: ["application.view"],
      required: "application.view",
    })).not.toThrow();
  });

  it("revokes every capability when membership is inactive", () => {
    expect(() => assertHiringTeamPermission({
      organizationPermissions: new Set(["application.view"]),
      membershipActive: false,
      teamPermissions: ["application.view"],
      required: "application.view",
    })).toThrow("Hiring Team permission required");
  });

  it("rejects stale concurrent membership edits", () => {
    expect(() => assertOptimisticVersion(3, 2)).toThrow("updated by another user");
    expect(() => assertOptimisticVersion(3, 3)).not.toThrow();
  });
});

describe("deterministic HR routing", () => {
  const rules = [
    { id: "fallback-rule", priority: 1, departmentId: null, legalEntityId: null, locationId: null, employmentType: null, ownerTeamId: "general", ownerUserId: null },
    { id: "department-rule", priority: 50, departmentId: "engineering", legalEntityId: null, locationId: null, employmentType: null, ownerTeamId: "engineering-hr", ownerUserId: null },
    { id: "specific-rule", priority: 100, departmentId: "engineering", legalEntityId: "uk", locationId: null, employmentType: "FULL_TIME", ownerTeamId: "uk-engineering-hr", ownerUserId: null },
  ];

  it("prefers the most specific applicable rule before numeric priority", () => {
    expect(selectRecruitmentRoute(rules, {
      departmentId: "engineering",
      legalEntityId: "uk",
      employmentType: "FULL_TIME",
    })?.id).toBe("specific-rule");
  });

  it("falls back deterministically when no scoped rule matches", () => {
    expect(selectRecruitmentRoute(rules, { departmentId: "finance" })?.id).toBe("fallback-rule");
  });
});
