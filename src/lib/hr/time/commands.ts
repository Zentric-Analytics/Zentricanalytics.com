import crypto from "node:crypto";
import { Prisma, type HrAttendanceOutcome, type HrTimeEventSource, type HrTimeEventType, type HrTimesheetStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { activeSupervisorForEmployee } from "@/lib/hr/supervisors/scope";
import { assertIndependentApproval, assertPeriodLock, assertTimesheetTransition, interpretAttendance, stableJsonStringify, transitionClock, validateTimeEvent } from "./domain";

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
    const employee = await tx.hrEmployee.findUniqueOrThrow({ where: { id: sheet.employeeId } });
    if (input.to === "SUBMITTED") {
      const supervisor = await activeSupervisorForEmployee(tx, { organizationId: context.organizationId, employeeId: sheet.employeeId });
      const manager = supervisor?.supervisorEmployee;
      const recipient = manager?.preferredNotificationEmail ?? manager?.companyEmail ?? manager?.personalEmail ?? manager?.user?.email;
      if (recipient) await enqueueHrEmail(tx, { organizationId: context.organizationId, recipient, template: "hr-time-timesheet-submitted", subject: "Timesheet ready for review", payload: { recipientName: manager?.preferredName ?? manager?.legalFirstName ?? "Manager", href: "/hr/supervisor/time" }, idempotencyKey: `time-timesheet-submitted:${sheet.id}:v${nextVersion}` });
    } else if (input.to === "RETURNED" || input.to === "REJECTED") {
      const recipient = employee.preferredNotificationEmail ?? employee.companyEmail ?? employee.personalEmail;
      if (recipient) await enqueueHrEmail(tx, { organizationId: context.organizationId, recipient, template: input.to === "RETURNED" ? "hr-time-returned" : "hr-time-rejected", subject: input.to === "RETURNED" ? "Timesheet returned for changes" : "Timesheet decision recorded", payload: { recipientName: employee.preferredName ?? employee.legalFirstName, href: "/hr/employee/time" }, idempotencyKey: `time-timesheet-${input.to.toLowerCase()}:${sheet.id}:v${nextVersion}` });
    }
    await appendHrAudit(tx, { ...context, entityType: "HrTimesheet", entityId: sheet.id, action: `hr.time.timesheet.${input.to.toLowerCase()}`, previousValues: { status: sheet.status, version: sheet.version }, newValues: { status: input.to, version: nextVersion }, correlationId: sheet.correlationId });
    return updated;
  }, { isolationLevel: "Serializable" }));
}

export async function createDraftTimesheet(context: Context, input: { employeeId: string; workRelationshipId: string; assignmentId: string; periodStart: Date; periodEnd: Date; entries: Prisma.InputJsonValue; totalMinutes: number; comment?: string }) {
  if (input.periodEnd <= input.periodStart || input.totalMinutes < 0) throw new Error("Timesheet period and minutes must be valid.");
  return withTimeSerializableRetry(() => prisma.$transaction(async (tx) => {
    await tx.hrEmployeeAssignment.findFirstOrThrow({ where: { id: input.assignmentId, organizationId: context.organizationId, employeeId: input.employeeId, status: "ACTIVE" } });
    const correlationId = crypto.randomUUID();
    const sheet = await tx.hrTimesheet.create({ data: { organizationId: context.organizationId, employeeId: input.employeeId, workRelationshipId: input.workRelationshipId, assignmentId: input.assignmentId, periodStart: input.periodStart, periodEnd: input.periodEnd, correlationId } });
    await tx.hrTimesheetVersion.create({ data: { timesheetId: sheet.id, version: 1, entries: input.entries, totalMinutes: input.totalMinutes, comment: input.comment, createdById: context.actorUserId } });
    await appendHrAudit(tx, { ...context, entityType: "HrTimesheet", entityId: sheet.id, action: "hr.time.timesheet.created", newValues: { employeeId: input.employeeId, assignmentId: input.assignmentId, periodStart: input.periodStart, periodEnd: input.periodEnd, version: 1, totalMinutes: input.totalMinutes }, correlationId });
    return sheet;
  }, { isolationLevel: "Serializable" }));
}

