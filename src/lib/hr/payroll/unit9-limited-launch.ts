import { payrollDigest, payrollMoney, type Unit9Money } from "./unit9-domain";

export const NG_LIMITED_LAUNCH_RTAS = ["LAGOS", "OYO", "FCT"] as const;
export type NgLaunchRta = typeof NG_LIMITED_LAUNCH_RTAS[number];
export type EarningType = "SALARY" | "BONUS";
export type EarningClassification = "RECURRING" | "NON_PERIODIC";
export type ComplianceReason = "PAYE_MINIMUM_WAGE_RTA_RULE_REQUIRED" | "PAYE_MINIMUM_WAGE_PRIOR_EMPLOYER_RULE_REQUIRED" | "OTHER_TAXABLE_EMPLOYMENT_INCOME_UNSUPPORTED" | "EMPLOYMENT_GROSS_INCOME_EVIDENCE_INCOMPLETE" | "PAYROLL_INCOME_BINDING_MISMATCH" | "BONUS_INPUT_BINDING_MISMATCH" | "ANNUAL_SALARY_BINDING_MISMATCH" | "PRIOR_EMPLOYER_INPUT_BINDING_MISMATCH" | "YTD_INPUT_BINDING_MISMATCH" | "NON_PERIODIC_PAY_RTA_RULE_REQUIRED" | "PENSION_APPLICABILITY_REVIEW_REQUIRED" | "PENSION_SETUP_REQUIRED" | "PRIOR_EMPLOYER_YTD_REQUIRED" | "JURISDICTION_RULE_NOT_CERTIFIED" | "REGULATORY_SOURCE_REQUIRED" | "LEGACY_COMPENSATION_CLASSIFICATION_REQUIRED" | "RTA_REFUND_PROCEDURE_REQUIRED";

const classifications: Record<EarningType, EarningClassification> = { SALARY: "RECURRING", BONUS: "NON_PERIODIC" };
export function classifyEarning(type: string) {
  const normalized = type.trim().toUpperCase();
  if (normalized === "COMPENSATION") throw new Error("LEGACY_COMPENSATION_CLASSIFICATION_REQUIRED");
  if (!(normalized in classifications)) throw new Error("AMBIGUOUS_OR_UNSUPPORTED_EARNING_TYPE");
  return { type: normalized as EarningType, classification: classifications[normalized as EarningType] };
}

export function resolveNigeriaRta(input: { residenceStateCode: string; city?: string }) {
  const code = input.residenceStateCode.trim().toUpperCase();
  if (code === "IBADAN") return "OYO" as const;
  if (!NG_LIMITED_LAUNCH_RTAS.includes(code as NgLaunchRta)) throw new Error("JURISDICTION_RULE_NOT_CERTIFIED");
  return code as NgLaunchRta;
}

export type FrozenBusinessCalendar = { versionId: string; weekendDays: number[]; holidays: string[] };
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export function resolveMonthlyPaymentDate(year: number, month: number, calendar: FrozenBusinessCalendar) {
  if (!calendar.versionId.trim()) throw new Error("A frozen calendar version is required.");
  const nominal = new Date(Date.UTC(year, month - 1, 29));
  const resolved = new Date(nominal);
  const holidays = new Set(calendar.holidays);
  while (calendar.weekendDays.includes(resolved.getUTCDay()) || holidays.has(dateKey(resolved))) resolved.setUTCDate(resolved.getUTCDate() - 1);
  return { nominalPaymentDate: nominal, resolvedPaymentDate: resolved, calendarVersionId: calendar.versionId, rule: "IMMEDIATELY_PRECEDING_BUSINESS_DAY" as const };
}

export type EligibilityFinding = { code: ComplianceReason; category: "TAX" | "PENSION" | "EVIDENCE" | "JURISDICTION"; affectedInput?: string };
export function complianceEligibility(input: { rta: string; earnings: Array<{ type: string; amount: Unit9Money }>; certifiedNonPeriodicTypes?: string[]; pensionOperationalState: "CONFIGURED" | "NOT_CONFIGURED"; pensionLegallyRequired?: boolean; priorEmployerYtdRequired?: boolean; priorEmployerYtdPresent?: boolean; jurisdictionCertified?: boolean; candidateVersion?: string; minimumWageDecision?: { status: "SUPPORTED" | "COMPLIANCE_HOLD"; blockerCodes: string[]; decisionHash: string } }) {
  const findings: EligibilityFinding[] = [];
  const supportedNonPeriodicTypes = input.certifiedNonPeriodicTypes ?? ["BONUS"];
  if (!NG_LIMITED_LAUNCH_RTAS.includes(input.rta as NgLaunchRta) || input.jurisdictionCertified === false) findings.push({ code: "JURISDICTION_RULE_NOT_CERTIFIED", category: "JURISDICTION" });
  for (const earning of input.earnings) {
    const classified = classifyEarning(earning.type);
    if (classified.classification === "NON_PERIODIC" && payrollMoney(earning.amount).greaterThan(0) && !supportedNonPeriodicTypes.includes(classified.type)) findings.push({ code: "NON_PERIODIC_PAY_RTA_RULE_REQUIRED", category: "TAX", affectedInput: classified.type });
  }
  if (input.pensionLegallyRequired && input.pensionOperationalState === "NOT_CONFIGURED") findings.push({ code: "PENSION_SETUP_REQUIRED", category: "PENSION" });
  if (input.priorEmployerYtdRequired && !input.priorEmployerYtdPresent) findings.push({ code: "PRIOR_EMPLOYER_YTD_REQUIRED", category: "EVIDENCE" });
  if (["NG-CANDIDATE-2026.5", "NG-CANDIDATE-2026.6"].includes(input.candidateVersion ?? "")) {
    if (!input.minimumWageDecision) findings.push({ code: "EMPLOYMENT_GROSS_INCOME_EVIDENCE_INCOMPLETE", category: "EVIDENCE", affectedInput: "MINIMUM_WAGE_DECISION" });
    else if (input.minimumWageDecision.status === "COMPLIANCE_HOLD") for (const code of input.minimumWageDecision.blockerCodes) findings.push({ code: code as ComplianceReason, category: "TAX", affectedInput: "MINIMUM_WAGE_DECISION" });
  }
  return { status: findings.length ? "COMPLIANCE_HOLD" as const : "READY" as const, findings, digest: payrollDigest(findings) };
}

