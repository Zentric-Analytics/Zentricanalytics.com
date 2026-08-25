import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { complianceEligibility, partitionPayrollPopulation } from "../src/lib/hr/payroll/unit9-limited-launch";
import { calculateFrozenPayroll2026_5, type Candidate2026_5Manifest } from "../src/lib/hr/payroll/unit9-engine-2026-5";
import { assertNg2026_5AuthoritativeUseAllowed, decideNg2026_5MinimumWage, NG_2026_5_ACTIVE_EARNINGS, NG_2026_5_STATUS, NG_2026_5_VERSION, type Ng2026_5MinimumWageEvidence } from "../src/lib/hr/payroll/nigeria-2026-5";

const evidence = (overrides: Partial<Ng2026_5MinimumWageEvidence> = {}): Ng2026_5MinimumWageEvidence => ({ employeeId: "employee-1", workRelationshipId: "relationship-1", payrollPeriodId: "2026-08", rta: "LAGOS", candidateVersion: NG_2026_5_VERSION, monthlySalary: "70000", currentPeriodBonus: "0", materiallyVariableMonthlyWage: "NO", ambiguousMultiEmployer: "NO", unusualPartialYearArrangement: "NO", otherTaxableEmploymentIncome: "VERIFIED_NONE", evidenceCompletenessCertified: true, evidenceReferences: ["certified-input:mw-1"], inputCertificationId: "cert-1", inputCertificationVersion: "v1", ...overrides });
const manifest = (minimumWageEvidence = evidence()): Candidate2026_5Manifest => {
  const decision = decideNg2026_5MinimumWage(minimumWageEvidence);
  return { employeeId: "employee-1", workRelationshipId: "relationship-1", payrollPeriodId: "2026-08", currency: "NGN", jurisdictionVersion: NG_2026_5_VERSION, engineVersion: "unit9-ng-2026.5", minimumWageEvidence, expectedMinimumWageDecisionHash: decision.decisionHash, earnings: [{ code: "SALARY", sourceType: "UNIT8", sourceId: "salary-1", fixedAmount: minimumWageEvidence.monthlySalary, taxableBaseCode: "EMPLOYMENT", ruleVersionReference: "salary-v1" }, ...(Number(minimumWageEvidence.currentPeriodBonus) ? [{ code: "BONUS", sourceType: "UNIT8" as const, sourceId: "bonus-1", fixedAmount: minimumWageEvidence.currentPeriodBonus, taxableBaseCode: "EMPLOYMENT", ruleVersionReference: "bonus-v1" }] : [])], paye: { priorYtdTaxableIncome: "0", priorYtdPaye: "0", expectedAnnualEmploymentIncome: String(Number(minimumWageEvidence.monthlySalary) * 12), eligibleAnnualDeductions: "0", periodsElapsed: 12, periodsInTaxYear: 12, currentNonPeriodicPayments: minimumWageEvidence.currentPeriodBonus, bonusPaidTaxYearToDate: "0", rules: { version: "must-not-run", annualizationPeriods: 12, roundingScale: 2, bands: [] } } };
};

