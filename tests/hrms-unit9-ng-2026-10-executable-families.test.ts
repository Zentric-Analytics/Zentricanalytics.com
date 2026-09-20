import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import * as candidate from "../src/lib/hr/payroll/nigeria-2026-10";

const ids = ["F01_ZERO_INCOME", "F02_MINIMUM_WAGE_BOUNDARY", "F03_BELOW_ABOVE_MINIMUM_WAGE", "F04_TAX_BAND_BOUNDARIES", "F05_JOINER_LEAVER", "F06_BONUS_CURRENT_PRIOR_YTD", "F07_OTHER_EMPLOYMENT_INCOME", "F08_PRIOR_EMPLOYER", "F09_RELIEFS", "F10_PENSION_POPULATION", "F11_LEAVE_SALARY_CHANGE", "F12_RETRO", "F13_NEGATIVE_CUMULATIVE", "F14_RTA_ROUTING", "F15_ROUNDING_DRIFT", "F16_CORRECTED_OUTPUTS", "F17_FAIL_CLOSED"];
type Input = { income: string; incomes: string[]; ruleId: string; ruleState: candidate.Ng2026_10DecisionState; cumulativeLiability: string; validPriorPaye: string; annualRent: string; months: number; headcount: number; covered: boolean; base: string; employeeRate: string; employerRate: string };
type Family = { id: string; input: Input; expected: Record<string, unknown> };
type Fixture = { candidateVersion: string; status: string; ownerReviewSha256: string; families: Family[] };
const fixture: Fixture = JSON.parse(fs.readFileSync("tests/fixtures/ng-candidate-2026-10-owner-remediation-families.json", "utf8"));
const rule: candidate.Ng2026_10Rule = { id: "owner-accepted-rule", version: 1, state: "OWNER_ACCEPTED_ENGINEERING", ownerReviewSha256: fixture.ownerReviewSha256, effectiveFrom: "2026-01-01", sourceReferences: ["Accepted owner review"] };
const accepted = { status: "SUPPORTED", classification: "ACCEPTED", reasonCode: "ENGINEERING_CALCULATION_ONLY" };

