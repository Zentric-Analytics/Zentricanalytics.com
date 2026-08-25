import { describe, expect, it } from "vitest";
import { approveSupportedPopulation, assertExceptionResolution, assertPaymentExportState, classifyEarning, complianceEligibility, exceptionLogicalKey, NIGERIA_ACCOUNTING_STATE, NIGERIA_LAUNCH_SUPPORT_MATRIX, NIGERIA_PAYMENT_MODEL, partitionPayrollPopulation, resolveMonthlyPaymentDate, resolveNigeriaRta } from "../src/lib/hr/payroll/unit9-limited-launch";
import { canAssignRole, permissionsForRole } from "../src/lib/hr/permissions/catalog";
import { readFileSync } from "node:fs";

const calendar = (holidays: string[] = []) => ({ versionId: "ng-calendar-2026-v1", weekendDays: [0, 6], holidays });
const eligible = (extra = {}) => complianceEligibility({ rta: "LAGOS", earnings: [{ type: "SALARY", amount: "100000" }], pensionOperationalState: "NOT_CONFIGURED", ...extra });

describe("Unit 9 Nigeria limited-launch operating controls", () => {
  it("limits launch RTAs and maps Ibadan to Oyo", () => {
    expect(NIGERIA_LAUNCH_SUPPORT_MATRIX.map((x) => x.rta)).toEqual(["LAGOS", "OYO", "FCT"]);
    expect(resolveNigeriaRta({ residenceStateCode: "Ibadan" })).toBe("OYO");
    expect(() => resolveNigeriaRta({ residenceStateCode: "KANO" })).toThrow("JURISDICTION_RULE_NOT_CERTIFIED");
  });

  it("uses the exact unambiguous earning taxonomy", () => {
    expect(classifyEarning("SALARY").classification).toBe("RECURRING");
    expect(classifyEarning("BONUS").classification).toBe("NON_PERIODIC");
    expect(() => classifyEarning("COMPENSATION")).toThrow("LEGACY_COMPENSATION_CLASSIFICATION_REQUIRED");
    for (const excluded of ["SICK_PAY", "SICK_LEAVE_PAY", "OTHER"]) expect(() => classifyEarning(excluded)).toThrow("AMBIGUOUS_OR_UNSUPPORTED_EARNING_TYPE");
  });

  it("resolves the 29th against a frozen previous-business-day calendar", () => {
    expect(resolveMonthlyPaymentDate(2026, 9, calendar()).resolvedPaymentDate.toISOString().slice(0, 10)).toBe("2026-09-29");
    expect(resolveMonthlyPaymentDate(2026, 8, calendar()).resolvedPaymentDate.toISOString().slice(0, 10)).toBe("2026-08-28");
    expect(resolveMonthlyPaymentDate(2026, 11, calendar()).resolvedPaymentDate.toISOString().slice(0, 10)).toBe("2026-11-27");
    expect(resolveMonthlyPaymentDate(2026, 6, calendar(["2026-06-29"])).resolvedPaymentDate.toISOString().slice(0, 10)).toBe("2026-06-26");
    expect(resolveMonthlyPaymentDate(2026, 8, calendar(["2026-08-28", "2026-08-27"])).resolvedPaymentDate.toISOString().slice(0, 10)).toBe("2026-08-26");
  });

  it.each(["LAGOS", "OYO", "FCT"])("uses the common supported Bonus path for %s without inventing an RTA difference", (rta) => {
    const result = complianceEligibility({ rta, earnings: [{ type: "BONUS", amount: "180000" }], pensionOperationalState: "NOT_CONFIGURED" });
    expect(result.status).toBe("READY");
    expect(result.findings).not.toContainEqual(expect.objectContaining({ code: "NON_PERIODIC_PAY_RTA_RULE_REQUIRED" }));
  });

  it("allows supported salary simulations without claiming certification", () => {
    expect(eligible().status).toBe("READY");
    expect(NIGERIA_LAUNCH_SUPPORT_MATRIX.every((row) => row.certification === "NOT_CERTIFIED")).toBe(true);
    expect(NIGERIA_LAUNCH_SUPPORT_MATRIX.every((row) => row.candidate === "NG-CANDIDATE-2026.5")).toBe(true);
  });

  it("does not treat pension not configured as legal exemption", () => {
    expect(eligible({ pensionLegallyRequired: true }).findings).toContainEqual(expect.objectContaining({ code: "PENSION_SETUP_REQUIRED" }));
  });

  it("partitions deterministically and never silently drops held workers", () => {
    const held = eligible({ pensionLegallyRequired: true });
    const first = partitionPayrollPopulation([{ employeeId: "e2", eligibility: held }, { employeeId: "e1", eligibility: eligible() }]);
    const replay = partitionPayrollPopulation([{ employeeId: "e1", eligibility: eligible() }, { employeeId: "e2", eligibility: held }]);
    expect(first).toEqual(replay);
    expect(first).toMatchObject({ originalPopulationCount: 2, readyCount: 1, heldCount: 1, readyEmployeeIds: ["e1"], decisionRequired: true });
    expect(first.held[0].employeeId).toBe("e2");
  });

  it("requires independent explicit partition approval and stable idempotency", () => {
    const input = { actorUserId: "checker", preparedById: "maker", decision: "APPROVE_SUPPORTED_POPULATION_AND_DEFER_HELD_POPULATION", reason: "Defer to governed off-cycle", partitionHash: "abc", expectedPartitionHash: "abc" };
    expect(approveSupportedPopulation(input)).toEqual(approveSupportedPopulation(input));
    expect(() => approveSupportedPopulation({ ...input, actorUserId: "maker" })).toThrow("INDEPENDENT_PARTITION_APPROVAL_REQUIRED");
  });

  it("makes exception creation idempotent and forbids manual tax guessing", () => {
    const facts = { organizationId: "o", payrollRunId: "r", employeeId: "e", calculationAttemptId: "a", blockerCode: "NON_PERIODIC_PAY_RTA_RULE_REQUIRED" as const, affectedInput: "BONUS" };
    expect(exceptionLogicalKey(facts)).toBe(exceptionLogicalKey(facts));
    expect(() => assertExceptionResolution({ status: "RESOLVED", resolutionType: "MANUAL", manualTaxAmount: "1" })).toThrow("MANUAL_TAX_GUESS_FORBIDDEN");
    expect(() => assertExceptionResolution({ status: "RESOLVED", resolutionType: "RULE" })).toThrow("RULE_BACKED_RECALCULATION_REQUIRED");
  });

  it("keeps role assignment authority separate from payroll access", () => {
    expect(canAssignRole(["ADMIN"], "PAYROLL_PROCESSOR")).toBe(true);
    expect(permissionsForRole("ADMIN")).not.toContain("payroll.read");
    expect(permissionsForRole("PAYROLL_COMPLIANCE_ADMIN")).toEqual(expect.arrayContaining(["payroll.exception.read", "payroll.exception.resolve"]));
    expect(permissionsForRole("PAYROLL_PROCESSOR")).not.toContain("payroll.approve");
  });

  it("backfills limited-launch permissions into persisted tenant RBAC", () => {
    const migration = readFileSync("prisma/migrations/20260824143000_hrms_unit9_limited_launch_permission_backfill/migration.sql", "utf8");
    expect(migration).toContain("'PAYROLL_COMPLIANCE_ADMIN'::\"HrRoleKey\", 'payroll.exception.read'");
    expect(migration).toContain("'PAYROLL_COMPLIANCE_ADMIN'::\"HrRoleKey\", 'payroll.exception.resolve'");
    expect(migration).toContain("'PAYROLL_ADMIN'::\"HrRoleKey\", 'payroll.population_partition.approve'");
    expect(migration).toContain('ON CONFLICT ("roleId", "permissionId") DO NOTHING');
    const releaseReconciler = readFileSync("scripts/hr-bootstrap-lib.mjs", "utf8");
    expect(releaseReconciler).toContain('"payroll.exception.read","payroll.exception.manage","payroll.exception.resolve","payroll.population_partition.approve","payroll.roles.assign"');
    expect(releaseReconciler).toContain('PAYROLL_COMPLIANCE_ADMIN: ["payroll.read", "payroll.rules.manage", "payroll.rules.certify", "payroll.regulatory_watch.manage", "payroll.statutory.read", "payroll.audit.read", "payroll.exception.read", "payroll.exception.manage", "payroll.exception.resolve"]');
  });

  it("uses governed exports without falsely settling payments", () => {
    expect(NIGERIA_PAYMENT_MODEL).toBe("GOVERNED_EXPORT");
    expect(NIGERIA_ACCOUNTING_STATE).toBe("ACCOUNTING_ADAPTER_NOT_CONFIGURED");
    expect(assertPaymentExportState({ batchStatus: "APPROVED", actorUserId: "operator", createdById: "maker", approvedById: "checker", currency: "NGN" })).toEqual({ nextStatus: "EXPORTED", settlementStatus: "NOT_SETTLED" });
    expect(() => assertPaymentExportState({ batchStatus: "APPROVED", actorUserId: "maker", createdById: "maker", currency: "NGN" })).toThrow("PAYMENT_MAKER_CHECKER_REQUIRED");
  });
});
