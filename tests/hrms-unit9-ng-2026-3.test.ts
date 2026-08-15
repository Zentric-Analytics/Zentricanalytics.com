import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  NG_2026_3_STATUS, NG_2026_3_VERSION, assertNg2026_3AuthoritativeUseAllowed, assertNg2026_3Fixture,
  calculateNg2026_3CurrentPaye, evaluateNg2026_3EmploymentMinimumWage, evaluateNg2026_3PayeMinimumWageExemption,
  selectNg2026_3RtaNonPeriodicRule, type Ng2026_3Fixture, type Ng2026_3RtaNonPeriodicRule,
} from "../src/lib/hr/payroll/nigeria-2026-3";
import { calculateFrozenPayroll } from "../src/lib/hr/payroll/unit9-engine";

const fixturePath = path.join(process.cwd(), "tests/fixtures/ng-candidate-2026-3-expected-values.json");
const fixturePackage = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as { candidateVersion: string; certificationStatus: string; fixtures: Ng2026_3Fixture[] };
const certifiedRule: Ng2026_3RtaNonPeriodicRule = { rtaId: "REVIEW-RTA", taxYear: 2026, paymentType: "BONUS", methodology: "ANNUAL_INCREMENTAL_TAX_DUE_IN_PAYMENT_PERIOD", effectiveFrom: new Date("2026-01-01"), sourceId: "NG3-SRC-JRB-2026", sourceSection: "ss.13.1-13.2 plus qualified RTA closure decision", ruleVersion: "review-only-v1", certificationState: "CERTIFIED" };

