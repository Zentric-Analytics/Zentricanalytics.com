import { z } from "zod";

export const leaveTypeInput = z.object({
  code: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9_-]+$/).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().transform((value) => value || undefined),
  unit: z.enum(["DAYS", "HOURS"]),
  paid: z.coerce.boolean(),
  requiresAttachment: z.coerce.boolean(),
});

export const leavePolicyInput = z.object({
  leaveTypeId: z.string().cuid(),
  name: z.string().trim().min(2).max(120),
  entitlement: z.coerce.number().nonnegative().max(10000),
  accrualFrequency: z.enum(["NONE", "MONTHLY", "QUARTERLY", "ANNUALLY"]),
  accrualAmount: z.coerce.number().nonnegative().max(10000).optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  maximumBalance: z.coerce.number().nonnegative().max(10000).optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  carryOverLimit: z.coerce.number().nonnegative().max(10000).optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  carryOverExpiryMonth: z.coerce.number().int().min(1).max(12).optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  minimumNoticeDays: z.coerce.number().int().nonnegative().max(365),
  maximumConsecutive: z.coerce.number().positive().max(10000).optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  probationMonths: z.coerce.number().int().nonnegative().max(60),
  allowNegativeBalance: z.coerce.boolean(),
  requiresApproval: z.coerce.boolean(),
  entitlementModel: z.enum(["ENTITLEMENT", "EVENT_LIMITED", "UNLIMITED", "UNPAID", "STATUTORY", "LONG_TERM"]).default("ENTITLEMENT"),
  timezone: z.string().trim().min(3).max(100).default("UTC"),
  minimumRequest: z.coerce.number().positive().max(10000).optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  evidenceClass: z.string().trim().max(100).optional().transform((value) => value || undefined),
  evidenceRetentionDays: z.coerce.number().int().positive().max(36500).optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  workflowDefinitionKey: z.string().trim().max(120).optional().transform((value) => value || undefined),
  effectiveFrom: z.coerce.date(),
});

export const leaveRequestInput = z.object({
  leaveTypeId: z.string().cuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  hours: z.coerce.number().positive().max(24).optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  reason: z.string().trim().min(3).max(1000),
}).refine(({ startDate, endDate }) => endDate >= startDate, { message: "Leave end date cannot be before start date.", path: ["endDate"] });

function utcDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function countWorkingDays(startDate: Date, endDate: Date, workingDays = [1, 2, 3, 4, 5], holidayDates: Date[] = []) {
  if (endDate < startDate) throw new Error("Leave end date cannot be before start date.");
  const holidays = new Set(holidayDates.map(utcDateKey));
  let count = 0;
  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const end = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());
  while (cursor.getTime() <= end) {
    if (workingDays.includes(cursor.getUTCDay()) && !holidays.has(utcDateKey(cursor))) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export function availableLeaveBalance(balance: { opening: number; accrued: number; carriedOver: number; adjusted: number; reserved: number; used: number; expired: number }) {
  return balance.opening + balance.accrued + balance.carriedOver + balance.adjusted - balance.reserved - balance.used - balance.expired;
}

export function validateLeaveEligibility(input: {
  amount: number;
  available: number;
  allowNegativeBalance: boolean;
  maximumConsecutive?: number | null;
  minimumNoticeDays: number;
  startDate: Date;
  now: Date;
  hireDate?: Date | null;
  probationMonths: number;
}) {
  const issues: string[] = [];
  if (input.amount <= 0) issues.push("The selected period contains no working leave units.");
  if (!input.allowNegativeBalance && input.amount > input.available) issues.push("Insufficient available leave balance.");
  if (input.maximumConsecutive && input.amount > input.maximumConsecutive) issues.push("Request exceeds the maximum consecutive leave allowance.");
  const noticeMs = input.startDate.getTime() - input.now.getTime();
  if (noticeMs < input.minimumNoticeDays * 86_400_000) issues.push("Request does not meet the minimum notice period.");
  if (input.hireDate) {
    const eligibleAt = new Date(input.hireDate);
    eligibleAt.setUTCMonth(eligibleAt.getUTCMonth() + input.probationMonths);
    if (input.startDate < eligibleAt) issues.push("Employee is not yet eligible under the policy probation period.");
  }
  return issues;
}

export function workingDayNumbers(setting: unknown) {
  const mapping: Record<string, number> = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };
  if (!Array.isArray(setting)) return [1, 2, 3, 4, 5];
  const days = setting.flatMap((value) => typeof value === "string" && value in mapping ? [mapping[value]] : []);
  return days.length ? [...new Set(days)] : [1, 2, 3, 4, 5];
}

export function scheduledAccrualAmount(policy: { entitlement: number; accrualFrequency: "NONE" | "MONTHLY" | "QUARTERLY" | "ANNUALLY"; accrualAmount?: number | null }) {
  if (policy.accrualFrequency === "NONE" || policy.accrualFrequency === "ANNUALLY") return 0;
  if (policy.accrualAmount !== undefined && policy.accrualAmount !== null) return policy.accrualAmount;
  return policy.entitlement / (policy.accrualFrequency === "MONTHLY" ? 12 : 4);
}

export function capAccrual(amount: number, available: number, maximumBalance?: number | null) {
  if (maximumBalance === undefined || maximumBalance === null) return Math.max(0, amount);
  return Math.max(0, Math.min(amount, maximumBalance - available));
}
