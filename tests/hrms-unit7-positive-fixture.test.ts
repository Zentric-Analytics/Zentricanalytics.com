import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Unit 7 positive staging fixture", () => {
  const source = readFileSync("scripts/hr-unit7-positive-fixture.mjs", "utf8");

  it("is guarded to the staging database and is idempotently labeled", () => {
    expect(source).toContain('HR_UNIT7_POSITIVE_FIXTURE_CONFIRM !== "staging-only"');
    expect(source).toContain('databaseUrl.pathname.slice(1) !== "zentric_analytics_staging"');
    expect(source).toContain('const fixtureKey = "unit7-positive-promotion-v1"');
    expect(source).toContain("hrPerson.upsert");
    expect(source).toContain("hrWorkRelationship.upsert");
    expect(source).toContain("hrSupervisorAssignment.findFirst");
    expect(source).toContain("hrSupervisorAssignment.create");
    expect(source).toContain('assignmentType: "DIRECT_REPORT"');
  });

  it("uses a separate employee and the approved staging-safe recipient", () => {
    expect(source).toContain('employeeNumber: "U7-POSITIVE-001"');
    expect(source).toContain('preferredNotificationEmail: "workingemail20266@gmail.com"');
    expect(source).not.toContain("cms9or661003eu02a87j6mc9x");
  });
});
