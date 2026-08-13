import { createHash } from "node:crypto";
import type { HrCompCycleStatus, HrCompDecisionStatus, HrCompRecommendationStatus } from "@prisma/client";

export type MoneyInput = string | number | { toString(): string };

export function compensationHash(value: unknown) {
  const normalize = (item: unknown): unknown => Array.isArray(item) ? item.map(normalize) : item && typeof item === "object"
    ? Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, normalize(child)]))
    : item;
  return createHash("sha256").update(JSON.stringify(normalize(value))).digest("hex");
}

export function parseMoney(value: MoneyInput, label = "amount") {
  const text = String(value).trim();
  if (!/^(0|[1-9]\d*)(\.\d{1,4})?$/.test(text)) throw new Error(`${label} must be a non-negative fixed-precision amount with at most four decimal places.`);
  return text;
}

export function assertCurrency(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw new Error("Currency must be a three-letter ISO code.");
  return normalized;
}

export function rangePosition(amountInput: MoneyInput, minimumInput: MoneyInput, midpointInput: MoneyInput, maximumInput: MoneyInput) {
  const amount = Number(parseMoney(amountInput));
  const minimum = Number(parseMoney(minimumInput, "minimum"));
  const midpoint = Number(parseMoney(midpointInput, "midpoint"));
  const maximum = Number(parseMoney(maximumInput, "maximum"));
  if (!(minimum <= midpoint && midpoint <= maximum) || midpoint <= 0) throw new Error("Band range must satisfy minimum <= midpoint <= maximum and midpoint must be positive.");
  const ratio = amount / midpoint;
  const category = amount < minimum ? "BELOW_MINIMUM" : amount > maximum ? "ABOVE_MAXIMUM" : ratio < 0.9 ? "LOWER_RANGE" : ratio <= 1.1 ? "AROUND_MIDPOINT" : "UPPER_RANGE";
  return { category, compaRatio: ratio.toFixed(4) } as const;
}

export function promotionRecommendationFloor(current: MoneyInput, bandMinimum: MoneyInput, proposed: MoneyInput, exceptionApproved = false) {
  const currentAmount = Number(parseMoney(current, "current amount"));
  const minimum = Number(parseMoney(bandMinimum, "band minimum"));
  const proposedAmount = Number(parseMoney(proposed, "proposed amount"));
  if (proposedAmount < currentAmount) throw new Error("Promotion compensation cannot reduce base pay through the promotion path.");
  if (proposedAmount < minimum && !exceptionApproved) throw new Error("Promotion compensation must reach the target band minimum or use an approved exception.");
  return proposedAmount.toFixed(4);
}

export type BudgetEntry = { entryType: "ALLOCATE" | "RESERVE" | "RELEASE" | "CONSUME" | "ADJUST"; amount: MoneyInput };

export function reconcileBudget(allocatedInput: MoneyInput, entries: BudgetEntry[]) {
  const allocated = Number(parseMoney(allocatedInput, "allocated amount"));
  let adjustment = 0; let reserved = 0; let consumed = 0;
  for (const entry of entries) {
    const amount = Number(parseMoney(entry.amount));
    if (entry.entryType === "ALLOCATE" || entry.entryType === "ADJUST") adjustment += amount;
    if (entry.entryType === "RESERVE") reserved += amount;
    if (entry.entryType === "RELEASE") reserved -= amount;
    if (entry.entryType === "CONSUME") { reserved -= amount; consumed += amount; }
  }
  if (reserved < -0.00001) throw new Error("Budget ledger releases or consumes more than it reserved.");
  const available = allocated + adjustment - reserved - consumed;
  return { allocated: allocated.toFixed(4), adjusted: adjustment.toFixed(4), reserved: reserved.toFixed(4), consumed: consumed.toFixed(4), available: available.toFixed(4), balanced: available >= -0.00001 };
}

export function assertBudgetAvailable(allocated: MoneyInput, entries: BudgetEntry[], requested: MoneyInput) {
  const state = reconcileBudget(allocated, entries);
  if (Number(parseMoney(requested, "requested budget")) > Number(state.available)) throw new Error("Insufficient compensation budget remains for this reservation.");
  return state;
}

