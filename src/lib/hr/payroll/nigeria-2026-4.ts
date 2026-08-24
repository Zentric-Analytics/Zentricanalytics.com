import { Prisma } from "@prisma/client";
import { payrollDigest, payrollMoney, roundPayroll, type Unit9Money } from "./unit9-domain";

export const NG_2026_4_VERSION = "NG-CANDIDATE-2026.4" as const;
export const NG_2026_4_STATUS = "NOT_CERTIFIED" as const;
export const NG_2026_4_ACTIVE_EARNINGS = ["SALARY", "BONUS"] as const;
export type Ng2026_4EarningType = typeof NG_2026_4_ACTIVE_EARNINGS[number];
export type Ng2026_4StoredEarningType = Ng2026_4EarningType | "COMPENSATION";
export const NG_2026_4_MINIMUM_WAGE_MONTHLY = "70000.00" as const;

const annualBands = [
  { lower: "0", upper: "800000", rate: "0" },
  { lower: "800000", upper: "3000000", rate: "15" },
  { lower: "3000000", upper: "12000000", rate: "18" },
  { lower: "12000000", upper: "25000000", rate: "21" },
  { lower: "25000000", upper: "50000000", rate: "23" },
  { lower: "50000000", upper: null, rate: "25" },
] as const;

export function classifyNg2026_4Earning(type: string, mode: "NEW_INPUT" | "HISTORICAL_REPLAY" = "NEW_INPUT") {
  const normalized = type.trim().toUpperCase();
  if (normalized === "SALARY") return { type: "SALARY" as const, classification: "RECURRING" as const, deprecated: false };
  if (normalized === "BONUS") return { type: "BONUS" as const, classification: "NON_PERIODIC" as const, deprecated: false };
  if (normalized === "COMPENSATION" && mode === "HISTORICAL_REPLAY") return { type: "COMPENSATION" as const, classification: "LEGACY_NON_PERIODIC" as const, deprecated: true };
  if (normalized === "COMPENSATION") throw new Error("LEGACY_COMPENSATION_CLASSIFICATION_REQUIRED");
  throw new Error("UNSUPPORTED_PAYROLL_EARNING_TYPE");
}

export function reclassifyLegacyDraft(input: { originalType: string; replacementType?: string; reason?: string; priorSnapshotHash: string }) {
  if (input.originalType.trim().toUpperCase() !== "COMPENSATION") throw new Error("LEGACY_COMPENSATION_INPUT_REQUIRED");
  if (!input.replacementType || !input.reason?.trim()) throw new Error("LEGACY_COMPENSATION_CLASSIFICATION_REQUIRED");
  const replacement = classifyNg2026_4Earning(input.replacementType);
  const snapshot = { originalType: "COMPENSATION", replacementType: replacement.type, reason: input.reason.trim(), priorSnapshotHash: input.priorSnapshotHash };
  return { ...snapshot, newSnapshotHash: payrollDigest(snapshot) };
}

export function payrollEarningsFromAuthoritativeInputs(input: {
  salaryHandoff?: { id: string; status: "READY" | "CONSUMED"; effective: boolean; amount: Unit9Money };
  bonusAward?: { id: string; status: "DRAFT" | "APPROVED" | "EFFECTIVE"; effective: boolean; amount: Unit9Money };
  approvedSickLeaveDays?: Unit9Money;
}) {
  const earnings: Array<{ type: Ng2026_4EarningType; amount: Prisma.Decimal; sourceId: string }> = [];
  if (input.salaryHandoff?.effective && new Set(["READY", "CONSUMED"]).has(input.salaryHandoff.status)) earnings.push({ type: "SALARY", amount: roundPayroll(input.salaryHandoff.amount), sourceId: input.salaryHandoff.id });
  if (input.bonusAward?.effective && new Set(["APPROVED", "EFFECTIVE"]).has(input.bonusAward.status)) earnings.push({ type: "BONUS", amount: roundPayroll(input.bonusAward.amount), sourceId: input.bonusAward.id });
  return { earnings, sickLeaveEarningCount: 0 as const, digest: payrollDigest(earnings.map((earning) => ({ ...earning, amount: earning.amount.toFixed(2) }))) };
}

export type Ng2026_4MinimumWageInput = {
  monthlySalary: Unit9Money;
  bonusPaidInPeriod?: Unit9Money;
  materiallyVariableMonthlyWage?: boolean;
  ambiguousMultiEmployer?: boolean;
  unusualPartialYearArrangement?: boolean;
};