export async function recordAttendanceInterpretation(context: Context, input: { employeeId: string; workRelationshipId: string; assignmentId: string; businessDate: Date; trackingMode: "NONE" | "EXCEPTION_BASED" | "CLOCK" | "TIMESHEET"; scheduledMinutes: number; workedMinutes: number; approvedPaidLeaveMinutes?: number; isHoliday?: boolean; graceMinutes?: number; missedClockIn?: boolean; missedClockOut?: boolean; breakException?: boolean; inputSnapshot: Prisma.InputJsonValue; correlationId?: string }) {
  return withTimeSerializableRetry(() => prisma.$transaction(async (tx) => {
    const result = interpretAttendance(input) as ReturnType<typeof interpretAttendance> & { outcome: HrAttendanceOutcome };
    const day = await tx.hrAttendanceDay.upsert({ where: { organizationId_assignmentId_businessDate: { organizationId: context.organizationId, assignmentId: input.assignmentId, businessDate: input.businessDate } }, update: {}, create: { organizationId: context.organizationId, employeeId: input.employeeId, workRelationshipId: input.workRelationshipId, assignmentId: input.assignmentId, businessDate: input.businessDate, currentOutcome: result.outcome, correlationId: input.correlationId ?? crypto.randomUUID() } });
    const previous = await tx.hrAttendanceInterpretation.findFirst({ where: { attendanceDayId: day.id }, orderBy: { version: "desc" } });
    if (previous && stableJsonStringify(previous.inputSnapshot) === stableJsonStringify(input.inputSnapshot)
      && previous.outcome === result.outcome && previous.scheduledMinutes === result.scheduledMinutes
      && previous.workedMinutes === result.workedMinutes && previous.paidLeaveMinutes === result.paidLeaveMinutes) return previous;
    const nextVersion = previous ? day.currentVersion + 1 : 1;
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

export async function requestTimeCorrection(context: Context, input: { employeeId: string; attendanceDayId?: string; timesheetId?: string; sourceEventId?: string; requestedChanges: Prisma.InputJsonValue; reason: string }) {
  if (!input.attendanceDayId && !input.timesheetId && !input.sourceEventId) throw new Error("A correction must identify the governed time record being corrected.");
  return withTimeSerializableRetry(() => prisma.$transaction(async (tx) => {
    await tx.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: context.organizationId } });
    const attendanceDay = input.attendanceDayId ? await tx.hrAttendanceDay.findFirstOrThrow({ where: { id: input.attendanceDayId, organizationId: context.organizationId, employeeId: input.employeeId } }) : null;
    if (input.timesheetId) await tx.hrTimesheet.findFirstOrThrow({ where: { id: input.timesheetId, organizationId: context.organizationId, employeeId: input.employeeId } });
    if (input.sourceEventId) await tx.hrTimeEvent.findFirstOrThrow({ where: { id: input.sourceEventId, organizationId: context.organizationId, employeeId: input.employeeId } });
    const existingOpen = await tx.hrTimeCorrection.findFirst({ where: { organizationId: context.organizationId, employeeId: input.employeeId, attendanceDayId: input.attendanceDayId, timesheetId: input.timesheetId, sourceEventId: input.sourceEventId, status: { in: ["DRAFT", "SUBMITTED", "IN_REVIEW", "RETURNED", "APPROVED"] } } });
    if (existingOpen) throw new Error("An open correction already exists for this exact time record.");
    const requestedChanges = { ...(input.requestedChanges as Prisma.InputJsonObject), sourceAttendanceVersion: attendanceDay?.currentVersion } as Prisma.InputJsonObject;
    const correction = await tx.hrTimeCorrection.create({ data: { organizationId: context.organizationId, employeeId: input.employeeId, attendanceDayId: input.attendanceDayId, timesheetId: input.timesheetId, sourceEventId: input.sourceEventId, status: "SUBMITTED", requestedChanges, reason: input.reason, requestedById: context.actorUserId, correlationId: crypto.randomUUID() } });
    await appendHrAudit(tx, { ...context, entityType: "HrTimeCorrection", entityId: correction.id, action: "hr.time.correction.submitted", newValues: { employeeId: input.employeeId, attendanceDayId: input.attendanceDayId, timesheetId: input.timesheetId, sourceEventId: input.sourceEventId, version: correction.version }, reason: input.reason, correlationId: correction.correlationId });
    return correction;
  }, { isolationLevel: "Serializable" }));
}

export async function reviewTimeCorrection(context: Context, input: { correctionId: string; expectedVersion: number; decision: "APPROVED" | "RETURNED" | "REJECTED"; reason: string }) {
  return withTimeSerializableRetry(() => prisma.$transaction(async (tx) => {
    const correction = await tx.hrTimeCorrection.findFirstOrThrow({ where: { id: input.correctionId, organizationId: context.organizationId, status: { in: ["SUBMITTED", "IN_REVIEW"] }, version: input.expectedVersion } });
    if (correction.requestedById === context.actorUserId) throw new Error("A correction requester cannot approve their own correction.");
    if (input.decision === "APPROVED" && correction.attendanceDayId) {
      const day = await tx.hrAttendanceDay.findFirstOrThrow({ where: { id: correction.attendanceDayId, organizationId: context.organizationId, employeeId: correction.employeeId } });
      const changes = correction.requestedChanges as { requestedClockIn?: unknown; requestedClockOut?: unknown; sourceAttendanceVersion?: unknown };
      if (changes.sourceAttendanceVersion !== day.currentVersion) throw new Error("This correction is stale because the attendance record changed. Submit a new correction against the current version.");
      if (typeof changes.requestedClockIn !== "string" || typeof changes.requestedClockOut !== "string") throw new Error("Approved attendance corrections require governed clock-in and clock-out values.");
      const requestedClockIn = new Date(changes.requestedClockIn);
      const requestedClockOut = new Date(changes.requestedClockOut);
      if (Number.isNaN(requestedClockIn.getTime()) || Number.isNaN(requestedClockOut.getTime()) || requestedClockOut <= requestedClockIn) throw new Error("Correction clock-out must be after clock-in.");
      const previous = await tx.hrAttendanceInterpretation.findFirstOrThrow({ where: { attendanceDayId: day.id, version: day.currentVersion } });
      const workedMinutes = Math.max(0, Math.round((requestedClockOut.getTime() - requestedClockIn.getTime()) / 60_000));
      const result = interpretAttendance({ trackingMode: "CLOCK", scheduledMinutes: previous.scheduledMinutes, workedMinutes }) as ReturnType<typeof interpretAttendance> & { outcome: HrAttendanceOutcome };
      const approved = await tx.hrTimeCorrection.update({ where: { id: correction.id }, data: { status: "APPROVED", version: { increment: 1 }, reviewedById: context.actorUserId, reviewedAt: new Date() } });
      await appendHrAudit(tx, { ...context, entityType: "HrTimeCorrection", entityId: correction.id, action: "hr.time.correction.approved", previousValues: { status: correction.status, version: correction.version }, newValues: { status: "APPROVED", version: approved.version }, reason: input.reason, correlationId: correction.correlationId });
      const interpretation = await tx.hrAttendanceInterpretation.create({ data: { attendanceDayId: day.id, version: day.currentVersion + 1, outcome: result.outcome, scheduledMinutes: result.scheduledMinutes, workedMinutes: result.workedMinutes, paidLeaveMinutes: result.paidLeaveMinutes, unpaidAbsenceMinutes: result.outcome === "ABSENT" ? result.scheduledMinutes : 0, underTimeMinutes: result.underTimeMinutes, overtimeMinutes: result.overtimeMinutes, breakMinutes: 0, inputSnapshot: { sourceType: "CORRECTION", correctionId: correction.id, sourceAttendanceVersion: day.currentVersion, requestedClockIn: requestedClockIn.toISOString(), requestedClockOut: requestedClockOut.toISOString() }, supersedesId: previous.id, createdById: context.actorUserId } });
      await tx.hrAttendanceDay.update({ where: { id: day.id }, data: { currentVersion: { increment: 1 }, currentOutcome: result.outcome } });
      const lockedPeriod = await tx.hrAttendancePeriod.findFirst({ where: { organizationId: context.organizationId, status: "LOCKED", startsOn: { lte: day.businessDate }, endsOn: { gt: day.businessDate } } });
      const applied = await tx.hrTimeCorrection.update({ where: { id: correction.id }, data: { status: "APPLIED", version: { increment: 1 }, appliedInterpretationId: interpretation.id, payrollImpact: Boolean(lockedPeriod) } });
      if (lockedPeriod) await tx.hrAttendancePeriod.update({ where: { id: lockedPeriod.id }, data: { status: "CORRECTED_AFTER_LOCK", version: { increment: 1 } } });
      await appendHrAudit(tx, { ...context, entityType: "HrAttendanceInterpretation", entityId: interpretation.id, action: "hr.time.correction.applied", previousValues: { attendanceVersion: day.currentVersion, outcome: previous.outcome }, newValues: { attendanceVersion: day.currentVersion + 1, outcome: result.outcome, workedMinutes, correctionId: correction.id, payrollImpact: Boolean(lockedPeriod) }, reason: input.reason, correlationId: correction.correlationId });
      return applied;
    }
    const updated = await tx.hrTimeCorrection.update({ where: { id: correction.id }, data: { status: input.decision, version: { increment: 1 }, reviewedById: context.actorUserId, reviewedAt: new Date() } });
    await appendHrAudit(tx, { ...context, entityType: "HrTimeCorrection", entityId: correction.id, action: `hr.time.correction.${input.decision.toLowerCase()}`, previousValues: { status: correction.status, version: correction.version }, newValues: { status: input.decision, version: correction.version + 1 }, reason: input.reason, correlationId: correction.correlationId });
    return updated;
  }, { isolationLevel: "Serializable" }));
}

export async function approveAttendancePeriod(context: Context, input: { periodId: string; expectedVersion: number }) {
  return withTimeSerializableRetry(() => prisma.$transaction(async (tx) => {
    const period = await tx.hrAttendancePeriod.findFirstOrThrow({ where: { id: input.periodId, organizationId: context.organizationId, status: "SUBMITTED", version: input.expectedVersion } });
    const days = await tx.hrAttendanceDay.findMany({ where: { organizationId: context.organizationId, businessDate: { gte: period.startsOn, lt: period.endsOn } }, include: { interpretations: { orderBy: { version: "desc" }, take: 1 } } });
    for (const day of days) {
      const interpretation = day.interpretations[0];
      if (!interpretation) continue;
      for (const [category, minutes] of [["REGULAR", interpretation.workedMinutes], ["PAID_LEAVE", interpretation.paidLeaveMinutes], ["UNDER_TIME", -interpretation.underTimeMinutes], ["OVERTIME_CANDIDATE", interpretation.overtimeMinutes]] as const) {
        if (!minutes) continue;
        await tx.hrAuthoritativeTimeEntry.upsert({ where: { attendancePeriodId_employeeId_assignmentId_businessDate_category_sourceId: { attendancePeriodId: period.id, employeeId: day.employeeId, assignmentId: day.assignmentId, businessDate: day.businessDate, category, sourceId: interpretation.id } }, update: {}, create: { organizationId: context.organizationId, attendancePeriodId: period.id, employeeId: day.employeeId, workRelationshipId: day.workRelationshipId, assignmentId: day.assignmentId, businessDate: day.businessDate, category, minutes, sourceType: "ATTENDANCE_INTERPRETATION", sourceId: interpretation.id, correlationId: day.correlationId } });
      }
    }
    const updated = await tx.hrAttendancePeriod.update({ where: { id: period.id }, data: { status: "APPROVED", version: { increment: 1 }, approvedAt: new Date(), approvedById: context.actorUserId } });
    await appendHrAudit(tx, { ...context, entityType: "HrAttendancePeriod", entityId: period.id, action: "hr.time.period.approved", previousValues: { status: period.status, version: period.version }, newValues: { status: "APPROVED", version: period.version + 1, attendanceDays: days.length }, correlationId: period.correlationId });
    return updated;
  }, { isolationLevel: "Serializable" }));
}

export async function createOrSubmitAttendancePeriod(context: Context, input: { periodId?: string; expectedVersion?: number; timezone?: string; startsOn?: Date; endsOn?: Date }) {
  return withTimeSerializableRetry(() => prisma.$transaction(async (tx) => {
    if (!input.periodId) {
      if (!input.timezone || !input.startsOn || !input.endsOn || input.endsOn <= input.startsOn) throw new Error("A valid timezone and period range are required.");
      try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }).format(input.startsOn); } catch { throw new Error("Attendance period timezone must be a valid IANA timezone."); }
      const period = await tx.hrAttendancePeriod.create({ data: { organizationId: context.organizationId, timezone: input.timezone, startsOn: input.startsOn, endsOn: input.endsOn, correlationId: crypto.randomUUID() } });
      await appendHrAudit(tx, { ...context, entityType: "HrAttendancePeriod", entityId: period.id, action: "hr.time.period.created", newValues: { startsOn: period.startsOn, endsOn: period.endsOn, timezone: period.timezone, status: period.status }, correlationId: period.correlationId });
      return period;
    }
    const period = await tx.hrAttendancePeriod.findFirstOrThrow({ where: { id: input.periodId, organizationId: context.organizationId, status: "OPEN", version: input.expectedVersion } });
    const unresolved = await tx.hrAttendanceDay.count({ where: { organizationId: context.organizationId, businessDate: { gte: period.startsOn, lt: period.endsOn }, currentOutcome: { in: ["MISSED_CLOCK_IN", "MISSED_CLOCK_OUT", "PENDING_CORRECTION", "SCHEDULE_EXCEPTION"] } } });
    if (unresolved) throw new Error("Attendance period has unresolved exceptions and cannot be submitted.");
    const updated = await tx.hrAttendancePeriod.update({ where: { id: period.id }, data: { status: "SUBMITTED", version: { increment: 1 }, submittedAt: new Date() } });
    await appendHrAudit(tx, { ...context, entityType: "HrAttendancePeriod", entityId: period.id, action: "hr.time.period.submitted", previousValues: { status: period.status, version: period.version }, newValues: { status: "SUBMITTED", version: period.version + 1 }, correlationId: period.correlationId });
    return updated;
  }, { isolationLevel: "Serializable" }));
}

