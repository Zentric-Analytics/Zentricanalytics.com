import { Prisma } from "@prisma/client";
import { payrollDigest, payrollMoney, roundPayroll, type Unit9Money } from "./unit9-domain";

export const NG_2026_3_VERSION = "NG-CANDIDATE-2026.3" as const;
export const NG_2026_3_STATUS = "NOT_CERTIFIED" as const;
export const NG_2026_3_MINIMUM_WAGE_MONTHLY = "70000.00" as const;
export const NG_2026_3_MINIMUM_WAGE_ANNUAL = "840000.00" as const;
export const NG_2026_3_MINIMUM_WAGE_EFFECTIVE_FROM = new Date("2024-07-29T00:00:00.000Z");

export const NG_2026_3_ANNUAL_BANDS = [
  { lowerExclusive: "0", upperInclusive: "800000", ratePercent: "0" },
  { lowerExclusive: "800000", upperInclusive: "3000000", ratePercent: "15" },
  { lowerExclusive: "3000000", upperInclusive: "12000000", ratePercent: "18" },
  { lowerExclusive: "12000000", upperInclusive: "25000000", ratePercent: "21" },
  { lowerExclusive: "25000000", upperInclusive: "50000000", ratePercent: "23" },
  { lowerExclusive: "50000000", upperInclusive: null, ratePercent: "25" },
] as const;

export type EmploymentMinimumWageApplicability = "APPLICABLE" | "EXEMPT" | "REVIEW_REQUIRED";
export type EmploymentMinimumWageExemption = "PART_TIME" | "COMMISSION_OR_PIECE_RATE" | "EMPLOYER_UNDER_25" | "SEASONAL_AGRICULTURE" | "REGULATED_VESSEL_OR_AIRCRAFT" | "MINISTERIAL_GAZETTED_EXEMPTION";

export function evaluateNg2026_3EmploymentMinimumWage(input: {
  payrollDate: Date;
  applicability: EmploymentMinimumWageApplicability;
  comparableMonthlyWage: Unit9Money;
  exemptionType?: EmploymentMinimumWageExemption;
  evidenceReference?: string;
}) {
  if (input.payrollDate < NG_2026_3_MINIMUM_WAGE_EFFECTIVE_FROM) throw new Error("EMPLOYMENT_MINIMUM_WAGE_PRIOR_VERSION_REQUIRED");
  if (input.applicability === "REVIEW_REQUIRED") throw new Error("EMPLOYMENT_MINIMUM_WAGE_REVIEW_REQUIRED");
  if (!input.evidenceReference) throw new Error("EMPLOYMENT_MINIMUM_WAGE_EVIDENCE_REQUIRED");
  if (input.applicability === "EXEMPT") {
    if (!input.exemptionType) throw new Error("EMPLOYMENT_MINIMUM_WAGE_EXEMPTION_EVIDENCE_REQUIRED");
    return { candidateVersion: NG_2026_3_VERSION, applicability: "EXEMPT" as const, exemptionType: input.exemptionType, compliant: null, threshold: null, evidenceReference: input.evidenceReference };
  }
  if (input.exemptionType) throw new Error("EMPLOYMENT_MINIMUM_WAGE_CONFLICTING_APPLICABILITY");
  const actual = payrollMoney(input.comparableMonthlyWage);
  const threshold = payrollMoney(NG_2026_3_MINIMUM_WAGE_MONTHLY);
  return { candidateVersion: NG_2026_3_VERSION, applicability: "APPLICABLE" as const, exemptionType: null, compliant: actual.greaterThanOrEqualTo(threshold), threshold: roundPayroll(threshold), shortfall: roundPayroll(Prisma.Decimal.max(0, threshold.minus(actual))), evidenceReference: input.evidenceReference };
}

export type PayeMinimumWageComparisonMethod = "ACTUAL_MONTHLY_GROSS" | "EXPECTED_ANNUAL_GROSS" | "RTA_RULE_REQUIRED";
export function evaluateNg2026_3PayeMinimumWageExemption(input: {
  payrollDate: Date;
  method: PayeMinimumWageComparisonMethod;
  actualMonthlyGross: Unit9Money;
  expectedAnnualGross: Unit9Money;
  sourceRuleId?: string;
  rtaRuleVersion?: string;
}) {
  if (input.payrollDate < NG_2026_3_MINIMUM_WAGE_EFFECTIVE_FROM) throw new Error("PAYE_MINIMUM_WAGE_PRIOR_VERSION_REQUIRED");
  if (input.method === "RTA_RULE_REQUIRED" || !input.sourceRuleId || !input.rtaRuleVersion) throw new Error("PAYE_MINIMUM_WAGE_RTA_RULE_REQUIRED");
  const comparedGross = payrollMoney(input.method === "ACTUAL_MONTHLY_GROSS" ? input.actualMonthlyGross : input.expectedAnnualGross);
  const threshold = payrollMoney(input.method === "ACTUAL_MONTHLY_GROSS" ? NG_2026_3_MINIMUM_WAGE_MONTHLY : NG_2026_3_MINIMUM_WAGE_ANNUAL);
  const exempt = comparedGross.lessThanOrEqualTo(threshold);
  return { candidateVersion: NG_2026_3_VERSION, certificationStatus: NG_2026_3_STATUS, method: input.method, comparedGross: roundPayroll(comparedGross), threshold: roundPayroll(threshold), exempt, result: exempt ? "PAYE_MINIMUM_WAGE_EXEMPT" as const : "NORMAL_PAYE_REQUIRED" as const, sourceRuleId: input.sourceRuleId, rtaRuleVersion: input.rtaRuleVersion };
}

