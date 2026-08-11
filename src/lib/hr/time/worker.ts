import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { recordAttendanceInterpretation, withTimeSerializableRetry } from "./commands";

async function claimRun(organizationId: string, jobType: string, windowKey: string, now: Date) {
  const leaseToken = crypto.randomUUID();
  return withTimeSerializableRetry(() => prisma.$transaction(async (tx) => {
    const run = await tx.hrTimeWorkerRun.upsert({ where: { organizationId_jobType_windowKey: { organizationId, jobType, windowKey } }, update: {}, create: { organizationId, jobType, windowKey, correlationId: crypto.randomUUID() } });
    if (run.status === "SUCCEEDED" || (run.status === "RUNNING" && run.leaseExpiresAt && run.leaseExpiresAt > now)) return null;
    const claimed = await tx.hrTimeWorkerRun.updateMany({ where: { id: run.id, OR: [{ status: { in: ["PENDING", "FAILED"] } }, { status: "RUNNING", leaseExpiresAt: { lte: now } }] }, data: { status: "RUNNING", leaseToken, leaseExpiresAt: new Date(now.getTime() + 5 * 60_000), attemptCount: { increment: 1 }, startedAt: now, safeError: null } });
    return claimed.count ? { ...run, leaseToken } : null;
  }, { isolationLevel: "Serializable" }));
}

async function notifyMissedClockOut(organizationId: string, sessionId: string) {
  return withTimeSerializableRetry(() => prisma.$transaction(async (tx) => {
    const session = await tx.hrClockSession.findFirstOrThrow({ where: { id: sessionId, organizationId, status: { in: ["CLOCKED_IN", "ON_BREAK"] } } });
    const employee = await tx.hrEmployee.findUniqueOrThrow({ where: { id: session.employeeId } });
    await tx.hrClockSession.update({ where: { id: session.id }, data: { status: "CORRECTION_REQUIRED", version: { increment: 1 } } });
    const recipient = employee.preferredNotificationEmail ?? employee.companyEmail ?? employee.personalEmail;
    if (recipient) await enqueueHrEmail(tx, { organizationId, recipient, template: "hr-time-missed-clock-out", subject: "Time correction required", payload: { recipientName: employee.preferredName ?? employee.legalFirstName, href: "/hr/employee/time" }, idempotencyKey: `time-missed-clock-out:${session.id}:v${session.version}` });
    await appendHrAudit(tx, { organizationId, actorRole: "WORKER", entityType: "HrClockSession", entityId: session.id, action: "hr.time.clock_session.correction_required", previousValues: { status: session.status, version: session.version }, newValues: { status: "CORRECTION_REQUIRED", version: session.version + 1 }, reason: "Open session exceeded the governed policy window", correlationId: session.correlationId });
  }, { isolationLevel: "Serializable" }));
}

async function interpretApprovedTimesheets(organizationId: string) {
  const sheets = await prisma.hrTimesheet.findMany({
    where: { organizationId, status: "APPROVED" },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    orderBy: { approvedAt: "asc" },
    take: 500,
  });
  let processed = 0;
  for (const sheet of sheets) {
    const evidence = sheet.versions[0];
    if (!evidence || !Array.isArray(evidence.entries)) continue;
    for (const [entryIndex, rawEntry] of evidence.entries.entries()) {
      if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) continue;
      const entry = rawEntry as { date?: unknown; minutes?: unknown; scheduledMinutes?: unknown };
      if (typeof entry.date !== "string" || typeof entry.minutes !== "number") continue;
      const businessDate = new Date(`${entry.date}T00:00:00.000Z`);
      if (Number.isNaN(businessDate.getTime())) continue;
      const scheduledMinutes = typeof entry.scheduledMinutes === "number" ? entry.scheduledMinutes : entry.minutes;
      await recordAttendanceInterpretation(
        { organizationId, actorUserId: sheet.approvedById ?? evidence.createdById, actorRole: "WORKER" },
        {
          employeeId: sheet.employeeId,
          workRelationshipId: sheet.workRelationshipId,
          assignmentId: sheet.assignmentId,
          businessDate,
          trackingMode: "TIMESHEET",
          scheduledMinutes,
          workedMinutes: entry.minutes,
          inputSnapshot: { sourceType: "TIMESHEET", timesheetId: sheet.id, timesheetVersion: sheet.version, evidenceVersion: evidence.version, entryIndex, entry: rawEntry },
          correlationId: sheet.correlationId,
        },
      );
      processed += 1;
    }
  }
  return processed;
}

export async function runTimeOperationalWindow(now = new Date()) {
  const organizations = await prisma.hrOrganization.findMany({ select: { id: true } });
  const windowKey = now.toISOString().slice(0, 13);
  const results: Array<{ organizationId: string; status: string; processed: number }> = [];
  for (const organization of organizations) {
    const run = await claimRun(organization.id, "TIME_EXCEPTION_SWEEP", windowKey, now);
    if (!run) results.push({ organizationId: organization.id, status: "SKIPPED", processed: 0 });
    else try {
        const stale = await prisma.hrClockSession.findMany({ where: { organizationId: organization.id, status: { in: ["CLOCKED_IN", "ON_BREAK"] }, startedAt: { lt: new Date(now.getTime() - 20 * 60 * 60_000) } }, select: { id: true }, take: 500 });
        for (const session of stale) await notifyMissedClockOut(organization.id, session.id);
        await prisma.hrTimeWorkerRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", completedAt: new Date(), leaseToken: null, leaseExpiresAt: null, checkpoint: { processed: stale.length } } });
        results.push({ organizationId: organization.id, status: "COMPLETED", processed: stale.length });
      } catch (error) {
        await prisma.hrTimeWorkerRun.update({ where: { id: run.id }, data: { status: run.attemptCount >= 5 ? "DEAD_LETTER" : "FAILED", safeError: (error instanceof Error ? error.message : "Time worker failed").slice(0, 1000), leaseToken: null, leaseExpiresAt: null } });
        results.push({ organizationId: organization.id, status: "FAILED", processed: 0 });
      }
    const interpretationRun = await claimRun(organization.id, "TIME_INTERPRETATION_SWEEP", windowKey, now);
    if (!interpretationRun) continue;
    try {
      const processed = await interpretApprovedTimesheets(organization.id);
      await prisma.hrTimeWorkerRun.update({ where: { id: interpretationRun.id }, data: { status: "SUCCEEDED", completedAt: new Date(), leaseToken: null, leaseExpiresAt: null, checkpoint: { processed } } });
      results.push({ organizationId: organization.id, status: "INTERPRETED", processed });
    } catch (error) {
      await prisma.hrTimeWorkerRun.update({ where: { id: interpretationRun.id }, data: { status: interpretationRun.attemptCount >= 5 ? "DEAD_LETTER" : "FAILED", safeError: (error instanceof Error ? error.message : "Time interpretation worker failed").slice(0, 1000), leaseToken: null, leaseExpiresAt: null } });
      results.push({ organizationId: organization.id, status: "FAILED", processed: 0 });
    }
  }
  return results;
}
