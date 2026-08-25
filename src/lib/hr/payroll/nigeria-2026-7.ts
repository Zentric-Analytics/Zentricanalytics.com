import { Prisma } from "@prisma/client";
import { payrollDigest, payrollMoney, roundPayroll, type Unit9Money } from "./unit9-domain";
import { calculateNg2026_4Paye } from "./nigeria-2026-4";

export const NG_2026_7_VERSION = "NG-CANDIDATE-2026.7" as const;
export const NG_2026_7_STATUS = "NOT_CERTIFIED" as const;
export const NG_2026_7_ACTIVE_EARNINGS = ["SALARY", "BONUS"] as const;
export const NG_2026_7_MONTHLY_RULE = {
  code: "NG-2026.7-MONTHLY-12",
  version: 1,
  frequency: "MONTHLY",
  periodsInTaxYear: 12,
  method: "GOVERNED_PERIODIC_SALARY_X_PERIODS_IN_TAX_YEAR",
  certificationStatus: "CERTIFIED",
} as const;

export type Ng2026_7Evidence = {
  employeeId: string; workRelationshipId: string; assignmentId: string; payrollPeriodId: string;
  rta: "LAGOS" | "OYO" | "FCT"; candidateVersion: typeof NG_2026_7_VERSION;
  actualFrozenSalary: Unit9Money; currentBonus: Unit9Money;
  otherTaxableEmploymentIncome: "VERIFIED_NONE" | "PRESENT" | "UNKNOWN";
  materiallyVariableMonthlyWage: "YES" | "NO" | "UNKNOWN";
  ambiguousMultiEmployer: "YES" | "NO" | "UNKNOWN";
  unusualPartialYearArrangement: "YES" | "NO" | "UNKNOWN";
  evidenceCompletenessCertified: boolean; evidenceReferences: string[];
  inputCertificationId: string; inputCertificationVersion: string;
};

export type Ng2026_7AuthoritativeSources = {
  salary: { recordId: string; versionHash: string; monthlyAmount: Unit9Money; currency: string; payFrequency: string; effectiveFrom: string; effectiveTo?: string | null };
  annualization: { ruleId: string; ruleVersion: number; frequency: string; periodsInTaxYear: number; method: string; taxYear: number; certificationStatus: string };
  ytd: { sourceLedgerHash: string; cutoff: string; priorBonusYtd: Unit9Money; payeDeducted: Unit9Money; payeRepaid: Unit9Money; entryIds: string[] };
  priorEmployer: { state: "NONE" | "VERIFIED" | "UNKNOWN"; recordId?: string; recordVersion?: number; income: Unit9Money; paye: Unit9Money; payeRepaid: Unit9Money; evidenceReference?: string };
  deductions: { amount: Unit9Money; sourceType: "TAX_RELIEF_CLAIM_VERSIONS"; sourceRecordIds: string[]; sourceVersions: string[]; evidenceReferences: string[]; aggregateHash: string };
};

export type Ng2026_7BindingInput = {
  evidence: Ng2026_7Evidence; sources: Ng2026_7AuthoritativeSources;
  auditExpectedAnnualSalary?: Unit9Money; payeExpectedAnnualSalary?: Unit9Money;
  auditPriorBonusYtd?: Unit9Money; auditPayeDeductedYtd?: Unit9Money; auditPayeRepaidYtd?: Unit9Money; auditEligibleAnnualDeductions?: Unit9Money;
  periodsElapsed: number; periodsInTaxYear: number;
};

const money = (value: Unit9Money) => roundPayroll(value).toFixed(2);
const equal = (a: Unit9Money, b: Unit9Money) => payrollMoney(a).eq(payrollMoney(b));
const validMoney = (value: Unit9Money) => {
  const parsed = payrollMoney(value);
  return parsed.isFinite() && !parsed.isNegative();
};
const validInteger = (value: number) => Number.isFinite(value) && Number.isInteger(value);

