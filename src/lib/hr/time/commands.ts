import crypto from "node:crypto";
import { Prisma, type HrAttendanceOutcome, type HrTimeEventSource, type HrTimeEventType, type HrTimesheetStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { assertIndependentApproval, assertPeriodLock, assertTimesheetTransition, interpretAttendance, transitionClock, validateTimeEvent } from "./domain";

type Context = { organizationId: string; actorUserId: string; actorRole?: string };

function isSerializationFailure(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string; meta?: { code?: string } };
  return candidate.code === "P2034" || candidate.meta?.code === "40001" || candidate.message?.includes("40001") === true;
}

export async function withTimeSerializableRetry<T>(operation: () => Promise<T>, maximumAttempts = 4): Promise<T> {
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try { return await operation(); } catch (error) { if (!isSerializationFailure(error) || attempt === maximumAttempts) throw error; }
  }
  throw new Error("Time transaction retry budget exhausted.");
}

export async function captureClockEvent(context: Context, input: {
  employeeId: string; workRelationshipId: string; assignmentId: string; timePolicyVersionId: string;
  eventType: HrTimeEventType; source: HrTimeEventSource; occurredAt: Date; receivedAt?: Date;
  timezone: string; localDate: Date; localTime: string; utcOffsetMinutes: number; idempotencyKey: string;
  maximumOfflineDelayMin: number; maximumFutureSkewMin: number; userAgentHash?: string;
}) {
  const receivedAt = input.receivedAt ?? new Date();
  const checked = validateTimeEvent({ ...input, organizationId: context.organizationId, eventType: input.eventType as "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END", receivedAt });
  return withTimeSerializableRetry(() => prisma.$transaction(async (tx) => {
    const replay = await tx.hrTimeEvent.findUnique({ where: { organizationId_idempotencyKey: { organizationId: context.organizationId, idempotencyKey: input.idempotencyKey } } });
    if (replay) {
      if (replay.payloadHash !== checked.payloadHash) throw new Error("Conflicting payload reused an existing time-event idempotency key.");
      return { event: replay, replayed: true };
    }
    const [employee, relationship, assignment] = await Promise.all([
      tx.hrEmployee.findFirst({ where: { id: input.employeeId, organizationId: context.organizationId } }),
      tx.hrWorkRelationship.findFirst({ where: { id: input.workRelationshipId, organizationId: context.organizationId, employeeId: input.employeeId, status: { in: ["ACTIVE", "NOTICE_PERIOD", "SUSPENDED"] } } }),
      tx.hrEmployeeAssignment.findFirst({ where: { id: input.assignmentId, organizationId: context.organizationId, employeeId: input.employeeId, status: "ACTIVE", effectiveFrom: { lte: input.occurredAt }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.occurredAt } }] } }),
    ]);
    if (!employee || !relationship || !assignment) throw new Error("Time event does not match an active tenant-scoped employment assignment.");
    const open = await tx.hrClockSession.findFirst({ where: { organizationId: context.organizationId, assignmentId: input.assignmentId, status: { in: ["CLOCKED_IN", "ON_BREAK"] } }, orderBy: { startedAt: "desc" } });
    const current = open ? (open.status === "ON_BREAK" ? "ON_BREAK" : "CLOCKED_IN") : "NOT_STARTED";
    const transition = transitionClock(current, input.eventType as "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END");
    const correlationId = open?.correlationId ?? crypto.randomUUID();
    const event = await tx.hrTimeEvent.create({ data: { organizationId: context.organizationId, employeeId: input.employeeId, workRelationshipId: input.workRelationshipId, assignmentId: input.assignmentId, eventType: input.eventType, source: input.source, occurredAt: input.occurredAt, receivedAt, timezone: input.timezone, localDate: input.localDate, localTime: input.localTime, utcOffsetMinutes: input.utcOffsetMinutes, idempotencyKey: input.idempotencyKey, payloadHash: checked.payloadHash, userAgentHash: input.userAgentHash, replayed: checked.replayed, authoritative: transition.authoritative, invalidReason: transition.reason, actorUserId: context.actorUserId, correlationId } });
    if (transition.authoritative && input.eventType === "CLOCK_IN") await tx.hrClockSession.create({ data: { organizationId: context.organizationId, employeeId: input.employeeId, workRelationshipId: input.workRelationshipId, assignmentId: input.assignmentId, timePolicyVersionId: input.timePolicyVersionId, businessDate: input.localDate, openedByEventId: event.id, status: "CLOCKED_IN", startedAt: input.occurredAt, correlationId } });
    else if (transition.authoritative && open) {
      const status = input.eventType === "BREAK_START" ? "ON_BREAK" : input.eventType === "BREAK_END" ? "CLOCKED_IN" : "CLOCKED_OUT";
      await tx.hrClockSession.update({ where: { id: open.id }, data: { status, closedByEventId: input.eventType === "CLOCK_OUT" ? event.id : open.closedByEventId, endedAt: input.eventType === "CLOCK_OUT" ? input.occurredAt : open.endedAt, workedMinutes: input.eventType === "CLOCK_OUT" ? Math.max(0, Math.floor((input.occurredAt.getTime() - open.startedAt.getTime()) / 60_000) - open.breakMinutes) : open.workedMinutes, version: { increment: 1 } } });
    }
    await appendHrAudit(tx, { ...context, entityType: "HrTimeEvent", entityId: event.id, action: transition.authoritative ? "hr.time.event.captured" : "hr.time.event.rejected", newValues: { eventType: input.eventType, assignmentId: input.assignmentId, occurredAt: input.occurredAt, authoritative: transition.authoritative, replayed: checked.replayed }, reason: transition.reason ?? "Governed time capture", correlationId });
    return { event, replayed: false };
  }, { isolationLevel: "Serializable" }));
}