export function classifyNg2026_4MinimumWage(input: Ng2026_4MinimumWageInput) {
  if (input.materiallyVariableMonthlyWage || input.ambiguousMultiEmployer || input.unusualPartialYearArrangement) throw new Error("PAYE_MINIMUM_WAGE_RTA_RULE_REQUIRED");
  const salary = payrollMoney(input.monthlySalary);
  const bonus = payrollMoney(input.bonusPaidInPeriod ?? 0);
  const exempt = salary.lessThanOrEqualTo(NG_2026_4_MINIMUM_WAGE_MONTHLY) && bonus.isZero();
  return { classification: exempt ? "MINIMUM_WAGE_EXEMPT" as const : "NORMAL_PAYE_REQUIRED" as const, monthlySalary: roundPayroll(salary), bonus: roundPayroll(bonus), threshold: payrollMoney(NG_2026_4_MINIMUM_WAGE_MONTHLY) };
}

function annualTax(amount: Prisma.Decimal) {
  let total = new Prisma.Decimal(0);
  for (const band of annualBands) {
    const lower = payrollMoney(band.lower);
    const upper = band.upper === null ? amount : payrollMoney(band.upper);
    total = total.plus(Prisma.Decimal.max(0, Prisma.Decimal.min(amount, upper).minus(lower)).mul(band.rate).div(100));
  }
  return total;
}

export function calculateNg2026_4Paye(input: {
  expectedAnnualSalary: Unit9Money;
  bonusPaidTaxYearToDate: Unit9Money;
  currentBonus: Unit9Money;
  eligibleAnnualDeductions: Unit9Money;
  periodsElapsed: number;
  periodsInTaxYear: number;
  currentEmployerPayeDeducted: Unit9Money;
  currentEmployerPayeRepaid?: Unit9Money;
  priorEmployerIncome?: Unit9Money;
  priorEmployerPaye?: Unit9Money;
  priorEmployerEvidenceVerified?: boolean;
}) {
  if (!Number.isInteger(input.periodsElapsed) || input.periodsElapsed < 1 || input.periodsElapsed > input.periodsInTaxYear) throw new Error("PAYE_PERIOD_POSITION_REQUIRED");
  const salary = payrollMoney(input.expectedAnnualSalary);
  const bonuses = payrollMoney(input.bonusPaidTaxYearToDate).plus(input.currentBonus);
  const verifiedPriorIncome = input.priorEmployerEvidenceVerified ? payrollMoney(input.priorEmployerIncome ?? 0) : payrollMoney(0);
  const verifiedPriorPaye = input.priorEmployerEvidenceVerified ? payrollMoney(input.priorEmployerPaye ?? 0) : payrollMoney(0);
  const deductions = payrollMoney(input.eligibleAnnualDeductions);
  const annualTaxable = Prisma.Decimal.max(0, salary.plus(bonuses).plus(verifiedPriorIncome).minus(deductions));
  const salaryTaxable = Prisma.Decimal.max(0, salary.plus(verifiedPriorIncome).minus(deductions));
  const salaryTarget = annualTax(salaryTaxable).mul(input.periodsElapsed).div(input.periodsInTaxYear);
  const bonusIncrement = annualTax(annualTaxable).minus(annualTax(salaryTaxable));
  const cumulativeTarget = salaryTarget.plus(bonusIncrement);
  const validPriorPaye = payrollMoney(input.currentEmployerPayeDeducted).minus(input.currentEmployerPayeRepaid ?? 0).plus(verifiedPriorPaye);
  const unroundedCurrentPaye = cumulativeTarget.minus(validPriorPaye);
  const currentPaye = roundPayroll(unroundedCurrentPaye, 2);
  const refundCandidate = currentPaye.isNegative() ? currentPaye.abs() : payrollMoney(0);
  const output = {
    candidateVersion: NG_2026_4_VERSION,
    certificationStatus: NG_2026_4_STATUS,
    taxableIncome: roundPayroll(annualTaxable),
    cumulativeTarget: roundPayroll(cumulativeTarget),
    validPriorPaye: roundPayroll(validPriorPaye),
    currentPaye,
    treatment: currentPaye.isNegative() ? "PAYE_REFUND_CREDIT_CANDIDATE" as const : currentPaye.isZero() ? "ORDINARY_PAYE_ZERO" as const : "PAYE_DEDUCTION" as const,
    refundCandidate: roundPayroll(refundCandidate),
    refundExecution: currentPaye.isNegative() ? "COMPLIANCE_HOLD_RTA_REFUND_PROCEDURE_REQUIRED" as const : "NOT_APPLICABLE" as const,
    unverifiedPriorEmployerPayeIgnored: !input.priorEmployerEvidenceVerified && payrollMoney(input.priorEmployerPaye ?? 0).greaterThan(0),
  };
  return { ...output, hash: payrollDigest({ input, ...output, taxableIncome: output.taxableIncome.toFixed(2), cumulativeTarget: output.cumulativeTarget.toFixed(2), validPriorPaye: output.validPriorPaye.toFixed(2), currentPaye: currentPaye.toFixed(2), refundCandidate: output.refundCandidate.toFixed(2) }) };
}

export function assertNg2026_4AuthoritativeUseAllowed(): never { throw new Error("NG-CANDIDATE-2026.4_NOT_CERTIFIED"); }