const recommendationTransitions: Record<HrCompRecommendationStatus, readonly HrCompRecommendationStatus[]> = {
  DRAFT: ["SUBMITTED", "WITHDRAWN"], SUBMITTED: ["HR_REVIEW", "RETURNED", "REJECTED", "WITHDRAWN"], HR_REVIEW: ["APPROVED", "RETURNED", "REJECTED"],
  APPROVED: ["SUPERSEDED"], RETURNED: ["SUBMITTED", "WITHDRAWN"], REJECTED: [], WITHDRAWN: [], SUPERSEDED: [],
};
const cycleTransitions: Record<HrCompCycleStatus, readonly HrCompCycleStatus[]> = {
  DRAFT: ["PUBLISHED", "CANCELLED"], PUBLISHED: ["OPEN", "CANCELLED"], OPEN: ["REVIEW", "CANCELLED"], REVIEW: ["FINALIZING", "OPEN"], FINALIZING: ["CLOSED", "REVIEW"], CLOSED: [], CANCELLED: [],
};
const decisionTransitions: Record<HrCompDecisionStatus, readonly HrCompDecisionStatus[]> = {
  PENDING: ["APPROVED", "CANCELLED"], APPROVED: ["SCHEDULED", "EFFECTIVE", "CANCELLED"], SCHEDULED: ["EFFECTIVE", "CANCELLED", "FAILED"],
  EFFECTIVE: ["SUPERSEDED", "CORRECTED"], CANCELLED: [], SUPERSEDED: [], CORRECTED: [], FAILED: ["SCHEDULED", "CANCELLED"],
};

function transition<T extends string>(map: Record<T, readonly T[]>, from: T, to: T, label: string) {
  if (!map[from].includes(to)) throw new Error(`Invalid ${label} transition ${from} -> ${to}.`);
  return to;
}
export const transitionRecommendation = (from: HrCompRecommendationStatus, to: HrCompRecommendationStatus) => transition(recommendationTransitions, from, to, "recommendation");
export const transitionCompCycle = (from: HrCompCycleStatus, to: HrCompCycleStatus) => transition(cycleTransitions, from, to, "compensation cycle");
export const transitionCompDecision = (from: HrCompDecisionStatus, to: HrCompDecisionStatus) => transition(decisionTransitions, from, to, "compensation decision");

export function assertIndependentCompensationApproval(input: { actorUserId: string; managerUserId?: string | null; employeeUserId?: string | null; priorApproverIds?: string[] }) {
  if ([input.managerUserId, input.employeeUserId, ...(input.priorApproverIds ?? [])].filter(Boolean).includes(input.actorUserId)) throw new Error("Independent compensation approval is required.");
}

export type CompensationViewer = { userId: string; employeeId?: string | null; isEffectiveManager?: boolean; hasScopedHrGrant?: boolean; hasCompensationGrant?: boolean; isBudgetOwner?: boolean; isPayrollReader?: boolean; isAuditor?: boolean };

export function compensationAccess(viewer: CompensationViewer, subjectEmployeeId: string) {
  const own = viewer.employeeId === subjectEmployeeId;
  return {
    finalizedPay: own || viewer.isEffectiveManager === true || viewer.hasScopedHrGrant === true || viewer.hasCompensationGrant === true || viewer.isPayrollReader === true || viewer.isAuditor === true,
    restrictedNarrative: viewer.hasCompensationGrant === true,
    budget: viewer.hasCompensationGrant === true || viewer.isBudgetOwner === true,
    payrollFields: viewer.hasCompensationGrant === true || viewer.isPayrollReader === true,
    mutateArchitecture: viewer.hasCompensationGrant === true,
  };
}

export function assertNoConflictingEvent(existing: string[], proposed: string) {
  const conflicts: Record<string, string[]> = {
    MERIT: ["PROMOTION", "MARKET_ADJUSTMENT", "TRANSFER_ADJUSTMENT", "LEGAL_ADJUSTMENT", "CORRECTION"],
    PROMOTION: ["MERIT", "RETENTION_ADJUSTMENT", "CORRECTION"],
    MARKET_ADJUSTMENT: ["MERIT", "CORRECTION"], RETENTION_ADJUSTMENT: ["PROMOTION", "CORRECTION"],
    TRANSFER_ADJUSTMENT: ["MERIT", "CORRECTION"], LEGAL_ADJUSTMENT: ["MERIT", "CORRECTION"], CORRECTION: ["MERIT", "PROMOTION", "MARKET_ADJUSTMENT", "RETENTION_ADJUSTMENT", "TRANSFER_ADJUSTMENT", "LEGAL_ADJUSTMENT"],
  };
  if (existing.some((event) => conflicts[proposed]?.includes(event))) throw new Error(`Compensation event ${proposed} conflicts with an unresolved event.`);
}

export function payrollHandoffKey(subjectType: "record" | "award", subjectId: string, version = 1) {
  if (!subjectId.trim()) throw new Error("Payroll handoff subject is required.");
  return `unit8:${subjectType}:${subjectId}:v${version}`;
}
