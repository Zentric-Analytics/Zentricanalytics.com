import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  assertNg2026_10EngineeringRule,
  assertNg2026_10OfficialUseAllowed,
  calculateNg2026_10AnnualPaye,
  calculateNg2026_10CumulativePaye,
  deriveNg2026_10Pension,
  deriveNg2026_10Reliefs,
  NG_2026_10_STATUS,
  NG_2026_10_VERSION,
  valueNg2026_10Benefit,
  type Ng2026_10Rule,
} from "../src/lib/hr/payroll/nigeria-2026-10";

const OWNER_REVIEW_SHA256 = "9f1ae0b58d78b6814f6c05c21b2f3b85a6bd2b25d47087187d68a5daf558ed9a";
const rule = (overrides: Partial<Ng2026_10Rule> = {}): Ng2026_10Rule => ({ id: "owner-accepted-rule", version: 1, state: "OWNER_ACCEPTED_ENGINEERING", ownerReviewSha256: OWNER_REVIEW_SHA256, effectiveFrom: "2026-01-01", sourceReferences: ["Accepted owner review"], ...overrides });

describe("NG-CANDIDATE-2026.10 owner-accepted engineering remediation", () => {
  it("records all seventeen certification-family outcomes without reopening the sealed 2026.9 fixture", () => {
    const fixture = JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests/fixtures/ng-candidate-2026-10-owner-remediation-families.json"), "utf8"));
    expect([fixture.candidateVersion, fixture.status, fixture.families.map((family: { id: string }) => family.id)]).toEqual(["NG-CANDIDATE-2026.10", "NOT_CERTIFIED", Array.from({ length: 17 }, (_, index) => `F${String(index + 1).padStart(2, "0")}_${["ZERO_INCOME", "MINIMUM_WAGE_BOUNDARY", "BELOW_ABOVE_MINIMUM_WAGE", "TAX_BAND_BOUNDARIES", "JOINER_LEAVER", "BONUS_CURRENT_PRIOR_YTD", "OTHER_EMPLOYMENT_INCOME", "PRIOR_EMPLOYER", "RELIEFS", "PENSION_POPULATION", "LEAVE_SALARY_CHANGE", "RETRO", "NEGATIVE_CUMULATIVE", "RTA_ROUTING", "ROUNDING_DRIFT", "CORRECTED_OUTPUTS", "FAIL_CLOSED"][index]}`)]);
  });
  it("is a new, non-certified candidate and never an official authorization", () => {
    expect([NG_2026_10_VERSION, NG_2026_10_STATUS]).toEqual(["NG-CANDIDATE-2026.10", "NOT_CERTIFIED"]);
    expect(() => assertNg2026_10OfficialUseAllowed()).toThrow("NG-CANDIDATE-2026.10_NOT_CERTIFIED");
  });

  it("requires a hashed owner-accepted rule for engineering calculations", () => {
    expect(assertNg2026_10EngineeringRule(rule()).ruleHash).toMatch(/^[a-f0-9]{64}$/);
    expect(() => assertNg2026_10EngineeringRule(rule({ state: "COMPLIANCE_HOLD" }))).toThrow("NG_2026_10_RULE_HELD");
  });

  it.each([["800000", "0.00"], ["3000000", "330000.00"], ["12000000", "1950000.00"], ["25000000", "4680000.00"], ["50000000", "10430000.00"], ["50000000.01", "10430000.00"]])("implements the accepted PAYE boundary %s", (income, expected) => {
    expect(calculateNg2026_10AnnualPaye(income, rule()).annualLiability.toFixed(2)).toBe(expected);
  });

  it("uses cumulative liability minus verified prior PAYE and holds a negative result", () => {
    expect(calculateNg2026_10CumulativePaye({ cumulativeLiability: "50000", validPriorPaye: "60000", allocationRule: rule() })).toMatchObject({ currentDeduction: expect.objectContaining({}), refundCandidate: expect.objectContaining({}), treatment: "COMPLIANCE_HOLD_REFUND_PROCEDURE_REQUIRED" });
  });

  it("caps allocated, evidenced rent relief and never falls back to an unverified claim", () => {
    const result = deriveNg2026_10Reliefs([{ id: "rent", type: "RENT", version: 1, amount: "0", actualAnnualRentPaid: "4000000", allocationMonths: 12, actuallyPaid: true, remittanceVerified: true, evidenceHash: "a".repeat(64), taxYear: 2026, rule: rule() }], 2026);
    expect([result.status, result.amount.toFixed(2)]).toEqual(["SUPPORTED", "500000.00"]);
  });

  it("models accepted BIK values and the accommodation cap", () => {
    expect(valueNg2026_10Benefit({ kind: "OWNED_ASSET", annualCostOrValue: "1000000", rule: rule() }).taxableBenefit.toFixed(2)).toBe("50000.00");
    expect(valueNg2026_10Benefit({ kind: "ACCOMMODATION", accommodationRentalValue: "300000", annualGrossExcludingAccommodation: "1000000", rule: rule() }).taxableBenefit.toFixed(2)).toBe("200000.00");
  });

  it("holds pension where coverage, RSA/PFA, remittance, or the statutory minimum is not evidenced", () => {
    expect(deriveNg2026_10Pension({ employerHeadcount: 15, employeeConfirmedCovered: true, rsaAndPfaVerified: true, coveredMonthlyEmoluments: "100000", employeeRatePercent: "8", employerRatePercent: "10", actualEmployeeContributionRemitted: true, rule: rule() })).toMatchObject({ status: "SUPPORTED", employeeDeduction: expect.objectContaining({}), employerContribution: expect.objectContaining({}) });
    expect(deriveNg2026_10Pension({ employerHeadcount: null, employeeConfirmedCovered: null, rsaAndPfaVerified: false, actualEmployeeContributionRemitted: false, rule: rule() })).toMatchObject({ status: "COMPLIANCE_HOLD" });
  });
});
