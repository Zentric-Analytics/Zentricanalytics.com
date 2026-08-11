import { createHash } from "node:crypto";
import { z } from "zod";
import { validateWeeklyPattern } from "../leave/unit5";

function localScheduleMinute(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function scheduledMinutesForBusinessDate(weeklyPattern: unknown, businessDate: Date) {
  const weekday = businessDate.getUTCDay();
  return validateWeeklyPattern(weeklyPattern)
    .filter((interval) => interval.weekday === weekday)
    .reduce((total, interval) => total + localScheduleMinute(interval.end) - localScheduleMinute(interval.start), 0);
}

export function assertCorrectionSourceVersion(expected: unknown, actual: number) {
  if (!Number.isInteger(expected) || expected !== actual) {
    throw new Error("This correction is stale because the attendance record changed. Submit a new correction against the current version.");
  }
}

export const trackingModes = ["NONE", "EXCEPTION_BASED", "CLOCK", "TIMESHEET"] as const;
export type TrackingMode = (typeof trackingModes)[number];

export function stableJsonStringify(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item !== null && typeof item === "object") {
      return Object.fromEntries(Object.entries(item as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalize(child)]));
    }
    return item;
  };
  return JSON.stringify(normalize(value));
}

export type PolicyContext = {
  employeeId: string;
  workRelationshipId: string;
  assignmentId: string;
  legalEntityId?: string | null;
  countryCode?: string | null;
  employmentType?: string | null;
  positionId?: string | null;
  gradeId?: string | null;
  departmentId?: string | null;
  locationId?: string | null;
  workMode?: string | null;
};

export type PolicyCandidate = {
  id: string;
  policyVersionId: string;
  priority: number;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  explicit?: { employeeId: string; workRelationshipId: string; assignmentId: string } | null;
  scope?: Partial<Omit<PolicyContext, "employeeId" | "workRelationshipId" | "assignmentId">>;
};

const activeAt = (candidate: PolicyCandidate, at: Date) => candidate.effectiveFrom <= at && (!candidate.effectiveTo || candidate.effectiveTo > at);

function scopeScore(candidate: PolicyCandidate, context: PolicyContext) {
  if (candidate.explicit) {
    return candidate.explicit.employeeId === context.employeeId && candidate.explicit.workRelationshipId === context.workRelationshipId && candidate.explicit.assignmentId === context.assignmentId ? 10_000 : -1;
  }
  let score = 0;
  for (const [key, value] of Object.entries(candidate.scope ?? {})) {
    if (value == null) continue;
    if (context[key as keyof PolicyContext] !== value) return -1;
    score += 1;
  }
  return score;
}

export function resolveTimePolicy(candidates: PolicyCandidate[], context: PolicyContext, at: Date) {
  const matching = candidates.map((candidate) => ({ candidate, score: activeAt(candidate, at) ? scopeScore(candidate, context) : -1 })).filter(({ score }) => score >= 0);
  if (!matching.length) throw new Error("No effective time policy matches this assignment.");
  matching.sort((a, b) => b.score - a.score || b.candidate.priority - a.candidate.priority || a.candidate.id.localeCompare(b.candidate.id));
  const winner = matching[0];
  const ambiguous = matching[1] && matching[1].score === winner.score && matching[1].candidate.priority === winner.candidate.priority;
  if (ambiguous) throw new Error("Time policy resolution is ambiguous at equal precedence and priority.");
  return { policyVersionId: winner.candidate.policyVersionId, applicabilityId: winner.candidate.id, score: winner.score, consideredIds: matching.map(({ candidate }) => candidate.id) };
}

export const scheduleIntervalInput = z.object({
  weekday: z.number().int().min(0).max(6),
  startLocalMinute: z.number().int().min(0).max(1439),
  endLocalMinute: z.number().int().min(0).max(1439),
  endDayOffset: z.number().int().min(0).max(1).default(0),
  expectedMinutes: z.number().int().positive().max(24 * 60),
  paidBreakMinutes: z.number().int().min(0).default(0),
  unpaidBreakMinutes: z.number().int().min(0).default(0),
}).superRefine((value, ctx) => {
  const span = value.endLocalMinute + value.endDayOffset * 1440 - value.startLocalMinute;
  if (span <= 0) ctx.addIssue({ code: "custom", message: "Schedule interval must end after it starts, including overnight offset." });
  if (value.expectedMinutes + value.paidBreakMinutes + value.unpaidBreakMinutes > span) ctx.addIssue({ code: "custom", message: "Expected work and breaks exceed the schedule interval." });
});

