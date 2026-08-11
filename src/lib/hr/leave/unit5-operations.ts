import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { accrueUnit5Assignment, processDueUnit5Leave, processUnit5CarryOver, reconcileUnit5Period } from "./unit5-accounting";

const jobTypes = ["LIFECYCLE", "ACCRUAL", "CARRYOVER_EXPIRY", "RECONCILIATION", "REMINDERS"] as const;
type JobType = typeof jobTypes[number];

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unit 5 worker failed";
  return message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[database-url-redacted]").slice(0, 1000);
}

async function claimJob(organizationId: string, jobType: JobType, windowKey: string, now: Date) {
  const correlationId = `unit5-job:${organizationId}:${jobType}:${windowKey}`;
  const run = await prisma.hrLeaveJobRun.upsert({ where: { organizationId_jobType_windowKey: { organizationId, jobType, windowKey } }, update: {}, create: { organizationId, jobType, windowKey, correlationId } });
  if (run.status === "COMPLETED" || run.status === "ABANDONED") return null;
  const staleBefore = new Date(now.getTime() - 15 * 60_000);
  const token = crypto.randomUUID();
  const claimed = await prisma.hrLeaveJobRun.updateMany({ where: { id: run.id, OR: [{ status: { in: ["PENDING", "FAILED"] } }, { status: "PROCESSING", startedAt: { lt: staleBefore } }] }, data: { status: "PROCESSING", claimTokenHash: crypto.createHash("sha256").update(token).digest("hex"), attemptCount: { increment: 1 }, startedAt: now, completedAt: null, safeError: null } });
  return claimed.count === 1 ? { id: run.id, correlationId } : null;
}

async function runJob(organizationId: string, jobType: JobType, now: Date) {
  if (jobType === "LIFECYCLE") return processDueUnit5Leave(now, 100, organizationId);
  if (jobType === "ACCRUAL") {
    const assignments = await prisma.hrEmployeeLeavePolicy.findMany({ where: { status: "ACTIVE", effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }], employee: { organizationId, employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] } }, leavePolicy: { status: "ACTIVE", accrualFrequency: { in: ["MONTHLY", "QUARTERLY"] } } }, select: { id: true } });
    const results = [];
    for (const assignment of assignments) results.push(await accrueUnit5Assignment({ organizationId, assignmentId: assignment.id, effectiveAt: now, actorRole: "UNIT5_ACCRUAL_WORKER" }));
    return results;
  }
  if (jobType === "CARRYOVER_EXPIRY") return processUnit5CarryOver({ organizationId, effectiveAt: now, actorRole: "UNIT5_CARRYOVER_WORKER" });
  if (jobType === "RECONCILIATION") {
    const periods = await prisma.hrLeaveAccountPeriod.findMany({ where: { account: { organizationId } }, select: { id: true }, take: 500, orderBy: { id: "asc" } });
    const results = [];
    for (const period of periods) results.push({ id: period.id, ...await reconcileUnit5Period(organizationId, period.id) });
    const mismatches = results.filter(({ balanced }) => !balanced);
    if (mismatches.length) throw new Error(`Leave ledger reconciliation found ${mismatches.length} divergent account period(s).`);
    return results;
  }
  const upcoming = new Date(now.getTime() + 7 * 86_400_000);
  const [leave, returns] = await Promise.all([
    prisma.hrLeaveRequestVersion.findMany({ where: { organizationId, segments: { some: { startsAt: { gt: now, lte: upcoming } } }, transitions: { some: { toStatus: { in: ["APPROVED", "SCHEDULED"] } } }, request: { requestedBy: { status: "ACTIVE" } } }, include: { request: { include: { requestedBy: true } } }, take: 100 }),
    prisma.hrLeaveLongAbsence.findMany({ where: { organizationId, status: { not: "COMPLETED" }, expectedReturnAt: { gt: now, lte: upcoming } }, include: { requestVersion: { include: { request: { include: { requestedBy: true } } } } }, take: 100 }),
  ]);
  return prisma.$transaction(async (tx) => {
    for (const item of leave) await enqueueHrEmail(tx, { organizationId, recipient: item.request.requestedBy.email, template: "hr-leave-upcoming", subject: "Upcoming leave reminder", payload: { leaveRequestId: item.requestId, requestVersionId: item.id }, idempotencyKey: `hr-leave-upcoming:${item.id}:${now.toISOString().slice(0, 10)}` });
    for (const item of returns) await enqueueHrEmail(tx, { organizationId, recipient: item.requestVersion.request.requestedBy.email, template: "hr-leave-return-to-work", subject: "Return-to-work action due", payload: { longAbsenceId: item.id, requestVersionId: item.requestVersionId }, idempotencyKey: `hr-leave-return:${item.id}:${now.toISOString().slice(0, 10)}` });
    return { upcomingLeave: leave.length, upcomingReturns: returns.length };
  });
}

export async function runUnit5OperationalWindow(now = new Date()) {
  const windowKey = now.toISOString().slice(0, 10);
  const organizations = await prisma.hrOrganization.findMany({ select: { id: true }, orderBy: { id: "asc" } });
  const results: Array<{ organizationId: string; jobType: JobType; status: string; result?: unknown; error?: string }> = [];
  for (const organization of organizations) for (const jobType of jobTypes) {
    const claim = await claimJob(organization.id, jobType, windowKey, now);
    if (!claim) { results.push({ organizationId: organization.id, jobType, status: "SKIPPED" }); continue; }
    try {
      const result = await runJob(organization.id, jobType, now);
      await prisma.hrLeaveJobRun.update({ where: { id: claim.id }, data: { status: "COMPLETED", completedAt: new Date(), checkpoint: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue } });
      results.push({ organizationId: organization.id, jobType, status: "COMPLETED", result });
    } catch (error) {
      const message = safeError(error);
      const run = await prisma.hrLeaveJobRun.findUniqueOrThrow({ where: { id: claim.id }, select: { attemptCount: true } });
      const status = run.attemptCount >= 5 ? "ABANDONED" : "FAILED";
      await prisma.hrLeaveJobRun.update({ where: { id: claim.id }, data: { status, safeError: message, completedAt: new Date() } });
      results.push({ organizationId: organization.id, jobType, status, error: message });
    }
  }
  return results;
}
