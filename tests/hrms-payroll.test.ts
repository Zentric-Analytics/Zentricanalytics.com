import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { permissionsForRole } from "../src/lib/hr/permissions/catalog";
import { assertPayrollTransition, calculatePayrollSnapshot, csvCell, payrollPeriodInput, salaryInput } from "../src/lib/hr/payroll/engine";
import { createPayslipPdf } from "../src/lib/hr/payroll/payslip";

describe("HRMS payroll", () => {
  it("calculates money with Decimal arithmetic and deterministic rounding", () => {
    const result = calculatePayrollSnapshot("1000.10", [
      { code: "HOUSING", name: "Housing", type: "EARNING", calculationType: "PERCENTAGE_OF_BASE", amount: "12.5" },
      { code: "TAX", name: "Configured tax", type: "TAX", calculationType: "PERCENTAGE_OF_GROSS", amount: "7.25" },
      { code: "PENSION", name: "Employer pension", type: "BENEFIT", calculationType: "FIXED", amount: "80.015" },
    ]);
    expect(result.baseSalary.toFixed(2)).toBe("1000.10");
    expect(result.grossEarnings.toFixed(2)).toBe("1125.11");
    expect(result.totalDeductions.toFixed(2)).toBe("81.57");
    expect(result.employerBenefits.toFixed(2)).toBe("80.02");
    expect(result.netPay.toFixed(2)).toBe("1043.54");
  });

  it("rejects deductions that produce negative net pay", () => {
    expect(() => calculatePayrollSnapshot("100", [{ code: "D", name: "Deduction", type: "DEDUCTION", calculationType: "FIXED", amount: "100.01" }])).toThrow("negative net pay");
  });

  it("validates salary, currencies, and payroll date ranges", () => {
    expect(salaryInput.parse({ employeeId: "cm12345678901234567890123", amount: "1000.25", currency: "ngn", payFrequency: "MONTHLY", effectiveFrom: "2026-07-01", reason: "Annual review" }).currency).toBe("NGN");
    expect(() => salaryInput.parse({ employeeId: "cm12345678901234567890123", amount: "1.23456", currency: "NGN", payFrequency: "MONTHLY", effectiveFrom: "2026-07-01", reason: "Review" })).toThrow();
    expect(() => payrollPeriodInput.parse({ name: "Invalid", startsAt: "2026-07-31", endsAt: "2026-07-01", payDate: "2026-07-31", currency: "NGN", payFrequency: "MONTHLY" })).toThrow("end");
    expect(() => salaryInput.parse({ employeeId: "cm12345678901234567890123", amount: "0", currency: "NGN", payFrequency: "MONTHLY", effectiveFrom: "2026-07-01", reason: "Review" })).toThrow("greater than zero");
  });

  it("enforces the review, approval, lock, and payment state machine", () => {
    expect(() => assertPayrollTransition("DRAFT", "CALCULATED")).not.toThrow();
    expect(() => assertPayrollTransition("CALCULATED", "REVIEWED")).not.toThrow();
    expect(() => assertPayrollTransition("REVIEWED", "APPROVED")).not.toThrow();
    expect(() => assertPayrollTransition("APPROVED", "LOCKED")).not.toThrow();
    expect(() => assertPayrollTransition("LOCKED", "PAID")).not.toThrow();
    expect(() => assertPayrollTransition("DRAFT", "PAID")).toThrow();
    expect(() => assertPayrollTransition("LOCKED", "DRAFT")).toThrow();
  });

  it("neutralizes spreadsheet formulas in CSV exports", () => {
    expect(csvCell("=HYPERLINK(\"bad\")")).toBe("\"'=HYPERLINK(\"\"bad\"\")\"");
    expect(csvCell("+SUM(1,2)")).toBe("\"'+SUM(1,2)\"");
    expect(csvCell("Normal")).toBe("\"Normal\"");
  });

  it("keeps payroll and bank authority out of HR_ADMIN while granting employee self access", () => {
    expect(permissionsForRole("HR_ADMIN")).not.toContain("payroll.read");
    expect(permissionsForRole("HR_ADMIN")).not.toContain("payroll.read_bank_details");
    expect(permissionsForRole("PAYROLL_ADMIN")).toContain("payroll.approve");
    expect(permissionsForRole("EMPLOYEE")).toContain("employee.read_self");
    expect(permissionsForRole("EMPLOYEE")).not.toContain("payroll.read");
  });

  it("defines additive precise payroll models and immutable database snapshots", () => {
    const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const migration = fs.readFileSync(path.join(process.cwd(), "prisma/migrations/20260730020000_hrms_payroll/migration.sql"), "utf8");
    for (const model of ["HrSalaryRecord", "HrPayrollComponent", "HrEmployeePayrollComponent", "HrPayrollPeriod", "HrPayrollRun", "HrPayrollItem", "HrPayrollItemComponent", "HrPayrollApproval", "HrPayrollAdjustment", "HrPayslip", "HrPayrollExport"]) expect(schema).toContain(`model ${model}`);
    expect(schema).toContain("@db.Decimal(18, 2)");
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(migration).toContain('"HrPayrollItem_snapshot_immutable"');
    expect(migration).toContain('"HrPayrollApproval_immutable"');
    expect(migration).toContain('"HrSalaryRecord_approved_immutable"');
    expect(migration).toContain('"HrPayrollRun_periodId_version_key"');
    expect(migration).toContain('"HrSalaryRecord_employeeId_effectiveFrom_key"');
    expect(migration).toContain('"HrPayrollItem_net_check"');
  });

  it("selects only approved effective salary and prevents destructive recalculation", () => {
    const actions = fs.readFileSync(path.join(process.cwd(), "src/app/hr/admin/payroll/actions.ts"), "utf8");
    expect(actions).toContain("approvedAt: { not: null }");
    expect(actions).toContain("effectiveFrom: { lte: run.period.endsAt }");
    expect(actions).toContain("salary.payFrequency !== run.period.payFrequency");
    expect(actions).toContain('run.status !== "DRAFT" || run.items.length');
    expect(actions).toContain('isolationLevel: "Serializable"');
    expect(actions).toContain("This payroll period already has an active run.");
    expect(actions).toContain("No eligible employees were found");
    expect(actions).toContain("cancelPayrollRunAction");
    expect(actions).toContain('template: "hr-payroll-review-ready"');
    expect(actions).toContain('template: "hr-payroll-approval-ready"');
    expect(actions).toContain("payload: { payrollRunId: input.runId }");
  });

  it("enforces exact employee payslip ownership and separate bank-export permission", () => {
    const payslip = fs.readFileSync(path.join(process.cwd(), "src/app/api/hr/payroll/payslips/[id]/route.ts"), "utf8");
    const payrollExport = fs.readFileSync(path.join(process.cwd(), "src/app/api/hr/payroll/runs/[id]/export/route.ts"), "utf8");
    expect(payslip).toContain("auth.user.employee?.id === item.employeeId");
    expect(payslip).toContain('auth.permissions.has("employee.read_self")');
    expect(payslip).toContain('"Cache-Control": "private, no-store"');
    expect(payrollExport).toContain('auth.permissions.has("payroll.export")');
    expect(payrollExport).toContain('auth.permissions.has("payroll.read_bank_details")');
    expect(payrollExport).toContain("unsealHrCredential");
  });

  it("generates private payslips and sends only a safe record reference", () => {
    const action = fs.readFileSync(path.join(process.cwd(), "src/app/hr/admin/payroll/payslips/actions.ts"), "utf8");
    expect(action).toContain("hrObjectStorage()");
    expect(action).toContain('template: "hr-payslip-ready"');
    expect(action).toContain("payload: { payrollItemId: item.id }");
    expect(action).not.toMatch(/payload:\s*\{[^}]*salary/i);
    expect(action).toContain("storage.delete(storageKey)");
    expect(action).toContain("crypto.randomUUID()");
  });

  it("creates a valid PDF payslip without external services", async () => {
    const bytes = await createPayslipPdf({ organizationName: "Example", periodName: "July 2026", payDate: new Date("2026-07-31"), employeeNumber: "E-1", employeeName: "Test Employee", currency: "NGN", baseSalary: "1000.00", grossEarnings: "1100.00", totalDeductions: "100.00", employerBenefits: "50.00", netPay: "1000.00", components: [{ name: "Allowance", type: "EARNING", amount: "100.00" }] });
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(500);
  });
});
