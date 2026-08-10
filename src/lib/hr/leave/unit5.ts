import { z } from "zod";

export type Unit5PolicyCandidate = {
  id: string;
  priority: number;
  explicitEmployee: boolean;
  countryCode?: string | null;
  legalEntityId?: string | null;
  locationId?: string | null;
  employmentType?: string | null;
  gradeId?: string | null;
};

export type Unit5EmployeeContext = {
  countryCode?: string | null;
  legalEntityId?: string | null;
  locationId?: string | null;
  employmentType?: string | null;
  gradeId?: string | null;
};

function scopeMatches(candidate: Unit5PolicyCandidate, context: Unit5EmployeeContext) {
  return (["countryCode", "legalEntityId", "locationId", "employmentType", "gradeId"] as const)
    .every((key) => !candidate[key] || candidate[key] === context[key]);
}

function specificity(candidate: Unit5PolicyCandidate) {
  if (candidate.explicitEmployee) return 1_000;
  const dimensions = [candidate.countryCode, candidate.legalEntityId, candidate.locationId, candidate.employmentType, candidate.gradeId].filter(Boolean).length;
  if (candidate.legalEntityId && candidate.locationId && candidate.employmentType && candidate.gradeId) return 500 + dimensions;
  if (candidate.legalEntityId && candidate.locationId) return 400 + dimensions;
  if (candidate.legalEntityId) return 300 + dimensions;
  if (candidate.countryCode) return 200 + dimensions;
  return 100 + dimensions;
}

export function resolveLeavePolicy(candidates: Unit5PolicyCandidate[], context: Unit5EmployeeContext) {
  const ranked = candidates.filter((candidate) => scopeMatches(candidate, context)).map((candidate) => ({ candidate, rank: specificity(candidate) }));
  if (!ranked.length) throw new Error("No leave policy applies to this employee and effective date.");
  ranked.sort((a, b) => b.rank - a.rank || b.candidate.priority - a.candidate.priority || a.candidate.id.localeCompare(b.candidate.id));
  const winner = ranked[0];
  const ambiguous = ranked[1] && ranked[1].rank === winner.rank && ranked[1].candidate.priority === winner.candidate.priority;
  if (ambiguous) throw new Error("Leave policy resolution is ambiguous; configure an explicit priority or narrower scope.");
  return { policyId: winner.candidate.id, rank: winner.rank, explanation: winner.candidate.explicitEmployee ? "explicit employee assignment" : `scope rank ${winner.rank}; priority ${winner.candidate.priority}` };
}

export const weeklyPatternSchema = z.array(z.object({
  weekday: z.number().int().min(0).max(6),
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
})).max(21);

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function validateWeeklyPattern(input: unknown) {
  const pattern = weeklyPatternSchema.parse(input);
  for (const interval of pattern) if (minutes(interval.end) <= minutes(interval.start)) throw new Error("Work schedule end time must be after start time.");
  for (let weekday = 0; weekday <= 6; weekday += 1) {
    const intervals = pattern.filter((item) => item.weekday === weekday).sort((a, b) => minutes(a.start) - minutes(b.start));
    for (let i = 1; i < intervals.length; i += 1) if (minutes(intervals[i].start) < minutes(intervals[i - 1].end)) throw new Error("Work schedule intervals cannot overlap.");
  }
  return pattern;
}

export function reconstructUnit5Balance(entries: Array<{ kind: string; amount: number; impactSign?: number }>) {
  return entries.reduce((total, entry) => {
    const naturalSign = ["GRANT", "ACCRUAL", "CARRYOVER_IN", "RESERVATION_RELEASE"].includes(entry.kind) ? 1 : ["CARRYOVER_OUT", "RESERVATION", "CONSUMPTION", "EXPIRY"].includes(entry.kind) ? -1 : entry.impactSign ?? 1;
    return total + entry.amount * naturalSign;
  }, 0);
}

export function projectedPeriodBalance(period: { granted: number; accrued: number; carriedOver: number; carriedOut?: number; adjusted: number; reserved: number; consumed: number; expired: number }) {
  return period.granted + period.accrued + period.carriedOver + period.adjusted - (period.carriedOut ?? 0) - period.reserved - period.consumed - period.expired;
}

export function expirableCarryover(carriedOver: number, alreadyExpired: number, spendableBalance: number) {
  return Math.round(Math.max(0, Math.min(Math.max(0, carriedOver - alreadyExpired), spendableBalance)) * 10_000) / 10_000;
}

