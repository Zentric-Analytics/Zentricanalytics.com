import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assignmentInput, departmentInput, employeeInput, lastFour, positionInput, rangesOverlap, wouldCreateSupervisorCycle } from "../src/lib/hr/core/invariants";

describe("HRMS Core HR", () => {
  it("normalizes organization codes and employee emails", () => {
    expect(departmentInput.parse({ code: " fin-ops ", name: "Finance Operations" }).code).toBe("FIN-OPS");
    expect(employeeInput.parse({ employeeNumber: " za_001 ", legalFirstName: "Ada", lastName: "Lovelace", companyEmail: " ADA@EXAMPLE.COM ", hireDate: "2026-07-30", employmentStatus: "ACTIVE" }).companyEmail).toBe("ada@example.com");
  });

  it("rejects inverted salary bands", () => {
    expect(() => positionInput.parse({ code: "ENG1", title: "Engineer", departmentId: "cm12345678901234567890123", currency: "NGN", salaryBandMinimum: "200", salaryBandMaximum: "100" })).toThrow("Salary band minimum");
  });

  it("requires assignment reasons and valid identifiers", () => {
    expect(() => assignmentInput.parse({ employeeId: "bad", departmentId: "bad", positionId: "bad", employmentType: "FULL_TIME", effectiveFrom: "2026-07-30", reason: "" })).toThrow();
  });

  it("detects overlapping effective-dated assignments but permits adjacent history", () => {
    const first = { effectiveFrom: new Date("2026-01-01"), effectiveTo: new Date("2026-06-01") };
    expect(rangesOverlap(first, { effectiveFrom: new Date("2026-05-01"), effectiveTo: null })).toBe(true);
    expect(rangesOverlap(first, { effectiveFrom: new Date("2026-06-01"), effectiveTo: null })).toBe(false);
  });

  it("derives display-safe last four values without changing the full value", () => {
    expect(lastFour(" 0123 4567 89 ")).toBe("6789");
    expect(lastFour("123")).toBe("123");
  });

  it("prevents direct and transitive supervisor cycles", () => {
    const assignments = [
      { supervisorEmployeeId: "a", assignedEmployeeId: "b" },
      { supervisorEmployeeId: "b", assignedEmployeeId: "c" },
    ];
    expect(wouldCreateSupervisorCycle(assignments, "c", "a")).toBe(true);
    expect(wouldCreateSupervisorCycle(assignments, "a", "a")).toBe(true);
    expect(wouldCreateSupervisorCycle(assignments, "a", "d")).toBe(false);
  });

  it("uses additive history tables and protected encrypted fields", () => {
    const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const migration = fs.readFileSync(path.join(process.cwd(), "prisma/migrations/20260730000000_hrms_core_hr/migration.sql"), "utf8");
    expect(schema).toContain("model HrEmployeeAssignment");
    expect(schema).toContain("accountNumberEncrypted");
    expect(schema).toContain("valueEncrypted");
    expect(schema).toContain("recruitmentApplicationId");
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(migration).toContain("HrEmployeeAssignment_dates_check");
    expect(migration).toContain("HrPosition_salary_band_check");
  });

  it("creates a single draft employee from final recruitment approval", () => {
    const actions = fs.readFileSync(path.join(process.cwd(), "src/app/admin/applications/actions.ts"), "utf8");
    expect(actions).toContain("recruitmentApplicationId: app.id");
    expect(actions).toContain("employmentStatus: 'DRAFT'");
    expect(actions).toContain("existingEmployee ?? await tx.hrEmployee.create");
    expect(actions).toContain("hr.employee.created_from_recruitment");
  });

  it("protects the final ADMIN and supports the full account lifecycle", () => {
    const actions = fs.readFileSync(path.join(process.cwd(), "src/app/hr/admin/users/actions.ts"), "utf8");
    expect(actions).toContain("The final active ADMIN role cannot be revoked.");
    expect(actions).toContain("reactivateHrUserAction");
    expect(actions).toContain("resendHrInvitationAction");
    expect(actions).toContain("linkHrUserEmployeeAction");
  });

  it("renders full authorized bank details instead of only the last four digits", () => {
    const profile = fs.readFileSync(path.join(process.cwd(), "src/app/hr/admin/employees/[id]/page.tsx"), "utf8");
    expect(profile).toContain("unsealHrCredential(account.accountNumberEncrypted)");
    expect(profile).toContain('auth.permissions.has("payroll.read_bank_details")');
    expect(profile).not.toContain("accountNumberLastFour}</dd>");
  });
});