export function requireSingleNg2026_7SalarySource<T extends { currency: string; payFrequency: string }>(sources: T[]): T {
  if (!sources.length) throw new Error("AUTHORITATIVE_SALARY_SOURCE_REQUIRED");
  if (sources.length !== 1) throw new Error("AUTHORITATIVE_SALARY_SOURCE_AMBIGUOUS");
  if (sources[0].currency !== "NGN") throw new Error("AUTHORITATIVE_SALARY_CURRENCY_MISMATCH");
  if (sources[0].payFrequency !== "MONTHLY") throw new Error("ANNUALIZATION_RULE_REQUIRED");
  return sources[0];
}

export function selectNg2026_7PriorYtdEntries<T extends { id: string; effectiveAt: Date; payrollResultId: string }>(entries: T[], cutoff: Date, currentResultIds: string[]): T[] {
  const current = new Set(currentResultIds);
  return entries.filter((entry) => entry.effectiveAt < cutoff && !current.has(entry.payrollResultId)).sort((a, b) => a.effectiveAt.getTime() - b.effectiveAt.getTime() || a.id.localeCompare(b.id));
}

const NG_2026_7_SUPPORTED_RELIEF_TYPES = new Set(["PENSION", "NHF", "NHIS", "MORTGAGE_INTEREST", "LIFE_ANNUITY", "RENT"]);

export function selectLatestNg2026_7ReliefVersions<T extends { claimType: string; version: number }>(claims: T[]): T[] {
  const ordered = [...claims].sort((left, right) => left.claimType.localeCompare(right.claimType) || right.version - left.version);
  const selected = new Map<string, T>();
  for (const claim of ordered) if (!selected.has(claim.claimType)) selected.set(claim.claimType, claim);
  return [...selected.values()];
}

export function assertUsableNg2026_7ReliefVersions<T extends { claimType: string; version: number; status: string; electionRecorded: boolean; evidenceReference: string; sourceRuleId: string }>(claims: T[]): T[] {
  const latest = selectLatestNg2026_7ReliefVersions(claims);
  if (latest.some((claim) => !NG_2026_7_SUPPORTED_RELIEF_TYPES.has(claim.claimType))) throw new Error("UNSUPPORTED_ELIGIBLE_DEDUCTION_TYPE");
  if (latest.some((claim) => claim.status !== "ELIGIBLE_FOR_PAYE_RELIEF" || !claim.electionRecorded || !claim.evidenceReference || !claim.sourceRuleId)) throw new Error("ELIGIBLE_DEDUCTION_SOURCE_REQUIRED");
  return latest;
}

type Ng2026_7ReliefVersion = {
  id: string;
  claimType: string;
  version: number;
  status: string;
  electionRecorded: boolean;
  evidenceReference: string;
  sourceRuleId: string;
  eligibleAmount: Unit9Money;
};

export function deriveNg2026_7ReliefAggregate<T extends Ng2026_7ReliefVersion>(claims: T[]) {
  const authoritativeClaims = assertUsableNg2026_7ReliefVersions(claims);
  const sources = authoritativeClaims.map((claim) => ({
    id: claim.id,
    type: claim.claimType,
    version: claim.version,
    eligibleAmount: payrollMoney(claim.eligibleAmount).toFixed(4),
    evidenceReference: claim.evidenceReference,
    sourceRuleId: claim.sourceRuleId,
  }));
  const amount = authoritativeClaims.reduce((total, claim) => total.plus(payrollMoney(claim.eligibleAmount)), new Prisma.Decimal(0));
  return {
    authoritativeClaims,
    amount: roundPayroll(amount),
    sourceType: "TAX_RELIEF_CLAIM_VERSIONS" as const,
    sourceRecordIds: sources.map((claim) => claim.id),
    sourceVersions: sources.map((claim) => `${claim.type}:v${claim.version}`),
    evidenceReferences: sources.map((claim) => claim.evidenceReference),
    aggregateHash: payrollDigest(sources),
  };
}

