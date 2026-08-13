import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Unit 8 compensation and rewards blueprint", () => {
  it("documents the audited boundaries and complete 8A–8F architecture", () => {
    const audit = read("docs/hrms/delivery-units/unit-08/repository-audit.md");
    const blueprint = read("docs/hrms/delivery-units/unit-08/blueprint.md");
    expect(audit).toContain("HrSalaryRecord");
    expect(audit).toContain("Legacy/conflicting");
    for (const section of ["8A", "8B", "8C", "8D", "8E", "8F"]) expect(blueprint).toContain(section);
    expect(blueprint).toContain("Only approved/effective Unit 8 records become payroll-authoritative");
    expect(blueprint).toContain("Budget availability is derived and checked inside the same transaction");
  });

  it("keeps the implementation status artifact free of compensation records", () => {
    const status = read("src/app/hr/admin/unit-8-status/page.tsx");
    expect(status).toContain("LOCAL FOUNDATION AND PRIVACY VALIDATION");
    expect(status).toContain("production untouched");
    expect(status).toContain("No individual compensation data");
    expect(status).not.toContain("salary:");
  });
});