export type Ng2026_3RtaNonPeriodicRule = {
  rtaId: string;
  taxYear: number;
  paymentType: "BONUS" | "COMMISSION" | "OVERTIME" | "SEVERANCE" | "TEMPORARY_EMPLOYEE" | "OTHER";
  methodology: "ANNUAL_INCREMENTAL_TAX_DUE_IN_PAYMENT_PERIOD";
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  sourceId: string;
  sourceSection: string;
  ruleVersion: string;
  certificationState: "CERTIFIED" | "NOT_CERTIFIED";
};

export function selectNg2026_3RtaNonPeriodicRule(rules: Ng2026_3RtaNonPeriodicRule[], input: { rtaId: string; taxYear: number; paymentType: Ng2026_3RtaNonPeriodicRule["paymentType"]; paymentDate: Date }) {
  const matches = rules.filter((rule) => rule.rtaId === input.rtaId && rule.taxYear === input.taxYear && rule.paymentType === input.paymentType && rule.effectiveFrom <= input.paymentDate && (!rule.effectiveTo || rule.effectiveTo > input.paymentDate));
  if (matches.length !== 1) throw new Error(matches.length ? "RTA_NON_PERIODIC_RULE_OVERLAP" : "RTA_NON_PERIODIC_RULE_REQUIRED");
  if (matches[0].certificationState !== "CERTIFIED") throw new Error("RTA_NON_PERIODIC_RULE_NOT_CERTIFIED");
  return matches[0];
}

function annualTax(annualChargeableIncome: Unit9Money) {
  const taxable = payrollMoney(annualChargeableIncome);
  let total = new Prisma.Decimal(0);
  for (const band of NG_2026_3_ANNUAL_BANDS) {
    const lower = payrollMoney(band.lowerExclusive);
    const upper = band.upperInclusive == null ? taxable : payrollMoney(band.upperInclusive);
    total = total.plus(Prisma.Decimal.max(0, Prisma.Decimal.min(taxable, upper).minus(lower)).mul(band.ratePercent).div(100));
  }
  return roundPayroll(total, 2);
}

export type Ng2026_3CurrentPayeInput = {
  expectedAnnualCashEmploymentIncome: Unit9Money;
  currentPeriodRecurringEarnings: Unit9Money;
  currentNonPeriodicPayments: Unit9Money;
  bik: Unit9Money;
  eligibleAnnualDeductions: Unit9Money;
  payrollPeriodNumber: number;
  totalPeriodsInTaxYear: number;
  priorPayeDeducted: Unit9Money;
  priorPayeRepaid: Unit9Money;
  rtaNonPeriodicRule?: Ng2026_3RtaNonPeriodicRule;
};

