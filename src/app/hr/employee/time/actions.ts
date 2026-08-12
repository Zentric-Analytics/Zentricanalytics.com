"use server";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { captureClockEvent, createDraftTimesheet, requestTimeCorrection, transitionTimesheet } from "@/lib/hr/time/commands";

export async function captureTimeEventAction(formData: FormData) {
  const auth = await requirePermission("time.capture_self");
  const employee = auth.user.employee;
  if (!employee) throw new Error("An employee profile is required.");
  const now = new Date();
  const assignment = await prisma.hrEmployeeAssignment.findFirstOrThrow({ where: { organizationId: auth.user.organizationId, employeeId: employee.id, status: "ACTIVE", effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }, orderBy: { effectiveFrom: "desc" } });
  const relationship = await prisma.hrWorkRelationship.findFirstOrThrow({ where: { organizationId: auth.user.organizationId, employeeId: employee.id, status: { in: ["ACTIVE", "NOTICE_PERIOD", "SUSPENDED"] }, startedAt: { lte: now }, OR: [{ endedAt: null }, { endedAt: { gt: now } }] }, orderBy: { startedAt: "desc" } });
  const policy = await prisma.hrTimePolicyAssignment.findFirstOrThrow({ where: { organizationId: auth.user.organizationId, employeeId: employee.id, workRelationshipId: relationship.id, assignmentId: assignment.id, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }, orderBy: { effectiveFrom: "desc" } });
  const version = await prisma.hrTimePolicyVersion.findUniqueOrThrow({ where: { id: policy.timePolicyVersionId } });
  if (version.trackingMode !== "CLOCK") throw new Error("Clock capture is not enabled for this assignment.");
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: version.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
  const localDate = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00.000Z`);
  await captureClockEvent({ organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "EMPLOYEE" }, { employeeId: employee.id, workRelationshipId: relationship.id, assignmentId: assignment.id, timePolicyVersionId: version.id, eventType: String(formData.get("eventType")) as "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END", source: "EMPLOYEE_WEB", occurredAt: now, timezone: version.timezone, localDate, localTime: `${parts.hour}:${parts.minute}`, utcOffsetMinutes: 0, idempotencyKey: crypto.randomUUID(), maximumOfflineDelayMin: version.maximumOfflineDelayMin, maximumFutureSkewMin: version.maximumFutureSkewMin });
  revalidatePath("/hr/employee/time");
}

export async function createTimesheetAction(formData: FormData) {
  const auth = await requirePermission("time.timesheet.submit");
  const employee = auth.user.employee;
  if (!employee) throw new Error("An employee profile is required.");
  const assignment = await prisma.hrEmployeeAssignment.findFirstOrThrow({ where: { organizationId: auth.user.organizationId, employeeId: employee.id, status: "ACTIVE" }, orderBy: { effectiveFrom: "desc" } });
  const relationship = await prisma.hrWorkRelationship.findFirstOrThrow({ where: { organizationId: auth.user.organizationId, employeeId: employee.id, status: { in: ["ACTIVE", "NOTICE_PERIOD", "SUSPENDED"] } }, orderBy: { startedAt: "desc" } });
  const periodStart = new Date(String(formData.get("periodStart"))); const periodEnd = new Date(String(formData.get("periodEnd"))); const totalMinutes = Number(formData.get("totalMinutes"));
  await createDraftTimesheet({ organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "EMPLOYEE" }, { employeeId: employee.id, workRelationshipId: relationship.id, assignmentId: assignment.id, periodStart, periodEnd, totalMinutes, comment: String(formData.get("comment") || ""), entries: [{ date: periodStart.toISOString().slice(0, 10), minutes: totalMinutes, source: "EMPLOYEE" }] });
  revalidatePath("/hr/employee/time");
}

export async function submitTimesheetAction(formData: FormData) {
  const auth = await requirePermission("time.timesheet.submit");
  await transitionTimesheet({ organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "EMPLOYEE" }, { timesheetId: String(formData.get("timesheetId")), expectedVersion: Number(formData.get("expectedVersion")), to: "SUBMITTED" });
  revalidatePath("/hr/employee/time");
}

export async function requestTimeCorrectionAction(formData: FormData) {
  const auth = await requirePermission("time.correction.request");
  if (!auth.user.employee) throw new Error("An employee profile is required.");
  await requestTimeCorrection({ organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "EMPLOYEE" }, { employeeId: auth.user.employee.id, attendanceDayId: String(formData.get("attendanceDayId")), requestedChanges: { requestedClockIn: String(formData.get("requestedClockIn") || ""), requestedClockOut: String(formData.get("requestedClockOut") || "") }, reason: String(formData.get("reason")) });
  revalidatePath("/hr/employee/time");
}