export async function transitionTimesheet(context: Context, input: { timesheetId: string; expectedVersion: number; to: HrTimesheetStatus; entries?: Prisma.InputJsonValue; totalMinutes?: number; comment?: string }) {
  return withTimeSerializableRetry(() => prisma.$transaction(async (tx) => {
    const sheet = await tx.hrTimesheet.findFirstOrThrow({ where: { id: input.timesheetId, organizationId: context.organizationId, version: input.expectedVersion } });
    assertTimesheetTransition(sheet.status, input.to);
    if (input.to === "APPROVED") {
      const employee = await tx.hrEmployee.findUniqueOrThrow({ where: { id: sheet.employeeId }, select: { userId: true } });
      assertIndependentApproval({ employeeUserId: employee.userId, actorUserId: context.actorUserId, submittedById: (await tx.hrTimesheetVersion.findUnique({ where: { timesheetId_version: { timesheetId: sheet.id, version: sheet.version } } }))?.createdById });
    }
    const nextVersion = sheet.version + 1;
    if (input.entries) await tx.hrTimesheetVersion.create({ data: { timesheetId: sheet.id, version: nextVersion, entries: input.entries, totalMinutes: input.totalMinutes ?? 0, comment: input.comment, createdById: context.actorUserId, submittedAt: input.to === "SUBMITTED" ? new Date() : undefined } });
    const updated = await tx.hrTimesheet.update({ where: { id: sheet.id }, data: { status: input.to, version: nextVersion, submittedAt: input.to === "SUBMITTED" ? new Date() : sheet.submittedAt, approvedAt: input.to === "APPROVED" ? new Date() : sheet.approvedAt, approvedById: input.to === "APPROVED" ? context.actorUserId : sheet.approvedById } });
    await appendHrAudit(tx, { ...context, entityType: "HrTimesheet", entityId: sheet.id, action: `hr.time.timesheet.${input.to.toLowerCase()}`, previousValues: { status: sheet.status, version: sheet.version }, newValues: { status: input.to, version: nextVersion }, correlationId: sheet.correlationId });
    return updated;
  }, { isolationLevel: "Serializable" }));
}

