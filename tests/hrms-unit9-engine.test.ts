import { describe, expect, it } from "vitest";
import { assertFinalizationReady, assertPaymentTransition, calculateEarnings, calculateProgressivePaye, calculationManifest, certifyPayrollInput, lateInputTreatment, payrollAccess, payrollRisk, reconcileJournal, retroDelta } from "../src/lib/hr/payroll/unit9-engine";

describe("Unit 9 payroll engine", () => {
  const eligible = { employeeId: "e1", personId: "p1", workRelationshipId: "w1", assignmentId: "a1", employmentStatus: "ACTIVE", legalEntityId: "l1", jurisdictionCode: "NG", payGroupId: "pg1", workerType: "SALARIED" as const, compensationHandoffId: "c1", compensationCurrency: "NGN", payrollCurrency: "NGN", taxProfileVersionId: "t1", paymentDestinationVersionId: "d1" };

  it("certifies authoritative inputs and isolates employee blockers", () => {
    expect(certifyPayrollInput(eligible)).toMatchObject({ runBlocked: false, employeeBlocked: false });
    const hourly = certifyPayrollInput({ ...eligible, workerType: "HOURLY" });
    expect(hourly.runBlocked).toBe(false);
    expect(hourly.findings).toContainEqual(expect.objectContaining({ code: "LOCKED_TIME_MISSING", severity: "EMPLOYEE_BLOCKER" }));
    expect(certifyPayrollInput({ ...eligible, jurisdictionCode: "GB" }).runBlocked).toBe(true);
  });

  it("calculates sourced salaried and hourly earnings deterministically", () => {
    const lines = calculateEarnings([
      { code: "BASE", sourceType: "UNIT8", sourceId: "handoff", fixedAmount: "100000", taxableBaseCode: "EMPLOYMENT", ruleVersionReference: "draft-rule" },
      { code: "REGULAR_HOURS", sourceType: "UNIT6", sourceId: "locked-time", units: "160", rate: "1000", multiplier: "1", taxableBaseCode: "EMPLOYMENT", ruleVersionReference: "draft-rule" },
    ]);
    expect(lines.map((line) => line.amount.toFixed(2))).toEqual(["100000.00", "160000.00"]);
  });

  it("evaluates progressive rules from versioned configuration without hardcoded Nigeria rates", () => {
    const result = calculateProgressivePaye({ periodTaxableIncome: "2000", priorYtdTaxableIncome: "0", priorYtdPaye: "0", rules: { version: "TEST-ONLY", annualizationPeriods: 12, roundingScale: 2, bands: [{ lowerExclusive: "0", upperInclusive: "1000", ratePercent: "10" }, { lowerExclusive: "1000", upperInclusive: null, ratePercent: "20" }] } });
    expect(result.currentPaye.toFixed(2)).toBe("300.00");
    expect(result.trace).toHaveLength(2);
  });

  it("produces stable calculation manifests and reconciles gross to net", () => {
    const input = { snapshotHash: "snapshot", jurisdictionVersion: "TEST-NOT-CERTIFIED", engineVersion: "unit9-1", sources: { unit8: ["h1"], unit4: ["a1"] }, ruleVersions: ["r2", "r1"], lines: [{ code: "BASE", category: "EARNING" as const, amount: "1000" }, { code: "PAYE", category: "PAYE" as const, amount: "100" }] };
    const first = calculationManifest(input); const second = calculationManifest({ ...input, sources: { unit4: ["a1"], unit8: ["h1"] } });
    expect(first.hash).toBe(second.hash);
    expect(first.output.net.toFixed(2)).toBe("900.00");
  });

  it("generates explainable blocking and high-risk findings without mutation", () => {
    const findings = payrollRisk({ gross: "1000", net: "1000", paye: "0", previousGross: "100", duplicateSourceCodes: ["BONUS"], hourly: true, lockedTimePresent: false, destinationChangedNearCutoff: true });
    expect(findings).toEqual(expect.arrayContaining([expect.objectContaining({ code: "ZERO_PAYE", severity: "HIGH" }), expect.objectContaining({ code: "DUPLICATE_SOURCE", severity: "BLOCKER" }), expect.objectContaining({ code: "HOURLY_TIME_MISSING", severity: "BLOCKER" })]));
  });

  it("requires balanced accounting and preserves retro deltas", () => {
    expect(reconcileJournal([{ accountCode: "SALARY", debit: "1000", sourceReference: "r" }, { accountCode: "PAYABLE", credit: "1000", sourceReference: "r" }]).balanced).toBe(true);
    expect(() => reconcileJournal([{ accountCode: "SALARY", debit: "1000", sourceReference: "r" }])).toThrow("not balanced");
    const delta = retroDelta([{ code: "BASE", category: "EARNING", amount: "1000" }], [{ code: "BASE", category: "EARNING", amount: "1100" }, { code: "PAYE", category: "PAYE", amount: "10" }]);
    expect(delta.deltas.map((line) => [line.key, line.amount.toFixed(2)])).toEqual([["EARNING:BASE", "100.00"], ["PAYE:PAYE", "10.00"]]);
  });

  it("fails finalization closed and enforces payment transitions", () => {
    const ready = { jurisdictionCertified: true, certificationComplete: true, inputsFrozen: true, authoritativeCalculation: true, employeeReconciliation: true, runReconciliation: true, unresolvedBlockers: 0, independentApproval: true };
    expect(assertFinalizationReady(ready)).toHaveLength(64);
    expect(() => assertFinalizationReady({ ...ready, jurisdictionCertified: false })).toThrow("jurisdictionCertified");
    expect(assertPaymentTransition("VALIDATED", "APPROVED")).toBe("APPROVED");
    expect(() => assertPaymentTransition("DRAFT", "SETTLED")).toThrow("Invalid payment transition");
  });

  it("classifies late authoritative changes without mutating frozen inputs", () => {
    const base = { sourceType: "UNIT8", oldVersion: "v1", newVersion: "v2", affectedPeriod: "2026-08" };
    expect(lateInputTreatment({ ...base, runFinalized: true, explicitlyAuthorizedRecalculation: false }).treatment).toBe("RETRO_TRIGGER");
    expect(lateInputTreatment({ ...base, runFinalized: false, explicitlyAuthorizedRecalculation: false }).treatment).toBe("GOVERNED_EXCEPTION_REQUIRED");
    expect(lateInputTreatment({ ...base, runFinalized: false, explicitlyAuthorizedRecalculation: true }).treatment).toBe("RECALCULATE");
  });

  it("keeps payroll data authority separate from generic administration", () => {
    expect(payrollAccess({ permissions: new Set() }).result).toBe(false);
    expect(payrollAccess({ employeeId: "e1", subjectEmployeeId: "e1", permissions: new Set() }).ownFinalizedPayslip).toBe(true);
    const processor = payrollAccess({ permissions: new Set(["payroll.read", "payroll.calculate"]) });
    expect(processor.calculate).toBe(true); expect(processor.approvePayroll).toBe(false); expect(processor.bankDetails).toBe(false);
    const approver = payrollAccess({ permissions: new Set(["payroll.approve"]) });
    expect(approver.approvePayroll).toBe(true); expect(approver.approvePayment).toBe(false);
  });
});