export function assertNoScheduleOverlap(intervals: Array<z.input<typeof scheduleIntervalInput>>) {
  const parsed = intervals.map((item) => scheduleIntervalInput.parse(item));
  const expanded = parsed.map((item) => ({ ...item, start: item.weekday * 1440 + item.startLocalMinute, end: item.weekday * 1440 + item.endLocalMinute + item.endDayOffset * 1440 })).sort((a, b) => a.start - b.start);
  for (let index = 1; index < expanded.length; index += 1) if (expanded[index].start < expanded[index - 1].end) throw new Error("Published schedule intervals overlap.");
  return parsed;
}

export type ClockState = "NOT_STARTED" | "CLOCKED_IN" | "ON_BREAK" | "CLOCKED_OUT" | "CORRECTION_REQUIRED";
export type ClockEventType = "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END";
const clockTransitions: Record<ClockState, Partial<Record<ClockEventType, ClockState>>> = {
  NOT_STARTED: { CLOCK_IN: "CLOCKED_IN" },
  CLOCKED_IN: { CLOCK_OUT: "CLOCKED_OUT", BREAK_START: "ON_BREAK" },
  ON_BREAK: { BREAK_END: "CLOCKED_IN" },
  CLOCKED_OUT: {},
  CORRECTION_REQUIRED: {},
};

export function transitionClock(state: ClockState, event: ClockEventType) {
  const next = clockTransitions[state][event];
  if (!next) return { state: "CORRECTION_REQUIRED" as const, authoritative: false, reason: `${event} is invalid while ${state}` };
  return { state: next, authoritative: true, reason: null };
}

export type TimeEventInput = {
  organizationId: string;
  employeeId: string;
  workRelationshipId: string;
  assignmentId: string;
  eventType: ClockEventType;
  occurredAt: Date;
  receivedAt: Date;
  timezone: string;
  idempotencyKey: string;
  maximumOfflineDelayMin: number;
  maximumFutureSkewMin: number;
};

export function validateTimeEvent(input: TimeEventInput) {
  if (!trackingModes.length || !input.idempotencyKey.trim()) throw new Error("A trusted time-event idempotency receipt is required.");
  try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }).format(input.occurredAt); } catch { throw new Error("Time-event timezone must be a valid IANA timezone."); }
  const skewMinutes = (input.occurredAt.getTime() - input.receivedAt.getTime()) / 60_000;
  if (skewMinutes > input.maximumFutureSkewMin) throw new Error("Time event is impossibly far in the future.");
  if (-skewMinutes > input.maximumOfflineDelayMin) throw new Error("Offline time-event replay exceeded the configured delay.");
  const payloadHash = createHash("sha256").update(JSON.stringify({ organizationId: input.organizationId, employeeId: input.employeeId, workRelationshipId: input.workRelationshipId, assignmentId: input.assignmentId, eventType: input.eventType, occurredAt: input.occurredAt.toISOString(), timezone: input.timezone })).digest("hex");
  return { payloadHash, replayed: input.receivedAt.getTime() - input.occurredAt.getTime() > 60_000 };
}

export function assertIdempotentReplay(existing: { payloadHash: string }, incomingPayloadHash: string) {
  if (existing.payloadHash !== incomingPayloadHash) throw new Error("Conflicting payload reused an existing time-event idempotency key.");
  return "REPLAY" as const;
}

export type InterpretationInput = {
  trackingMode: TrackingMode;
  scheduledMinutes: number;
  workedMinutes: number;
  approvedPaidLeaveMinutes?: number;
  isHoliday?: boolean;
  graceMinutes?: number;
  missedClockIn?: boolean;
  missedClockOut?: boolean;
  breakException?: boolean;
};