describe("NG-CANDIDATE-2026.5 governed minimum-wage runtime", () => {
  it("is a new immutable, not-certified Salary and Bonus candidate", () => {
    const fixture = JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests/fixtures/ng-candidate-2026-5-expected-values.json"), "utf8"));
    expect([NG_2026_5_VERSION, NG_2026_5_STATUS, NG_2026_5_ACTIVE_EARNINGS]).toEqual(["NG-CANDIDATE-2026.5", "NOT_CERTIFIED", ["SALARY", "BONUS"]]);
    expect(fixture.cases).toHaveLength(20);
    expect(() => assertNg2026_5AuthoritativeUseAllowed()).toThrow("NG-CANDIDATE-2026.5_NOT_CERTIFIED");
  });

  it.each([["69999.99", "MINIMUM_WAGE_EXEMPT"], ["70000", "MINIMUM_WAGE_EXEMPT"], ["70000.01", "NORMAL_PAYE_REQUIRED"], ["80000", "NORMAL_PAYE_REQUIRED"]])("governs the standard boundary %s", (monthlySalary, classification) => {
    expect(decideNg2026_5MinimumWage(evidence({ monthlySalary })).classification).toBe(classification);
  });

  it("holds allowance/BIK presence and unknown completeness instead of treating absence as false", () => {
    for (const otherTaxableEmploymentIncome of ["PRESENT", "UNKNOWN"] as const) {
      const decision = decideNg2026_5MinimumWage(evidence({ otherTaxableEmploymentIncome }));
      expect(decision.status).toBe("COMPLIANCE_HOLD");
      expect(decision.classification).toBeNull();
    }
    expect(decideNg2026_5MinimumWage(evidence({ otherTaxableEmploymentIncome: "PRESENT" })).blockerCodes).toContain("OTHER_TAXABLE_EMPLOYMENT_INCOME_UNSUPPORTED");
    expect(decideNg2026_5MinimumWage(evidence({ otherTaxableEmploymentIncome: "UNKNOWN" })).blockerCodes).toContain("EMPLOYMENT_GROSS_INCOME_EVIDENCE_INCOMPLETE");
  });

  it.each(["materiallyVariableMonthlyWage", "ambiguousMultiEmployer", "unusualPartialYearArrangement"] as const)("holds YES and UNKNOWN for %s", (field) => {
    expect(decideNg2026_5MinimumWage(evidence({ [field]: "YES" })).blockerCodes).toContain("PAYE_MINIMUM_WAGE_RTA_RULE_REQUIRED");
    expect(decideNg2026_5MinimumWage(evidence({ [field]: "UNKNOWN" })).blockerCodes).toContain("EMPLOYMENT_GROSS_INCOME_EVIDENCE_INCOMPLETE");
  });

  it("routes an exempt employee through explicit exempt PAYE and freezes the decision", () => {
    const value = calculateFrozenPayroll2026_5(manifest(), "snapshot-1");
    expect(value.minimumWageDecision.classification).toBe("MINIMUM_WAGE_EXEMPT");
    expect(value.paye.currentPaye.toFixed(2)).toBe("0.00");
    expect(value.paye.treatment).toBe("MINIMUM_WAGE_EXEMPT");
    expect(value.frozenManifest.payePath).toBe("MINIMUM_WAGE_EXEMPT");
    expect(value.frozenManifest.minimumWageDecision.decisionHash).toBe(manifest().expectedMinimumWageDecisionHash);
  });

  it("reassesses a supported bonus and uses normal cumulative PAYE", () => {
    const value = calculateFrozenPayroll2026_5(manifest(evidence({ currentPeriodBonus: "500000" })), "snapshot-bonus");
    expect(value.minimumWageDecision.classification).toBe("NORMAL_PAYE_REQUIRED");
    expect(value.paye.treatment).not.toBe("MINIMUM_WAGE_EXEMPT");
  });

  it("rejects held evidence before calculation and rejects stale hashes", () => {
    expect(() => calculateFrozenPayroll2026_5(manifest(evidence({ otherTaxableEmploymentIncome: "PRESENT" })), "snapshot-held")).toThrow("MINIMUM_WAGE_COMPLIANCE_HOLD");
    expect(() => calculateFrozenPayroll2026_5({ ...manifest(), expectedMinimumWageDecisionHash: "stale" }, "snapshot-stale")).toThrow("STALE_MINIMUM_WAGE_DECISION");
  });

  it("integrates the decision into eligibility and binds it into the partition hash", () => {
    const supported = decideNg2026_5MinimumWage(evidence());
    const ready = complianceEligibility({ rta: "LAGOS", earnings: [{ type: "SALARY", amount: "70000" }], pensionOperationalState: "CONFIGURED", candidateVersion: NG_2026_5_VERSION, minimumWageDecision: supported });
    expect(ready.status).toBe("READY");
    const first = partitionPayrollPopulation([{ employeeId: "employee-1", eligibility: ready, minimumWageDecisionHash: supported.decisionHash }]);
    const changed = partitionPayrollPopulation([{ employeeId: "employee-1", eligibility: ready, minimumWageDecisionHash: "changed" }]);
    expect(first.minimumWageDecisionHashes[0].decisionHash).toBe(supported.decisionHash);
    expect(first.partitionHash).not.toBe(changed.partitionHash);
  });

  it("holds a 2026.5 employee when governed minimum-wage evidence is absent", () => {
    const eligibility = complianceEligibility({ rta: "LAGOS", earnings: [{ type: "SALARY", amount: "70000" }], pensionOperationalState: "CONFIGURED", candidateVersion: NG_2026_5_VERSION });
    expect(eligibility.status).toBe("COMPLIANCE_HOLD");
    expect(eligibility.findings.map((finding) => finding.code)).toContain("EMPLOYMENT_GROSS_INCOME_EVIDENCE_INCOMPLETE");
  });

  it("has governed runtime call sites rather than a helper-only evaluator", () => {
    const engine = fs.readFileSync(path.join(process.cwd(), "src/lib/hr/payroll/unit9-engine-2026-5.ts"), "utf8");
    const service = fs.readFileSync(path.join(process.cwd(), "src/lib/hr/payroll/unit9-service.ts"), "utf8");
    expect(engine).toContain("assertNg2026_5Decision");
    expect(service).toContain("evaluateFrozenNg2026_5Eligibility");
    expect(service).toContain("calculateFrozenPayroll2026_5");
    const staging = fs.readFileSync(path.join(process.cwd(), "scripts/hr-unit9-ng-2026-5-staging.ts"), "utf8");
    expect(staging).toContain("calculateUnit9Run");
    expect(staging).toContain("OTHER_TAXABLE_EMPLOYMENT_INCOME_UNSUPPORTED");
    expect(staging).toContain("minimumWageDecisionHash");
  });
});
