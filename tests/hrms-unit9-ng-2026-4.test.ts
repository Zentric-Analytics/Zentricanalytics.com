import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  NG_2026_4_ACTIVE_EARNINGS, NG_2026_4_STATUS, NG_2026_4_VERSION,
  assertNg2026_4AuthoritativeUseAllowed, calculateNg2026_4Paye,
  classifyNg2026_4Earning, classifyNg2026_4MinimumWage,
  payrollEarningsFromAuthoritativeInputs, reclassifyLegacyDraft,
} from "../src/lib/hr/payroll/nigeria-2026-4";
import { calculateFrozenPayroll2026_4 } from "../src/lib/hr/payroll/unit9-engine-2026-4";

const fixturePath = path.join(process.cwd(), "tests/fixtures/ng-candidate-2026-4-expected-values.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const sha = (file: string) => crypto.createHash("sha256").update(fs.readFileSync(path.join(process.cwd(), file))).digest("hex");

describe("NG-CANDIDATE-2026.4 Salary and Bonus-only controls", () => {
  it("has immutable candidate identity, all required fixtures and remains fail-closed", () => {
    expect([NG_2026_4_VERSION, NG_2026_4_STATUS]).toEqual(["NG-CANDIDATE-2026.4", "NOT_CERTIFIED"]);
    expect(fixture.cases).toHaveLength(17);
    expect(fixture.ownerDecision).toBe("UNIT 9 ORDINARY EARNINGS = SALARY + BONUS ONLY");
    expect(() => assertNg2026_4AuthoritativeUseAllowed()).toThrow("NG-CANDIDATE-2026.4_NOT_CERTIFIED");
  });

  it("exposes only Salary and Bonus as active payroll earnings", () => {
    expect(NG_2026_4_ACTIVE_EARNINGS).toEqual(["SALARY", "BONUS"]);
    expect(classifyNg2026_4Earning("salary").classification).toBe("RECURRING");
    expect(classifyNg2026_4Earning("bonus").classification).toBe("NON_PERIODIC");
    for (const forbidden of ["COMPENSATION", "VARIABLE_COMPENSATION", "DISCRETIONARY_COMPENSATION", "SICK_LEAVE_PAY", "SICK_LEAVE", "OTHER"]) expect(() => classifyNg2026_4Earning(forbidden)).toThrow();
  });

  it("preserves legacy Compensation for replay but requires explicit draft reclassification", () => {
    expect(classifyNg2026_4Earning("COMPENSATION", "HISTORICAL_REPLAY")).toEqual({ type: "COMPENSATION", classification: "LEGACY_NON_PERIODIC", deprecated: true });
    expect(() => reclassifyLegacyDraft({ originalType: "COMPENSATION", priorSnapshotHash: "old" })).toThrow("LEGACY_COMPENSATION_CLASSIFICATION_REQUIRED");
    const first = reclassifyLegacyDraft({ originalType: "COMPENSATION", replacementType: "BONUS", reason: "Approved award classification", priorSnapshotHash: "old" });
    const replay = reclassifyLegacyDraft({ originalType: "COMPENSATION", replacementType: "BONUS", reason: "Approved award classification", priorSnapshotHash: "old" });
    expect(first).toEqual(replay);
    expect(first).toMatchObject({ originalType: "COMPENSATION", replacementType: "BONUS", priorSnapshotHash: "old" });
  });

  it("consumes only authoritative salary and approved effective bonus handoffs", () => {
    const approved = payrollEarningsFromAuthoritativeInputs({ salaryHandoff: { id: "salary-v1", status: "READY", effective: true, amount: "100000" }, bonusAward: { id: "bonus-v1", status: "APPROVED", effective: true, amount: "25000" } });
    expect(approved.earnings.map(({ type }) => type)).toEqual(["SALARY", "BONUS"]);
    const draft = payrollEarningsFromAuthoritativeInputs({ salaryHandoff: { id: "salary-v1", status: "READY", effective: true, amount: "100000" }, bonusAward: { id: "bonus-draft", status: "DRAFT", effective: true, amount: "25000" } });
    expect(draft.earnings.map(({ type }) => type)).toEqual(["SALARY"]);
  });

  it("never creates a sick-leave earning while preserving salary input", () => {
    const result = payrollEarningsFromAuthoritativeInputs({ salaryHandoff: { id: "salary-v1", status: "READY", effective: true, amount: "70000" }, approvedSickLeaveDays: "5" });
    expect(result.sickLeaveEarningCount).toBe(0);
    expect(result.earnings).toHaveLength(1);
    expect(result.earnings[0].type).toBe("SALARY");
  });

  it.each([["69999.99", "MINIMUM_WAGE_EXEMPT"], ["70000.00", "MINIMUM_WAGE_EXEMPT"], ["70000.01", "NORMAL_PAYE_REQUIRED"]])("classifies the standard monthly wage boundary %s", (salary, classification) => {
    expect(classifyNg2026_4MinimumWage({ monthlySalary: salary }).classification).toBe(classification);
  });

  it("does not misclassify a partial-year 80,000 salary from low received YTD", () => {
    expect(classifyNg2026_4MinimumWage({ monthlySalary: "80000" }).classification).toBe("NORMAL_PAYE_REQUIRED");
  });

  it("reassesses minimum-wage exemption when a bonus is paid", () => {
    expect(classifyNg2026_4MinimumWage({ monthlySalary: "70000", bonusPaidInPeriod: "1" }).classification).toBe("NORMAL_PAYE_REQUIRED");
  });

  it("holds unresolved variable, multi-employer and unusual partial-year comparisons", () => {
    expect(() => classifyNg2026_4MinimumWage({ monthlySalary: "70000", materiallyVariableMonthlyWage: true })).toThrow("PAYE_MINIMUM_WAGE_RTA_RULE_REQUIRED");
    expect(() => classifyNg2026_4MinimumWage({ monthlySalary: "70000", ambiguousMultiEmployer: true })).toThrow("PAYE_MINIMUM_WAGE_RTA_RULE_REQUIRED");
    expect(() => classifyNg2026_4MinimumWage({ monthlySalary: "70000", unusualPartialYearArrangement: true })).toThrow("PAYE_MINIMUM_WAGE_RTA_RULE_REQUIRED");
  });

  it("recognizes bonus in its payment period and recalculates cumulative PAYE", () => {
    const base = { expectedAnnualSalary: "3000000", bonusPaidTaxYearToDate: "0", eligibleAnnualDeductions: "0", periodsElapsed: 6, periodsInTaxYear: 12, currentEmployerPayeDeducted: "100000" };
    const withoutBonus = calculateNg2026_4Paye({ ...base, currentBonus: "0" });
    const withBonus = calculateNg2026_4Paye({ ...base, currentBonus: "500000" });
    expect(withBonus.cumulativeTarget.greaterThan(withoutBonus.cumulativeTarget)).toBe(true);
    expect(withBonus.currentPaye.toFixed(2)).toBe(withBonus.cumulativeTarget.minus(withBonus.validPriorPaye).toFixed(2));
  });

  it("uses verified prior-employer PAYE and ignores unverified credit", () => {
    const base = { expectedAnnualSalary: "3000000", bonusPaidTaxYearToDate: "0", currentBonus: "0", eligibleAnnualDeductions: "0", periodsElapsed: 12, periodsInTaxYear: 12, currentEmployerPayeDeducted: "0", priorEmployerIncome: "0", priorEmployerPaye: "50000" };
    const verified = calculateNg2026_4Paye({ ...base, priorEmployerEvidenceVerified: true });
    const unverified = calculateNg2026_4Paye({ ...base, priorEmployerEvidenceVerified: false });
    expect(verified.currentPaye.lessThan(unverified.currentPaye)).toBe(true);
    expect(unverified.unverifiedPriorEmployerPayeIgnored).toBe(true);
  });

  it("preserves negative PAYE as a held credit and never executes a refund", () => {
    const result = calculateNg2026_4Paye({ expectedAnnualSalary: "1000000", bonusPaidTaxYearToDate: "0", currentBonus: "0", eligibleAnnualDeductions: "0", periodsElapsed: 12, periodsInTaxYear: 12, currentEmployerPayeDeducted: "100000" });
    expect(result.currentPaye.isNegative()).toBe(true);
    expect(result.treatment).toBe("PAYE_REFUND_CREDIT_CANDIDATE");
    expect(result.refundExecution).toBe("COMPLIANCE_HOLD_RTA_REFUND_PROCEDURE_REQUIRED");
  });

  it("replays identical frozen inputs deterministically", () => {
    const input = { expectedAnnualSalary: "3000000", bonusPaidTaxYearToDate: "150000", currentBonus: "250000", eligibleAnnualDeductions: "100000", periodsElapsed: 8, periodsInTaxYear: 12, currentEmployerPayeDeducted: "180000", currentEmployerPayeRepaid: "0", priorEmployerIncome: "500000", priorEmployerPaye: "30000", priorEmployerEvidenceVerified: true };
    expect(calculateNg2026_4Paye(input).hash).toBe(calculateNg2026_4Paye(input).hash);
  });

  it("binds 2026.4 and Salary/Bonus-only semantics into the frozen engine manifest", () => {
    const manifest = { currency: "NGN", jurisdictionVersion: NG_2026_4_VERSION, engineVersion: "unit9-ng-2026.4", earnings: [{ code: "SALARY", sourceType: "UNIT8" as const, sourceId: "salary-handoff-v1", fixedAmount: "250000", taxableBaseCode: "EMPLOYMENT", ruleVersionReference: "salary-v1" }, { code: "BONUS", sourceType: "UNIT8" as const, sourceId: "bonus-award-v1", fixedAmount: "500000", taxableBaseCode: "EMPLOYMENT", ruleVersionReference: "bonus-v1" }], paye: { priorYtdTaxableIncome: "0", priorYtdPaye: "100000", priorPayeRepaid: "0", expectedAnnualEmploymentIncome: "3000000", eligibleAnnualDeductions: "0", periodsElapsed: 6, periodsInTaxYear: 12, currentNonPeriodicPayments: "500000", bonusPaidTaxYearToDate: "0", rules: { version: "must-not-run", annualizationPeriods: 12, roundingScale: 2, bands: [] } } };
    const first = calculateFrozenPayroll2026_4(manifest, "snapshot-v1");
    const replay = calculateFrozenPayroll2026_4(manifest, "snapshot-v1");
    expect(first.manifest.ruleVersions).toContain(NG_2026_4_VERSION);
    expect(first.earnings.map(({ code }) => code)).toEqual(["SALARY", "BONUS"]);
    expect(first.hash).toBe(replay.hash);
    expect(() => calculateFrozenPayroll2026_4({ ...manifest, earnings: [{ ...manifest.earnings[1], code: "COMPENSATION" }] }, "legacy-draft")).toThrow("LEGACY_COMPENSATION_CLASSIFICATION_REQUIRED");
  });

  it("does not mutate any 2026.1-2026.3 implementation or fixture bytes", () => {
    expect(sha("src/lib/hr/payroll/nigeria-2026-2.ts")).toBe("2bb4273852b4c5cb5685b57fb3852e95886ee3e91b6a18ba523afa8c3b8b8da5");
    expect(sha("tests/fixtures/ng-candidate-2026-2-expected-values.json")).toBe("bc7113ecd2057f70a1215f7b9c61af018c70dfbb155cfb6177d50916dc20af30");
    expect(sha("src/lib/hr/payroll/nigeria-2026-3.ts")).toBe("d2f82e2983dab31dc721d21a96baebc9669804fe5ad200259d24f4707f2ee46b");
    expect(sha("tests/fixtures/ng-candidate-2026-3-expected-values.json")).toBe("9cbca5487abffdff8ccb9a624f8f6c9e30c579629c258e0a928517ab40a86b0e");
  });

  it("makes 2026.4 the active limited-launch persistence boundary", () => {
    const limitedLaunch = fs.readFileSync(path.join(process.cwd(), "src/lib/hr/payroll/unit9-limited-launch.ts"), "utf8");
    const service = fs.readFileSync(path.join(process.cwd(), "src/lib/hr/payroll/unit9-service.ts"), "utf8");
    expect(limitedLaunch).toContain('export type EarningType = "SALARY" | "BONUS"');
    expect(limitedLaunch).not.toContain('"SALARY" | "COMPENSATION" | "BONUS"');
    expect(limitedLaunch).not.toContain('compensation: "BLOCKED_PENDING_RTA_AUTHORITY"');
    expect(service).toContain('candidateVersion: "NG-CANDIDATE-2026.4"');
  });

  it("runs the real PostgreSQL race against the 2026.4 refund-execution hold", () => {
    const harness = fs.readFileSync(path.join(process.cwd(), "scripts/hr-unit9-limited-launch-concurrency.mjs"), "utf8");
    expect(harness).toContain('candidateVersion: "NG-CANDIDATE-2026.4"');
    expect(harness).toContain('blockerCode: "RTA_REFUND_PROCEDURE_REQUIRED"');
    expect(harness).toContain('affectedInput: "PAYE_REFUND_CREDIT"');
    expect(harness).toContain("latestAttempt.attemptNumber + 1");
    expect(harness).toContain('purpose: "STAGING_CONCURRENCY_EVIDENCE"');
    expect(harness).not.toContain('candidateVersion: "NG-CANDIDATE-2026.3"');
  });
});
