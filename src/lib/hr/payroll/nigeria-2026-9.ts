import { Prisma } from "@prisma/client";
import { payrollDigest, payrollMoney, roundPayroll, type Unit9Money } from "./unit9-domain";

export const NG_2026_9_VERSION = "NG-CANDIDATE-2026.9" as const;
export const NG_2026_9_STATUS = "NOT_CERTIFIED" as const;

export type Ng2026_9RuleState =
  | "APPROVED"
  | "APPROVED_WITH_CLARIFICATION"
  | "CHANGE_REQUIRED"
  | "INSUFFICIENT_AUTHORITY"
  | "NOT_APPLICABLE";

export type Ng2026_9AuthorityClass =
  | "PRIMARY_LAW"
  | "REGULATION"
  | "ADMINISTRATIVE_GUIDANCE"
  | "EMPLOYER_POLICY"
  | "COLLECTIVE_AGREEMENT"
  | "WRITTEN_RTA_CLARIFICATION";

export type Ng2026_9AuthorityRecord = {
  id: string;
  issuingBody: string;
  title: string;
  publicationIdentifier: string;
  pinpoint: string;
  publicationDate: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  jurisdiction: "FEDERAL" | "LAGOS" | "OYO" | "FCT" | "EMPLOYER";
  officialUrl?: string;
  evidencePath?: string;
  accessedAt: string;
  sha256: string;
  authorityClass: Ng2026_9AuthorityClass;
  supersessionStatus: "CURRENT" | "SUPERSEDED" | "UNKNOWN";
  reviewerDecision: Ng2026_9RuleState;
};

export type Ng2026_9RuleBinding = {
  id: string;
  version: number;
  state: Ng2026_9RuleState;
  authorityIds: string[];
  effectiveFrom: string;
  effectiveTo?: string | null;
  professionalReviewerId?: string;
  clarification?: string;
};

export type Ng2026_9HoldCode =
  | "COMPLIANCE_HOLD_UNCLASSIFIED_EARNING"
  | "COMPLIANCE_HOLD_EARNING_RULE_NOT_APPROVED"
  | "COMPLIANCE_HOLD_MINIMUM_WAGE_AUTHORITY_REQUIRED"
  | "COMPLIANCE_HOLD_PARTIAL_YEAR_TREATMENT_REQUIRED"
  | "COMPLIANCE_HOLD_PRIOR_EMPLOYER_UNKNOWN"
  | "COMPLIANCE_HOLD_OTHER_EMPLOYMENT_INCOME"
  | "COMPLIANCE_HOLD_BONUS_ALLOCATION_METHOD_REQUIRED"
  | "COMPLIANCE_HOLD_REFUND_PROCEDURE_REQUIRED"
  | "COMPLIANCE_HOLD_DEDUCTION_EVIDENCE_REQUIRED"
  | "COMPLIANCE_HOLD_DEDUCTION_RULE_NOT_APPROVED"
  | "COMPLIANCE_HOLD_PENSION_DECISION_REQUIRED"
  | "COMPLIANCE_HOLD_PENSION_RULE_NOT_APPROVED"
  | "COMPLIANCE_HOLD_PRORATION_POLICY_NOT_APPROVED"
  | "COMPLIANCE_HOLD_OVERTIME_POLICY_NOT_APPROVED"
  | "COMPLIANCE_HOLD_ROUNDING_POLICY_NOT_APPROVED";

export type Ng2026_9EarningCategory =
  | "SALARY"
  | "HOURLY_WAGES"
  | "BONUS"
  | "COMMISSION"
  | "OVERTIME"
  | "ALLOWANCE"
  | "PAID_LEAVE"
  | "RETROACTIVE_EARNING"
  | "BENEFIT_IN_KIND_EMPLOYER_ASSET"
  | "BENEFIT_IN_KIND_HIRED_ASSET"
  | "EMPLOYER_PAID_EXPENSE"
  | "LOSS_OF_EMPLOYMENT_COMPENSATION"
  | "REIMBURSEMENT";

export type Ng2026_9Treatment = {
  category: Ng2026_9EarningCategory;
  grossIncomeMembership: "INCLUDED" | "EXCLUDED" | "PROFESSIONAL_DECISION_REQUIRED";
  taxableBaseMembership: "INCLUDED" | "EXCLUDED" | "PROFESSIONAL_DECISION_REQUIRED";
  recognitionTiming: "CURRENT_PERIOD" | "PAYMENT_DATE" | "ACCRUAL_DATE" | "PROFESSIONAL_DECISION_REQUIRED";
  valuationMethod: string;
  exemptionOrCap?: string;
  evidenceRequirements: string[];
  jurisdiction: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  ruleId: string;
  reviewState: Ng2026_9RuleState;
};

