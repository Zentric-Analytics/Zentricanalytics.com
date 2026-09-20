import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { calculateNg2026_10AnnualPaye, calculateNg2026_10CumulativePaye, deriveNg2026_10Reliefs, deriveNg2026_10Pension, type Ng2026_10Rule, type Ng2026_10ReliefType, type Ng2026_10PensionDecision } from "../src/lib/hr/payroll/nigeria-2026-10";

const rule: Ng2026_10Rule = { id: "owner-accepted-rule", version: 1, state: "OWNER_ACCEPTED_ENGINEERING", ownerReviewSha256: "9f1ae0b58d78b6814f6c05c21b2f3b85a6bd2b25d47087187d68a5daf558ed9a", effectiveFrom: "2026-01-01", sourceReferences: ["Accepted owner review"] };
const evidence = { id: "claim", version: 1, actuallyPaid: true, remittanceVerified: true, evidenceHash: "a".repeat(64), taxYear: 2026, rule };

describe("Independent review regressions", () => {
  it("rounds repeating internal rent relief only at the monetary output", () => {
    const result = deriveNg2026_10Reliefs([{ ...evidence, type: "RENT", amount: "0", actualAnnualRentPaid: "1000000", allocationMonths: 1 }], 2026);
    expect(result.amount.toFixed(2)).toBe("16666.67");
  });
  it("accepts valid four-decimal PAYE income without prematurely validating internal precision", () => {
    expect(calculateNg2026_10AnnualPaye("800000.0001", rule).annualLiability.toFixed(2)).toBe("0.00");
  });
  it("holds negative relief without aggregating it", () => {
    const result = deriveNg2026_10Reliefs([{ ...evidence, type: "PENSION", amount: "-100" }], 2026);
    expect(result.status).toBe("COMPLIANCE_HOLD");
    expect(result.holds).toEqual([{ claimId: "claim", code: "COMPLIANCE_HOLD_NEGATIVE_RELIEF" }]);
    expect(result.amount.toFixed(2)).toBe("0.00");
    expect(result.claims[0].accepted).toBe(false);
  });
  it("holds negative pension headcount instead of returning a supported exemption", () => {
    expect(deriveNg2026_10Pension({ employerHeadcount: -1, employeeConfirmedCovered: false, rsaAndPfaVerified: true, actualEmployeeContributionRemitted: false, rule })).toEqual({ status: "COMPLIANCE_HOLD", holdCode: "COMPLIANCE_HOLD_PENSION_HEADCOUNT_INVALID" });
  });
  it("requires executable inputs and structured expected outcomes for all seventeen families", () => {
    const fixture = JSON.parse(fs.readFileSync("tests/fixtures/ng-candidate-2026-10-owner-remediation-families.json", "utf8"));
    expect(fixture.families).toHaveLength(17);
    for (const family of fixture.families) {
      expect(family).toHaveProperty("input");
      expect(typeof family.expected).toBe("object");
      expect(family.expected).toHaveProperty("status");
      expect(family.expected).toHaveProperty("reasonCode");
      expect(family.expected).toHaveProperty("classification");
    }
  });
});

const reliefTypes: Ng2026_10ReliefType[] = ["PENSION", "NHF", "NHIS", "MORTGAGE_INTEREST", "LIFE_ANNUITY", "RENT"];
const pension = { employerHeadcount: 15, employeeConfirmedCovered: true, rsaAndPfaVerified: true, coveredMonthlyEmoluments: "100000", employeeRatePercent: "8", employerRatePercent: "10", actualEmployeeContributionRemitted: true, rule };

