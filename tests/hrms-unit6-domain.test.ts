import { describe, expect, it } from "vitest";
import { assertIdempotentReplay, assertIndependentApproval, assertNoScheduleOverlap, assertPeriodLock, assertTimesheetTransition, classifyOvertime, interpretAttendance, resolveTimePolicy, scheduledMinutesForBusinessDate, stableJsonStringify, transitionClock, validateTimeEvent } from "../src/lib/hr/time/domain";

describe("Unit 6 time and attendance domain", () => {
  it("compares persisted JSON snapshots independently of object key order", () => {
    const submitted = { sourceType: "TIMESHEET", entry: { date: "2096-03-10", source: "EMPLOYEE", minutes: 2400 }, entryIndex: 0 };
    const persisted = { entry: { minutes: 2400, source: "EMPLOYEE", date: "2096-03-10" }, entryIndex: 0, sourceType: "TIMESHEET" };
    expect(stableJsonStringify(submitted)).toBe(stableJsonStringify(persisted));
  });

  it("resolves explicit and more-specific policy deterministically and rejects ambiguity", () => {
    const at = new Date("2026-08-11T00:00:00Z");
    const context = { employeeId: "e1", workRelationshipId: "w1", assignmentId: "a1", legalEntityId: "le1", departmentId: "d1" };
    const base = { effectiveFrom: new Date("2026-01-01T00:00:00Z"), priority: 0 };
    expect(resolveTimePolicy([{ ...base, id: "org", policyVersionId: "p1", scope: {} }, { ...base, id: "dept", policyVersionId: "p2", scope: { departmentId: "d1" } }], context, at).policyVersionId).toBe("p2");
    expect(resolveTimePolicy([{ ...base, id: "explicit", policyVersionId: "p3", explicit: { employeeId: "e1", workRelationshipId: "w1", assignmentId: "a1" } }, { ...base, id: "dept", policyVersionId: "p2", scope: { departmentId: "d1" } }], context, at).policyVersionId).toBe("p3");
    expect(() => resolveTimePolicy([{ ...base, id: "a", policyVersionId: "p1", scope: { departmentId: "d1" } }, { ...base, id: "b", policyVersionId: "p2", scope: { departmentId: "d1" } }], context, at)).toThrow(/ambiguous/);
  });

  it("supports split and overnight schedules but rejects overlap", () => {
    expect(assertNoScheduleOverlap([{ weekday: 1, startLocalMinute: 540, endLocalMinute: 720, expectedMinutes: 180 }, { weekday: 1, startLocalMinute: 780, endLocalMinute: 1020, expectedMinutes: 240 }])).toHaveLength(2);
    expect(assertNoScheduleOverlap([{ weekday: 5, startLocalMinute: 1320, endLocalMinute: 360, endDayOffset: 1, expectedMinutes: 420, unpaidBreakMinutes: 60 }])[0].endDayOffset).toBe(1);
    expect(() => assertNoScheduleOverlap([{ weekday: 1, startLocalMinute: 540, endLocalMinute: 720, expectedMinutes: 180 }, { weekday: 1, startLocalMinute: 600, endLocalMinute: 800, expectedMinutes: 200 }])).toThrow(/overlap/);
  });

  it("derives expected minutes from the effective weekly schedule day", () => {
    const pattern = [
      { weekday: 1, start: "09:00", end: "12:00" },
      { weekday: 1, start: "13:00", end: "17:30" },
      { weekday: 2, start: "09:00", end: "17:00" },
    ];
    expect(scheduledMinutesForBusinessDate(pattern, new Date("2026-08-10T00:00:00.000Z"))).toBe(450);
    expect(scheduledMinutesForBusinessDate(pattern, new Date("2026-08-12T00:00:00.000Z"))).toBe(0);
  });

  it("preserves invalid clock evidence as correction-required state", () => {
    expect(transitionClock("NOT_STARTED", "CLOCK_IN")).toMatchObject({ state: "CLOCKED_IN", authoritative: true });
    expect(transitionClock("CLOCKED_IN", "BREAK_START")).toMatchObject({ state: "ON_BREAK" });
    expect(transitionClock("ON_BREAK", "BREAK_END")).toMatchObject({ state: "CLOCKED_IN" });
    expect(transitionClock("CLOCKED_IN", "CLOCK_OUT")).toMatchObject({ state: "CLOCKED_OUT" });
    expect(transitionClock("NOT_STARTED", "CLOCK_OUT")).toMatchObject({ state: "CORRECTION_REQUIRED", authoritative: false });
  });

  it("validates replay timing, IANA zones and payload identity", () => {
    const input = { organizationId: "o", employeeId: "e", workRelationshipId: "w", assignmentId: "a", eventType: "CLOCK_IN" as const, occurredAt: new Date("2026-08-11T09:00:00Z"), receivedAt: new Date("2026-08-11T09:02:00Z"), timezone: "Africa/Lagos", idempotencyKey: "receipt-1", maximumOfflineDelayMin: 60, maximumFutureSkewMin: 5 };
    const valid = validateTimeEvent(input);
    expect(valid.replayed).toBe(true);
    expect(assertIdempotentReplay({ payloadHash: valid.payloadHash }, valid.payloadHash)).toBe("REPLAY");
    expect(() => assertIdempotentReplay({ payloadHash: valid.payloadHash }, "different")).toThrow(/Conflicting payload/);
    expect(() => validateTimeEvent({ ...input, timezone: "Invalid/Zone" })).toThrow(/IANA/);
    expect(() => validateTimeEvent({ ...input, occurredAt: new Date("2026-08-11T10:00:00Z") })).toThrow(/future/);
  });

  it("applies leave precedence and classifies but never prices overtime", () => {
    expect(interpretAttendance({ trackingMode: "EXCEPTION_BASED", scheduledMinutes: 480, workedMinutes: 480 }).outcome).toBe("PRESENT");
    expect(interpretAttendance({ trackingMode: "EXCEPTION_BASED", scheduledMinutes: 480, workedMinutes: 0, approvedPaidLeaveMinutes: 480 }).outcome).toBe("APPROVED_LEAVE");
    expect(interpretAttendance({ trackingMode: "CLOCK", scheduledMinutes: 480, workedMinutes: 510, graceMinutes: 5 })).toMatchObject({ outcome: "OVERTIME_CANDIDATE", overtimeMinutes: 30 });
    expect(interpretAttendance({ trackingMode: "CLOCK", scheduledMinutes: 480, workedMinutes: 420, approvedPaidLeaveMinutes: 60 })).toMatchObject({ outcome: "PRESENT", paidLeaveMinutes: 60 });
    expect(() => interpretAttendance({ trackingMode: "CLOCK", scheduledMinutes: 480, workedMinutes: 420, approvedPaidLeaveMinutes: 120 })).toThrow(/overlap/);
  });

  it("enforces immutable timesheet governance, independent approval and period locking", () => {
    expect(() => assertTimesheetTransition("DRAFT", "SUBMITTED")).not.toThrow();
    expect(() => assertTimesheetTransition("SUBMITTED", "APPROVED")).toThrow(/Invalid/);
    expect(() => assertIndependentApproval({ employeeUserId: "u1", actorUserId: "u1", submittedById: "u1" })).toThrow(/own/);
    expect(() => assertPeriodLock({ status: "APPROVED", expectedVersion: 2, actualVersion: 2, actorHasLockPermission: true })).not.toThrow();
    expect(() => assertPeriodLock({ status: "APPROVED", expectedVersion: 1, actualVersion: 2, actorHasLockPermission: true })).toThrow(/changed/);
  });

  it("does not double-stack overtime categories by default", () => {
    expect(classifyOvertime({ dailyExtraMinutes: 60, weeklyExtraMinutes: 120, weekend: true, holiday: false, shiftPremium: true, allowStacking: false })).toEqual(["WEEKEND"]);
    expect(classifyOvertime({ dailyExtraMinutes: 60, weeklyExtraMinutes: 120, weekend: true, holiday: false, shiftPremium: true, allowStacking: true })).toEqual(["WEEKEND", "DAILY_OVERTIME", "WEEKLY_OVERTIME", "SHIFT_PREMIUM"]);
  });
});
