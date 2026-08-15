import { Prisma } from "@prisma/client";
import { payrollDigest, payrollMoney, roundPayroll, type Unit9Money } from "./unit9-domain";

export const NG_2026_2_VERSION = "NG-CANDIDATE-2026.2" as const;
export const NG_2026_2_STATUS = "NOT_CERTIFIED" as const;

export const NG_2026_2_ANNUAL_BANDS = [
  { lowerExclusive: "0", upperInclusive: "800000", ratePercent: "0" },
  { lowerExclusive: "800000", upperInclusive: "3000000", ratePercent: "15" },
  { lowerExclusive: "3000000", upperInclusive: "12000000", ratePercent: "18" },
  { lowerExclusive: "12000000", upperInclusive: "25000000", ratePercent: "21" },
  { lowerExclusive: "25000000", upperInclusive: "50000000", ratePercent: "23" },
  { lowerExclusive: "50000000", upperInclusive: null, ratePercent: "25" },
] as const;

export type AnnualizedPayeInput = {
  expectedAnnualEmploymentIncome: Unit9Money;
  eligibleAnnualDeductions: Unit9Money;
  periodsElapsed: number;
  periodsInTaxYear: number;
  priorPayeDeducted: Unit9Money;
  priorPayeRepaid: Unit9Money;
};

export function calculateNg2026_2AnnualizedPaye(input: AnnualizedPayeInput) {
  if (!Number.isInteger(input.periodsElapsed) || !Number.isInteger(input.periodsInTaxYear) || input.periodsElapsed < 1 || input.periodsElapsed > input.periodsInTaxYear) throw new Error("PAYE periods must identify a valid cumulative tax-year position.");
  const annualGross = payrollMoney(input.expectedAnnualEmploymentIncome);
  const deductions = payrollMoney(input.eligibleAnnualDeductions);
  if (annualGross.isNegative() || deductions.isNegative()) throw new Error("Annual employment income and eligible deductions cannot be negative.");
  const annualTaxable = Prisma.Decimal.max(0, annualGross.minus(deductions));
  let unroundedAnnualTax = new Prisma.Decimal(0);
  const trace = NG_2026_2_ANNUAL_BANDS.map((band) => {
    const lower = payrollMoney(band.lowerExclusive);
    const upper = band.upperInclusive == null ? annualTaxable : payrollMoney(band.upperInclusive);
    const taxable = Prisma.Decimal.max(0, Prisma.Decimal.min(annualTaxable, upper).minus(lower));
    const tax = taxable.mul(band.ratePercent).div(100);
    unroundedAnnualTax = unroundedAnnualTax.plus(tax);
    return { ...band, taxable: taxable.toFixed(4), unroundedTax: tax.toFixed(8) };
  });
  const annualTax = roundPayroll(unroundedAnnualTax, 2);
  const cumulativeTarget = roundPayroll(annualTax.mul(input.periodsElapsed).div(input.periodsInTaxYear), 2);
  const netPreviouslyApplied = payrollMoney(input.priorPayeDeducted).minus(payrollMoney(input.priorPayeRepaid));
  const currentAdjustment = roundPayroll(cumulativeTarget.minus(netPreviouslyApplied), 2);
  return {
    candidateVersion: NG_2026_2_VERSION,
    certificationStatus: NG_2026_2_STATUS,
    annualGross: roundPayroll(annualGross, 2), annualDeductions: roundPayroll(deductions, 2), annualTaxable: roundPayroll(annualTaxable, 2),
    annualTax, cumulativeTarget, currentAdjustment,
    currentTreatment: currentAdjustment.isNegative() ? "PAYE_REFUND_CREDIT" : "PAYE_DEDUCTION",
    ytdPayeDeducted: roundPayroll(input.priorPayeDeducted, 2), ytdPayeRepaid: roundPayroll(input.priorPayeRepaid, 2), trace,
    hash: payrollDigest({ candidateVersion: NG_2026_2_VERSION, input, annualTax: annualTax.toFixed(2), cumulativeTarget: cumulativeTarget.toFixed(2), currentAdjustment: currentAdjustment.toFixed(2) }),
  };
}

export function calculateNg2026_2RentRelief(annualRentAttributable: Unit9Money) {
  const rent = payrollMoney(annualRentAttributable);
  if (rent.isNegative()) throw new Error("Annual attributable rent cannot be negative.");
  return roundPayroll(Prisma.Decimal.min(rent.mul("0.20"), payrollMoney("500000")), 2);
}

export function assertNg2026_2EarningMapped(input: { code: string; employmentRemuneration: boolean; taxableClassification?: "INCLUDED" | "SOURCED_EXCLUSION"; sourceRuleId?: string }) {
  if (input.employmentRemuneration && !input.taxableClassification) throw new Error(`CERTIFICATION_BLOCKER: earning ${input.code} has no approved taxable-base classification.`);
  if (input.taxableClassification === "SOURCED_EXCLUSION" && !input.sourceRuleId) throw new Error(`CERTIFICATION_BLOCKER: earning ${input.code} exclusion lacks a sourced rule.`);
  return input.taxableClassification ?? "NOT_EMPLOYMENT_REMUNERATION";
}
