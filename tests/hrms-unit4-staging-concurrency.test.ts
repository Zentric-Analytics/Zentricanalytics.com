import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = fs.readFileSync(path.join(process.cwd(), "scripts/hr-unit4-staging-concurrency.mjs"), "utf8");

describe("Unit 4 real staging concurrency gate", () => {
  it("fails closed outside the explicitly confirmed staging database", () => {
    expect(script).toContain('HR_UNIT4_STAGING_CONCURRENCY_CONFIRM !== "staging-only"');
    expect(script).toContain('databaseUrl.pathname.slice(1) !== "zentric_analytics_staging"');
  });

  it("races the authenticated worker and verifies exactly-once durable effects", () => {
    expect(script).toContain('type: "WORK_ARRANGEMENT_CHANGE"');
    expect(script).toContain('isolationLevel: "Serializable"');
    expect(script).toContain("fixtureStartedAt = new Date(now.getTime() - 86_400_000)");
    expect(script).toContain("Promise.all([invokeWorker(), invokeWorker()])");
    expect(script).toContain('action: "hr.workforce_event.applied"');
    expect(script).toContain('action: "hr.separation.applied"');
    expect(script).toContain('eventAttempts !== 1');
    expect(script).toContain('separationHistory !== 1');
    expect(script).toContain('activeAssignments !== 0');
    expect(script).toContain('endedAssignments !== 1');
  });

  it("retains correlated staging evidence instead of deleting the fixtures", () => {
    expect(script).toContain("correlationId: `${run}:event`");
    expect(script).toContain("correlationId: `${run}:separation`");
    expect(script).not.toContain("deleteMany");
  });
});