export function interpretAttendance(input: InterpretationInput) {
  const scheduled = Math.max(0, input.scheduledMinutes);
  const worked = Math.max(0, input.workedMinutes);
  const leave = Math.max(0, input.approvedPaidLeaveMinutes ?? 0);
  if (worked + leave > scheduled && worked <= scheduled && leave > 0) throw new Error("Worked and approved leave minutes overlap beyond the scheduled interval.");
  if (input.isHoliday && scheduled === 0) return { outcome: "HOLIDAY" as const, scheduledMinutes: 0, workedMinutes: worked, paidLeaveMinutes: 0, underTimeMinutes: 0, overtimeMinutes: worked };
  if (scheduled === 0) return { outcome: "NON_WORKING_DAY" as const, scheduledMinutes: 0, workedMinutes: worked, paidLeaveMinutes: 0, underTimeMinutes: 0, overtimeMinutes: worked };
  if (leave >= scheduled && worked === 0) return { outcome: "APPROVED_LEAVE" as const, scheduledMinutes: scheduled, workedMinutes: 0, paidLeaveMinutes: scheduled, underTimeMinutes: 0, overtimeMinutes: 0 };
  if (input.missedClockIn) return { outcome: "MISSED_CLOCK_IN" as const, scheduledMinutes: scheduled, workedMinutes: worked, paidLeaveMinutes: leave, underTimeMinutes: Math.max(0, scheduled - worked - leave), overtimeMinutes: 0 };
  if (input.missedClockOut) return { outcome: "MISSED_CLOCK_OUT" as const, scheduledMinutes: scheduled, workedMinutes: worked, paidLeaveMinutes: leave, underTimeMinutes: 0, overtimeMinutes: 0 };
  if (input.breakException) return { outcome: "BREAK_EXCEPTION" as const, scheduledMinutes: scheduled, workedMinutes: worked, paidLeaveMinutes: leave, underTimeMinutes: Math.max(0, scheduled - worked - leave), overtimeMinutes: Math.max(0, worked + leave - scheduled) };
  const delta = worked + leave - scheduled;
  const grace = input.graceMinutes ?? 0;
  const outcome = delta > grace ? "OVERTIME_CANDIDATE" : delta < -grace ? (worked === 0 && leave === 0 ? "ABSENT" : "UNDER_TIME") : "PRESENT";
  return { outcome, scheduledMinutes: scheduled, workedMinutes: worked, paidLeaveMinutes: leave, underTimeMinutes: Math.max(0, -delta), overtimeMinutes: Math.max(0, delta) };
}

export const timesheetTransitions = {
  DRAFT: ["SUBMITTED"], SUBMITTED: ["IN_REVIEW", "WITHDRAWN"], IN_REVIEW: ["APPROVED", "RETURNED", "REJECTED"], RETURNED: ["SUBMITTED"], REJECTED: [], APPROVED: ["LOCKED"], LOCKED: ["CORRECTED_AFTER_LOCK"], WITHDRAWN: [], CORRECTED_AFTER_LOCK: [],
} as const;

export function assertTimesheetTransition(from: keyof typeof timesheetTransitions, to: string) {
  if (!(timesheetTransitions[from] as readonly string[]).includes(to)) throw new Error(`Invalid timesheet transition ${from} -> ${to}.`);
}

export function assertIndependentApproval(input: { employeeUserId?: string | null; actorUserId: string; submittedById?: string | null }) {
  if (input.actorUserId === input.employeeUserId || input.actorUserId === input.submittedById) throw new Error("Employees cannot approve their own authoritative time.");
}

export function classifyOvertime(input: { dailyExtraMinutes: number; weeklyExtraMinutes: number; weekend: boolean; holiday: boolean; shiftPremium: boolean; allowStacking: boolean }) {
  const candidates = [input.holiday && "PUBLIC_HOLIDAY", input.weekend && "WEEKEND", input.dailyExtraMinutes > 0 && "DAILY_OVERTIME", input.weeklyExtraMinutes > 0 && "WEEKLY_OVERTIME", input.shiftPremium && "SHIFT_PREMIUM"].filter(Boolean) as string[];
  return input.allowStacking ? candidates : candidates.slice(0, 1);
}

export function assertPeriodLock(input: { status: string; expectedVersion: number; actualVersion: number; actorHasLockPermission: boolean }) {
  if (!input.actorHasLockPermission) throw new Error("Attendance period locking requires explicit permission.");
  if (input.status !== "APPROVED") throw new Error("Only an approved attendance period can be locked.");
  if (input.expectedVersion !== input.actualVersion) throw new Error("Attendance period changed; refresh before locking.");
}