describe("Calculated decimal output boundaries", () => {
  it.each([[1, "16666.67"], [2, "33333.33"], [4, "66666.67"], [5, "83333.33"], [7, "116666.67"], [8, "133333.33"], [10, "166666.67"], [11, "183333.33"]] as const)("allocates %s months of rent", (months, expected) => {
    const claims = [{ ...evidence, type: "RENT" as const, amount: "0", actualAnnualRentPaid: "1000000", allocationMonths: months }];
    const result = deriveNg2026_10Reliefs(claims, 2026);
    expect(result.status).toBe("SUPPORTED");
    expect(result.amount.toFixed(2)).toBe(expected);
    expect(result.unroundedAmount).not.toBe(expected);
    expect(deriveNg2026_10Reliefs(claims, 2026)).toEqual(result);
  });
  it.each([["0.005", "0.01"], ["0.015", "0.02"], ["0.0049", "0.00"], ["0.0149", "0.01"]] as const)("rounds %s half-up once", (amount, expected) => {
    const result = calculateNg2026_10CumulativePaye({ cumulativeLiability: amount, validPriorPaye: "0", allocationRule: rule });
    expect(result.currentDeduction.toFixed(2)).toBe(expected);
    expect(result.unroundedCurrent).toBe(amount);
  });
  it("aggregates unrounded reliefs without per-claim drift", () => {
    const result = deriveNg2026_10Reliefs([{ ...evidence, type: "PENSION", amount: "0.005" }, { ...evidence, id: "nhf", type: "NHF", amount: "0.005" }], 2026);
    expect(result.amount.toFixed(2)).toBe("0.01");
    expect(result.claims.map(c => c.unroundedAmount)).toEqual(["0.005", "0.005"]);
  });
  it.each([
    ["799999.9999", "0"], ["800000.0001", "0.000015"],
    ["2999999.9999", "329999.999985"], ["3000000.0001", "330000.000018"],
    ["11999999.9999", "1949999.999982"], ["12000000.0001", "1950000.000021"],
    ["24999999.9999", "4679999.999979"], ["25000000.0001", "4680000.000023"],
    ["49999999.9999", "10429999.999977"], ["50000000.0001", "10430000.000025"],
  ])("preserves unrounded liability at %s", (income, expected) => {
    const result = calculateNg2026_10AnnualPaye(income, rule);
    expect(result.unroundedAnnualLiability).toBe(expected);
    expect(calculateNg2026_10AnnualPaye(income, rule)).toEqual(result);
  });
  it("does not round band liability before the final output", () => {
    const result = calculateNg2026_10AnnualPaye("800000.0333", rule);
    expect(result.unroundedAnnualLiability).toBe("0.004995");
    expect(result.trace[1].unroundedLiability).toBe("0.004995");
    expect(result.annualLiability.toFixed(2)).toBe("0.00");
  });
  it("handles large fixed-precision inputs without binary arithmetic", () => {
    expect(calculateNg2026_10AnnualPaye("999999999999.99", rule).annualLiability.toFixed(2)).toBe("249997930000.00");
  });
  it.each(["800000.00001", "1e6", "NaN", "Infinity", "", "1,000", "invalid", NaN, Infinity, -Infinity])("rejects malformed or overprecise external PAYE input %s", value => {
    expect(() => calculateNg2026_10AnnualPaye(value, rule)).toThrow();
  });
  it.each(["-0.01", "-100"])("rejects negative annual taxable income %s", value => {
    expect(() => calculateNg2026_10AnnualPaye(value, rule)).toThrow("NG_2026_10_NEGATIVE_TAXABLE_INCOME");
  });
  it.each(["0.00001", "NaN", "Infinity"])("rejects invalid external relief precision %s", amount => {
    expect(() => deriveNg2026_10Reliefs([{ ...evidence, type: "PENSION", amount }], 2026)).toThrow();
  });
});

