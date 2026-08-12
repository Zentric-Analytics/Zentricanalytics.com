import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { appendHrAudit } from "@/lib/hr/audit";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { prisma } from "@/lib/prisma";

const MAX_ATTEMPTS = 5;

async function claimRun(organizationId: string, jobType: string, windowKey: string, now: Date) {
  return prisma.$transaction(async (tx) => {
    const correlationId = `unit7-job:${organizationId}:${jobType}:${windowKey}`;
    const run = await tx.hrPerformanceJobRun.upsert({ where: { organizationId_jobType_windowKey: { organizationId, jobType, windowKey } }, update: {}, create: { organizationId, jobType, windowKey, correlationId } });
    if (run.status === "COMPLETED" || run.status === "DEAD_LETTER") return null;
    const staleBefore = new Date(now.getTime() - 10 * 60_000);
    const token = crypto.randomUUID();
    const claimed = await tx.hrPerformanceJobRun.updateMany({ where: { id: run.id, OR: [{ status: { in: ["PENDING", "FAILED"] } }, { status: "PROCESSING", startedAt: { lt: staleBefore } }] }, data: { status: "PROCESSING", claimTokenHash: crypto.createHash("sha256").update(token).digest("hex"), attemptCount: { increment: 1 }, startedAt: now, completedAt: null, safeError: null } });
    return claimed.count === 1 ? { ...run, attemptCount: run.attemptCount + 1, correlationId } : null;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function sendDueGoalReminders(organizationId: string, now: Date) {
  const horizon = new Date(now.getTime() + 7 * 86_400_000);
  const goals = await prisma.hrPerformanceGoal.findMany({ where: { organizationId, status: "ACTIVE" }, orderBy: { updatedAt: "asc" }, take: 500 });
  let queued = 0;
  for (const goal of goals) {
    const version = await prisma.hrPerformanceGoalVersion.findUnique({ where: { goalId_version: { goalId: goal.id, version: goal.currentVersion } } });
    if (!version || version.dueAt < now || version.dueAt > horizon) continue;
    const owner = await prisma.hrUser.findFirst({ where: { id: goal.ownerUserId, organizationId, status: "ACTIVE" }, include: { employee: true } });
    if (!owner) continue;
    await enqueueHrEmail(prisma, { organizationId, recipient: owner.email, template: "hr-performance-goal-due", subject: "Performance goal due soon", payload: { recipientName: owner.employee?.preferredName ?? owner.employee?.legalFirstName ?? owner.email.split("@")[0], href: "/hr/employee/performance", goalId: goal.id }, idempotencyKey: `unit7-goal-due:${goal.id}:v${goal.currentVersion}:${version.dueAt.toISOString().slice(0, 10)}` });
    queued += 1;
  }
  return queued;
}

async function sendDueDevelopmentReminders(organizationId: string, now: Date) {
  const horizon = new Date(now.getTime() + 7 * 86_400_000);
  const actions = await prisma.hrDevelopmentAction.findMany({ where: { organizationId, status: "PENDING", targetDate: { gte: now, lte: horizon } }, orderBy: { targetDate: "asc" }, take: 500 });
  let queued = 0;
  for (const action of actions) {
    const owner = await prisma.hrUser.findFirst({ where: { id: action.ownerUserId, organizationId, status: "ACTIVE" }, include: { employee: true } });
    if (!owner) continue;
    await enqueueHrEmail(prisma, { organizationId, recipient: owner.email, template: "hr-performance-development-action-due", subject: "Development action due soon", payload: { recipientName: owner.employee?.preferredName ?? owner.employee?.legalFirstName ?? owner.email.split("@")[0], href: "/hr/employee/performance", developmentActionId: action.id }, idempotencyKey: `unit7-development-due:${action.id}:${action.targetDate.toISOString().slice(0, 10)}` });
    queued += 1;
  }
  return queued;
}

async function sendDueCheckInReminders(organizationId: string, now: Date) {
  const horizon = new Date(now.getTime() + 7 * 86_400_000);
  const checkIns = await prisma.hrPerformanceCheckIn.findMany({ where: { organizationId, followUpAt: { gte: now, lte: horizon } }, orderBy: { followUpAt: "asc" }, take: 500 });
  let queued = 0;
  for (const checkIn of checkIns) {
    const manager = await prisma.hrEmployee.findFirst({ where: { id: checkIn.managerEmployeeId, organizationId, userId: { not: null } }, include: { user: true } });
    if (!manager?.user || manager.user.status !== "ACTIVE") continue;
    await enqueueHrEmail(prisma, { organizationId, recipient: manager.user.email, template: "hr-performance-checkin-due", subject: "Performance check-in follow-up due", payload: { recipientName: manager.preferredName ?? manager.legalFirstName, href: "/hr/supervisor/performance", checkInId: checkIn.id }, idempotencyKey: `unit7-checkin-due:${checkIn.id}:${checkIn.followUpAt!.toISOString().slice(0, 10)}` });
    queued += 1;
  }
  return queued;
}

async function sendReviewActionReminders(organizationId: string) {
  const reviews = await prisma.hrPerformanceReview.findMany({ where: { organizationId, status: { in: ["SELF_REVIEW", "MANAGER_REVIEW", "CALIBRATION"] } }, orderBy: { updatedAt: "asc" }, take: 500 });
  let queued = 0;
  for (const review of reviews) {
    if (review.status === "SELF_REVIEW") {
      const employee = await prisma.hrEmployee.findFirst({ where: { id: review.employeeId, organizationId, userId: { not: null } }, include: { user: true } });
      if (!employee?.user || employee.user.status !== "ACTIVE") continue;
      await enqueueHrEmail(prisma, { organizationId, recipient: employee.user.email, template: "hr-performance-self-review-due", subject: "Your self-review needs action", payload: { recipientName: employee.preferredName ?? employee.legalFirstName, href: "/hr/employee/performance", reviewId: review.id }, idempotencyKey: `unit7-self-review-due:${review.id}:v${review.version}` });
      queued += 1;
      continue;
    }
    if (review.status === "MANAGER_REVIEW") {
      const reviewer = await prisma.hrUser.findFirst({ where: { id: review.reviewerUserId, organizationId, status: "ACTIVE" }, include: { employee: true } });
      if (!reviewer) continue;
      await enqueueHrEmail(prisma, { organizationId, recipient: reviewer.email, template: "hr-performance-manager-review-due", subject: "Manager review needs action", payload: { recipientName: reviewer.employee?.preferredName ?? reviewer.employee?.legalFirstName ?? reviewer.email.split("@")[0], href: "/hr/supervisor/performance", reviewId: review.id }, idempotencyKey: `unit7-manager-review-due:${review.id}:v${review.version}` });
      queued += 1;
      continue;
    }
    const sessions = await prisma.hrCalibrationSession.findMany({ where: { organizationId, cycleId: review.cycleId, status: { in: ["IN_SESSION", "DECISIONS_PENDING"] } }, select: { id: true, version: true } });
    for (const session of sessions) {
      const grants = await prisma.hrCalibrationGrant.findMany({ where: { organizationId, sessionId: session.id, effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] }, select: { userId: true } });
      const users = await prisma.hrUser.findMany({ where: { organizationId, id: { in: grants.map(({ userId }) => userId) }, status: "ACTIVE" }, include: { employee: true } });
      for (const user of users) {
        await enqueueHrEmail(prisma, { organizationId, recipient: user.email, template: "hr-performance-calibration-action", subject: "Calibration action required", payload: { recipientName: user.employee?.preferredName ?? user.employee?.legalFirstName ?? user.email.split("@")[0], href: "/hr/admin/performance", sessionId: session.id, reviewId: review.id }, idempotencyKey: `unit7-calibration-action:${session.id}:v${session.version}:${review.id}:${user.id}` });
        queued += 1;
      }
    }
  }
  return queued;
}

async function reconcilePromotionHandoffs(organizationId: string) {
  const cases = await prisma.hrPromotionCase.findMany({ where: { organizationId, status: "EXECUTION_PENDING", workforceEventId: { not: null } }, take: 500 });
  let reconciled = 0;
  for (const item of cases) {
    const event = await prisma.hrWorkforceEvent.findFirst({ where: { id: item.workforceEventId!, organizationId }, select: { id: true, status: true, version: true } });
    if (!event) throw new Error(`Promotion case ${item.id} references a missing workforce event.`);
    if (event.status !== "APPLIED") continue;
    const updated = await prisma.hrPromotionCase.updateMany({ where: { id: item.id, status: "EXECUTION_PENDING", version: item.version, workforceEventId: event.id }, data: { status: "APPLIED", version: { increment: 1 }, workforceEventVersion: event.version } });
    if (updated.count !== 1) continue;
    await appendHrAudit(prisma, { organizationId, actorRole: "WORKER", entityType: "HrPromotionCase", entityId: item.id, action: "hr.performance.promotion.applied", previousValues: { status: item.status, version: item.version }, newValues: { status: "APPLIED", version: item.version + 1, workforceEventId: event.id, workforceEventVersion: event.version }, correlationId: item.correlationId });
    reconciled += 1;
  }
  return reconciled;
}

export async function runPerformanceOperationalWindow(now = new Date()) {
  const organizations = await prisma.hrOrganization.findMany({ select: { id: true } });
  const windowKey = now.toISOString().slice(0, 13);
  const results: Array<{ organizationId: string; status: string; reminders: number; reconciled: number }> = [];
  for (const { id: organizationId } of organizations) {
    const run = await claimRun(organizationId, "PERFORMANCE_OPERATIONAL_SWEEP", windowKey, now);
    if (!run) { results.push({ organizationId, status: "SKIPPED", reminders: 0, reconciled: 0 }); continue; }
    try {
      const reminders = (await sendDueGoalReminders(organizationId, now)) + (await sendDueDevelopmentReminders(organizationId, now)) + (await sendDueCheckInReminders(organizationId, now)) + (await sendReviewActionReminders(organizationId));
      const reconciled = await reconcilePromotionHandoffs(organizationId);
      await prisma.hrPerformanceJobRun.update({ where: { id: run.id }, data: { status: "COMPLETED", completedAt: new Date(), checkpoint: { reminders, reconciled }, claimTokenHash: null } });
      await appendHrAudit(prisma, { organizationId, actorRole: "WORKER", entityType: "HrPerformanceJobRun", entityId: run.id, action: "hr.performance.worker.completed", newValues: { jobType: run.jobType, windowKey, reminders, reconciled }, correlationId: run.correlationId });
      results.push({ organizationId, status: "COMPLETED", reminders, reconciled });
    } catch (error) {
      const safeError = (error instanceof Error ? error.message : "Performance worker failed").slice(0, 1000);
      const status = run.attemptCount >= MAX_ATTEMPTS ? "DEAD_LETTER" : "FAILED";
      await prisma.hrPerformanceJobRun.update({ where: { id: run.id }, data: { status, completedAt: new Date(), safeError, claimTokenHash: null } });
      results.push({ organizationId, status, reminders: 0, reconciled: 0 });
    }
  }
  return results;
}