const SHA256 = /^[a-f0-9]{64}$/;
const professionallyUsable = (state: Ng2026_9RuleState) => state === "APPROVED" || state === "APPROVED_WITH_CLARIFICATION";

export function validateNg2026_9Authority(record: Ng2026_9AuthorityRecord) {
  const required = [record.id, record.issuingBody, record.title, record.publicationIdentifier, record.pinpoint, record.publicationDate, record.effectiveFrom, record.accessedAt];
  if (required.some((value) => !value.trim()) || !SHA256.test(record.sha256) || (!record.officialUrl && !record.evidencePath)) throw new Error("NG_2026_9_AUTHORITY_RECORD_INCOMPLETE");
  if (record.authorityClass === "PRIMARY_LAW" && !/(act|gazette)/i.test(`${record.title} ${record.publicationIdentifier}`)) throw new Error("NG_2026_9_GUIDANCE_MISCLASSIFIED_AS_PRIMARY_LAW");
  if (record.supersessionStatus !== "CURRENT" || !professionallyUsable(record.reviewerDecision)) throw new Error("NG_2026_9_AUTHORITY_NOT_APPROVED");
  return { ...record, fingerprint: payrollDigest(record) };
}

export function validateNg2026_9Rule(binding: Ng2026_9RuleBinding, authorities: Ng2026_9AuthorityRecord[]) {
  if (!binding.id || !Number.isInteger(binding.version) || binding.version < 1 || !binding.authorityIds.length) throw new Error("NG_2026_9_RULE_BINDING_INCOMPLETE");
  if (!professionallyUsable(binding.state) || !binding.professionalReviewerId) throw new Error(`NG_2026_9_RULE_NOT_APPROVED:${binding.id}:${binding.state}`);
  const byId = new Map(authorities.map((authority) => [authority.id, authority]));
  for (const id of binding.authorityIds) {
    const authority = byId.get(id);
    if (!authority) throw new Error(`NG_2026_9_AUTHORITY_MISSING:${id}`);
    validateNg2026_9Authority(authority);
  }
  return { ...binding, bindingHash: payrollDigest({ ...binding, authorityIds: [...binding.authorityIds].sort() }) };
}

export function classifyNg2026_9Earning(category: string, treatments: Ng2026_9Treatment[]) {
  const normalized = category.trim().toUpperCase();
  const treatment = treatments.find((entry) => entry.category === normalized);
  if (!treatment) return { status: "COMPLIANCE_HOLD" as const, holdCode: "COMPLIANCE_HOLD_UNCLASSIFIED_EARNING" as Ng2026_9HoldCode, category: normalized };
  if (!professionallyUsable(treatment.reviewState)) return { status: "COMPLIANCE_HOLD" as const, holdCode: "COMPLIANCE_HOLD_EARNING_RULE_NOT_APPROVED" as Ng2026_9HoldCode, category: normalized, treatment };
  if (treatment.grossIncomeMembership === "PROFESSIONAL_DECISION_REQUIRED" || treatment.taxableBaseMembership === "PROFESSIONAL_DECISION_REQUIRED" || treatment.recognitionTiming === "PROFESSIONAL_DECISION_REQUIRED") return { status: "COMPLIANCE_HOLD" as const, holdCode: "COMPLIANCE_HOLD_EARNING_RULE_NOT_APPROVED" as Ng2026_9HoldCode, category: normalized, treatment };
  return { status: "SUPPORTED" as const, treatment, treatmentHash: payrollDigest(treatment) };
}

export type Ng2026_9MinimumWageInput = {
  monthlySalary: Unit9Money;
  currentOtherEmploymentIncome: Unit9Money;
  priorOtherEmploymentIncomeYtd: Unit9Money;
  priorEmployerState: "NONE" | "VERIFIED" | "UNKNOWN";
  employmentSpan: "FULL_YEAR" | "JOINER" | "LEAVER" | "OTHER_PARTIAL_YEAR";
  jurisdiction: "LAGOS" | "OYO" | "FCT";
  minimumWageRule: Ng2026_9RuleBinding;
  authorityRecords: Ng2026_9AuthorityRecord[];
};

