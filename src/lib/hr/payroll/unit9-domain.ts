import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

export type Unit9Money = string | number | Prisma.Decimal;

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonical(child)]));
  }
  return value;
}

export function payrollDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export function payrollMoney(value: Unit9Money, label = "amount") {
  const text = String(value).trim();
  if (!/^-?(0|[1-9]\d*)(\.\d{1,4})?$/.test(text)) {
    throw new Error(`${label} must be a fixed-precision amount with at most four decimal places.`);
  }
  return new Prisma.Decimal(text);
}

export function roundPayroll(value: Unit9Money, scale = 2, mode = Prisma.Decimal.ROUND_HALF_UP) {
  if (!Number.isInteger(scale) || scale < 0 || scale > 4) throw new Error("Payroll rounding scale must be between zero and four.");
  return payrollMoney(value).toDecimalPlaces(scale, mode);
}

export type CertifiedPackage = {
  jurisdictionCode: string;
  status: "DRAFT" | "REVIEW_REQUIRED" | "TESTING" | "CERTIFIED" | "SCHEDULED" | "ACTIVE" | "SUPERSEDED" | "RETIRED";
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  certifiedAt?: Date | null;
  sourceEvidenceCount: number;
};

export function assertCertifiedJurisdictionPackage(packages: CertifiedPackage[], jurisdictionCode: string, payrollDate: Date) {
  const code = jurisdictionCode.trim().toUpperCase();
  const match = packages.find((candidate) => candidate.jurisdictionCode === code
    && (candidate.status === "CERTIFIED" || candidate.status === "ACTIVE")
    && candidate.certifiedAt
    && candidate.sourceEvidenceCount > 0
    && candidate.effectiveFrom <= payrollDate
    && (!candidate.effectiveTo || candidate.effectiveTo >= payrollDate));
  if (!match) throw new Error(`Payroll cannot finalize: no certified ${code} jurisdiction package covers the payroll date.`);
  return match;
}

export type PayrollLine = {
  code: string;
  category: "EARNING" | "PAYE" | "EMPLOYEE_DEDUCTION" | "EMPLOYER_CONTRIBUTION" | "ADJUSTMENT";
  amount: Unit9Money;
};

export function reconcileGrossToNet(lines: PayrollLine[]) {
  const total = (categories: PayrollLine["category"][]) => lines
    .filter((line) => categories.includes(line.category))
    .reduce((sum, line) => sum.plus(payrollMoney(line.amount, line.code)), new Prisma.Decimal(0));
  const gross = total(["EARNING"]);
  const paye = total(["PAYE"]);
  const employeeDeductions = total(["EMPLOYEE_DEDUCTION"]);
  const adjustments = total(["ADJUSTMENT"]);
  const employerContributions = total(["EMPLOYER_CONTRIBUTION"]);
  const net = gross.minus(paye).minus(employeeDeductions).plus(adjustments);
  if (net.isNegative()) throw new Error("Payroll reconciliation produced negative net pay.");
  return {
    gross: roundPayroll(gross), paye: roundPayroll(paye), employeeDeductions: roundPayroll(employeeDeductions),
    adjustments: roundPayroll(adjustments), employerContributions: roundPayroll(employerContributions), net: roundPayroll(net),
    reconciles: roundPayroll(gross.minus(paye).minus(employeeDeductions).plus(adjustments)).equals(roundPayroll(net)),
  };
}

export type Unit9RunState = "DRAFT" | "CERTIFYING" | "BLOCKED" | "CERTIFIED" | "FROZEN" | "CALCULATING" | "CALCULATED" | "RECONCILED" | "APPROVED" | "FINALIZED" | "CANCELLED";
const runTransitions: Record<Unit9RunState, readonly Unit9RunState[]> = {
  DRAFT: ["CERTIFYING", "CANCELLED"], CERTIFYING: ["BLOCKED", "CERTIFIED", "CANCELLED"], BLOCKED: ["CERTIFYING", "CANCELLED"],
  CERTIFIED: ["FROZEN", "CERTIFYING", "CANCELLED"], FROZEN: ["CALCULATING", "CANCELLED"], CALCULATING: ["CALCULATED", "BLOCKED"],
  CALCULATED: ["RECONCILED", "CALCULATING", "CANCELLED"], RECONCILED: ["APPROVED", "CALCULATING", "CANCELLED"],
  APPROVED: ["FINALIZED"], FINALIZED: [], CANCELLED: [],
};

export function assertUnit9RunTransition(from: Unit9RunState, to: Unit9RunState) {
  if (!runTransitions[from].includes(to)) throw new Error(`Invalid Unit 9 payroll transition ${from} -> ${to}.`);
  return to;
}

export function assertIndependentPayrollApproval(input: {
  actorUserId: string;
  createdById: string;
  calculatedById?: string | null;
  reconciledById?: string | null;
  priorApproverIds?: string[];
}) {
  const prohibited = new Set([input.createdById, input.calculatedById, input.reconciledById, ...(input.priorApproverIds ?? [])].filter(Boolean));
  if (prohibited.has(input.actorUserId)) throw new Error("Independent payroll approval requires a different authorized actor.");
}

export function paymentInstructionKey(input: { organizationId: string; finalizedResultId: string; destinationVersionId: string; amount: Unit9Money; currency: string }) {
  return `unit9:payment:${payrollDigest({
    organizationId: input.organizationId,
    finalizedResultId: input.finalizedResultId,
    destinationVersionId: input.destinationVersionId,
    amount: payrollMoney(input.amount).toFixed(4),
    currency: input.currency.trim().toUpperCase(),
  })}`;
}

export function assertRegulatorySourceUrl(raw: string, approvedHosts: readonly string[]) {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Regulatory sources must use HTTPS.");
  if (!approvedHosts.includes(url.hostname.toLowerCase())) throw new Error("Regulatory source host is not approved.");
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase())) throw new Error("Internal regulatory source addresses are forbidden.");
  return url.toString();
}