export const UNIT5_REQUEST_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ["SUBMITTED", "WITHDRAWN"],
  SUBMITTED: ["UNDER_REVIEW", "RETURNED", "WITHDRAWN"],
  UNDER_REVIEW: ["RETURNED", "APPROVED", "REJECTED", "WITHDRAWN"],
  RETURNED: ["SUBMITTED", "WITHDRAWN"],
  APPROVED: ["SCHEDULED", "CANCELLATION_PENDING", "IN_PROGRESS"],
  SCHEDULED: ["IN_PROGRESS", "CANCELLATION_PENDING"],
  IN_PROGRESS: ["COMPLETED", "CANCELLATION_PENDING"],
  CANCELLATION_PENDING: ["CANCELLED", "APPROVED", "SCHEDULED", "IN_PROGRESS"],
  COMPLETED: [], REJECTED: [], CANCELLED: [], WITHDRAWN: [],
};

export function assertUnit5RequestTransition(from: string, to: string) {
  if (!UNIT5_REQUEST_TRANSITIONS[from]?.includes(to)) throw new Error(`Invalid leave request transition: ${from} to ${to}.`);
}

export function assertIndependentLeaveApproval(requesterId: string, reviewerId: string) {
  if (requesterId === reviewerId) throw new Error("A requester cannot approve their own leave request.");
}

export function assertCurrentRequestVersion(expected: number, actual: number) {
  if (expected !== actual) throw new Error("This leave request changed while it was being reviewed. Reload the latest version.");
}

export function usageLabel(model: string, used: number, unit: string) {
  return model === "UNLIMITED" ? `Unlimited policy · ${used} ${unit.toLowerCase()} used this year` : null;
}

export function calculateUnit5Segments(input: { startDate: Date; endDate: Date; unit: "DAYS" | "HOURS"; requestedHours?: number; weeklyPattern: unknown; holidays: Array<{ localDate: Date; durationMinutes?: number | null; name: string }> }) {
  if (input.endDate < input.startDate) throw new Error("Leave end date cannot be before start date.");
  const pattern = validateWeeklyPattern(input.weeklyPattern);
  const holidays = new Map(input.holidays.map((holiday) => [holiday.localDate.toISOString().slice(0, 10), holiday]));
  const segments: Array<{ localDate: Date; startsAt: Date; endsAt: Date; scheduledMinutes: number; excludedMinutes: number; chargeableAmount: number; exclusionReason?: string }> = [];
  const cursor = new Date(Date.UTC(input.startDate.getUTCFullYear(), input.startDate.getUTCMonth(), input.startDate.getUTCDate()));
  const end = Date.UTC(input.endDate.getUTCFullYear(), input.endDate.getUTCMonth(), input.endDate.getUTCDate());
  while (cursor.getTime() <= end) {
    const intervals = pattern.filter((entry) => entry.weekday === cursor.getUTCDay());
    const scheduledMinutes = intervals.reduce((total, interval) => total + minutes(interval.end) - minutes(interval.start), 0);
    const holiday = holidays.get(cursor.toISOString().slice(0, 10));
    const excludedMinutes = holiday ? Math.min(scheduledMinutes, holiday.durationMinutes ?? scheduledMinutes) : 0;
    const chargeableMinutes = Math.max(0, scheduledMinutes - excludedMinutes);
    if (scheduledMinutes > 0) segments.push({ localDate: new Date(cursor), startsAt: new Date(cursor), endsAt: new Date(cursor.getTime() + 86_400_000), scheduledMinutes, excludedMinutes, chargeableAmount: input.unit === "HOURS" ? chargeableMinutes / 60 : chargeableMinutes / scheduledMinutes, exclusionReason: holiday?.name });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (input.unit === "HOURS") {
    if (!input.requestedHours) throw new Error("Enter the number of leave hours requested.");
    const availableHours = segments.reduce((total, segment) => total + segment.chargeableAmount, 0);
    if (input.requestedHours > availableHours) throw new Error("Requested hours exceed scheduled chargeable time.");
    let remaining = input.requestedHours;
    for (const segment of segments) { const amount = Math.min(segment.chargeableAmount, remaining); segment.chargeableAmount = amount; remaining -= amount; }
  }
  return segments;
}