export function calculateNg2026_3CurrentPaye(input: Ng2026_3CurrentPayeInput) {
  if (!Number.isInteger(input.payrollPeriodNumber) || input.payrollPeriodNumber < 1 || input.payrollPeriodNumber > input.totalPeriodsInTaxYear) throw new Error("PAYE_PERIOD_POSITION_REQUIRED");
  const annualCash = payrollMoney(input.expectedAnnualCashEmploymentIncome);
  const nonPeriodic = payrollMoney(input.currentNonPeriodicPayments);
  const bik = payrollMoney(input.bik);
  const deductions = payrollMoney(input.eligibleAnnualDeductions);
  const annualChargeableIncome = Prisma.Decimal.max(0, annualCash.plus(bik).minus(deductions));
  const annualPayeLiability = annualTax(annualChargeableIncome);
  const recurringAnnualChargeable = Prisma.Decimal.max(0, annualCash.minus(nonPeriodic).plus(bik).minus(deductions));
  const recurringAnnualLiability = annualTax(recurringAnnualChargeable);
  const incrementalAnnualTaxEffect = roundPayroll(annualPayeLiability.minus(recurringAnnualLiability), 2);
  const hasNonPeriodicPayment = nonPeriodic.greaterThan(0);
  if (hasNonPeriodicPayment) {
    if (!input.rtaNonPeriodicRule) throw new Error("RTA_NON_PERIODIC_RULE_REQUIRED");
    if (input.rtaNonPeriodicRule.certificationState !== "CERTIFIED") throw new Error("RTA_NON_PERIODIC_RULE_NOT_CERTIFIED");
  }
  const cumulativeRecurringTarget = roundPayroll(recurringAnnualLiability.mul(input.payrollPeriodNumber).div(input.totalPeriodsInTaxYear), 2);
  const cumulativeTarget = roundPayroll(cumulativeRecurringTarget.plus(hasNonPeriodicPayment ? incrementalAnnualTaxEffect : 0), 2);
  const netPriorPaye = payrollMoney(input.priorPayeDeducted).minus(input.priorPayeRepaid);
  const currentPeriodPayeDebitOrRefund = roundPayroll(cumulativeTarget.minus(netPriorPaye), 2);
  const output = { candidateVersion: NG_2026_3_VERSION, certificationStatus: NG_2026_3_STATUS, annualChargeableIncome: roundPayroll(annualChargeableIncome), annualPayeLiability, incrementalAnnualTaxEffect, cumulativeTarget, netPriorPaye: roundPayroll(netPriorPaye), currentPeriodPayeDebitOrRefund, currentTreatment: currentPeriodPayeDebitOrRefund.isNegative() ? "PAYE_REFUND_CREDIT" as const : "PAYE_DEDUCTION" as const, nonPeriodicAllocation: hasNonPeriodicPayment ? input.rtaNonPeriodicRule!.methodology : "NONE" as const };
  return { ...output, hash: payrollDigest({ ...output, annualChargeableIncome: output.annualChargeableIncome.toFixed(2), annualPayeLiability: annualPayeLiability.toFixed(2), incrementalAnnualTaxEffect: incrementalAnnualTaxEffect.toFixed(2), cumulativeTarget: cumulativeTarget.toFixed(2), netPriorPaye: output.netPriorPaye.toFixed(2), currentPeriodPayeDebitOrRefund: currentPeriodPayeDebitOrRefund.toFixed(2), input }) };
}

export type Ng2026_3Fixture = {
  fixtureId: string; evidenceClass: "OFFICIAL_NUMERIC_EXAMPLE" | "SOURCE_BACKED_INDEPENDENT_EXPECTED_VALUE" | "FAIL_CLOSED_COMPLIANCE_CASE"; taxYear: number; jurisdictionCandidateVersion: typeof NG_2026_3_VERSION; payrollFrequency: "MONTHLY"; payrollPeriodNumber: number; totalPeriodsInTaxYear: number; employeeStatus: "FULL_YEAR" | "JOINER" | "LEAVER" | "PARTIAL_YEAR"; expectedAnnualCashEmploymentIncome: string; currentPeriodRecurringEarnings: string; currentNonPeriodicPayments: string; bik: string; eligibleDeductionsReliefs: string; annualChargeableIncome: string | null; annualPayeLiability: string | null; cumulativeTargetMethodology: string; cumulativeTargetAtPeriod: string | null; priorPayeDeducted: string; priorPayeRepaid: string; netPriorPaye: string; roundingStageMode: string; expectedCurrentPayeDebitOrRefund: string | null; incrementalAnnualTaxEffect: string | null; sourceIds: string[]; exactSourceSections: string[]; independentDerivation: string; expectedBlocker?: string;
};

export function assertNg2026_3Fixture(fixture: Ng2026_3Fixture) {
  const required = [fixture.fixtureId, fixture.evidenceClass, fixture.taxYear, fixture.jurisdictionCandidateVersion, fixture.payrollFrequency, fixture.payrollPeriodNumber, fixture.totalPeriodsInTaxYear, fixture.employeeStatus, fixture.expectedAnnualCashEmploymentIncome, fixture.currentPeriodRecurringEarnings, fixture.currentNonPeriodicPayments, fixture.bik, fixture.eligibleDeductionsReliefs, fixture.cumulativeTargetMethodology, fixture.priorPayeDeducted, fixture.priorPayeRepaid, fixture.netPriorPaye, fixture.roundingStageMode, fixture.independentDerivation];
  if (required.some((value) => value === null || value === undefined || value === "") || fixture.sourceIds.length === 0 || fixture.exactSourceSections.length === 0) throw new Error(`CURRENT_PAYE_FIXTURE_INCOMPLETE: ${fixture.fixtureId}`);
  if (fixture.expectedCurrentPayeDebitOrRefund === null && !fixture.expectedBlocker) throw new Error(`CURRENT_PAYE_FIXTURE_AMBIGUOUS: ${fixture.fixtureId}`);
  if (fixture.expectedCurrentPayeDebitOrRefund !== null && [fixture.annualChargeableIncome, fixture.annualPayeLiability, fixture.cumulativeTargetAtPeriod, fixture.incrementalAnnualTaxEffect].some((value) => value === null)) throw new Error(`CURRENT_PAYE_FIXTURE_INCOMPLETE: ${fixture.fixtureId}`);
  return true;
}

export function assertNg2026_3AuthoritativeUseAllowed() { throw new Error("NG-CANDIDATE-2026.3_NOT_CERTIFIED"); }
