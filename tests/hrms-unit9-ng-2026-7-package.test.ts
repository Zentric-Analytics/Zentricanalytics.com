import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const required = [
  "src/lib/hr/payroll/nigeria-2026-7.ts", "src/lib/hr/payroll/unit9-engine-2026-7.ts",
  "src/lib/hr/payroll/nigeria-2026-6.ts", "src/lib/hr/payroll/nigeria-2026-4.ts",
  "src/lib/hr/payroll/unit9-domain.ts", "src/lib/hr/payroll/unit9-engine.ts",
  "src/lib/hr/payroll/unit9-service.ts", "src/lib/hr/payroll/unit9-limited-launch.ts",
  "prisma/migrations/20260825160000_hrms_unit9_ng_2026_7_annualization/migration.sql",
  "tests/fixtures/ng-candidate-2026-7-expected-values.json",
  "tests/hrms-unit9-ng-2026-7.test.ts"
];

describe("NG-CANDIDATE-2026.7 closure package completeness", () => {
  it.each(required)("contains %s", (file) => expect(fs.existsSync(path.join(process.cwd(), file))).toBe(true));
  it("integrates independent persisted sources in the authoritative service", () => { const service = fs.readFileSync(path.join(process.cwd(), "src/lib/hr/payroll/unit9-service.ts"), "utf8"); for (const control of ["resolveNg2026_7AuthoritativeManifest", "hrSalaryRecord.findMany", "requireSingleNg2026_7SalarySource", "hrPayrollYtdLedgerEntry.findMany", "effectiveAt: { lt: ytdCutoff }", "payrollResultId: { notIn: currentResultIds }", "hrPayrollTaxReliefClaimVersion.findMany", "hrPayrollPriorEmployerYtdVersion.findFirst", "hrPayrollAnnualizationRuleVersion.findFirst", "calculateFrozenPayroll2026_7", "STALE_EMPLOYMENT_INCOME_BINDING"]) expect(service).toContain(control); });
  it("does not mutate predecessor implementations", () => { const changed = execFileSync("git", ["diff", "14850c8b1ee68baaf4156725e6751fb7549348a3", "--name-only"], { encoding: "utf8" }); expect(changed).not.toMatch(/nigeria-2026-[1-6]\.ts|unit9-engine-2026-6\.ts|ng-candidate-2026-6/); });
  it("publishes current non-sensitive staging evidence without mutating the sealed predecessor page", () => { const status = fs.readFileSync(path.join(process.cwd(), "src/app/hr/admin/unit-9-status/2026-7/page.tsx"), "utf8"); expect(status).toContain("NG-CANDIDATE-2026.7"); expect(status).toContain("63 applied; none pending or failed"); expect(status).toContain("RENDER_GIT_COMMIT"); expect(status).not.toMatch(/account number|bank identifier|tax identifier/i); });
});
