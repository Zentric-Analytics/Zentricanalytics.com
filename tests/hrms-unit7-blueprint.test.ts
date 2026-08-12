import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("Unit 7 blueprint and implementation status artifacts", () => {
  it("preserves the repository audit and complete 7A–7F architecture", () => {
    const audit = read("docs/hrms/delivery-units/unit-07/repository-audit.md");
    const blueprint = read("docs/hrms/delivery-units/unit-07/blueprint.md");
    expect(audit).toContain("HrWorkforceEvent");
    expect(audit).toContain("Missing");
    for (const section of ["7A", "7B", "7C", "7D", "7E", "7F"]) expect(blueprint).toContain(section);
    expect(blueprint).toContain("Unit 4 alone changes");
    expect(blueprint).toContain("Owner decisions required before implementation");
  });

  it("exposes an honest staging-only implementation status page", () => {
    const status = read("src/app/hr/admin/unit-7-status/page.tsx");
    expect(status).toContain("IMPLEMENTATION IN PROGRESS");
    expect(status).toContain("production untouched");
    expect(status).not.toContain("PASS — Unit 7 Production Ready");
    expect(read("src/app/unit-7-status/page.tsx")).toContain("unit-7-status/page");
  });
});
