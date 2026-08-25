import { describe, expect, it } from "vitest";
import { calculateFrozenPayroll2026_6, deriveFrozenNg2026_6Binding, type Candidate2026_6Manifest } from "../src/lib/hr/payroll/unit9-engine-2026-6";
import { assertNg2026_6AuthoritativeUseAllowed, deriveAndValidateNg2026_6IncomeBinding, NG_2026_6_ACTIVE_EARNINGS, NG_2026_6_STATUS, NG_2026_6_VERSION, type Ng2026_6IncomeEvidence } from "../src/lib/hr/payroll/nigeria-2026-6";
import { complianceEligibility, partitionPayrollPopulation } from "../src/lib/hr/payroll/unit9-limited-launch";
import fs from "node:fs";
import path from "node:path";

const evidence = (overrides: Partial<Ng2026_6IncomeEvidence> = {}): Ng2026_6IncomeEvidence => ({ employeeId: "employee-1", workRelationshipId: "relationship-1", payrollPeriodId: "2026-08", rta: "LAGOS", candidateVersion: NG_2026_6_VERSION, monthlySalary: "70000", currentPeriodBonus: "0", materiallyVariableMonthlyWage: "NO", ambiguousMultiEmployer: "NO", unusualPartialYearArrangement: "NO", otherTaxableEmploymentIncome: "VERIFIED_NONE", evidenceCompletenessCertified: true, evidenceReferences: ["certified-input:income-1"], inputCertificationId: "cert-1", inputCertificationVersion: "v1", ...overrides });
const manifest = (overrides: Partial<Candidate2026_6Manifest> = {}): Candidate2026_6Manifest => ({ employeeId: "employee-1", workRelationshipId: "relationship-1", payrollPeriodId: "2026-08", currency: "NGN", jurisdictionVersion: NG_2026_6_VERSION, engineVersion: "unit9-ng-2026.6", incomeEvidence: evidence(), authoritativeIncomeFacts: { governedMonthlySalary: "70000", expectedAnnualSalary: "840000", priorBonusPaidTaxYearToDate: "0", currentEmployerPayeDeducted: "0", currentEmployerPayeRepaid: "0", priorEmployer: { state: "NONE", income: "0", paye: "0" } }, earnings: [{ code: "SALARY", sourceType: "UNIT8", sourceId: "salary-1", fixedAmount: "70000", taxableBaseCode: "EMPLOYMENT", ruleVersionReference: "salary-v1" }], paye: { priorYtdTaxableIncome: "0", priorYtdPaye: "0", priorPayeRepaid: "0", expectedAnnualEmploymentIncome: "840000", eligibleAnnualDeductions: "0", periodsElapsed: 8, periodsInTaxYear: 12, currentNonPeriodicPayments: "0", priorBonusPaidTaxYearToDate: "0", priorEmployerIncome: "0", priorEmployerPaye: "0", rules: { version: "must-not-run", annualizationPeriods: 12, roundingScale: 2, bands: [] } }, ...overrides });
const bind = (value: Candidate2026_6Manifest) => deriveFrozenNg2026_6Binding(value);

