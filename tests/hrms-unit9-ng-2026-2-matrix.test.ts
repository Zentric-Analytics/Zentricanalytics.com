import { describe, expect, it } from "vitest";
import {
  assertNg2026_2JoinerYtd,
  calculateNg2026_2AnnualizedPaye,
  calculateNg2026_2Overtime,
  calculateNg2026_2Pension,
  calculateNg2026_2Proration,
  evaluateNg2026_2Relief,
  pensionRemittanceDueDate,
} from "../src/lib/hr/payroll/nigeria-2026-2";

describe("NG-CANDIDATE-2026.2 independent matrix closure", () => {
  it.each([
    ["NHF", "10000", "10000.00"],
    ["NHIS", "12500", "12500.00"],
    ["MORTGAGE_INTEREST", "45000", "45000.00"],
    ["LIFE_ANNUITY", "90000", "90000.00"],
    ["RENT", "1000000", "200000.00"],
    ["RENT", "2500000", "500000.00"],
    ["RENT", "3000000", "500000.00"],
  ] as const)("applies independently specified %s relief for %s", (type, amount, expected) => {
    const result = evaluateNg2026_2Relief({ type, amount, taxYear: 2026, elected: true, evidenceReference: `evidence-${type}`, sourceRuleId: `rule-${type}`, remittanceStatus: "NOT_REQUIRED" });
    expect(result.eligibleAmount.toFixed(2)).toBe(expected);
  });

  it("requires remittance for pension relief and preserves YTD exhaustion", () => {
    expect(() => evaluateNg2026_2Relief({ type: "PENSION", amount: "80000", taxYear: 2026, elected: true, evidenceReference: "pension", sourceRuleId: "pra", remittanceStatus: "DEDUCTED" })).toThrow("actual remittance");
    expect(evaluateNg2026_2Relief({ type: "PENSION", amount: "80000", taxYear: 2026, elected: true, evidenceReference: "pension", sourceRuleId: "pra", remittanceStatus: "REMITTED", ytdUsed: "30000" }).eligibleAmount.toFixed(2)).toBe("50000.00");
    expect(evaluateNg2026_2Relief({ type: "PENSION", amount: "80000", taxYear: 2026, elected: true, evidenceReference: "pension", sourceRuleId: "pra", remittanceStatus: "ACKNOWLEDGED", ytdUsed: "80000" }).eligibleAmount.toFixed(2)).toBe("0.00");
  });

  it.each([
    ["COVERED", false, "130000.00", "10400.00", "13000.00"],
    ["COVERED", true, "130000.00", "0.00", "26000.00"],
    ["EXEMPT", false, "0.00", "0.00", "0.00"],
    ["VOLUNTARY_MICRO", false, "0.00", "0.00", "0.00"],
  ] as const)("calculates pension state %s employer-all=%s", (applicability, employerPaysAll, basis, employee, employer) => {
    const result = calculateNg2026_2Pension({ applicability, basic: "100000", housing: "20000", transport: "10000", employerPaysAll });
    expect([result.basis.toFixed(2), result.employee.toFixed(2), result.employer.toFixed(2)]).toEqual([basis, employee, employer]);
  });

  it("uses the higher contractual pension basis and blocks unresolved applicability", () => {
    const result = calculateNg2026_2Pension({ applicability: "COVERED", basic: "100000", housing: "20000", transport: "10000", contractualBasis: "200000" });
    expect([result.basis.toFixed(2), result.employee.toFixed(2), result.employer.toFixed(2)]).toEqual(["200000.00", "16000.00", "20000.00"]);
    expect(() => calculateNg2026_2Pension({ applicability: "REVIEW_REQUIRED", basic: "0", housing: "0", transport: "0" })).toThrow("PENSION_APPLICABILITY_REVIEW_REQUIRED");
  });

  it.each([
    ["2026-08-03", "2026-08-12"],
    ["2026-08-07", "2026-08-18"],
  ])("computes seven-working-day pension remittance from %s", (paid, expected) => {
    expect(pensionRemittanceDueDate(new Date(`${paid}T00:00:00.000Z`)).toISOString().slice(0, 10)).toBe(expected);
  });

  it("requires locked, approved, policy-backed overtime and keeps pension treatment explicit", () => {
    const included = calculateNg2026_2Overtime({ lockedTime: true, approved: true, hours: "10", hourlyRate: "2000", multiplier: "1.5", policyReference: "OT-2026", pensionBasisTreatment: "INCLUDED" });
    const excluded = calculateNg2026_2Overtime({ lockedTime: true, approved: true, hours: "10", hourlyRate: "2000", multiplier: "1.5", policyReference: "OT-2026", pensionBasisTreatment: "EXCLUDED" });
    expect([included.amount.toFixed(2), included.taxableEmploymentIncome.toFixed(2), included.pensionableAmount.toFixed(2)]).toEqual(["30000.00", "30000.00", "30000.00"]);
    expect(excluded.pensionableAmount.toFixed(2)).toBe("0.00");
    expect(() => calculateNg2026_2Overtime({ lockedTime: false, approved: true, hours: "1", hourlyRate: "1", multiplier: "1.5", policyReference: "OT", pensionBasisTreatment: "EXCLUDED" })).toThrow("OVERTIME_LOCKED_TIME_BLOCKER");
    expect(() => calculateNg2026_2Overtime({ lockedTime: true, approved: false, hours: "1", hourlyRate: "1", multiplier: "1.5", policyReference: "OT", pensionBasisTreatment: "EXCLUDED" })).toThrow("OVERTIME_APPROVAL_BLOCKER");
  });

  it("blocks missing joiner evidence and accepts governed no-prior-value handling", () => {
    expect(() => assertNg2026_2JoinerYtd({ taxYear: 2026, handling: "EVIDENCED" })).toThrow("PRIOR_YTD_BLOCKER");
    const approved = assertNg2026_2JoinerYtd({ taxYear: 2026, handling: "RTA_APPROVED_NO_PRIOR_VALUES", evidenceReference: "RTA-APPROVAL" });
    expect(approved.payeDeducted.toFixed(2)).toBe("0.00");
  });

  it("models a mid-period leaver without post-termination pay and an explicit final refund", () => {
    const finalSalary = calculateNg2026_2Proration({ mode: "CALENDAR_DAY", fullPeriodAmount: "310000", eligibleUnits: "15", denominatorUnits: "31", timezone: "Africa/Lagos", roundingScale: 2 });
    expect(finalSalary.amount.toFixed(2)).toBe("150000.00");
    const finalPaye = calculateNg2026_2AnnualizedPaye({ expectedAnnualEmploymentIncome: "3000000", eligibleAnnualDeductions: "0", periodsElapsed: 6, periodsInTaxYear: 12, priorPayeDeducted: "200000", priorPayeRepaid: "0" });
    expect([finalPaye.currentTreatment, finalPaye.currentAdjustment.toFixed(2)]).toEqual(["PAYE_REFUND_CREDIT", "-35000.00"]);
  });

  it("reconciles displayed band trace and deterministic retro debit/refund deltas", () => {
    const original = calculateNg2026_2AnnualizedPaye({ expectedAnnualEmploymentIncome: "3000000", eligibleAnnualDeductions: "0", periodsElapsed: 12, periodsInTaxYear: 12, priorPayeDeducted: "330000", priorPayeRepaid: "0" });
    const corrected = calculateNg2026_2AnnualizedPaye({ expectedAnnualEmploymentIncome: "3600000", eligibleAnnualDeductions: "0", periodsElapsed: 12, periodsInTaxYear: 12, priorPayeDeducted: "330000", priorPayeRepaid: "0" });
    const traceTax = corrected.trace.reduce((sum, band) => sum + Number(band.unroundedTax), 0);
    expect(traceTax.toFixed(2)).toBe(corrected.annualTax.toFixed(2));
    expect(corrected.annualTax.minus(original.annualTax).toFixed(2)).toBe("108000.00");
    expect(corrected.hash).toBe(calculateNg2026_2AnnualizedPaye({ expectedAnnualEmploymentIncome: "3600000", eligibleAnnualDeductions: "0", periodsElapsed: 12, periodsInTaxYear: 12, priorPayeDeducted: "330000", priorPayeRepaid: "0" }).hash);
  });
});