describe("Relief evidence and sign validation", () => {
  it.each(reliefTypes.flatMap(type => ["-0.01", "-100"].map(amount => ({ type, amount }))))("holds $type $amount", ({ type, amount }) => {
    const result = deriveNg2026_10Reliefs([{ ...evidence, type, amount, actualAnnualRentPaid: "1000000", allocationMonths: 12 }], 2026);
    expect(result.status).toBe("COMPLIANCE_HOLD");
    expect(result.holds).toEqual([{ claimId: "claim", code: "COMPLIANCE_HOLD_NEGATIVE_RELIEF" }]);
    expect(result.amount.toFixed(2)).toBe("0.00");
    expect(result.claims[0]).toMatchObject({ accepted: false, unroundedAmount: amount });
  });
  it.each(reliefTypes.flatMap(type => ["0", "100"].map(amount => ({ type, amount }))))("accepts evidenced $type $amount", ({ type, amount }) => {
    const result = deriveNg2026_10Reliefs([{ ...evidence, type, amount, actualAnnualRentPaid: amount === "0" ? "0" : "500", allocationMonths: 12 }], 2026);
    expect(result.status).toBe("SUPPORTED");
    expect(result.amount.toFixed(2)).toBe(amount === "0" ? "0.00" : "100.00");
    expect(result.claims[0].accepted).toBe(true);
  });
  it("holds a mixed aggregate while retaining only the positive accepted amount", () => {
    const result = deriveNg2026_10Reliefs([{ ...evidence, type: "PENSION", amount: "-100" }, { ...evidence, id: "nhf", type: "NHF", amount: "50" }], 2026);
    expect(result.status).toBe("COMPLIANCE_HOLD");
    expect(result.amount.toFixed(2)).toBe("50.00");
    expect(result.holds).toEqual([{ claimId: "claim", code: "COMPLIANCE_HOLD_NEGATIVE_RELIEF" }]);
  });
  it("does not accept any negative type in a combined input", () => {
    const result = deriveNg2026_10Reliefs(reliefTypes.map(type => ({ ...evidence, id: type, type, amount: "-0.01", actualAnnualRentPaid: "1000", allocationMonths: 12 })), 2026);
    expect(result.status).toBe("COMPLIANCE_HOLD");
    expect(result.holds).toHaveLength(6);
    expect(result.claims.every(c => !c.accepted)).toBe(true);
    expect(result.amount.toFixed(2)).toBe("0.00");
  });
  it("holds unsupported relief types", () => {
    const result = deriveNg2026_10Reliefs([{ ...evidence, type: "UNSUPPORTED" as Ng2026_10ReliefType, amount: "100" }], 2026);
    expect(result.status).toBe("COMPLIANCE_HOLD");
    expect(result.holds[0].code).toBe("COMPLIANCE_HOLD_UNSUPPORTED_RELIEF_TYPE");
    expect(result.amount.toFixed(2)).toBe("0.00");
  });
  it.each(reliefTypes)("holds missing evidence for %s", type => {
    const result = deriveNg2026_10Reliefs([{ ...evidence, type, amount: "100", evidenceHash: "", actualAnnualRentPaid: "500", allocationMonths: 12 }], 2026);
    expect(result.status).toBe("COMPLIANCE_HOLD");
    expect(result.holds[0].code).toBe("COMPLIANCE_HOLD_RELIEF_EVIDENCE_OR_RULE_REQUIRED");
    expect(result.amount.toFixed(2)).toBe("0.00");
  });
});

describe("Pension headcount and population boundaries", () => {
  it.each([-1, -0.1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, "15", null, undefined])("holds invalid headcount %s before population logic", headcount => {
    for (const covered of [true, false]) {
      const result = deriveNg2026_10Pension({ ...pension, employerHeadcount: headcount as Ng2026_10PensionDecision["employerHeadcount"], employeeConfirmedCovered: covered });
      expect(result).toEqual({ status: "COMPLIANCE_HOLD", holdCode: "COMPLIANCE_HOLD_PENSION_HEADCOUNT_INVALID" });
      expect(result).not.toHaveProperty("employeeDeduction");
    }
  });
  it.each([0, 1, 2, 3, 14])("keeps explicitly uncovered below-threshold population at %s", employerHeadcount => {
    const result = deriveNg2026_10Pension({ ...pension, employerHeadcount, employeeConfirmedCovered: false });
    expect(result.status).toBe("SUPPORTED");
    if (result.status === "SUPPORTED") {
      expect(result.covered).toBe(false);
      expect(result.employeeDeduction.toFixed(2)).toBe("0.00");
    }
  });
  it.each([0, 1, 2, 3, 14, 15, 16])("honors explicit covered/voluntary population at %s", employerHeadcount => {
    const result = deriveNg2026_10Pension({ ...pension, employerHeadcount });
    expect(result.status).toBe("SUPPORTED");
    if (result.status === "SUPPORTED") {
      expect(result.covered).toBe(true);
      expect(result.employeeDeduction.toFixed(2)).toBe("8000.00");
      expect(result.employerContribution.toFixed(2)).toBe("10000.00");
    }
  });
  it.each([15, 16])("does not infer exempt coverage at %s", employerHeadcount => {
    expect(deriveNg2026_10Pension({ ...pension, employerHeadcount, employeeConfirmedCovered: false })).toEqual({ status: "COMPLIANCE_HOLD", holdCode: "COMPLIANCE_HOLD_PENSION_COVERAGE_REQUIRED" });
  });
  it("holds unresolved coverage", () => {
    expect(deriveNg2026_10Pension({ ...pension, employeeConfirmedCovered: null })).toEqual({ status: "COMPLIANCE_HOLD", holdCode: "COMPLIANCE_HOLD_PENSION_POPULATION_OR_RSA_REQUIRED" });
  });
  it.each([{ employeeRatePercent: "7.99" }, { employerRatePercent: "9.99" }, { actualEmployeeContributionRemitted: false }])("preserves minimum rates and evidence hold %j", overrides => {
    expect(deriveNg2026_10Pension({ ...pension, ...overrides })).toEqual({ status: "COMPLIANCE_HOLD", holdCode: "COMPLIANCE_HOLD_PENSION_EVIDENCE_OR_MINIMUM_REQUIRED" });
  });
});