export function deriveNg2026_7Binding(input: Ng2026_7BindingInput) {
  const { evidence, sources } = input;
  if (evidence.candidateVersion !== NG_2026_7_VERSION) throw new Error("NG_2026_7_EVIDENCE_VERSION_REQUIRED");
  if (!evidence.employeeId || !evidence.workRelationshipId || !evidence.assignmentId || !evidence.payrollPeriodId) throw new Error("EMPLOYMENT_INCOME_BINDING_IDENTITY_INCOMPLETE");
  if (sources.annualization.certificationStatus !== "CERTIFIED") throw new Error("ANNUALIZATION_RULE_NOT_CERTIFIED");
  if (sources.annualization.frequency !== "MONTHLY" || sources.annualization.periodsInTaxYear !== 12 || sources.annualization.method !== NG_2026_7_MONTHLY_RULE.method) throw new Error("ANNUALIZATION_RULE_REQUIRED");
  if (!validInteger(input.periodsInTaxYear) || input.periodsInTaxYear <= 0 || input.periodsInTaxYear !== sources.annualization.periodsInTaxYear) throw new Error("INVALID_PERIODS_IN_TAX_YEAR");
  if (!validInteger(input.periodsElapsed) || input.periodsElapsed < 1 || input.periodsElapsed > input.periodsInTaxYear) throw new Error("INVALID_PERIODS_ELAPSED");
  const financial = [sources.salary.monthlyAmount, evidence.actualFrozenSalary, evidence.currentBonus, sources.ytd.priorBonusYtd, sources.ytd.payeDeducted, sources.ytd.payeRepaid, sources.priorEmployer.income, sources.priorEmployer.paye, sources.priorEmployer.payeRepaid, sources.deductions.amount];
  if (!financial.every(validMoney)) throw new Error("INVALID_PAYROLL_MONEY_INPUT");
  if (sources.salary.payFrequency !== "MONTHLY" || sources.salary.currency !== "NGN") throw new Error("ANNUALIZATION_RULE_REQUIRED");
  const derivedAnnualSalary = payrollMoney(sources.salary.monthlyAmount).mul(sources.annualization.periodsInTaxYear);
  const blockers: string[] = [];
  if (!equal(sources.salary.monthlyAmount, evidence.actualFrozenSalary)) blockers.push("PAYROLL_INCOME_BINDING_MISMATCH");
  if (input.auditExpectedAnnualSalary !== undefined && !equal(input.auditExpectedAnnualSalary, derivedAnnualSalary)) blockers.push("ANNUAL_SALARY_BINDING_MISMATCH");
  if (input.payeExpectedAnnualSalary !== undefined && !equal(input.payeExpectedAnnualSalary, derivedAnnualSalary)) blockers.push("ANNUAL_SALARY_BINDING_MISMATCH");
  if (input.auditPriorBonusYtd !== undefined && !equal(input.auditPriorBonusYtd, sources.ytd.priorBonusYtd)) blockers.push("YTD_INPUT_BINDING_MISMATCH");
  if (input.auditPayeDeductedYtd !== undefined && !equal(input.auditPayeDeductedYtd, sources.ytd.payeDeducted)) blockers.push("YTD_INPUT_BINDING_MISMATCH");
  if (input.auditPayeRepaidYtd !== undefined && !equal(input.auditPayeRepaidYtd, sources.ytd.payeRepaid)) blockers.push("YTD_INPUT_BINDING_MISMATCH");
  if (input.auditEligibleAnnualDeductions === undefined) throw new Error("ELIGIBLE_DEDUCTION_SOURCE_REQUIRED");
  if (!equal(input.auditEligibleAnnualDeductions, sources.deductions.amount)) throw new Error("ELIGIBLE_DEDUCTION_BINDING_MISMATCH");
  if (sources.priorEmployer.state === "UNKNOWN" || (sources.priorEmployer.state === "VERIFIED" && (!sources.priorEmployer.recordId || !sources.priorEmployer.recordVersion || !sources.priorEmployer.evidenceReference))) blockers.push("PRIOR_EMPLOYER_INPUT_BINDING_MISMATCH");
  if (!evidence.evidenceCompletenessCertified || !evidence.evidenceReferences.length || evidence.otherTaxableEmploymentIncome === "UNKNOWN") blockers.push("EMPLOYMENT_GROSS_INCOME_EVIDENCE_INCOMPLETE");
  if (evidence.otherTaxableEmploymentIncome === "PRESENT") blockers.push("OTHER_TAXABLE_EMPLOYMENT_INCOME_UNSUPPORTED");
  const ambiguity = [evidence.materiallyVariableMonthlyWage, evidence.ambiguousMultiEmployer, evidence.unusualPartialYearArrangement];
  if (ambiguity.includes("UNKNOWN")) blockers.push("EMPLOYMENT_GROSS_INCOME_EVIDENCE_INCOMPLETE");
  if (ambiguity.includes("YES")) blockers.push("PAYE_MINIMUM_WAGE_RTA_RULE_REQUIRED");
  if (blockers.includes("ANNUAL_SALARY_BINDING_MISMATCH") || blockers.includes("YTD_INPUT_BINDING_MISMATCH") || blockers.includes("PAYROLL_INCOME_BINDING_MISMATCH")) throw new Error(blockers[0]);
  const facts = {
    candidateVersion: NG_2026_7_VERSION,
    identity: { employeeId: evidence.employeeId, workRelationshipId: evidence.workRelationshipId, assignmentId: evidence.assignmentId, payrollPeriodId: evidence.payrollPeriodId },
    currentPeriod: { governedSalarySourceId: sources.salary.recordId, governedSalarySourceVersion: sources.salary.versionHash, governedMonthlySalary: money(sources.salary.monthlyAmount), actualFrozenSalary: money(evidence.actualFrozenSalary), currentBonus: money(evidence.currentBonus) },
    annualization: { ruleId: sources.annualization.ruleId, ruleVersion: sources.annualization.ruleVersion, frequency: sources.annualization.frequency, certifiedPeriodsInTaxYear: sources.annualization.periodsInTaxYear, method: sources.annualization.method, taxYear: sources.annualization.taxYear, derivedExpectedAnnualSalary: money(derivedAnnualSalary), periodsElapsed: input.periodsElapsed },
    ytd: { sourceLedgerHash: sources.ytd.sourceLedgerHash, cutoff: sources.ytd.cutoff, entryIds: [...sources.ytd.entryIds].sort(), priorBonusYtd: money(sources.ytd.priorBonusYtd), currentEmployerPayeDeducted: money(sources.ytd.payeDeducted), currentEmployerPayeRepaid: money(sources.ytd.payeRepaid) },
    priorEmployer: { state: sources.priorEmployer.state, recordId: sources.priorEmployer.recordId ?? null, recordVersion: sources.priorEmployer.recordVersion ?? null, income: money(sources.priorEmployer.income), paye: money(sources.priorEmployer.paye), payeRepaid: money(sources.priorEmployer.payeRepaid), evidenceReference: sources.priorEmployer.evidenceReference ?? null },
    eligibleAnnualDeductions: { amount: money(sources.deductions.amount), sourceType: sources.deductions.sourceType, sourceRecordIds: [...sources.deductions.sourceRecordIds].sort(), sourceVersions: [...sources.deductions.sourceVersions].sort(), evidenceReferences: [...sources.deductions.evidenceReferences].sort(), aggregateHash: sources.deductions.aggregateHash },
    otherTaxableIncomeState: evidence.otherTaxableEmploymentIncome,
    inputCertification: { id: evidence.inputCertificationId, version: evidence.inputCertificationVersion, references: [...evidence.evidenceReferences].sort() },
  };
  const employmentIncomeBindingHash = payrollDigest(facts);
  const potentialExempt = payrollMoney(sources.salary.monthlyAmount).lte(70000) && payrollMoney(evidence.currentBonus).isZero() && payrollMoney(sources.ytd.priorBonusYtd).isZero();
  if (potentialExempt && sources.priorEmployer.state === "VERIFIED" && payrollMoney(sources.priorEmployer.income).gt(0)) blockers.push("PAYE_MINIMUM_WAGE_PRIOR_EMPLOYER_RULE_REQUIRED");
  const uniqueBlockers = [...new Set(blockers)].sort();
  const classification = uniqueBlockers.length ? null : potentialExempt ? "MINIMUM_WAGE_EXEMPT" as const : "NORMAL_PAYE_REQUIRED" as const;
  const decisionBase = { candidateVersion: NG_2026_7_VERSION, status: uniqueBlockers.length ? "COMPLIANCE_HOLD" as const : "SUPPORTED" as const, classification, blockerCodes: uniqueBlockers, employmentIncomeBindingHash };
  return { ...facts, employmentIncomeBindingHash, decision: { ...decisionBase, decisionHash: payrollDigest(decisionBase) } };
}

