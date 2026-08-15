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

export type BikInput = { code: string; method: "FIXED" | "PERCENT_OF_ASSET_VALUE"; fixedValue?: Unit9Money; assetValue?: Unit9Money; ratePercent?: Unit9Money; effectiveFrom: Date; effectiveTo?: Date; sourceRuleId?: string; sourcedExclusion?: boolean };
export function valueNg2026_2Bik(input: BikInput) {
  if (!input.sourceRuleId) throw new Error(`CERTIFICATION_BLOCKER: BIK ${input.code} lacks a sourced valuation rule.`);
  if (input.sourcedExclusion) return { code: input.code, taxableValue: roundPayroll(0), treatment: "SOURCED_EXCLUSION", sourceRuleId: input.sourceRuleId };
  const value = input.method === "FIXED" ? payrollMoney(input.fixedValue ?? "0") : payrollMoney(input.assetValue ?? "0").mul(payrollMoney(input.ratePercent ?? "0")).div(100);
  if (value.isNegative()) throw new Error("BIK taxable value cannot be negative.");
  return { code: input.code, taxableValue: roundPayroll(value, 2), treatment: "INCLUDED", sourceRuleId: input.sourceRuleId, hash: payrollDigest({ ...input, effectiveFrom: input.effectiveFrom.toISOString(), effectiveTo: input.effectiveTo?.toISOString() }) };
}

export type ReliefClaim = { type: "PENSION" | "NHF" | "NHIS" | "MORTGAGE_INTEREST" | "LIFE_ANNUITY" | "RENT"; amount: Unit9Money; taxYear: number; elected: boolean; evidenceReference?: string; sourceRuleId?: string; remittanceStatus?: "NOT_REQUIRED" | "CALCULATED" | "DEDUCTED" | "REMITTED" | "ACKNOWLEDGED"; ytdUsed?: Unit9Money };
export function evaluateNg2026_2Relief(claim: ReliefClaim) {
  if (!claim.elected || !claim.evidenceReference || !claim.sourceRuleId) throw new Error(`RELIEF_EVIDENCE_BLOCKER: ${claim.type} claim is not fully evidenced.`);
  if (claim.type === "PENSION" && !new Set(["REMITTED", "ACKNOWLEDGED"]).has(claim.remittanceStatus ?? "CALCULATED")) throw new Error("RELIEF_EVIDENCE_BLOCKER: pension relief requires actual remittance evidence.");
  const claimed = claim.type === "RENT" ? calculateNg2026_2RentRelief(claim.amount) : roundPayroll(claim.amount, 2);
  const available = Prisma.Decimal.max(0, claimed.minus(payrollMoney(claim.ytdUsed ?? "0")));
  return { ...claim, eligibleAmount: roundPayroll(available, 2), status: "ELIGIBLE_FOR_PAYE_RELIEF" as const };
}

export type PriorEmployerYtd = { taxYear: number; priorEmployer?: string; gross?: Unit9Money; eligibleDeductions?: Unit9Money; taxableIncome?: Unit9Money; payeDeducted?: Unit9Money; payeRepaid?: Unit9Money; evidenceReference?: string; handling?: "EVIDENCED" | "RTA_APPROVED_NO_PRIOR_VALUES" };
export function assertNg2026_2JoinerYtd(input: PriorEmployerYtd) {
  if (input.handling === "RTA_APPROVED_NO_PRIOR_VALUES" && input.evidenceReference) return { gross: payrollMoney(0), eligibleDeductions: payrollMoney(0), taxableIncome: payrollMoney(0), payeDeducted: payrollMoney(0), payeRepaid: payrollMoney(0), handling: input.handling };
  if (input.handling !== "EVIDENCED" || !input.priorEmployer || !input.evidenceReference || [input.gross, input.eligibleDeductions, input.taxableIncome, input.payeDeducted, input.payeRepaid].some((v) => v === undefined)) throw new Error("PRIOR_YTD_BLOCKER: required prior-employer tax-year evidence is incomplete.");
  return { gross: payrollMoney(input.gross!), eligibleDeductions: payrollMoney(input.eligibleDeductions!), taxableIncome: payrollMoney(input.taxableIncome!), payeDeducted: payrollMoney(input.payeDeducted!), payeRepaid: payrollMoney(input.payeRepaid!), handling: input.handling };
}

export type PensionApplicability = "COVERED" | "EXEMPT" | "VOLUNTARY_MICRO" | "REVIEW_REQUIRED";
export function calculateNg2026_2Pension(input: { applicability: PensionApplicability; basic: Unit9Money; housing: Unit9Money; transport: Unit9Money; contractualBasis?: Unit9Money; employerPaysAll?: boolean }) {
  if (input.applicability === "REVIEW_REQUIRED") throw new Error("PENSION_APPLICABILITY_REVIEW_REQUIRED");
  if (input.applicability !== "COVERED") return { basis: roundPayroll(0), employee: roundPayroll(0), employer: roundPayroll(0), applicability: input.applicability };
  const bht = payrollMoney(input.basic).plus(input.housing).plus(input.transport);
  const basis = Prisma.Decimal.max(bht, payrollMoney(input.contractualBasis ?? "0"));
  return input.employerPaysAll
    ? { basis: roundPayroll(basis), employee: roundPayroll(0), employer: roundPayroll(basis.mul("0.20")), applicability: input.applicability }
    : { basis: roundPayroll(basis), employee: roundPayroll(basis.mul("0.08")), employer: roundPayroll(basis.mul("0.10")), applicability: input.applicability };
}

export function addWorkingDays(date: Date, days: number) { const out = new Date(date); let added = 0; while (added < days) { out.setUTCDate(out.getUTCDate() + 1); const day = out.getUTCDay(); if (day !== 0 && day !== 6) added++; } return out; }
export function pensionRemittanceDueDate(paymentDate: Date) { return addWorkingDays(paymentDate, 7); }
export function payeRemittanceDueDate(year: number, monthOneBased: number) { return new Date(Date.UTC(monthOneBased === 12 ? year + 1 : year, monthOneBased % 12, 10)); }
export function annualEmployerReturnDueDate(taxYear: number) { return new Date(Date.UTC(taxYear + 1, 0, 31)); }

export type ApplicabilityState = "APPLICABLE_CONFIGURED" | "NOT_APPLICABLE" | "OUT_OF_SCOPE" | "REVIEW_REQUIRED";
export function assertStatutoryApplicability(schemes: Record<"NHF" | "NHIS" | "NSITF_ECA" | "ITF" | "GROUP_LIFE", ApplicabilityState>) {
  const unresolved = Object.entries(schemes).filter(([, state]) => state === "REVIEW_REQUIRED").map(([scheme]) => scheme);
  if (unresolved.length) throw new Error(`APPLICABILITY_REVIEW_REQUIRED: ${unresolved.join(", ")}`);
  return payrollDigest(schemes);
}

export function assertRtaConfiguration(input: { stateOrFct?: string; rtaId?: string; taxIdentifier?: string; adapterVersion?: string; effectiveFrom?: Date }) {
  if (!input.stateOrFct || !input.rtaId || !input.taxIdentifier || !input.adapterVersion || !input.effectiveFrom) throw new Error("RTA_CONFIGURATION_BLOCKER");
  return payrollDigest({ ...input, effectiveFrom: input.effectiveFrom.toISOString() });
}

export function taxRetentionUntil(yearOfAssessment: number, holdUntil?: Date) { const minimum = new Date(Date.UTC(yearOfAssessment + 7, 0, 1)); return holdUntil && holdUntil > minimum ? holdUntil : minimum; }
