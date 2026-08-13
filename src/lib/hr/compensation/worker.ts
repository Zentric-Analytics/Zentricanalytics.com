import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { appendHrAudit } from "@/lib/hr/audit";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { prisma } from "@/lib/prisma";
import { activateCompensationDecision, compensationBudgetState } from "./commands";

const MAX_ATTEMPTS = 5;

async function claimRun(organizationId: string, windowKey: string, now: Date) {
  return prisma.$transaction(async (tx) => {
    const jobType = "COMPENSATION_OPERATIONAL_SWEEP";
    const correlationId = `unit8-job:${organizationId}:${windowKey}`;
    const run = await tx.hrCompJobRun.upsert({ where: { organizationId_jobType_windowKey: { organizationId, jobType, windowKey } }, update: {}, create: { organizationId, jobType, windowKey, correlationId } });
    if (["COMPLETED", "DEAD_LETTER"].includes(run.status)) return null;
    const staleBefore = new Date(now.getTime() - 10 * 60_000);
    const tokenHash = crypto.createHash("sha256").update(crypto.randomUUID()).digest("hex");
    const claimed = await tx.hrCompJobRun.updateMany({ where: { id: run.id, OR: [{ status: { in: ["PENDING", "FAILED"] } }, { status: "PROCESSING", startedAt: { lt: staleBefore } }] }, data: { status: "PROCESSING", claimTokenHash: tokenHash, attemptCount: { increment: 1 }, startedAt: now, completedAt: null, safeError: null } });
    return claimed.count === 1 ? { ...run, attemptCount: run.attemptCount + 1 } : null;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function openDueCycles(organizationId: string, now: Date) {
  const cycles = await prisma.hrCompCycle.findMany({ where: { organizationId, status: "PUBLISHED", recommendationOpensAt: { lte: now } }, take: 100 });
  let opened = 0;
  for (const cycle of cycles) {
    const result = await prisma.hrCompCycle.updateMany({ where: { id: cycle.id, organizationId, status: "PUBLISHED", version: cycle.version }, data: { status: "OPEN", version: { increment: 1 } } });
    if (result.count !== 1) continue;
    await appendHrAudit(prisma, { organizationId, actorRole: "WORKER", entityType: "HrCompCycle", entityId: cycle.id, action: "hr.compensation.cycle.opened", previousValues: { status: cycle.status, version: cycle.version }, newValues: { status: "OPEN", version: cycle.version + 1 }, correlationId: cycle.correlationId });
    opened += 1;
  }
  return opened;
}

async function sendRecommendationReminders(organizationId: string, now: Date) {
  const horizon = new Date(now.getTime() + 7 * 86_400_000);
  const cycles = await prisma.hrCompCycle.findMany({ where: { organizationId, managerDeadlineAt: { gte: now, lte: horizon }, status: { in: ["OPEN", "REVIEW"] } }, select: { id: true } });
  const populations = await prisma.hrCompCyclePopulation.findMany({ where: { organizationId, cycleId: { in: cycles.map(({ id }) => id) } }, select: { id: true } });
  const recommendations = await prisma.hrCompRecommendation.findMany({ where: { organizationId, status: { in: ["DRAFT", "RETURNED"] }, cyclePopulationId: { in: populations.map(({ id }) => id) } }, take: 500 });
  let queued = 0;
  for (const item of recommendations) {
    const manager = await prisma.hrUser.findFirst({ where: { id: item.managerUserId, organizationId, status: "ACTIVE" }, include: { employee: true } });
    if (!manager) continue;
    await enqueueHrEmail(prisma, { organizationId, recipient: manager.email, template: "hr-compensation-recommendation-due", subject: "Compensation recommendation due", payload: { recipientName: manager.employee?.preferredName ?? manager.employee?.legalFirstName ?? manager.email.split("@")[0], href: "/hr/supervisor/compensation", recommendationId: item.id }, idempotencyKey: `unit8-recommendation-due:${item.id}:v${item.version}` });
    queued += 1;
  }
  return queued;
}

async function reconcileBudgets(organizationId: string) {
  const budgets = await prisma.hrCompBudget.findMany({ where: { organizationId }, select: { id: true } });
  let reconciled = 0;
  for (const budget of budgets) {
    const state = await compensationBudgetState(organizationId, budget.id);
    if (!state.balanced) throw new Error(`Compensation budget ${budget.id} is imbalanced.`);
    reconciled += 1;
  }
  return reconciled;
}

async function activateDueDecisions(organizationId: string, now: Date) {
  const decisions = await prisma.hrCompDecision.findMany({ where: { organizationId, recommendationId: { not: null }, status: { in: ["SCHEDULED", "EFFECTIVE"] }, effectiveAt: { lte: now } }, orderBy: { effectiveAt: "asc" }, take: 200 });
  let activated = 0;
  for (const decision of decisions) {
    await activateCompensationDecision({ organizationId, actorUserId: "WORKER" }, decision.id, now);
    activated += 1;
  }
  return activated;
}

export async function runCompensationOperationalWindow(now = new Date()) {
  const organizations = await prisma.hrOrganization.findMany({ select: { id: true } });
  const windowKey = now.toISOString().slice(0, 13);
  const results: Array<{ organizationId: string; status: string; opened: number; reminders: number; activated: number; reconciled: number }> = [];
  for (const { id: organizationId } of organizations) {
    const run = await claimRun(organizationId, windowKey, now);
    if (!run) { results.push({ organizationId, status: "SKIPPED", opened: 0, reminders: 0, activated: 0, reconciled: 0 }); continue; }
    try {
      const opened = await openDueCycles(organizationId, now);
      const reminders = await sendRecommendationReminders(organizationId, now);
      const activated = await activateDueDecisions(organizationId, now);
      const reconciled = await reconcileBudgets(organizationId);
      const checkpoint = { opened, reminders, activated, reconciled };
      await prisma.hrCompJobRun.update({ where: { id: run.id }, data: { status: "COMPLETED", completedAt: new Date(), checkpoint, claimTokenHash: null } });
      await appendHrAudit(prisma, { organizationId, actorRole: "WORKER", entityType: "HrCompJobRun", entityId: run.id, action: "hr.compensation.worker.completed", newValues: checkpoint, correlationId: run.correlationId });
      results.push({ organizationId, status: "COMPLETED", ...checkpoint });
    } catch (error) {
      const safeError = (error instanceof Error ? error.message : "Compensation worker failed").slice(0, 1000);
      const status = run.attemptCount >= MAX_ATTEMPTS ? "DEAD_LETTER" : "FAILED";
      await prisma.hrCompJobRun.update({ where: { id: run.id }, data: { status, completedAt: new Date(), safeError, claimTokenHash: null } });
      results.push({ organizationId, status, opened: 0, reminders: 0, activated: 0, reconciled: 0 });
    }
  }
  return results;
}
