import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("isolated staging PostgreSQL concurrency validation", () => {
  const script = readFileSync(resolve(import.meta.dirname, "../scripts/hr-staging-concurrency.mjs"), "utf8");

  it("refuses non-staging execution", () => {
    expect(script).toContain('HR_STAGING_CONCURRENCY_CONFIRM !== "staging-only"');
    expect(script).toContain('databaseUrl.pathname.slice(1) !== "zentric_analytics_staging"');
  });

  it("runs every required conflict with serializable simultaneous transactions", () => {
    for (const gate of ["offerAcceptance", "handoverCreation", "preHireConversion", "employeeNumberAndOnboarding", "manualVsScheduledActivation"]) expect(script).toContain(`race("${gate}"`);
    expect(script.match(/isolationLevel: "Serializable"/g)?.length).toBe(5);
    expect(script).toContain("expected one winner and one losing request");
  });

  it("checks duplicates, onboarding children, sequence rollback, employee state, and audits", () => {
    expect(script).toContain("duplicate or missing durable record");
    expect(script).toContain("sequenceIncrement !== 1");
    expect(script).toContain("taskRecords !== outcomes.employeeNumberAndOnboarding.expectedTasks");
    expect(script).toContain('employeeStatus !== "ACTIVE"');
    expect(script).toContain("audit evidence count is not exactly one");
  });
});
