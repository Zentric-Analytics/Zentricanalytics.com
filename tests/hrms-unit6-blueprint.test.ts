import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Unit 6 blueprint", () => {
  it("records repository facts and shared schedule strategy", () => {
    const audit = read("docs/hrms/delivery-units/unit-06/repository-audit.md");
    expect(audit).toContain("HrWorkScheduleVersion");
    expect(audit).toContain("Extend the pattern; do not create a second basic schedule authority");
    expect(audit).toContain("Actual clock/punch/time-event records");
  });

  it("defines policy-driven modes and authoritative time boundaries", () => {
    const blueprint = read("docs/hrms/delivery-units/unit-06/blueprint.md");
    for (const value of ["NONE", "EXCEPTION_BASED", "CLOCK", "TIMESHEET", "KIOSK"]) expect(blueprint).toContain(value);
    expect(blueprint).toContain("Schedule is expectation, not proof");
    expect(blueprint).toContain("Only locked authoritative time is exportable");
    expect(blueprint).not.toContain("facial recognition is enabled");
  });

  it("covers privacy, timezone, concurrency, migration, recovery, and owner decisions", () => {
    const blueprint = read("docs/hrms/delivery-units/unit-06/blueprint.md");
    const validation = read("docs/hrms/delivery-units/unit-06/validation-plan.md");
    for (const value of ["IANA", "DST", "serializable", "Location is event-time proof", "Owner decisions required", "No destructive rewrite"]) expect(blueprint).toContain(value);
    for (const value of ["Real PostgreSQL", "Full staging E2E", "Recovery correlation", "Production-readiness gates"]) expect(validation).toContain(value);
  });

  it("provides a public secret-free status artifact without claiming implementation", () => {
    const status = read("src/app/hr/admin/unit-6-status/page.tsx");
    expect(status).toContain("UNIT 6 BLUEPRINT COMPLETE — READY FOR IMPLEMENTATION APPROVAL");
    expect(status).toContain("BLUEPRINT — APPROVAL REQUIRED");
    expect(status).toContain("production unchanged");
    expect(status).not.toMatch(/DATABASE_URL|SECRET_ACCESS_KEY|AUTH_SECRET/);
    expect(read("src/app/unit-6-status/page.tsx")).toContain("unit-6-status/page");
  });
});
