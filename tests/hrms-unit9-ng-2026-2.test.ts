import { describe, expect, it } from "vitest";
import { annualEmployerReturnDueDate, assertNg2026_2EarningMapped, assertNg2026_2JoinerYtd, assertRtaConfiguration, assertStatutoryApplicability, calculateNg2026_2AnnualizedPaye, calculateNg2026_2Pension, calculateNg2026_2RentRelief, evaluateNg2026_2Relief, NG_2026_2_STATUS, payeRemittanceDueDate, pensionRemittanceDueDate, taxRetentionUntil, valueNg2026_2Bik } from "../src/lib/hr/payroll/nigeria-2026-2";

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

  it("values BIK separately and blocks unsourced treatment", () => {
    expect(valueNg2026_2Bik({ code: "CAR", method: "PERCENT_OF_ASSET_VALUE", assetValue: "1000000", ratePercent: "5", effectiveFrom: new Date("2026-01-01"), sourceRuleId: "NG-BIK-001" }).taxableValue.toFixed(2)).toBe("50000.00");
    expect(() => valueNg2026_2Bik({ code: "CAR", method: "FIXED", fixedValue: "1", effectiveFrom: new Date("2026-01-01") })).toThrow("CERTIFICATION_BLOCKER");
  });

  it("requires evidence and remittance before relief eligibility", () => {
    expect(() => evaluateNg2026_2Relief({ type: "PENSION", amount: "80000", taxYear: 2026, elected: true, evidenceReference: "e1", sourceRuleId: "NG-PEN", remittanceStatus: "DEDUCTED" })).toThrow("actual remittance");
    expect(evaluateNg2026_2Relief({ type: "PENSION", amount: "80000", taxYear: 2026, elected: true, evidenceReference: "e1", sourceRuleId: "NG-PEN", remittanceStatus: "ACKNOWLEDGED", ytdUsed: "10000" }).eligibleAmount.toFixed(2)).toBe("70000.00");
    expect(() => evaluateNg2026_2Relief({ type: "NHF", amount: "1", taxYear: 2026, elected: false })).toThrow("RELIEF_EVIDENCE_BLOCKER");
  });

  it("blocks incomplete joiner YTD and accepts evidenced continuity", () => {
    expect(() => assertNg2026_2JoinerYtd({ taxYear: 2026 })).toThrow("PRIOR_YTD_BLOCKER");
    expect(assertNg2026_2JoinerYtd({ taxYear: 2026, priorEmployer: "Prior", gross: "100", eligibleDeductions: "10", taxableIncome: "90", payeDeducted: "5", payeRepaid: "0", evidenceReference: "doc", handling: "EVIDENCED" }).taxableIncome.toFixed(2)).toBe("90.00");
  });

  it("uses BHT minimum pension basis and reviewed 8/10 or employer-all 20 rates", () => {
    const split = calculateNg2026_2Pension({ applicability: "COVERED", basic: "100000", housing: "20000", transport: "10000", contractualBasis: "120000" });
    expect([split.basis.toFixed(2), split.employee.toFixed(2), split.employer.toFixed(2)]).toEqual(["130000.00", "10400.00", "13000.00"]);
    expect(calculateNg2026_2Pension({ applicability: "COVERED", basic: "100000", housing: "20000", transport: "10000", employerPaysAll: true }).employer.toFixed(2)).toBe("26000.00");
    expect(() => calculateNg2026_2Pension({ applicability: "REVIEW_REQUIRED", basic: "1", housing: "0", transport: "0" })).toThrow("PENSION_APPLICABILITY_REVIEW_REQUIRED");
  });

  it("calculates candidate statutory due dates without external submission", () => {
    expect(pensionRemittanceDueDate(new Date("2026-08-14T00:00:00Z")).toISOString().slice(0,10)).toBe("2026-08-25");
    expect(payeRemittanceDueDate(2026, 12).toISOString().slice(0,10)).toBe("2027-01-10");
    expect(annualEmployerReturnDueDate(2026).toISOString().slice(0,10)).toBe("2027-01-31");
  });

  it("blocks unresolved schemes and missing State/FCT RTA routing", () => {
    expect(() => assertStatutoryApplicability({ NHF: "REVIEW_REQUIRED", NHIS: "OUT_OF_SCOPE", NSITF_ECA: "OUT_OF_SCOPE", ITF: "OUT_OF_SCOPE", GROUP_LIFE: "OUT_OF_SCOPE" })).toThrow("APPLICABILITY_REVIEW_REQUIRED");
    expect(() => assertRtaConfiguration({ stateOrFct: "Lagos" })).toThrow("RTA_CONFIGURATION_BLOCKER");
    expect(assertRtaConfiguration({ stateOrFct: "Lagos", rtaId: "LIRS", taxIdentifier: "redacted", adapterVersion: "test-v1", effectiveFrom: new Date("2026-01-01") })).toHaveLength(64);
  });

  it("retains tax evidence for at least six years after assessment and honors longer holds", () => {
    expect(taxRetentionUntil(2026).toISOString().slice(0,10)).toBe("2033-01-01");
    expect(taxRetentionUntil(2026, new Date("2035-06-01")).toISOString().slice(0,10)).toBe("2035-06-01");
  });
});