// This adapter executes candidate functions; it never reads expected values.
// Families without an implemented, evidence-backed adapter exercise the real
// COMPLIANCE_HOLD rule guard. They are not claimed as implemented calculations.
function execute({ id, input }: Family): Record<string, unknown> {
  if (id === ids[0]) {
    const result = candidate.calculateNg2026_10AnnualPaye(input.income, rule);
    return { ...accepted, rounded: result.annualLiability.toFixed(2), unrounded: result.unroundedAnnualLiability };
  }
  if (id === ids[3]) {
    const results = input.incomes.map(income => candidate.calculateNg2026_10AnnualPaye(income, rule));
    return { ...accepted, rounded: results.map(r => r.annualLiability.toFixed(2)), unrounded: results.map(r => r.unroundedAnnualLiability) };
  }
  if ([ids[5], ids[12], ids[14]].includes(id)) {
    const result = candidate.calculateNg2026_10CumulativePaye({ ...input, allocationRule: rule });
    const held = result.treatment === "COMPLIANCE_HOLD_REFUND_PROCEDURE_REQUIRED";
    return { status: held ? "COMPLIANCE_HOLD" : "SUPPORTED", classification: held ? "HELD" : "ACCEPTED", reasonCode: result.treatment, rounded: result.currentDeduction.toFixed(2), refund: result.refundCandidate.toFixed(2), unrounded: result.unroundedCurrent };
  }
  if (id === ids[8]) {
    const result = candidate.deriveNg2026_10Reliefs([{ id: "rent", type: "RENT", version: 1, amount: "0", actualAnnualRentPaid: input.annualRent, allocationMonths: input.months, actuallyPaid: true, remittanceVerified: true, evidenceHash: "a".repeat(64), taxYear: 2026, rule }], 2026);
    return { status: result.status, classification: result.status === "SUPPORTED" ? "ACCEPTED" : "HELD", reasonCode: result.holds[0]?.code ?? accepted.reasonCode, rounded: result.amount.toFixed(2), unrounded: result.unroundedAmount, accepted: result.claims.map(c => c.accepted), holds: result.holds };
  }
  if (id === ids[9]) {
    const result = candidate.deriveNg2026_10Pension({ employerHeadcount: input.headcount, employeeConfirmedCovered: input.covered, rsaAndPfaVerified: true, coveredMonthlyEmoluments: input.base, employeeRatePercent: input.employeeRate, employerRatePercent: input.employerRate, actualEmployeeContributionRemitted: true, rule });
    if (result.status !== "SUPPORTED") return { status: result.status, classification: "HELD", reasonCode: result.holdCode };
    return { ...accepted, covered: result.covered, rounded: result.employeeDeduction.toFixed(2), employer: result.employerContribution.toFixed(2), unrounded: result.unroundedEmployeeDeduction, unroundedEmployer: result.unroundedEmployerContribution };
  }
  if (id === ids[15]) {
    try { candidate.assertNg2026_10OfficialUseAllowed(); return accepted; }
    catch (error) { return { status: "COMPLIANCE_HOLD", classification: "REJECTED", reasonCode: (error as Error).message }; }
  }
  if ([ids[1], ids[2], ids[4], ids[6], ids[7], ids[10], ids[11], ids[13], ids[16]].includes(id)) {
    try {
      candidate.assertNg2026_10EngineeringRule({ ...rule, id: input.ruleId, state: input.ruleState });
      return accepted;
    } catch (error) { return { status: "COMPLIANCE_HOLD", classification: "HELD", reasonCode: (error as Error).message }; }
  }
  throw new Error("UNKNOWN_CERTIFICATION_FAMILY");
}

function checkAll(data: Fixture) {
  expect(data.candidateVersion).toBe(candidate.NG_2026_10_VERSION);
  expect(data.status).toBe("NOT_CERTIFIED");
  expect(data.ownerReviewSha256).toBe("9f1ae0b58d78b6814f6c05c21b2f3b85a6bd2b25d47087187d68a5daf558ed9a");
  expect(data.families.map(f => f.id).sort()).toEqual([...ids].sort());
  for (const family of data.families) expect(execute(family)).toEqual(family.expected);
}

describe("F01-F17 executable owner-remediation fixtures", () => {
  it("validates the complete fixture contract and all expected fields", () => checkAll(fixture));
  it.each(fixture.families)("$id executes its implementation or exact hold", family => expect(execute(family)).toEqual(family.expected));
  it.each(ids)("detects changed expected outcomes for %s", id => {
    const changed = structuredClone(fixture);
    changed.families.find(f => f.id === id)!.expected.reasonCode = "UNALIGNED_EXPECTATION";
    expect(() => checkAll(changed)).toThrow();
  });
  it.each(["removed", "duplicated", "unknown"])("rejects a %s family", mode => {
    const changed = structuredClone(fixture);
    if (mode === "removed") changed.families.pop();
    if (mode === "duplicated") changed.families.push(changed.families[0]);
    if (mode === "unknown") changed.families[0].id = "F99_UNKNOWN";
    expect(() => checkAll(changed)).toThrow();
  });
  it("detects a hold becoming supported", () => {
    const changed = structuredClone(fixture);
    changed.families[1].input.ruleState = "OWNER_ACCEPTED_ENGINEERING";
    expect(() => checkAll(changed)).toThrow();
  });
  it("detects the official-output guard becoming enabled", () => {
    const spy = vi.spyOn(candidate, "assertNg2026_10OfficialUseAllowed").mockImplementation(() => undefined as never);
    try { expect(() => checkAll(fixture)).toThrow(); } finally { spy.mockRestore(); }
  });
});