export async function recordAttendanceInterpretation(context: Context, input: { employeeId: string; workRelationshipId: string; assignmentId: string; businessDate: Date; trackingMode: "NONE" | "EXCEPTION_BASED" | "CLOCK" | "TIMESHEET"; scheduledMinutes: number; workedMinutes: number; approvedPaidLeaveMinutes?: number; isHoliday?: boolean; graceMinutes?: number; missedClockIn?: boolean; missedClockOut?: boolean; breakException?: boolean; inputSnapshot: Prisma.InputJsonValue; correlationId?: string }) {
  return withTimeSerializableRetry(() => prisma.$transaction(async (tx) => {
    const result = interpretAttendance(input) as ReturnType<typeof interpretAttendance> & { outcome: HrAttendanceOutcome };
    const day = await tx.hrAttendanceDay.upsert({ where: { organizationId_assignmentId_businessDate: { organizationId: context.organizationId, assignmentId: input.assignmentId, businessDate: input.businessDate } }, update: {}, create: { organizationId: context.organizationId, employeeId: input.employeeId, workRelationshipId: input.workRelationshipId, assignmentId: input.assignmentId, businessDate: input.businessDate, currentOutcome: result.outcome, correlationId: input.correlationId ?? crypto.randomUUID() } });
    const nextVersion = day.currentVersion + (await tx.hrAttendanceInterpretation.count({ where: { attendanceDayId: day.id } }) ? 1 : 0);
    const previous = await tx.hrAttendanceInterpretation.findFirst({ where: { attendanceDayId: day.id }, orderBy: { version: "desc" } });
    const interpretation = await tx.hrAttendanceInterpretation.create({ data: { attendanceDayId: day.id, version: nextVersion, outcome: result.outcome, scheduledMinutes: result.scheduledMinutes, workedMinutes: result.workedMinutes, paidLeaveMinutes: result.paidLeaveMinutes, unpaidAbsenceMinutes: result.outcome === "ABSENT" ? result.scheduledMinutes : 0, underTimeMinutes: result.underTimeMinutes, overtimeMinutes: result.overtimeMinutes, breakMinutes: 0, inputSnapshot: input.inputSnapshot, supersedesId: previous?.id, createdById: context.actorUserId } });
    await tx.hrAttendanceDay.update({ where: { id: day.id }, data: { currentVersion: nextVersion, currentOutcome: result.outcome } });
    await appendHrAudit(tx, { ...context, entityType: "HrAttendanceInterpretation", entityId: interpretation.id, action: "hr.time.attendance.interpreted", previousValues: previous ? { version: previous.version, outcome: previous.outcome } : undefined, newValues: { version: nextVersion, outcome: result.outcome, scheduledMinutes: result.scheduledMinutes, workedMinutes: result.workedMinutes, paidLeaveMinutes: result.paidLeaveMinutes }, correlationId: day.correlationId });
    return interpretation;
  }, { isolationLevel: "Serializable" }));
}

export async function lockAttendancePeriod(context: Context, input: { periodId: string; expectedVersion: number; actorHasLockPermission: boolean }) {
  return withTimeSerializableRetry(() => prisma.$transaction(async (tx) => {
    const period = await tx.hrAttendancePeriod.findFirstOrThrow({ where: { id: input.periodId, organizationId: context.organizationId } });
    assertPeriodLock({ status: period.status, expectedVersion: input.expectedVersion, actualVersion: period.version, actorHasLockPermission: input.actorHasLockPermission });
    const entries = await tx.hrAuthoritativeTimeEntry.findMany({ where: { attendancePeriodId: period.id }, orderBy: [{ employeeId: "asc" }, { businessDate: "asc" }, { category: "asc" }, { sourceId: "asc" }] });
    const lockHash = crypto.createHash("sha256").update(JSON.stringify(entries.map(({ employeeId, assignmentId, businessDate, category, minutes, sourceType, sourceId }) => ({ employeeId, assignmentId, businessDate: businessDate.toISOString(), category, minutes, sourceType, sourceId })))).digest("hex");
    const updated = await tx.hrAttendancePeriod.update({ where: { id: period.id }, data: { status: "LOCKED", version: { increment: 1 }, lockedAt: new Date(), lockedById: context.actorUserId, lockHash } });
    await appendHrAudit(tx, { ...context, entityType: "HrAttendancePeriod", entityId: period.id, action: "hr.time.period.locked", previousValues: { status: period.status, version: period.version }, newValues: { status: "LOCKED", version: period.version + 1, lockHash, entryCount: entries.length }, correlationId: period.correlationId });
    return updated;
  }, { isolationLevel: "Serializable" }));
}