export async function claimAuthoritativeTimeExport(context: Context, input: { periodId: string; claimKey: string }) {
  return withTimeSerializableRetry(() => prisma.$transaction(async (tx) => {
    const period = await tx.hrAttendancePeriod.findFirstOrThrow({ where: { id: input.periodId, organizationId: context.organizationId, status: { in: ["LOCKED", "CORRECTED_AFTER_LOCK"] } } });
    const conflicting = await tx.hrAuthoritativeTimeEntry.count({ where: { attendancePeriodId: period.id, exportClaimKey: { not: null, notIn: [input.claimKey] } } });
    if (conflicting) throw new Error("Authoritative time entries were already claimed by another export.");
    await tx.hrAuthoritativeTimeEntry.updateMany({ where: { attendancePeriodId: period.id, exportClaimKey: null }, data: { exportClaimKey: input.claimKey, exportedAt: new Date() } });
    const entries = await tx.hrAuthoritativeTimeEntry.findMany({ where: { attendancePeriodId: period.id, exportClaimKey: input.claimKey }, orderBy: [{ employeeId: "asc" }, { businessDate: "asc" }, { category: "asc" }] });
    await appendHrAudit(tx, { ...context, entityType: "HrAttendancePeriod", entityId: period.id, action: "hr.time.authoritative_export.claimed", newValues: { claimKey: input.claimKey, entries: entries.length, lockHash: period.lockHash }, correlationId: period.correlationId });
    return { period, entries };
  }, { isolationLevel: "Serializable" }));
}