describe("NG-CANDIDATE-2026.3 Stage 1 remediation", () => {
  it("has independent immutable identity and remains fail-closed", () => {
    expect([NG_2026_3_VERSION, NG_2026_3_STATUS]).toEqual(["NG-CANDIDATE-2026.3", "NOT_CERTIFIED"]);
    expect(() => assertNg2026_3AuthoritativeUseAllowed()).toThrow("NG-CANDIDATE-2026.3_NOT_CERTIFIED");
    expect(fs.readFileSync(path.join(process.cwd(), "src/lib/hr/payroll/nigeria-2026-2.ts"), "utf8")).not.toContain("NG-CANDIDATE-2026.3");
  });

  it.each([["69999.99", true], ["70000.00", true], ["70000.01", false]])("evaluates monthly PAYE boundary %s independently", (gross, exempt) => {
    expect(evaluateNg2026_3PayeMinimumWageExemption({ payrollDate: new Date("2026-01-31"), method: "ACTUAL_MONTHLY_GROSS", actualMonthlyGross: gross, expectedAnnualGross: "0", sourceRuleId: "NG3-SRC-JRB-2026", rtaRuleVersion: "review-v1" }).exempt).toBe(exempt);
  });
  it.each([["839999.99", true], ["840000.00", true], ["840000.01", false]])("evaluates annual PAYE boundary %s independently", (gross, exempt) => {
    expect(evaluateNg2026_3PayeMinimumWageExemption({ payrollDate: new Date("2026-12-31"), method: "EXPECTED_ANNUAL_GROSS", actualMonthlyGross: "0", expectedAnnualGross: gross, sourceRuleId: "NG3-SRC-JRB-2026", rtaRuleVersion: "review-v1" }).exempt).toBe(exempt);
  });

  it.each([
    ["APPLICABLE", undefined, "70000", true, true], ["EXEMPT", "EMPLOYER_UNDER_25", "70000", null, true],
    ["APPLICABLE", undefined, "80000", true, false], ["EXEMPT", "PART_TIME", "80000", null, false],
  ] as const)("keeps employment applicability %s and PAYE exemption independent", (applicability, exemptionType, gross, compliance, payeExempt) => {
    const employment = evaluateNg2026_3EmploymentMinimumWage({ payrollDate: new Date("2026-01-31"), applicability, exemptionType, comparableMonthlyWage: gross, evidenceReference: "NG3-SRC-NMW-2019" });
    const paye = evaluateNg2026_3PayeMinimumWageExemption({ payrollDate: new Date("2026-01-31"), method: "ACTUAL_MONTHLY_GROSS", actualMonthlyGross: gross, expectedAnnualGross: "0", sourceRuleId: "NG3-SRC-JRB-2026", rtaRuleVersion: "review-v1" });
    expect([employment.compliant, paye.exempt]).toEqual([compliance, payeExempt]);
  });

  it("uses effective dates and never applies the 2024 wage version backwards", () => {
    expect(() => evaluateNg2026_3EmploymentMinimumWage({ payrollDate: new Date("2024-07-28"), applicability: "APPLICABLE", comparableMonthlyWage: "70000", evidenceReference: "law" })).toThrow("PRIOR_VERSION_REQUIRED");
    expect(evaluateNg2026_3EmploymentMinimumWage({ payrollDate: new Date("2024-07-29"), applicability: "APPLICABLE", comparableMonthlyWage: "70000", evidenceReference: "law" }).compliant).toBe(true);
  });

  it("fails closed on ambiguous joiner/partial-year and bonus threshold interpretation", () => {
    expect(() => evaluateNg2026_3PayeMinimumWageExemption({ payrollDate: new Date("2026-07-31"), method: "RTA_RULE_REQUIRED", actualMonthlyGross: "70000", expectedAnnualGross: "420000" })).toThrow("PAYE_MINIMUM_WAGE_RTA_RULE_REQUIRED");
  });

  it("selects exactly one certified effective RTA non-periodic rule", () => {
    expect(selectNg2026_3RtaNonPeriodicRule([certifiedRule], { rtaId: "REVIEW-RTA", taxYear: 2026, paymentType: "BONUS", paymentDate: new Date("2026-12-01") }).ruleVersion).toBe("review-only-v1");
    expect(() => selectNg2026_3RtaNonPeriodicRule([], { rtaId: "LIRS", taxYear: 2026, paymentType: "BONUS", paymentDate: new Date("2026-12-01") })).toThrow("RTA_NON_PERIODIC_RULE_REQUIRED");
    expect(() => selectNg2026_3RtaNonPeriodicRule([{ ...certifiedRule, certificationState: "NOT_CERTIFIED" }], { rtaId: "REVIEW-RTA", taxYear: 2026, paymentType: "BONUS", paymentDate: new Date("2026-12-01") })).toThrow("NOT_CERTIFIED");
  });

  it("validates every current-PAYE fixture as independently reproducible or explicitly blocked", () => {
    expect(fixturePackage.candidateVersion).toBe(NG_2026_3_VERSION);
    expect(fixturePackage.certificationStatus).toBe("NOT_CERTIFIED");
    expect(fixturePackage.fixtures.every(assertNg2026_3Fixture)).toBe(true);
    expect(() => assertNg2026_3Fixture({ ...fixturePackage.fixtures[0], sourceIds: [] })).toThrow("CURRENT_PAYE_FIXTURE_INCOMPLETE");
  });

  it.each(["PAYE-ONE-TIME-BONUS", "PAYE-ALLOWANCE-INCLUDED", "PAYE-BONUS-PLUS-BIK", "PAYE-RELIEF-INTRODUCED-300K", "PAYE-REFUND-35K"])("replays corrected fixture %s deterministically", (id) => {
    const f = fixturePackage.fixtures.find((fixture) => fixture.fixtureId === id)!;
    const run = () => calculateNg2026_3CurrentPaye({ expectedAnnualCashEmploymentIncome: f.expectedAnnualCashEmploymentIncome, currentPeriodRecurringEarnings: f.currentPeriodRecurringEarnings, currentNonPeriodicPayments: f.currentNonPeriodicPayments, bik: f.bik, eligibleAnnualDeductions: f.eligibleDeductionsReliefs, payrollPeriodNumber: f.payrollPeriodNumber, totalPeriodsInTaxYear: f.totalPeriodsInTaxYear, priorPayeDeducted: f.priorPayeDeducted, priorPayeRepaid: f.priorPayeRepaid, rtaNonPeriodicRule: Number(f.currentNonPeriodicPayments) > 0 ? certifiedRule : undefined });
    const first = run(); const second = run();
    expect([first.annualChargeableIncome.toFixed(2), first.annualPayeLiability.toFixed(2), first.incrementalAnnualTaxEffect.toFixed(2), first.cumulativeTarget.toFixed(2), first.currentPeriodPayeDebitOrRefund.toFixed(2)]).toEqual([f.annualChargeableIncome, f.annualPayeLiability, f.incrementalAnnualTaxEffect, f.cumulativeTargetAtPeriod, f.expectedCurrentPayeDebitOrRefund]);
    expect(first.hash).toBe(second.hash);
  });

  it("never spreads a non-periodic payment through the generic cumulative target", () => {
    const input = { expectedAnnualCashEmploymentIncome: "4000000", currentPeriodRecurringEarnings: "250000", currentNonPeriodicPayments: "1000000", bik: "0", eligibleAnnualDeductions: "0", payrollPeriodNumber: 6, totalPeriodsInTaxYear: 12, priorPayeDeducted: "165000", priorPayeRepaid: "0" };
    expect(() => calculateNg2026_3CurrentPaye(input)).toThrow("RTA_NON_PERIODIC_RULE_REQUIRED");
    expect(calculateNg2026_3CurrentPaye({ ...input, rtaNonPeriodicRule: certifiedRule }).currentPeriodPayeDebitOrRefund.toFixed(2)).toBe("180000.00");
  });

  it("binds the exact 2026.3 identity into frozen calculation manifests", () => {
    const result = calculateFrozenPayroll({ currency: "NGN", jurisdictionVersion: NG_2026_3_VERSION, engineVersion: "unit9-ng-2026.3", earnings: [{ code: "BASE", sourceType: "UNIT8", sourceId: "handoff", fixedAmount: "250000", taxableBaseCode: "EMPLOYMENT", ruleVersionReference: "comp-v1" }], paye: { priorYtdTaxableIncome: "0", priorYtdPaye: "302500", priorPayeRepaid: "0", expectedAnnualEmploymentIncome: "3000000", eligibleAnnualDeductions: "0", periodsElapsed: 12, periodsInTaxYear: 12, currentPeriodRecurringEarnings: "250000", currentNonPeriodicPayments: "0", bik: "0", rules: { version: "must-not-run", annualizationPeriods: 12, roundingScale: 2, bands: [] } } }, "snapshot");
    expect(result.manifest.jurisdictionVersion).toBe(NG_2026_3_VERSION);
    expect(result.paye.currentPaye.toFixed(2)).toBe("27500.00");
    expect(result.manifest.ruleVersions).toContain(NG_2026_3_VERSION);
  });
});
