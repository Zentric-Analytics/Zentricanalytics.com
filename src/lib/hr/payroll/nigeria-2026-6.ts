import { Prisma } from "@prisma/client";
import { payrollDigest, payrollMoney, roundPayroll, type Unit9Money } from "./unit9-domain";
import { calculateNg2026_4Paye } from "./nigeria-2026-4";

export const NG_2026_6_VERSION = "NG-CANDIDATE-2026.6" as const;
export const NG_2026_6_STATUS = "NOT_CERTIFIED" as const;
export const NG_2026_6_MINIMUM_WAGE_MONTHLY = "70000.00" as const;
export const NG_2026_6_ACTIVE_EARNINGS = ["SALARY", "BONUS"] as const;

export type Ng2026_6TriState = "YES" | "NO" | "UNKNOWN";
export type Ng2026_6OtherIncomeState = "VERIFIED_NONE" | "PRESENT" | "UNKNOWN";
export type Ng2026_6PriorEmployerState = "NONE" | "VERIFIED" | "UNKNOWN";
export type Ng2026_6IncomeEvidence = {
  employeeId: string; workRelationshipId: string; payrollPeriodId: string; rta: "LAGOS" | "OYO" | "FCT";
  candidateVersion: typeof NG_2026_6_VERSION;
  monthlySalary: Unit9Money; currentPeriodBonus: Unit9Money;
  materiallyVariableMonthlyWage: Ng2026_6TriState; ambiguousMultiEmployer: Ng2026_6TriState; unusualPartialYearArrangement: Ng2026_6TriState;
  otherTaxableEmploymentIncome: Ng2026_6OtherIncomeState; evidenceCompletenessCertified: boolean;
  evidenceReferences: string[]; inputCertificationId: string; inputCertificationVersion: string;
};

export type Ng2026_6AuthoritativeFacts = {
  governedMonthlySalary: Unit9Money;
  expectedAnnualSalary: Unit9Money;
  priorBonusPaidTaxYearToDate: Unit9Money;
  currentEmployerPayeDeducted: Unit9Money;
  currentEmployerPayeRepaid: Unit9Money;
  priorEmployer: { state: Ng2026_6PriorEmployerState; income: Unit9Money; paye: Unit9Money; evidenceReference?: string; evidenceVersion?: string };
};

export type Ng2026_6BindingInput = {
  evidence: Ng2026_6IncomeEvidence;
  actualSalary: Unit9Money; actualBonus: Unit9Money; payeCurrentBonus: Unit9Money;
  payeExpectedAnnualSalary: Unit9Money; payePriorBonusPaidTaxYearToDate: Unit9Money;
  payeCurrentEmployerPayeDeducted: Unit9Money; payeCurrentEmployerPayeRepaid: Unit9Money;
  payePriorEmployerIncome: Unit9Money; payePriorEmployerPaye: Unit9Money;
  periodsElapsed: number; periodsInTaxYear: number; eligibleAnnualDeductions: Unit9Money;
  authoritative: Ng2026_6AuthoritativeFacts;
};

export type Ng2026_6Blocker = "EMPLOYMENT_GROSS_INCOME_EVIDENCE_INCOMPLETE" | "OTHER_TAXABLE_EMPLOYMENT_INCOME_UNSUPPORTED" | "PAYE_MINIMUM_WAGE_RTA_RULE_REQUIRED" | "PAYROLL_INCOME_BINDING_MISMATCH" | "BONUS_INPUT_BINDING_MISMATCH" | "ANNUAL_SALARY_BINDING_MISMATCH" | "PRIOR_EMPLOYER_INPUT_BINDING_MISMATCH" | "YTD_INPUT_BINDING_MISMATCH" | "PAYE_MINIMUM_WAGE_PRIOR_EMPLOYER_RULE_REQUIRED";

const money = (value: Unit9Money) => roundPayroll(value).toFixed(2);
const equalMoney = (left: Unit9Money, right: Unit9Money) => payrollMoney(left).eq(payrollMoney(right));