export function assertNg2026_7AuthoritativeBinding(input: Ng2026_7BindingInput, expectedBindingHash?: string, expectedDecisionHash?: string) {
  if (!expectedBindingHash) throw new Error("EMPLOYMENT_INCOME_BINDING_HASH_REQUIRED");
  if (!expectedDecisionHash) throw new Error("MINIMUM_WAGE_DECISION_HASH_REQUIRED");
  const binding = deriveNg2026_7Binding(input);
  if (binding.employmentIncomeBindingHash !== expectedBindingHash) throw new Error("STALE_EMPLOYMENT_INCOME_BINDING");
  if (binding.decision.decisionHash !== expectedDecisionHash) throw new Error("STALE_EMPLOYMENT_INCOME_BINDING");
  if (binding.decision.status !== "SUPPORTED") throw new Error(`EMPLOYMENT_INCOME_COMPLIANCE_HOLD:${binding.decision.blockerCodes.join(",")}`);
  return binding;
}

export function calculateNg2026_7Paye(binding: ReturnType<typeof assertNg2026_7AuthoritativeBinding>) {
  if (binding.decision.classification === "MINIMUM_WAGE_EXEMPT") {
    const zero = new Prisma.Decimal(0);
    const base = { candidateVersion: NG_2026_7_VERSION, certificationStatus: NG_2026_7_STATUS, taxableIncome: zero, cumulativeTarget: zero, validPriorPaye: zero, currentPaye: zero, treatment: "MINIMUM_WAGE_EXEMPT" as const, refundCandidate: zero, refundExecution: "NOT_APPLICABLE" as const, decisionHash: binding.decision.decisionHash, employmentIncomeBindingHash: binding.employmentIncomeBindingHash };
    return { ...base, hash: payrollDigest({ ...base, currentPaye: "0.00" }) };
  }
  const ordinary = calculateNg2026_4Paye({ expectedAnnualSalary: binding.annualization.derivedExpectedAnnualSalary, bonusPaidTaxYearToDate: binding.ytd.priorBonusYtd, currentBonus: binding.currentPeriod.currentBonus, eligibleAnnualDeductions: binding.eligibleAnnualDeductions.amount, periodsElapsed: binding.annualization.periodsElapsed, periodsInTaxYear: binding.annualization.certifiedPeriodsInTaxYear, currentEmployerPayeDeducted: binding.ytd.currentEmployerPayeDeducted, currentEmployerPayeRepaid: binding.ytd.currentEmployerPayeRepaid, priorEmployerIncome: binding.priorEmployer.income, priorEmployerPaye: binding.priorEmployer.paye, priorEmployerEvidenceVerified: binding.priorEmployer.state === "VERIFIED" });
  return { ...ordinary, candidateVersion: NG_2026_7_VERSION, certificationStatus: NG_2026_7_STATUS, decisionHash: binding.decision.decisionHash, employmentIncomeBindingHash: binding.employmentIncomeBindingHash, hash: payrollDigest({ priorHash: ordinary.hash, candidateVersion: NG_2026_7_VERSION, decisionHash: binding.decision.decisionHash, employmentIncomeBindingHash: binding.employmentIncomeBindingHash }) };
}

export function assertNg2026_7AuthoritativeUseAllowed(): never { throw new Error("NG-CANDIDATE-2026.7_NOT_CERTIFIED"); }