describe("NG-CANDIDATE-2026.6 canonical employment-income binding", () => {
  it("is immutable, not certified, and restricted to Salary plus Bonus", () => {
    expect([NG_2026_6_VERSION, NG_2026_6_STATUS, NG_2026_6_ACTIVE_EARNINGS]).toEqual(["NG-CANDIDATE-2026.6", "NOT_CERTIFIED", ["SALARY", "BONUS"]]);
    expect(() => assertNg2026_6AuthoritativeUseAllowed()).toThrow("NG-CANDIDATE-2026.6_NOT_CERTIFIED");
    expect(() => bind(manifest({ earnings: [...manifest().earnings, { code: "ALLOWANCE", sourceType: "PAYROLL", sourceId: "a", fixedAmount: "1", taxableBaseCode: "EMPLOYMENT", ruleVersionReference: "v1" }] }))).toThrow("UNSUPPORTED_ORDINARY_EARNING");
  });

  it("binds the exact 70k standard exemption to the same frozen facts", () => {
    const binding = bind(manifest());
    expect(binding.currentPeriod).toEqual({ salary: "70000.00", bonus: "0.00", taxableEmploymentEarnings: "70000.00" });
    expect(binding.annualization.expectedAnnualSalary).toBe("840000.00");
    expect(binding.decision.classification).toBe("MINIMUM_WAGE_EXEMPT");
    const result = calculateFrozenPayroll2026_6(manifest(), "snapshot-standard");
    expect(result.paye.currentPaye.toFixed(2)).toBe("0.00");
    expect(result.paye.employmentIncomeBindingHash).toBe(binding.employmentIncomeBindingHash);
  });

  it("rejects mismatched evidence Salary and governed annual Salary", () => {
    expect(() => bind(manifest({ earnings: [{ ...manifest().earnings[0], fixedAmount: "80000" }] }))).toThrow("PAYROLL_INCOME_BINDING_MISMATCH");
    expect(() => bind(manifest({ paye: { ...manifest().paye, expectedAnnualEmploymentIncome: "1200000" } }))).toThrow("ANNUAL_SALARY_BINDING_MISMATCH");
  });

  it("rejects Bonus mismatches across earnings, evidence, and PAYE", () => {
    const bonusLine = { code: "BONUS", sourceType: "UNIT8" as const, sourceId: "bonus-1", fixedAmount: "100000", taxableBaseCode: "EMPLOYMENT", ruleVersionReference: "bonus-v1" };
    expect(() => bind(manifest({ earnings: [...manifest().earnings, bonusLine] }))).toThrow("BONUS_INPUT_BINDING_MISMATCH");
    expect(() => bind(manifest({ incomeEvidence: evidence({ currentPeriodBonus: "100000" }), earnings: [...manifest().earnings, bonusLine], paye: { ...manifest().paye, currentNonPeriodicPayments: "0" } }))).toThrow("BONUS_INPUT_BINDING_MISMATCH");
    const bound = bind(manifest({ incomeEvidence: evidence({ currentPeriodBonus: "100000" }), earnings: [...manifest().earnings, bonusLine], paye: { ...manifest().paye, currentNonPeriodicPayments: "100000" } }));
    expect(bound.decision.classification).toBe("NORMAL_PAYE_REQUIRED");
  });

  it("does not restore the exemption after a prior Bonus in the tax year", () => {
    const value = bind(manifest({ authoritativeIncomeFacts: { ...manifest().authoritativeIncomeFacts, priorBonusPaidTaxYearToDate: "100000" }, paye: { ...manifest().paye, priorBonusPaidTaxYearToDate: "100000" } }));
    expect(value.decision.classification).toBe("NORMAL_PAYE_REQUIRED");
  });

  it("binds YTD amounts and rejects caller divergence", () => {
    expect(() => bind(manifest({ paye: { ...manifest().paye, priorYtdPaye: "1" } }))).toThrow("YTD_INPUT_BINDING_MISMATCH");
    expect(() => bind(manifest({ paye: { ...manifest().paye, priorBonusPaidTaxYearToDate: "1" } }))).toThrow("YTD_INPUT_BINDING_MISMATCH");
  });

  it("holds unknown or mismatched prior-employer evidence and the potential-exemption edge case", () => {
    expect(() => bind(manifest({ authoritativeIncomeFacts: { ...manifest().authoritativeIncomeFacts, priorEmployer: { state: "UNKNOWN", income: "0", paye: "0" } } }))).toThrow("PRIOR_EMPLOYER_INPUT_BINDING_MISMATCH");
    expect(() => bind(manifest({ authoritativeIncomeFacts: { ...manifest().authoritativeIncomeFacts, priorEmployer: { state: "VERIFIED", income: "500000", paye: "10000", evidenceReference: "prior-1", evidenceVersion: "v1" } }, paye: { ...manifest().paye, priorEmployerIncome: "500000", priorEmployerPaye: "10000" } }))).toThrow("PAYE_MINIMUM_WAGE_PRIOR_EMPLOYER_RULE_REQUIRED");
    expect(() => bind(manifest({ authoritativeIncomeFacts: { ...manifest().authoritativeIncomeFacts, priorEmployer: { state: "VERIFIED", income: "500000", paye: "10000", evidenceReference: "prior-1", evidenceVersion: "v1" } }, paye: { ...manifest().paye, priorEmployerIncome: "400000", priorEmployerPaye: "10000" } }))).toThrow("PRIOR_EMPLOYER_INPUT_BINDING_MISMATCH");
  });

  it("allows verified prior-employer facts through the ordinary PAYE path", () => {
    const value = calculateFrozenPayroll2026_6(manifest({ incomeEvidence: evidence({ monthlySalary: "100000" }), authoritativeIncomeFacts: { ...manifest().authoritativeIncomeFacts, governedMonthlySalary: "100000", expectedAnnualSalary: "1200000", priorEmployer: { state: "VERIFIED", income: "500000", paye: "10000", evidenceReference: "prior-1", evidenceVersion: "v1" } }, earnings: [{ ...manifest().earnings[0], fixedAmount: "100000" }], paye: { ...manifest().paye, expectedAnnualEmploymentIncome: "1200000", priorEmployerIncome: "500000", priorEmployerPaye: "10000" } }), "snapshot-normal");
    expect(value.minimumWageDecision.classification).toBe("NORMAL_PAYE_REQUIRED");
    expect(value.employmentIncomeBinding.priorEmployer.state).toBe("VERIFIED");
  });

  it("rejects stale full-binding and decision hashes independently", () => {
    expect(() => bind(manifest({ expectedEmploymentIncomeBindingHash: "stale" }))).toThrow("STALE_EMPLOYMENT_INCOME_BINDING");
    expect(() => bind(manifest({ expectedMinimumWageDecisionHash: "stale" }))).toThrow("STALE_MINIMUM_WAGE_DECISION");
  });

  it("replays the exact binding deterministically", () => {
    const first = calculateFrozenPayroll2026_6(manifest(), "same-snapshot"); const second = calculateFrozenPayroll2026_6(manifest(), "same-snapshot");
    expect(second.employmentIncomeBinding.employmentIncomeBindingHash).toBe(first.employmentIncomeBinding.employmentIncomeBindingHash);
    expect(second.minimumWageDecision.decisionHash).toBe(first.minimumWageDecision.decisionHash);
    expect(second.hash).toBe(first.hash); expect(second.manifest).toEqual(first.manifest);
  });

  it("uses fixed precision at the final PAYE stage", () => {
    const value = calculateFrozenPayroll2026_6(manifest({ incomeEvidence: evidence({ monthlySalary: "100000.01" }), authoritativeIncomeFacts: { ...manifest().authoritativeIncomeFacts, governedMonthlySalary: "100000.01", expectedAnnualSalary: "1200001.20" }, earnings: [{ ...manifest().earnings[0], fixedAmount: "100000.01" }], paye: { ...manifest().paye, expectedAnnualEmploymentIncome: "1200001.20", eligibleAnnualDeductions: "0.01" } }), "rounding");
    expect(value.paye.currentPaye.toFixed(2)).toBe("40000.12");
  });

  it("asserts complete numeric Bonus expected values", () => {
    const value = calculateFrozenPayroll2026_6(manifest({ incomeEvidence: evidence({ monthlySalary: "250000", currentPeriodBonus: "250000" }), authoritativeIncomeFacts: { governedMonthlySalary: "250000", expectedAnnualSalary: "3000000", priorBonusPaidTaxYearToDate: "150000", currentEmployerPayeDeducted: "180000", currentEmployerPayeRepaid: "0", priorEmployer: { state: "VERIFIED", income: "500000", paye: "30000", evidenceReference: "prior-1", evidenceVersion: "v1" } }, earnings: [{ ...manifest().earnings[0], fixedAmount: "250000" }, { code: "BONUS", sourceType: "UNIT8", sourceId: "bonus-1", fixedAmount: "250000", taxableBaseCode: "EMPLOYMENT", ruleVersionReference: "bonus-v1" }], paye: { ...manifest().paye, expectedAnnualEmploymentIncome: "3000000", eligibleAnnualDeductions: "100000", periodsElapsed: 8, currentNonPeriodicPayments: "250000", priorBonusPaidTaxYearToDate: "150000", priorYtdPaye: "180000", priorEmployerIncome: "500000", priorEmployerPaye: "30000" } }), "numeric-bonus");
    expect([value.employmentIncomeBinding.annualization.expectedAnnualSalary, value.employmentIncomeBinding.ytd.priorBonusPaidTaxYearToDate, value.employmentIncomeBinding.currentPeriod.bonus, value.paye.taxableIncome.toFixed(2), value.paye.cumulativeTarget.toFixed(2), value.paye.validPriorPaye.toFixed(2), value.paye.currentPaye.toFixed(2), value.paye.refundCandidate.toFixed(2), value.paye.refundExecution]).toEqual(["3000000.00", "150000.00", "250000.00", "3800000.00", "340000.00", "210000.00", "130000.00", "0.00", "NOT_APPLICABLE"]);
  });

  it("hashes every calculation-driving operand", () => {
    const base = deriveAndValidateNg2026_6IncomeBinding({ evidence: evidence(), actualSalary: "70000", actualBonus: "0", payeCurrentBonus: "0", payeExpectedAnnualSalary: "840000", payePriorBonusPaidTaxYearToDate: "0", payeCurrentEmployerPayeDeducted: "0", payeCurrentEmployerPayeRepaid: "0", payePriorEmployerIncome: "0", payePriorEmployerPaye: "0", periodsElapsed: 8, periodsInTaxYear: 12, eligibleAnnualDeductions: "0", authoritative: manifest().authoritativeIncomeFacts });
    const changed = deriveAndValidateNg2026_6IncomeBinding({ evidence: evidence(), actualSalary: "70000", actualBonus: "0", payeCurrentBonus: "0", payeExpectedAnnualSalary: "840000", payePriorBonusPaidTaxYearToDate: "0", payeCurrentEmployerPayeDeducted: "0", payeCurrentEmployerPayeRepaid: "0", payePriorEmployerIncome: "0", payePriorEmployerPaye: "0", periodsElapsed: 9, periodsInTaxYear: 12, eligibleAnnualDeductions: "0", authoritative: manifest().authoritativeIncomeFacts });
    expect(changed.employmentIncomeBindingHash).not.toBe(base.employmentIncomeBindingHash);
  });

  it("binds partition approval to the complete income binding", () => {
    const binding = bind(manifest());
    const eligibility = complianceEligibility({ rta: "LAGOS", earnings: [{ type: "SALARY", amount: "70000" }], pensionOperationalState: "CONFIGURED", candidateVersion: NG_2026_6_VERSION, minimumWageDecision: binding.decision });
    const first = partitionPayrollPopulation([{ employeeId: "employee-1", eligibility, minimumWageDecisionHash: binding.decision.decisionHash, employmentIncomeBindingHash: binding.employmentIncomeBindingHash }]);
    const stale = partitionPayrollPopulation([{ employeeId: "employee-1", eligibility, minimumWageDecisionHash: binding.decision.decisionHash, employmentIncomeBindingHash: "changed" }]);
    expect(first.employmentIncomeBindingHashes).toEqual([{ employeeId: "employee-1", bindingHash: binding.employmentIncomeBindingHash }]);
    expect(stale.partitionHash).not.toBe(first.partitionHash);
  });

  it("integrates binding through freeze, partition, calculation, and persistence services", () => {
    const service = fs.readFileSync(path.join(process.cwd(), "src/lib/hr/payroll/unit9-service.ts"), "utf8");
    for (const call of ["deriveFrozenNg2026_6Binding", "employmentIncomeBindingHash", "employmentIncomeBindingHashes", "STALE_EMPLOYMENT_INCOME_BINDING", "calculateFrozenPayroll2026_6"]) expect(service).toContain(call);
  });
});
