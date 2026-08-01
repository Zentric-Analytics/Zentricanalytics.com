import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openingHeadcount, percentage, reportPeriod, safeReportFileName, turnoverRate } from "../src/lib/hr/reports/metrics";
import { permissionsForRole } from "../src/lib/hr/permissions/catalog";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("HRMS reports and analytics", () => {
  it("calculates headcount and turnover with a stable average denominator", () => {
    expect(openingHeadcount({ closingHeadcount: 110, hires: 20, terminations: 10 })).toBe(100);
    expect(turnoverRate({ openingHeadcount: 100, closingHeadcount: 110, terminations: 10 })).toBe(9.52);
    expect(turnoverRate({ openingHeadcount: 0, closingHeadcount: 0, terminations: 0 })).toBe(0);
    expect(percentage(25, 200)).toBe(12.5);
  });
  it("uses UTC bounded annual report periods and safe filenames", () => {
    expect(reportPeriod(2026).startsAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(reportPeriod(2026).endsAt.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(() => reportPeriod(1999)).toThrow("invalid");
    expect(safeReportFileName("../../Payroll = export", new Date("2026-08-01T00:00:00Z"))).toBe("hr-payroll-export-2026-08-01.csv");
  });
  it("keeps reporting out of employee self-service roles", () => {
    expect(permissionsForRole("ADMIN")).toEqual(expect.arrayContaining(["report.read", "report.export"]));
    expect(permissionsForRole("HR_ADMIN")).toEqual(expect.arrayContaining(["report.read", "report.export"]));
    expect(permissionsForRole("PAYROLL_ADMIN")).toEqual(expect.arrayContaining(["report.read", "report.export"]));
    expect(permissionsForRole("EMPLOYEE")).not.toContain("report.read");
  });
  it("enforces export and module permissions with tenant predicates", () => {
    const route = read("src/app/api/hr/reports/[report]/route.ts");
    expect(route).toContain('auth.permissions.has("report.export")');
    expect(route).toContain("auth.permissions.has(modulePermission)");
    expect(route).toContain("organizationId = auth.user.organizationId");
    expect(route).toContain('"Cache-Control": "private, no-store"');
    expect(route).toContain("appendHrAudit");
  });
  it("neutralizes CSV formulas and avoids floating-point payroll totals", () => {
    const route = read("src/app/api/hr/reports/[report]/route.ts");
    expect(route).toContain("csvCell");
    expect(route).toContain("new Prisma.Decimal(0)");
    expect(route).not.toContain("Number(item.netPay)");
  });
  it("tenant-links recruitment data before exposing pipeline analytics", () => {
    const migration = read("prisma/migrations/20260730060000_hrms_reports_analytics/migration.sql");
    const apply = read("src/app/apply/actions.ts");
    expect(migration).toContain('ALTER TABLE "JobApplication" ADD COLUMN "organizationId"');
    expect(migration).toContain("JobApplication_organizationId_fkey");
    expect(apply).toContain("organizationId: hrOrganization?.id");
  });
  it("provides every blueprint report family", () => {
    const route = read("src/app/api/hr/reports/[report]/route.ts");
    for (const report of ["employees", "headcount", "turnover", "recruitment", "leave", "payroll", "assets", "audit"]) expect(route).toContain(`${report}:`);
  });
});
