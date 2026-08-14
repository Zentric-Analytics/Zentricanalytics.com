import { Prisma } from "@prisma/client";
import { payrollDigest, payrollMoney, reconcileGrossToNet, roundPayroll, type PayrollLine, type Unit9Money } from "./unit9-domain";

export type CertificationSeverity = "RUN_BLOCKER" | "EMPLOYEE_BLOCKER" | "WARNING" | "INFO";
export type PayrollInputCandidate = {
  employeeId: string; personId?: string; workRelationshipId?: string; assignmentId?: string;
  employmentStatus: string; legalEntityId?: string; jurisdictionCode?: string; payGroupId?: string;
  workerType: "SALARIED" | "HOURLY"; compensationHandoffId?: string; compensationCurrency?: string;
  payrollCurrency: string; lockedTimeReference?: string; taxProfileVersionId?: string;
  paymentDestinationVersionId?: string; conflictingIntervals?: boolean;
};

export function certifyPayrollInput(candidate: PayrollInputCandidate) {
  const findings: { code: string; severity: CertificationSeverity; message: string }[] = [];
  const add = (code: string, severity: CertificationSeverity, message: string) => findings.push({ code, severity, message });
  if (!candidate.personId || !candidate.workRelationshipId || !candidate.assignmentId) add("WORKFORCE_IDENTITY_MISSING", "EMPLOYEE_BLOCKER", "Authoritative workforce identity or assignment is missing.");
  if (!new Set(["ACTIVE", "ON_LEAVE", "NOTICE_PERIOD"]).has(candidate.employmentStatus)) add("WORKER_INELIGIBLE", "EMPLOYEE_BLOCKER", "Worker is not payroll eligible for this period.");
  if (!candidate.legalEntityId) add("LEGAL_ENTITY_MISSING", "RUN_BLOCKER", "Payroll legal entity is required.");
  if (candidate.jurisdictionCode !== "NG") add("JURISDICTION_UNSUPPORTED", "RUN_BLOCKER", "The initial payroll scope supports Nigeria only.");
  if (!candidate.payGroupId) add("PAY_GROUP_MISSING", "EMPLOYEE_BLOCKER", "A governed payroll pay group is required.");
  if (!candidate.compensationHandoffId) add("COMPENSATION_MISSING", "EMPLOYEE_BLOCKER", "An approved Unit 8 compensation handoff is required.");
  if (candidate.compensationCurrency !== candidate.payrollCurrency) add("CURRENCY_POLICY_REQUIRED", "EMPLOYEE_BLOCKER", "Currency conversion requires an explicit effective-dated policy.");
  if (candidate.workerType === "HOURLY" && !candidate.lockedTimeReference) add("LOCKED_TIME_MISSING", "EMPLOYEE_BLOCKER", "Hourly payroll requires approved locked Unit 6 time.");
  if (!candidate.taxProfileVersionId) add("TAX_PROFILE_MISSING", "EMPLOYEE_BLOCKER", "An effective employee tax profile is required.");
  if (!candidate.paymentDestinationVersionId) add("PAYMENT_DESTINATION_MISSING", "EMPLOYEE_BLOCKER", "A verified payment destination version is required.");
  if (candidate.conflictingIntervals) add("EFFECTIVE_DATE_CONFLICT", "EMPLOYEE_BLOCKER", "Conflicting effective-dated payroll inputs must be resolved.");
  return {
    findings,
    runBlocked: findings.some((finding) => finding.severity === "RUN_BLOCKER"),
    employeeBlocked: findings.some((finding) => finding.severity === "EMPLOYEE_BLOCKER"),
    inputHash: payrollDigest(candidate),
  };
}

export type EarningInput = {
  code: string; sourceType: "UNIT4" | "UNIT5" | "UNIT6" | "UNIT8" | "PAYROLL";
  sourceId: string; units?: Unit9Money; rate?: Unit9Money; fixedAmount?: Unit9Money;
  multiplier?: Unit9Money; taxableBaseCode: string; ruleVersionReference: string;
};

export function calculateEarnings(inputs: EarningInput[]) {
  return inputs.map((input, sequence) => {
    const amount = input.fixedAmount !== undefined
      ? payrollMoney(input.fixedAmount)
      : payrollMoney(input.units ?? "0").mul(payrollMoney(input.rate ?? "0")).mul(payrollMoney(input.multiplier ?? "1"));
    if (amount.isNegative()) throw new Error(`Earning ${input.code} cannot be negative.`);
    return { ...input, sequence, amount: roundPayroll(amount), explanation: { sourceType: input.sourceType, sourceId: input.sourceId, units: String(input.units ?? ""), rate: String(input.rate ?? ""), multiplier: String(input.multiplier ?? "1") } };
  });
}

export type TaxBand = { lowerExclusive: Unit9Money; upperInclusive?: Unit9Money | null; ratePercent: Unit9Money };
export type ProgressiveTaxRules = { version: string; annualizationPeriods: number; bands: TaxBand[]; roundingScale: number };

