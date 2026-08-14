import { describe, expect, it } from "vitest";
import {
  assertCertifiedJurisdictionPackage,
  assertIndependentPayrollApproval,
  assertRegulatorySourceUrl,
  assertUnit9RunTransition,
  paymentInstructionKey,
  payrollDigest,
  payrollMoney,
  reconcileGrossToNet,
  roundPayroll,
} from "../src/lib/hr/payroll/unit9-domain";
import { canAssignRole, HR_ADMIN_WORKSPACE_ROLES, HR_PRIVILEGED_MFA_ROLES, permissionsForRole } from "../src/lib/hr/permissions/catalog";
import fs from "node:fs";
import path from "node:path";

describe("Unit 9 payroll domain", () => {
  it("uses canonical hashes and fixed-precision arithmetic", () => {
    expect(payrollDigest({ b: 2, a: 1 })).toBe(payrollDigest({ a: 1, b: 2 }));
    expect(roundPayroll("10.005").toFixed(2)).toBe("10.01");
    expect(() => payrollMoney("0.00001")).toThrow("fixed-precision");
    expect(() => payrollMoney(Number.NaN)).toThrow("fixed-precision");
  });

  it("keeps employee deductions and employer contributions separate", () => {
    const result = reconcileGrossToNet([
      { code: "BASE", category: "EARNING", amount: "100000.00" },
      { code: "PAYE", category: "PAYE", amount: "10000.00" },
      { code: "PENSION_EMPLOYEE", category: "EMPLOYEE_DEDUCTION", amount: "8000.00" },
      { code: "PENSION_EMPLOYER", category: "EMPLOYER_CONTRIBUTION", amount: "10000.00" },
      { code: "CORRECTION", category: "ADJUSTMENT", amount: "500.00" },
    ]);
    expect(result.gross.toFixed(2)).toBe("100000.00");
    expect(result.paye.toFixed(2)).toBe("10000.00");
    expect(result.employeeDeductions.toFixed(2)).toBe("8000.00");
    expect(result.employerContributions.toFixed(2)).toBe("10000.00");
    expect(result.net.toFixed(2)).toBe("82500.00");
    expect(result.reconciles).toBe(true);
  });

  it("fails closed unless certified source-backed rules cover the payroll date", () => {
    const payrollDate = new Date("2026-08-31T00:00:00.000Z");
    expect(() => assertCertifiedJurisdictionPackage([], "NG", payrollDate)).toThrow("cannot finalize");
    expect(() => assertCertifiedJurisdictionPackage([{ jurisdictionCode: "NG", status: "DRAFT", effectiveFrom: new Date("2026-01-01"), certifiedAt: null, sourceEvidenceCount: 2 }], "NG", payrollDate)).toThrow();
    expect(assertCertifiedJurisdictionPackage([{ jurisdictionCode: "NG", status: "CERTIFIED", effectiveFrom: new Date("2026-01-01"), certifiedAt: new Date("2026-08-01"), sourceEvidenceCount: 2 }], "NG", payrollDate).jurisdictionCode).toBe("NG");
  });

  it("enforces governed run transitions and independent approval", () => {
    expect(assertUnit9RunTransition("DRAFT", "CERTIFYING")).toBe("CERTIFYING");
    expect(assertUnit9RunTransition("APPROVED", "FINALIZED")).toBe("FINALIZED");
    expect(() => assertUnit9RunTransition("DRAFT", "FINALIZED")).toThrow("Invalid");
    expect(() => assertIndependentPayrollApproval({ actorUserId: "same", createdById: "same" })).toThrow("Independent");
    expect(() => assertIndependentPayrollApproval({ actorUserId: "approver", createdById: "creator", calculatedById: "processor" })).not.toThrow();
  });

  it("generates stable logical payment keys", () => {
    const input = { organizationId: "org", finalizedResultId: "result", destinationVersionId: "bank-v2", amount: "100.0000", currency: "ngn" };
    expect(paymentInstructionKey(input)).toBe(paymentInstructionKey({ ...input }));
    expect(paymentInstructionKey({ ...input, amount: "101" })).not.toBe(paymentInstructionKey(input));
  });

  it("allows only explicitly approved HTTPS regulatory hosts", () => {
    expect(assertRegulatorySourceUrl("https://www.pencom.gov.ng/pra2014/", ["www.pencom.gov.ng"])).toContain("https://");
    expect(() => assertRegulatorySourceUrl("http://www.pencom.gov.ng/pra2014/", ["www.pencom.gov.ng"])).toThrow("HTTPS");
    expect(() => assertRegulatorySourceUrl("https://example.com/rules", ["www.pencom.gov.ng"])).toThrow("not approved");
  });

  it("separates role governance from operational payroll authority", () => {
    expect(canAssignRole(["ADMIN"], "PAYROLL_APPROVER")).toBe(true);
    expect(canAssignRole(["HR_ADMIN"], "PAYROLL_APPROVER")).toBe(false);
    expect(permissionsForRole("ADMIN")).not.toContain("payroll.read");
    expect(permissionsForRole("PAYROLL_PROCESSOR")).toContain("payroll.calculate");
    expect(permissionsForRole("PAYROLL_PROCESSOR")).not.toContain("payroll.approve");
    expect(permissionsForRole("PAYROLL_APPROVER")).toContain("payroll.approve");
    expect(permissionsForRole("PAYROLL_APPROVER")).not.toContain("payroll.payment.submit");
    expect(permissionsForRole("PAYMENT_OPERATOR")).not.toContain("payroll.payment.approve");
    expect(permissionsForRole("PAYMENT_APPROVER")).toContain("payroll.payment.approve");
    for (const role of ["PAYROLL_PROCESSOR", "PAYROLL_APPROVER", "PAYROLL_COMPLIANCE_ADMIN", "PAYMENT_OPERATOR", "PAYMENT_APPROVER", "FINANCE_READER", "PAYROLL_AUDITOR", "STATUTORY_COMPLIANCE_OPERATOR"] as const) {
      expect(HR_ADMIN_WORKSPACE_ROLES).toContain(role);
      expect(HR_PRIVILEGED_MFA_ROLES).toContain(role);
    }
    expect(HR_ADMIN_WORKSPACE_ROLES).not.toContain("EMPLOYEE");
    expect(HR_ADMIN_WORKSPACE_ROLES).not.toContain("AUDITOR");
  });

  it("routes specialized payroll roles before the generic admin dashboard", () => {
    const home = fs.readFileSync(path.join(process.cwd(), "src/app/hr/page.tsx"), "utf8");
    const payrollRedirect = home.indexOf('redirect("/hr/admin/payroll/unit9")');
    const dashboardRedirect = home.indexOf('redirect("/hr/admin/dashboard")');

    expect(payrollRedirect).toBeGreaterThan(-1);
    expect(dashboardRedirect).toBeGreaterThan(payrollRedirect);
    for (const role of ["PAYROLL_PROCESSOR", "PAYROLL_APPROVER", "PAYMENT_OPERATOR", "STATUTORY_COMPLIANCE_OPERATOR"]) {
      expect(home).toContain(`"${role}"`);
    }
  });

  it("provides a governed Regulatory Watch workspace without automatic rule activation", () => {
    const page = fs.readFileSync(path.join(process.cwd(), "src/app/hr/admin/payroll/unit9/regulatory-watch/page.tsx"), "utf8");
    const button = fs.readFileSync(path.join(process.cwd(), "src/app/hr/admin/payroll/unit9/regulatory-watch/poll-source-button.tsx"), "utf8");
    const watcher = fs.readFileSync(path.join(process.cwd(), "src/lib/hr/payroll/unit9-regulatory-watch.ts"), "utf8");
    expect(page).toContain('requirePermission("payroll.regulatory_watch.manage")');
    expect(page).toContain("organizationId: auth.user.organizationId");
    expect(page).toContain("never activate payroll rules automatically");
    expect(button).toContain("/api/hr/payroll/unit9/regulatory-sources/${sourceId}/poll");
    expect(button).not.toContain("jurisdiction-versions");
    expect(watcher).toContain("Regulatory source check timed out after 8 seconds");
  });

  it("persists Unit 9 foundations additively with database-backed invariants", () => {
    const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const migrationPath = path.join(process.cwd(), "prisma/migrations/20260814110000_hrms_unit9_payroll_foundation/migration.sql");
    const migrationBytes = fs.readFileSync(migrationPath);
    expect([...migrationBytes.subarray(0, 3)]).not.toEqual([0xef, 0xbb, 0xbf]);
    const migration = migrationBytes.toString("utf8");
    for (const model of ["HrPayrollJurisdiction", "HrPayrollJurisdictionVersion", "HrPayrollRegulatorySource", "HrPayrollRegulatoryEvidence", "HrPayrollRegulatoryChange", "HrPayrollPayGroup", "HrPayrollCalendarPeriod", "HrPayrollAuthoritativeRun", "HrPayrollInputSnapshot", "HrPayrollCalculationAttempt", "HrPayrollAuthoritativeResult", "HrPayrollResultLine", "HrPayrollRunApproval", "HrPayrollPaymentInstruction"]) {
      expect(schema).toContain(`model ${model}`);
      expect(migration).toContain(`CREATE TABLE "${model}"`);
    }
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(migration).toContain("HrPayrollAuthoritativeResult_finalized_immutable");
    expect(migration).toContain("HrPayrollInputSnapshot_immutable");
    expect(migration).toContain('ON "HrPayrollAuthoritativeRun"("payGroupId", "calendarPeriodId", "kind", "sequence")');
    expect(schema).toMatch(/Decimal\s+@db\.Decimal\(20, 4\)/);
  });

  it("reconciles every governed payroll role into initialized organizations", () => {
    const bootstrap = fs.readFileSync(path.join(process.cwd(), "scripts/hr-bootstrap-lib.mjs"), "utf8");
    for (const role of ["PAYROLL_PROCESSOR", "PAYROLL_APPROVER", "PAYROLL_COMPLIANCE_ADMIN", "PAYMENT_OPERATOR", "PAYMENT_APPROVER", "FINANCE_READER", "PAYROLL_AUDITOR", "STATUTORY_COMPLIANCE_OPERATOR"]) {
      expect(bootstrap).toContain(`"${role}"`);
      expect(bootstrap).toContain(`${role}: [`);
    }
    expect(bootstrap).toContain("existingRole ?? await tx.hrRole.create");
    expect(bootstrap).toContain('!key.startsWith("compensation.") && !key.startsWith("payroll.")');
  });
});