export function classifyNg2026_9MinimumWage(input: Ng2026_9MinimumWageInput) {
  const salary = payrollMoney(input.monthlySalary);
  const other = payrollMoney(input.currentOtherEmploymentIncome).plus(input.priorOtherEmploymentIncomeYtd);
  const facts = { candidateVersion: NG_2026_9_VERSION, monthlySalary: salary.toFixed(2), otherEmploymentIncome: other.toFixed(2), priorEmployerState: input.priorEmployerState, employmentSpan: input.employmentSpan, jurisdiction: input.jurisdiction, ruleId: input.minimumWageRule.id, ruleVersion: input.minimumWageRule.version };
  const holdCodes: Ng2026_9HoldCode[] = [];
  try { validateNg2026_9Rule(input.minimumWageRule, input.authorityRecords); } catch { holdCodes.push("COMPLIANCE_HOLD_MINIMUM_WAGE_AUTHORITY_REQUIRED"); }
  if (input.priorEmployerState === "UNKNOWN") holdCodes.push("COMPLIANCE_HOLD_PRIOR_EMPLOYER_UNKNOWN");
  if (input.employmentSpan !== "FULL_YEAR") holdCodes.push("COMPLIANCE_HOLD_PARTIAL_YEAR_TREATMENT_REQUIRED");
  if (!other.isZero()) holdCodes.push("COMPLIANCE_HOLD_OTHER_EMPLOYMENT_INCOME");
  const unique = [...new Set(holdCodes)].sort();
  const classification = unique.length ? null : salary.lte(70000) ? "MINIMUM_WAGE_EXEMPT" as const : "NORMAL_PAYE_REQUIRED" as const;
  return { ...facts, status: unique.length ? "COMPLIANCE_HOLD" as const : "SUPPORTED" as const, classification, holdCodes: unique, decisionHash: payrollDigest({ ...facts, classification, holdCodes: unique }) };
}

export type Ng2026_9ReliefClaim = {
  id: string;
  type: "PENSION" | "NHF" | "NHIS" | "MORTGAGE_INTEREST" | "LIFE_ANNUITY" | "RENT";
  version: number;
  amount: Unit9Money;
  status: "ELIGIBLE_FOR_PAYE_RELIEF" | "PENDING" | "REJECTED" | "SUPERSEDED";
  actuallyPaid: boolean;
  remittanceVerified: boolean;
  evidenceReference: string;
  evidenceHash: string;
  effectiveYear: number;
  rule: Ng2026_9RuleBinding;
};

export function deriveNg2026_9Reliefs(claims: Ng2026_9ReliefClaim[], authorities: Ng2026_9AuthorityRecord[], taxYear: number) {
  const ordered = [...claims].sort((a, b) => a.type.localeCompare(b.type) || b.version - a.version || a.id.localeCompare(b.id));
  const newest = new Map<string, Ng2026_9ReliefClaim>();
  for (const claim of ordered) if (!newest.has(claim.type)) newest.set(claim.type, claim);
  const selected = [...newest.values()];
  const holds: Array<{ claimId: string; code: Ng2026_9HoldCode }> = [];
  for (const claim of selected) {
    const evidenceValid = claim.evidenceReference.trim() && SHA256.test(claim.evidenceHash);
    let ruleValid = true;
    try { validateNg2026_9Rule(claim.rule, authorities); } catch { ruleValid = false; }
    if (claim.status !== "ELIGIBLE_FOR_PAYE_RELIEF" || !claim.actuallyPaid || !claim.remittanceVerified || !evidenceValid || claim.effectiveYear !== taxYear) holds.push({ claimId: claim.id, code: "COMPLIANCE_HOLD_DEDUCTION_EVIDENCE_REQUIRED" });
    if (!ruleValid) holds.push({ claimId: claim.id, code: "COMPLIANCE_HOLD_DEDUCTION_RULE_NOT_APPROVED" });
  }
  const amount = selected.reduce((sum, claim) => holds.some((hold) => hold.claimId === claim.id) ? sum : sum.plus(payrollMoney(claim.amount)), new Prisma.Decimal(0));
  const source = selected.map((claim) => ({ id: claim.id, type: claim.type, version: claim.version, amount: payrollMoney(claim.amount).toFixed(4), ruleId: claim.rule.id, ruleVersion: claim.rule.version, evidenceHash: claim.evidenceHash }));
  return { status: holds.length ? "COMPLIANCE_HOLD" as const : "SUPPORTED" as const, authoritativeClaims: selected, amount: roundPayroll(amount), holds, aggregateHash: payrollDigest(source) };
}

export type Ng2026_9PensionDecision = {
  state: "COVERED" | "EXEMPT" | "VOLUNTARY" | "UNRESOLVED_COMPLIANCE_HOLD";
  coveredMonthlyEmoluments?: Unit9Money;
  employeeRatePercent?: Unit9Money;
  employerRatePercent?: Unit9Money;
  employerPaysAll?: boolean;
  evidenceReferences: string[];
  rule: Ng2026_9RuleBinding;
};