export function calculateProgressivePaye(input: { periodTaxableIncome: Unit9Money; priorYtdTaxableIncome: Unit9Money; priorYtdPaye: Unit9Money; rules: ProgressiveTaxRules }) {
  if (!input.rules.version.trim()) throw new Error("A certified tax rule version is required.");
  const currentTaxable = payrollMoney(input.periodTaxableIncome);
  const ytdTaxable = payrollMoney(input.priorYtdTaxableIncome).plus(currentTaxable);
  let annualTax = new Prisma.Decimal(0);
  const trace = input.rules.bands.map((band) => {
    const lower = payrollMoney(band.lowerExclusive);
    const upper = band.upperInclusive == null ? null : payrollMoney(band.upperInclusive);
    const taxableAtBand = Prisma.Decimal.max(0, Prisma.Decimal.min(ytdTaxable, upper ?? ytdTaxable).minus(lower));
    const tax = taxableAtBand.mul(payrollMoney(band.ratePercent)).div(100);
    annualTax = annualTax.plus(tax);
    return { lower: lower.toFixed(4), upper: upper?.toFixed(4) ?? null, taxable: taxableAtBand.toFixed(4), ratePercent: payrollMoney(band.ratePercent).toFixed(4), tax: roundPayroll(tax, input.rules.roundingScale).toFixed(input.rules.roundingScale) };
  });
  const currentPaye = Prisma.Decimal.max(0, roundPayroll(annualTax.minus(payrollMoney(input.priorYtdPaye)), input.rules.roundingScale));
  return { ruleVersion: input.rules.version, currentPaye, ytdTaxable: roundPayroll(ytdTaxable), ytdPaye: roundPayroll(payrollMoney(input.priorYtdPaye).plus(currentPaye)), trace };
}

export function calculationManifest(input: { snapshotHash: string; jurisdictionVersion: string; engineVersion: string; sources: Record<string, string[]>; ruleVersions: string[]; lines: PayrollLine[] }) {
  const manifest = { ...input, sources: Object.fromEntries(Object.entries(input.sources).sort(([a], [b]) => a.localeCompare(b))), ruleVersions: [...input.ruleVersions].sort(), lines: input.lines.map((line) => ({ ...line, amount: payrollMoney(line.amount).toFixed(4) })) };
  return { manifest, output: reconcileGrossToNet(input.lines), hash: payrollDigest(manifest) };
}

export type RiskFinding = { code: string; severity: "BLOCKER" | "HIGH" | "MEDIUM" | "LOW" | "INFO"; explanation: string };
export function payrollRisk(input: { gross: Unit9Money; net: Unit9Money; paye: Unit9Money; previousGross?: Unit9Money; duplicateSourceCodes?: string[]; separated?: boolean; regularEarnings?: Unit9Money; hourly?: boolean; lockedTimePresent?: boolean; destinationChangedNearCutoff?: boolean; manualAdjustment?: Unit9Money }) {
  const findings: RiskFinding[] = [];
  const gross = payrollMoney(input.gross); const net = payrollMoney(input.net); const paye = payrollMoney(input.paye);
  if (net.isNegative()) findings.push({ code: "NEGATIVE_NET", severity: "BLOCKER", explanation: "Net pay is below zero." });
  if (gross.isPositive() && paye.isZero()) findings.push({ code: "ZERO_PAYE", severity: "HIGH", explanation: "Positive gross pay produced zero PAYE and requires rule-backed review." });
  if (input.previousGross !== undefined && payrollMoney(input.previousGross).isPositive() && gross.minus(payrollMoney(input.previousGross)).abs().div(payrollMoney(input.previousGross)).greaterThan("0.5")) findings.push({ code: "GROSS_VARIANCE", severity: "HIGH", explanation: "Gross pay changed by more than 50% from the comparison period." });
  if (input.duplicateSourceCodes?.length) findings.push({ code: "DUPLICATE_SOURCE", severity: "BLOCKER", explanation: `Duplicate governed sources: ${input.duplicateSourceCodes.join(", ")}.` });
  if (input.separated && payrollMoney(input.regularEarnings ?? "0").isPositive()) findings.push({ code: "SEPARATED_REGULAR_PAY", severity: "BLOCKER", explanation: "A separated worker has unexpected regular earnings." });
  if (input.hourly && !input.lockedTimePresent) findings.push({ code: "HOURLY_TIME_MISSING", severity: "BLOCKER", explanation: "Hourly earnings lack approved locked time." });
  if (input.destinationChangedNearCutoff) findings.push({ code: "PAYMENT_DESTINATION_CHANGED", severity: "HIGH", explanation: "Payment destination changed near payroll cutoff." });
  if (payrollMoney(input.manualAdjustment ?? "0").abs().greaterThan(gross.mul("0.25"))) findings.push({ code: "LARGE_MANUAL_ADJUSTMENT", severity: "HIGH", explanation: "Manual adjustment exceeds 25% of gross pay." });
  return findings;
}

