import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("Unit 7 blueprint artifacts", () => {
  it("records the repository audit and complete 7A–7F architecture", () => {
    const audit = read("docs/hrms/delivery-units/unit-07/repository-audit.md");
    const blueprint = read("docs/hrms/delivery-units/unit-07/blueprint.md");
    expect(audit).toContain("HrWorkforceEvent");
    expect(audit).toContain("Missing");
    for (const section of ["7A —", "7B —", "7C —", "7D —", "7E —", "7F —"]) expect(blueprint).toContain(section);
    expect(blueprint).toContain("Unit 4 alone changes");
    expect(blueprint).toContain("Owner decisions required before implementation");
    expect(blueprint).toContain("no Unit 7 runtime implementation");
  });

  it("exposes an honest blueprint-only status page", () => {
    const status = read("src/app/hr/admin/unit-7-status/page.tsx");
    expect(status).toContain("UNIT 7 BLUEPRINT COMPLETE — READY FOR IMPLEMENTATION APPROVAL");
    expect(status).toContain("No Unit 7 migrations, runtime implementation");
    expect(status).not.toContain("Unit 7 Production Ready");
    expect(read("src/app/unit-7-status/page.tsx")).toContain("unit-7-status/page");
  });
});
