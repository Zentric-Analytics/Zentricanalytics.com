import { Prisma } from "@prisma/client";
import { payrollDigest, payrollMoney, roundPayroll, type Unit9Money } from "./unit9-domain";

/**
 * Engineering-only successor to the sealed 2026.9 candidate.  It models the
 * owner-accepted decisions without treating that acceptance as professional
 * certification or permission to mutate official payroll records.
 */
export const NG_2026_10_VERSION = "NG-CANDIDATE-2026.10" as const;
export const NG_2026_10_STATUS = "NOT_CERTIFIED" as const;

export type Ng2026_10DecisionState = "OWNER_ACCEPTED_ENGINEERING" | "COMPLIANCE_HOLD";
export type Ng2026_10Rule = {
  id: string;
  version: number;
  state: Ng2026_10DecisionState;
  ownerReviewSha256: string;
  effectiveFrom: string;
  sourceReferences: string[];
  note?: string;
};

const SHA256 = /^[a-f0-9]{64}$/;
const accepted = (rule: Ng2026_10Rule) => rule.state === "OWNER_ACCEPTED_ENGINEERING";

// External amounts still pass payrollMoney's four-decimal contract. Calculated
// decimals are not external inputs: retain their precision until this boundary.
function roundCalculated(value: Prisma.Decimal) {
  if (!value.isFinite()) throw new Error("NG_2026_10_NON_FINITE_CALCULATION");
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function assertNg2026_10EngineeringRule(rule: Ng2026_10Rule) {
  if (!rule.id.trim() || !Number.isInteger(rule.version) || rule.version < 1 || !SHA256.test(rule.ownerReviewSha256) || !rule.effectiveFrom || !rule.sourceReferences.length) {
    throw new Error("NG_2026_10_RULE_RECORD_INCOMPLETE");
  }
  if (!accepted(rule)) throw new Error(`NG_2026_10_RULE_HELD:${rule.id}`);
  return { ...rule, ruleHash: payrollDigest({ ...rule, sourceReferences: [...rule.sourceReferences].sort() }) };
}

export const NG_2026_10_PAYE_BANDS = [
  { ceiling: "800000", ratePercent: "0" },
  { ceiling: "3000000", ratePercent: "15" },
  { ceiling: "12000000", ratePercent: "18" },
  { ceiling: "25000000", ratePercent: "21" },
  { ceiling: "50000000", ratePercent: "23" },
  { ceiling: null, ratePercent: "25" },
] as const;

/** Calculates the engineering candidate's annual PAYE before final-output use. */
export function calculateNg2026_10AnnualPaye(taxableAnnualIncome: Unit9Money, rule: Ng2026_10Rule) {
  const validated = assertNg2026_10EngineeringRule(rule);
  const income = payrollMoney(taxableAnnualIncome, "taxable annual income");
  if (income.isNegative()) throw new Error("NG_2026_10_NEGATIVE_TAXABLE_INCOME");
  let lower = new Prisma.Decimal(0);
  let remaining = income;
  let liability = new Prisma.Decimal(0);
  const trace = NG_2026_10_PAYE_BANDS.map((band) => {
    const ceiling = band.ceiling === null ? null : new Prisma.Decimal(band.ceiling);
    const width = ceiling === null ? remaining : Prisma.Decimal.min(remaining, ceiling.minus(lower));
    const taxable = Prisma.Decimal.max(width, 0);
    const amount = taxable.mul(band.ratePercent).div(100);
    liability = liability.plus(amount);
    remaining = Prisma.Decimal.max(remaining.minus(taxable), 0);
    if (ceiling) lower = ceiling;
    return { ceiling: band.ceiling, ratePercent: band.ratePercent, taxable: taxable.toFixed(4), liability: amount.toFixed(4), unroundedLiability: amount.toString() };
  });
  return { candidateVersion: NG_2026_10_VERSION, annualTaxableIncome: income.toFixed(4), annualLiability: roundCalculated(liability), unroundedAnnualLiability: liability.toString(), trace, ruleHash: validated.ruleHash };
}

export type Ng2026_10ReliefType = "PENSION" | "NHF" | "NHIS" | "MORTGAGE_INTEREST" | "LIFE_ANNUITY" | "RENT";
const reliefTypes: readonly string[] = ["PENSION", "NHF", "NHIS", "MORTGAGE_INTEREST", "LIFE_ANNUITY", "RENT"];
export type Ng2026_10ReliefClaim = {
  id: string;
  type: Ng2026_10ReliefType;
  version: number;
  amount: Unit9Money;
  actualAnnualRentPaid?: Unit9Money;
  allocationMonths?: number;
  actuallyPaid: boolean;
  remittanceVerified: boolean;
  evidenceHash: string;
  taxYear: number;
  rule: Ng2026_10Rule;
};

export function deriveNg2026_10Reliefs(claims: Ng2026_10ReliefClaim[], taxYear: number) {
  const newest = new Map<Ng2026_10ReliefType, Ng2026_10ReliefClaim>();
  for (const claim of [...claims].sort((a, b) => b.version - a.version || a.id.localeCompare(b.id))) if (!newest.has(claim.type)) newest.set(claim.type, claim);
  const selected = [...newest.values()].sort((a, b) => a.type.localeCompare(b.type));
  const holds: Array<{ claimId: string; code: string }> = [];
  let total = new Prisma.Decimal(0);
  const acceptedClaims = selected.map((claim) => {
    let valid = claim.actuallyPaid && claim.remittanceVerified && SHA256.test(claim.evidenceHash) && claim.taxYear === taxYear;
    try { assertNg2026_10EngineeringRule(claim.rule); } catch { valid = false; }
    let amount = payrollMoney(claim.amount);
    let reasonCode = "COMPLIANCE_HOLD_RELIEF_EVIDENCE_OR_RULE_REQUIRED";
    if (!reliefTypes.includes(claim.type)) {
      valid = false;
      reasonCode = "COMPLIANCE_HOLD_UNSUPPORTED_RELIEF_TYPE";
    } else if (amount.isNegative()) {
      valid = false;
      reasonCode = "COMPLIANCE_HOLD_NEGATIVE_RELIEF";
    }
    if (claim.type === "RENT") {
      const rent = payrollMoney(claim.actualAnnualRentPaid ?? -1, "actual annual rent");
      const allocationMonths = claim.allocationMonths;
      if (!Number.isInteger(allocationMonths) || !allocationMonths || allocationMonths < 1 || allocationMonths > 12 || rent.isNegative()) valid = false;
      else if (!amount.isNegative()) amount = Prisma.Decimal.min(rent.mul(20).div(100).mul(allocationMonths).div(12), new Prisma.Decimal(500000));
    }
    if (!valid) holds.push({ claimId: claim.id, code: reasonCode });
    else total = total.plus(amount);
    return { id: claim.id, type: claim.type, amount: amount.toFixed(4), unroundedAmount: amount.toString(), accepted: valid };
  });
  return { status: holds.length ? "COMPLIANCE_HOLD" as const : "SUPPORTED" as const, amount: roundCalculated(total), unroundedAmount: total.toString(), claims: acceptedClaims, holds, aggregateHash: payrollDigest(acceptedClaims) };
}

export type Ng2026_10BenefitKind = "OWNED_ASSET" | "HIRED_ASSET" | "ACCOMMODATION" | "EXCLUDED_MEAL" | "EXCLUDED_UNIFORM" | "EXCLUDED_TOOL" | "EXCLUDED_RELOCATION";
export function valueNg2026_10Benefit(input: { kind: Ng2026_10BenefitKind; annualCostOrValue?: Unit9Money; annualHireCost?: Unit9Money; accommodationRentalValue?: Unit9Money; annualGrossExcludingAccommodation?: Unit9Money; rule: Ng2026_10Rule }) {
  const validated = assertNg2026_10EngineeringRule(input.rule);
  let taxable = new Prisma.Decimal(0);
  if (input.kind === "OWNED_ASSET") taxable = payrollMoney(input.annualCostOrValue ?? -1).mul(5).div(100);
  if (input.kind === "HIRED_ASSET") taxable = payrollMoney(input.annualHireCost ?? -1);
  if (input.kind === "ACCOMMODATION") taxable = Prisma.Decimal.min(payrollMoney(input.accommodationRentalValue ?? -1), payrollMoney(input.annualGrossExcludingAccommodation ?? -1).mul(20).div(100));
  if (taxable.isNegative()) throw new Error("NG_2026_10_BIK_EVIDENCE_REQUIRED");
  return { taxableBenefit: roundCalculated(taxable), unroundedTaxableBenefit: taxable.toString(), ruleHash: validated.ruleHash };
}

export type Ng2026_10PensionDecision = {
  employerHeadcount: number | null;
  employeeConfirmedCovered: boolean | null;
  rsaAndPfaVerified: boolean;
  coveredMonthlyEmoluments?: Unit9Money;
  employeeRatePercent?: Unit9Money;
  employerRatePercent?: Unit9Money;
  actualEmployeeContributionRemitted: boolean;
  rule: Ng2026_10Rule;
};

export function deriveNg2026_10Pension(input: Ng2026_10PensionDecision) {
  try { assertNg2026_10EngineeringRule(input.rule); } catch { return { status: "COMPLIANCE_HOLD" as const, holdCode: "COMPLIANCE_HOLD_PENSION_RULE_REQUIRED" }; }
  if (typeof input.employerHeadcount !== "number" || !Number.isSafeInteger(input.employerHeadcount) || input.employerHeadcount < 0) return { status: "COMPLIANCE_HOLD" as const, holdCode: "COMPLIANCE_HOLD_PENSION_HEADCOUNT_INVALID" };
  if (input.employerHeadcount === null || input.employeeConfirmedCovered === null || !input.rsaAndPfaVerified) return { status: "COMPLIANCE_HOLD" as const, holdCode: "COMPLIANCE_HOLD_PENSION_POPULATION_OR_RSA_REQUIRED" };
  if (input.employerHeadcount < 15 && !input.employeeConfirmedCovered) return { status: "SUPPORTED" as const, covered: false, employeeDeduction: roundPayroll(0), employerContribution: roundPayroll(0) };
  if (!input.employeeConfirmedCovered) return { status: "COMPLIANCE_HOLD" as const, holdCode: "COMPLIANCE_HOLD_PENSION_COVERAGE_REQUIRED" };
  const base = payrollMoney(input.coveredMonthlyEmoluments ?? -1);
  const employeeRate = payrollMoney(input.employeeRatePercent ?? -1);
  const employerRate = payrollMoney(input.employerRatePercent ?? -1);
  if (base.isNegative() || employeeRate.lt(8) || employerRate.lt(10) || !input.actualEmployeeContributionRemitted) return { status: "COMPLIANCE_HOLD" as const, holdCode: "COMPLIANCE_HOLD_PENSION_EVIDENCE_OR_MINIMUM_REQUIRED" };
  const employee = base.mul(employeeRate).div(100);
  const employer = base.mul(employerRate).div(100);
  return { status: "SUPPORTED" as const, covered: true, employeeDeduction: roundCalculated(employee), employerContribution: roundCalculated(employer), unroundedEmployeeDeduction: employee.toString(), unroundedEmployerContribution: employer.toString() };
}

export function calculateNg2026_10CumulativePaye(input: { cumulativeLiability: Unit9Money; validPriorPaye: Unit9Money; allocationRule: Ng2026_10Rule }) {
  assertNg2026_10EngineeringRule(input.allocationRule);
  const current = payrollMoney(input.cumulativeLiability).minus(payrollMoney(input.validPriorPaye));
  return current.isNegative()
    ? { currentDeduction: roundPayroll(0), refundCandidate: roundCalculated(current.abs()), unroundedCurrent: current.toString(), treatment: "COMPLIANCE_HOLD_REFUND_PROCEDURE_REQUIRED" as const }
    : { currentDeduction: roundCalculated(current), refundCandidate: roundPayroll(0), unroundedCurrent: current.toString(), treatment: "CURRENT_PAYE_DEDUCTION" as const };
}

export function assertNg2026_10OfficialUseAllowed(): never {
  throw new Error("NG-CANDIDATE-2026.10_NOT_CERTIFIED");
}