export type JournalLine = { accountCode: string; debit?: Unit9Money; credit?: Unit9Money; sourceReference: string };
export function reconcileJournal(lines: JournalLine[]) {
  const debit = lines.reduce((sum, line) => sum.plus(payrollMoney(line.debit ?? "0")), new Prisma.Decimal(0));
  const credit = lines.reduce((sum, line) => sum.plus(payrollMoney(line.credit ?? "0")), new Prisma.Decimal(0));
  if (!roundPayroll(debit).equals(roundPayroll(credit))) throw new Error("Payroll journal batch is not balanced.");
  return { debit: roundPayroll(debit), credit: roundPayroll(credit), balanced: true, hash: payrollDigest(lines.map((line) => ({ ...line, debit: payrollMoney(line.debit ?? "0").toFixed(4), credit: payrollMoney(line.credit ?? "0").toFixed(4) }))) };
}

export function retroDelta(original: PayrollLine[], corrected: PayrollLine[]) {
  const keys = new Set([...original.map((line) => `${line.category}:${line.code}`), ...corrected.map((line) => `${line.category}:${line.code}`)]);
  const amount = (lines: PayrollLine[], key: string) => lines.filter((line) => `${line.category}:${line.code}` === key).reduce((sum, line) => sum.plus(payrollMoney(line.amount)), new Prisma.Decimal(0));
  const deltas = [...keys].sort().map((key) => ({ key, amount: roundPayroll(amount(corrected, key).minus(amount(original, key))) })).filter((line) => !line.amount.isZero());
  return { deltas, hash: payrollDigest(deltas.map((line) => ({ key: line.key, amount: line.amount.toFixed(4) }))) };
}

export type FinalizationEvidence = {
  jurisdictionCertified: boolean; certificationComplete: boolean; inputsFrozen: boolean;
  authoritativeCalculation: boolean; employeeReconciliation: boolean; runReconciliation: boolean;
  unresolvedBlockers: number; independentApproval: boolean;
};

export function assertFinalizationReady(evidence: FinalizationEvidence) {
  const missing = Object.entries(evidence).flatMap(([key, value]) => key === "unresolvedBlockers" ? (value === 0 ? [] : [key]) : (value ? [] : [key]));
  if (missing.length) throw new Error(`Payroll cannot finalize; missing prerequisites: ${missing.join(", ")}.`);
  return payrollDigest(evidence);
}

export type PaymentState = "DRAFT" | "VALIDATED" | "APPROVED" | "EXPORTED" | "SUBMITTED" | "ACKNOWLEDGED" | "SETTLED" | "REJECTED" | "RETURNED" | "CANCELLED";
const paymentTransitions: Record<PaymentState, readonly PaymentState[]> = {
  DRAFT: ["VALIDATED", "CANCELLED"], VALIDATED: ["APPROVED", "REJECTED", "CANCELLED"], APPROVED: ["EXPORTED", "CANCELLED"],
  EXPORTED: ["SUBMITTED"], SUBMITTED: ["ACKNOWLEDGED", "REJECTED", "RETURNED"], ACKNOWLEDGED: ["SETTLED", "REJECTED", "RETURNED"],
  SETTLED: [], REJECTED: [], RETURNED: [], CANCELLED: [],
};
export function assertPaymentTransition(from: PaymentState, to: PaymentState) {
  if (!paymentTransitions[from].includes(to)) throw new Error(`Invalid payment transition ${from} -> ${to}.`);
  return to;
}

export function lateInputTreatment(input: { runFinalized: boolean; explicitlyAuthorizedRecalculation: boolean; sourceType: string; oldVersion: string; newVersion: string; affectedPeriod: string }) {
  if (input.oldVersion === input.newVersion) return { treatment: "NO_CHANGE", correlation: payrollDigest(input) } as const;
  if (input.runFinalized) return { treatment: "RETRO_TRIGGER", correlation: payrollDigest(input) } as const;
  if (input.explicitlyAuthorizedRecalculation) return { treatment: "RECALCULATE", correlation: payrollDigest(input) } as const;
  return { treatment: "GOVERNED_EXCEPTION_REQUIRED", correlation: payrollDigest(input) } as const;
}

export type PayrollAccessContext = { employeeId?: string | null; subjectEmployeeId?: string | null; permissions: ReadonlySet<string> };
export function payrollAccess(context: PayrollAccessContext) {
  const own = Boolean(context.employeeId && context.employeeId === context.subjectEmployeeId);
  return {
    result: own || context.permissions.has("payroll.read"),
    ownFinalizedPayslip: own,
    calculate: context.permissions.has("payroll.calculate"),
    approvePayroll: context.permissions.has("payroll.approve"),
    approvePayment: context.permissions.has("payroll.payment.approve"),
    submitPayment: context.permissions.has("payroll.payment.submit"),
    bankDetails: context.permissions.has("payroll.read_bank_details"),
    risk: context.permissions.has("payroll.review") || context.permissions.has("payroll.audit.read"),
  };
}