export function deriveAndValidateNg2026_6IncomeBinding(input: Ng2026_6BindingInput) {
  if (input.evidence.candidateVersion !== NG_2026_6_VERSION) throw new Error("NG_2026_6_EVIDENCE_VERSION_REQUIRED");
  if (!input.evidence.employeeId || !input.evidence.workRelationshipId || !input.evidence.payrollPeriodId || !input.evidence.inputCertificationId || !input.evidence.inputCertificationVersion) throw new Error("EMPLOYMENT_INCOME_BINDING_IDENTITY_INCOMPLETE");
  const blockers: Ng2026_6Blocker[] = [];
  if (!equalMoney(input.evidence.monthlySalary, input.actualSalary)) blockers.push("PAYROLL_INCOME_BINDING_MISMATCH");
  if (!equalMoney(input.authoritative.governedMonthlySalary, input.actualSalary)) blockers.push("PAYROLL_INCOME_BINDING_MISMATCH");
  if (!equalMoney(input.evidence.currentPeriodBonus, input.actualBonus) || !equalMoney(input.actualBonus, input.payeCurrentBonus)) blockers.push("BONUS_INPUT_BINDING_MISMATCH");
  if (!equalMoney(input.authoritative.expectedAnnualSalary, input.payeExpectedAnnualSalary)) blockers.push("ANNUAL_SALARY_BINDING_MISMATCH");
  if (!equalMoney(input.authoritative.priorBonusPaidTaxYearToDate, input.payePriorBonusPaidTaxYearToDate) || !equalMoney(input.authoritative.currentEmployerPayeDeducted, input.payeCurrentEmployerPayeDeducted) || !equalMoney(input.authoritative.currentEmployerPayeRepaid, input.payeCurrentEmployerPayeRepaid)) blockers.push("YTD_INPUT_BINDING_MISMATCH");
  const prior = input.authoritative.priorEmployer;
  if (prior.state === "UNKNOWN" || (prior.state !== "VERIFIED" && (!payrollMoney(input.payePriorEmployerIncome).isZero() || !payrollMoney(input.payePriorEmployerPaye).isZero()))) blockers.push("PRIOR_EMPLOYER_INPUT_BINDING_MISMATCH");
  if (prior.state === "VERIFIED" && (!prior.evidenceReference || !prior.evidenceVersion || !equalMoney(prior.income, input.payePriorEmployerIncome) || !equalMoney(prior.paye, input.payePriorEmployerPaye))) blockers.push("PRIOR_EMPLOYER_INPUT_BINDING_MISMATCH");
  if (prior.state === "NONE" && (!payrollMoney(prior.income).isZero() || !payrollMoney(prior.paye).isZero())) blockers.push("PRIOR_EMPLOYER_INPUT_BINDING_MISMATCH");
  if (!input.evidence.evidenceCompletenessCertified || !input.evidence.evidenceReferences.length || input.evidence.otherTaxableEmploymentIncome === "UNKNOWN") blockers.push("EMPLOYMENT_GROSS_INCOME_EVIDENCE_INCOMPLETE");
  if (input.evidence.otherTaxableEmploymentIncome === "PRESENT") blockers.push("OTHER_TAXABLE_EMPLOYMENT_INCOME_UNSUPPORTED");
  const ambiguity = [input.evidence.materiallyVariableMonthlyWage, input.evidence.ambiguousMultiEmployer, input.evidence.unusualPartialYearArrangement];
  if (ambiguity.includes("UNKNOWN")) blockers.push("EMPLOYMENT_GROSS_INCOME_EVIDENCE_INCOMPLETE");
  if (ambiguity.includes("YES")) blockers.push("PAYE_MINIMUM_WAGE_RTA_RULE_REQUIRED");
  const facts = {
    candidateVersion: NG_2026_6_VERSION, employeeId: input.evidence.employeeId, workRelationshipId: input.evidence.workRelationshipId, payrollPeriodId: input.evidence.payrollPeriodId, rta: input.evidence.rta,
    currentPeriod: { salary: money(input.actualSalary), bonus: money(input.actualBonus), taxableEmploymentEarnings: payrollMoney(input.actualSalary).plus(input.actualBonus).toFixed(2) },
    annualization: { expectedAnnualSalary: money(input.payeExpectedAnnualSalary), periodsElapsed: input.periodsElapsed, periodsInTaxYear: input.periodsInTaxYear },
    ytd: { priorBonusPaidTaxYearToDate: money(input.payePriorBonusPaidTaxYearToDate), currentEmployerPayeDeducted: money(input.payeCurrentEmployerPayeDeducted), currentEmployerPayeRepaid: money(input.payeCurrentEmployerPayeRepaid) },
    priorEmployer: { state: prior.state, income: money(input.payePriorEmployerIncome), paye: money(input.payePriorEmployerPaye), evidenceReference: prior.evidenceReference ?? null, evidenceVersion: prior.evidenceVersion ?? null },
    eligibleAnnualDeductions: money(input.eligibleAnnualDeductions), unsupportedOtherTaxableEmploymentIncome: input.evidence.otherTaxableEmploymentIncome,
    ambiguity: { materiallyVariableMonthlyWage: input.evidence.materiallyVariableMonthlyWage, multiEmployerMinimumWage: input.evidence.ambiguousMultiEmployer, unusualPartialYearArrangement: input.evidence.unusualPartialYearArrangement },
    evidenceReferences: [...input.evidence.evidenceReferences].sort(), inputCertificationId: input.evidence.inputCertificationId, inputCertificationVersion: input.evidence.inputCertificationVersion,
  };
  const employmentIncomeBindingHash = payrollDigest(facts);
  const potentialExempt = payrollMoney(input.actualSalary).lessThanOrEqualTo(NG_2026_6_MINIMUM_WAGE_MONTHLY) && payrollMoney(input.actualBonus).isZero() && payrollMoney(input.payePriorBonusPaidTaxYearToDate).isZero();
  if (potentialExempt && prior.state === "VERIFIED" && payrollMoney(prior.income).greaterThan(0)) blockers.push("PAYE_MINIMUM_WAGE_PRIOR_EMPLOYER_RULE_REQUIRED");
  const uniqueBlockers = [...new Set(blockers)].sort();
  const classification = uniqueBlockers.length ? null : potentialExempt ? "MINIMUM_WAGE_EXEMPT" as const : "NORMAL_PAYE_REQUIRED" as const;
  const decisionBase = { status: uniqueBlockers.length ? "COMPLIANCE_HOLD" as const : "SUPPORTED" as const, classification, blockerCodes: uniqueBlockers, threshold: NG_2026_6_MINIMUM_WAGE_MONTHLY, employmentIncomeBindingHash, candidateVersion: NG_2026_6_VERSION };
  return { ...facts, employmentIncomeBindingHash, decision: { ...decisionBase, decisionHash: payrollDigest(decisionBase) } };
}

