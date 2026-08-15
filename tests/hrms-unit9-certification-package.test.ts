import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const evidenceDir = path.join(root, "docs", "hrms", "delivery-units", "unit-09");
const files = [
  "nigeria-certification-handoff.md",
  "nigeria-authoritative-source-register.md",
  "nigeria-rule-source-matrix.md",
  "nigeria-paye-calculation-spec.md",
  "nigeria-taxable-base-matrix.md",
  "nigeria-pension-contribution-spec.md",
  "nigeria-proration-overtime-rounding.md",
  "nigeria-ytd-retro-spec.md",
  "nigeria-certification-test-matrix.md",
  "nigeria-reviewer-questions.md",
  "nigeria-certification-signoff-template.md",
  "nigeria-certification-manifest.json",
];

describe("Unit 9 Nigeria certification evidence package", () => {
  it("contains the complete reviewer package without claiming certification", () => {
    for (const file of files) {
      const content = fs.readFileSync(path.join(evidenceDir, file), "utf8");
      expect(content.length, file).toBeGreaterThan(100);
    }
    const handoff = fs.readFileSync(path.join(evidenceDir, files[0]), "utf8");
    expect(handoff).toContain("NOT CERTIFIED");
    expect(handoff).toContain("independent certification");
  });

  it("maps every candidate rule to implementation, tests, and unresolved human review", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(evidenceDir, "nigeria-certification-manifest.json"), "utf8"));
    const matrix = fs.readFileSync(path.join(evidenceDir, "nigeria-rule-source-matrix.md"), "utf8");
    expect(manifest.jurisdiction).toBe("NG");
    expect(manifest.status).toBe("NOT_CERTIFIED");
    expect(manifest.certification).toEqual(expect.objectContaining({ reviewer: null, certifier: null, decision: "NOT_CERTIFIED" }));
    expect(manifest.sources).toHaveLength(4);
    expect(manifest.ruleIds.length).toBeGreaterThanOrEqual(15);
    for (const ruleId of manifest.ruleIds) expect(matrix, ruleId).toContain(ruleId);
    expect(matrix).toContain("INSUFFICIENT EVIDENCE");
    expect(matrix).toContain("REVIEW REQUIRED");
  });

  it("keeps official downstream actions dependent on certified finalization", () => {
    const domain = fs.readFileSync(path.join(root, "src", "lib", "hr", "payroll", "unit9-domain.ts"), "utf8");
    const service = fs.readFileSync(path.join(root, "src", "lib", "hr", "payroll", "unit9-service.ts"), "utf8");
    const financial = fs.readFileSync(path.join(root, "src", "lib", "hr", "payroll", "unit9-financial-service.ts"), "utf8");
    expect(domain).toContain("no certified ${code} jurisdiction package covers the payroll date");
    expect(service).toContain("assertCertifiedJurisdictionPackage");
    expect(financial).toContain("Official payslips require finalized authoritative payroll");
    expect(financial).toContain("Payment batches require finalized tenant payroll");
    expect(financial).toContain("Accounting and statutory outputs require finalized tenant payroll");
  });
});