export type PopulationMember = { employeeId: string; eligibility: ReturnType<typeof complianceEligibility>; minimumWageDecisionHash?: string; employmentIncomeBindingHash?: string };
export function partitionPayrollPopulation(members: PopulationMember[]) {
  const ordered = [...members].sort((a, b) => a.employeeId.localeCompare(b.employeeId));
  const readyEmployeeIds = ordered.filter((x) => x.eligibility.status === "READY").map((x) => x.employeeId);
  const held = ordered.filter((x) => x.eligibility.status === "COMPLIANCE_HOLD").map((x) => ({ employeeId: x.employeeId, reasons: x.eligibility.findings.map((f) => f.code).sort() }));
  const minimumWageDecisionHashes = ordered.map((member) => ({ employeeId: member.employeeId, decisionHash: member.minimumWageDecisionHash ?? null }));
  const employmentIncomeBindingHashes = ordered.map((member) => ({ employeeId: member.employeeId, bindingHash: member.employmentIncomeBindingHash ?? null }));
  const manifest = { originalPopulationCount: ordered.length, readyCount: readyEmployeeIds.length, heldCount: held.length, readyEmployeeIds, held, minimumWageDecisionHashes, employmentIncomeBindingHashes };
  return { ...manifest, partitionHash: payrollDigest(manifest), decisionRequired: held.length > 0 };
}

export function approveSupportedPopulation(input: { actorUserId: string; preparedById: string; decision: string; reason: string; partitionHash: string; expectedPartitionHash: string }) {
  if (input.actorUserId === input.preparedById) throw new Error("INDEPENDENT_PARTITION_APPROVAL_REQUIRED");
  if (input.decision !== "APPROVE_SUPPORTED_POPULATION_AND_DEFER_HELD_POPULATION") throw new Error("INVALID_PARTITION_DECISION");
  if (!input.reason.trim() || input.partitionHash !== input.expectedPartitionHash) throw new Error("STALE_OR_UNEXPLAINED_PARTITION_DECISION");
  return { approved: true, idempotencyKey: `partition:${input.partitionHash}` };
}

export function exceptionLogicalKey(input: { organizationId: string; payrollRunId: string; employeeId: string; calculationAttemptId: string; blockerCode: ComplianceReason; affectedInput?: string }) {
  return payrollDigest(input);
}

export function assertExceptionResolution(input: { status: string; resolutionType: string; authorityEvidenceId?: string; approvedRuleVersion?: string; recalculationAttemptId?: string; manualTaxAmount?: Unit9Money }) {
  if (input.manualTaxAmount !== undefined) throw new Error("MANUAL_TAX_GUESS_FORBIDDEN");
  if (input.status === "RESOLVED" && (!input.authorityEvidenceId || !input.approvedRuleVersion || !input.recalculationAttemptId)) throw new Error("RULE_BACKED_RECALCULATION_REQUIRED");
  return payrollDigest(input);
}

export function assertPaymentExportState(input: { batchStatus: string; actorUserId: string; createdById: string; approvedById?: string; currency: string }) {
  if (input.currency !== "NGN") throw new Error("NIGERIA_EXPORT_REQUIRES_NGN");
  if (input.actorUserId === input.createdById || input.actorUserId === input.approvedById) throw new Error("PAYMENT_MAKER_CHECKER_REQUIRED");
  return { nextStatus: "EXPORTED" as const, settlementStatus: "NOT_SETTLED" as const };
}

export const NIGERIA_LAUNCH_SUPPORT_MATRIX = NG_LIMITED_LAUNCH_RTAS.map((rta) => ({ rta, recurringSalary: "SIMULATION_SUPPORTED" as const, normalPaye: "SIMULATION_SUPPORTED" as const, minimumWageStandardCases: "GOVERNED_RUNTIME_SUPPORTED" as const, minimumWageEdgeCases: "COMPLIANCE_HOLD" as const, otherTaxableEmploymentIncome: "COMPLIANCE_HOLD" as const, bonus: "SIMULATION_SUPPORTED" as const, priorEmployerYtd: "EVIDENCE_REQUIRED" as const, candidate: "NG-CANDIDATE-2026.5" as const, certification: "NOT_CERTIFIED" as const }));
export const NIGERIA_PAYMENT_MODEL = "GOVERNED_EXPORT" as const;
export const NIGERIA_ACCOUNTING_STATE = "ACCOUNTING_ADAPTER_NOT_CONFIGURED" as const;