export function assertNg2026_6Binding(input: Ng2026_6BindingInput, expectedBindingHash?: string, expectedDecisionHash?: string) {
  const binding = deriveAndValidateNg2026_6IncomeBinding(input);
  if (expectedBindingHash && binding.employmentIncomeBindingHash !== expectedBindingHash) throw new Error("STALE_EMPLOYMENT_INCOME_BINDING");
  if (expectedDecisionHash && binding.decision.decisionHash !== expectedDecisionHash) throw new Error("STALE_MINIMUM_WAGE_DECISION");
  if (binding.decision.status === "COMPLIANCE_HOLD") throw new Error(`EMPLOYMENT_INCOME_COMPLIANCE_HOLD:${binding.decision.blockerCodes.join(",")}`);
  return binding;
}

export function calculateNg2026_6Paye(binding: ReturnType<typeof assertNg2026_6Binding>) {
  if (binding.decision.classification === "MINIMUM_WAGE_EXEMPT") {
    const zero = new Prisma.Decimal(0);
    const result = { candidateVersion: NG_2026_6_VERSION, certificationStatus: NG_2026_6_STATUS, taxableIncome: zero, cumulativeTarget: zero, validPriorPaye: zero, currentPaye: zero, treatment: "MINIMUM_WAGE_EXEMPT" as const, refundCandidate: zero, refundExecution: "NOT_APPLICABLE" as const, unverifiedPriorEmployerPayeIgnored: false, decisionHash: binding.decision.decisionHash, employmentIncomeBindingHash: binding.employmentIncomeBindingHash };
    return { ...result, hash: payrollDigest({ ...result, currentPaye: "0.00" }) };
  }
  const ordinary = calculateNg2026_4Paye({ expectedAnnualSalary: binding.annualization.expectedAnnualSalary, bonusPaidTaxYearToDate: binding.ytd.priorBonusPaidTaxYearToDate, currentBonus: binding.currentPeriod.bonus, eligibleAnnualDeductions: binding.eligibleAnnualDeductions, periodsElapsed: binding.annualization.periodsElapsed, periodsInTaxYear: binding.annualization.periodsInTaxYear, currentEmployerPayeDeducted: binding.ytd.currentEmployerPayeDeducted, currentEmployerPayeRepaid: binding.ytd.currentEmployerPayeRepaid, priorEmployerIncome: binding.priorEmployer.income, priorEmployerPaye: binding.priorEmployer.paye, priorEmployerEvidenceVerified: binding.priorEmployer.state === "VERIFIED" });
  return { ...ordinary, candidateVersion: NG_2026_6_VERSION, certificationStatus: NG_2026_6_STATUS, decisionHash: binding.decision.decisionHash, employmentIncomeBindingHash: binding.employmentIncomeBindingHash, hash: payrollDigest({ priorHash: ordinary.hash, candidateVersion: NG_2026_6_VERSION, decisionHash: binding.decision.decisionHash, employmentIncomeBindingHash: binding.employmentIncomeBindingHash }) };
}

export function assertNg2026_6AuthoritativeUseAllowed(): never { throw new Error("NG-CANDIDATE-2026.6_NOT_CERTIFIED"); }