export function deriveNg2026_9Pension(decision: Ng2026_9PensionDecision, authorities: Ng2026_9AuthorityRecord[]) {
  if (decision.state === "UNRESOLVED_COMPLIANCE_HOLD") return { status: "COMPLIANCE_HOLD" as const, holdCodes: ["COMPLIANCE_HOLD_PENSION_DECISION_REQUIRED" as Ng2026_9HoldCode] };
  try { validateNg2026_9Rule(decision.rule, authorities); } catch { return { status: "COMPLIANCE_HOLD" as const, holdCodes: ["COMPLIANCE_HOLD_PENSION_RULE_NOT_APPROVED" as Ng2026_9HoldCode] }; }
  if (!decision.evidenceReferences.length) return { status: "COMPLIANCE_HOLD" as const, holdCodes: ["COMPLIANCE_HOLD_PENSION_DECISION_REQUIRED" as Ng2026_9HoldCode] };
  if (decision.state !== "COVERED") return { status: "SUPPORTED" as const, state: decision.state, employeeDeduction: roundPayroll(0), employerCost: roundPayroll(0), remittanceLiability: roundPayroll(0), decisionHash: payrollDigest(decision) };
  const emoluments = payrollMoney(decision.coveredMonthlyEmoluments ?? -1);
  const employeeRate = payrollMoney(decision.employeeRatePercent ?? -1);
  const employerRate = payrollMoney(decision.employerRatePercent ?? -1);
  if (emoluments.isNegative() || employeeRate.isNegative() || employerRate.isNegative()) return { status: "COMPLIANCE_HOLD" as const, holdCodes: ["COMPLIANCE_HOLD_PENSION_DECISION_REQUIRED" as Ng2026_9HoldCode] };
  const employeeDeduction = decision.employerPaysAll ? new Prisma.Decimal(0) : emoluments.mul(employeeRate).div(100);
  const employerCost = emoluments.mul(employerRate).div(100).plus(decision.employerPaysAll ? emoluments.mul(employeeRate).div(100) : 0);
  return { status: "SUPPORTED" as const, state: decision.state, employeeDeduction: roundPayroll(employeeDeduction), employerCost: roundPayroll(employerCost), remittanceLiability: roundPayroll(employeeDeduction.plus(employerCost)), decisionHash: payrollDigest(decision) };
}

export type Ng2026_9PolicyPacket = {
  proration: { method: "CALENDAR_DAY" | "WORKDAY" | "HOUR"; effectiveDateInclusive: boolean; rule: Ng2026_9RuleBinding };
  overtime: { eligible: boolean; multiplier: Unit9Money; lockedTimeRequired: boolean; rule: Ng2026_9RuleBinding };
  rounding: { scale: number; mode: "HALF_UP"; stages: Array<"FINAL_COMPONENT" | "FINAL_TAX" | "FINAL_NET">; rule: Ng2026_9RuleBinding };
};

export function validateNg2026_9Policies(packet: Ng2026_9PolicyPacket, authorities: Ng2026_9AuthorityRecord[]) {
  const holds: Ng2026_9HoldCode[] = [];
  try { validateNg2026_9Rule(packet.proration.rule, authorities); } catch { holds.push("COMPLIANCE_HOLD_PRORATION_POLICY_NOT_APPROVED"); }
  try { validateNg2026_9Rule(packet.overtime.rule, authorities); } catch { holds.push("COMPLIANCE_HOLD_OVERTIME_POLICY_NOT_APPROVED"); }
  try { validateNg2026_9Rule(packet.rounding.rule, authorities); } catch { holds.push("COMPLIANCE_HOLD_ROUNDING_POLICY_NOT_APPROVED"); }
  if (!Number.isInteger(packet.rounding.scale) || packet.rounding.scale < 2 || packet.rounding.mode !== "HALF_UP" || !packet.rounding.stages.length || payrollMoney(packet.overtime.multiplier).lt(1)) holds.push("COMPLIANCE_HOLD_ROUNDING_POLICY_NOT_APPROVED");
  return { status: holds.length ? "COMPLIANCE_HOLD" as const : "SUPPORTED" as const, holdCodes: [...new Set(holds)].sort(), policyHash: payrollDigest(packet) };
}

export function assertNg2026_9AuthoritativeUseAllowed(): never {
  throw new Error("NG-CANDIDATE-2026.9_NOT_CERTIFIED");
}
