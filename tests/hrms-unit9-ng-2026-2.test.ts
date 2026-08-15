import { describe, expect, it } from "vitest";
import { assertNg2026_2EarningMapped, calculateNg2026_2AnnualizedPaye, calculateNg2026_2RentRelief, NG_2026_2_STATUS } from "../src/lib/hr/payroll/nigeria-2026-2";

describe("NG-CANDIDATE-2026.2 remediation", () => {
  it.each([
    ["799999.99", "0.00"], ["800000.00", "0.00"], ["800000.01", "0.00"],
    ["2999999.99", "330000.00"], ["3000000.00", "330000.00"], ["3000000.01", "330000.00"],
    ["11999999.99", "1950000.00"], ["12000000.00", "1950000.00"], ["12000000.01", "1950000.00"],
    ["24999999.99", "4680000.00"], ["25000000.00", "4680000.00"], ["25000000.01", "4680000.00"],
    ["49999999.99", "10430000.00"], ["50000000.00", "10430000.00"], ["50000000.01", "10430000.00"],
  ])("uses independently specified annual band expectations at %s", (income, expected) => {
    const result = calculateNg2026_2AnnualizedPaye({ expectedAnnualEmploymentIncome: income, eligibleAnnualDeductions: "0", periodsElapsed: 12, periodsInTaxYear: 12, priorPayeDeducted: "0", priorPayeRepaid: "0" });
    expect(result.annualTax.toFixed(2)).toBe(expected);
    expect(result.certificationStatus).toBe(NG_2026_2_STATUS);
  });

  it("annualizes cumulative target and preserves a negative refund", () => {
    const result = calculateNg2026_2AnnualizedPaye({ expectedAnnualEmploymentIncome: "3000000", eligibleAnnualDeductions: "0", periodsElapsed: 6, periodsInTaxYear: 12, priorPayeDeducted: "200000", priorPayeRepaid: "0" });
    expect(result.cumulativeTarget.toFixed(2)).toBe("165000.00");
    expect(result.currentAdjustment.toFixed(2)).toBe("-35000.00");
    expect(result.currentTreatment).toBe("PAYE_REFUND_CREDIT");
  });

  it.each([["0","0.00"],["1000000","200000.00"],["2500000","500000.00"],["3000000","500000.00"]])("caps evidenced rent relief for %s", (rent, expected) => expect(calculateNg2026_2RentRelief(rent).toFixed(2)).toBe(expected));

  it("blocks unknown remuneration and unsourced exclusions", () => {
    expect(() => assertNg2026_2EarningMapped({ code: "UNKNOWN", employmentRemuneration: true })).toThrow("CERTIFICATION_BLOCKER");
    expect(() => assertNg2026_2EarningMapped({ code: "EXPENSE", employmentRemuneration: true, taxableClassification: "SOURCED_EXCLUSION" })).toThrow("sourced rule");
    expect(assertNg2026_2EarningMapped({ code: "BONUS", employmentRemuneration: true, taxableClassification: "INCLUDED" })).toBe("INCLUDED");
  });
});
