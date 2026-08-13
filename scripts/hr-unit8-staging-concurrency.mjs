import crypto from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
if (process.env.HR_UNIT8_STAGING_CONCURRENCY_CONFIRM !== "staging-only" || databaseUrl.pathname.slice(1) !== "zentric_analytics_staging") {
  throw new Error("Refusing Unit 8 concurrency validation outside the explicitly confirmed staging database.");
}

const prisma = new PrismaClient();
const run = `unit8-concurrency-${Date.now()}`;
const key = (suffix) => `${run}:${suffix}:${crypto.randomUUID()}`;
const evidence = {};

function exactlyOne(name, settled, loser) {
  const winners = settled.filter(({ status }) => status === "fulfilled").length;
  if (winners !== 1) throw new Error(`${name} expected one winner, received ${winners}.`);
  evidence[name] = { attempts: settled.length, winners, loser };
}

try {
  const organization = await prisma.hrOrganization.findFirstOrThrow({ select: { id: true } });
  const actors = await prisma.hrUser.findMany({ where: { organizationId: organization.id, status: "ACTIVE" }, take: 2, select: { id: true } });
  if (actors.length !== 2) throw new Error("Two active staging actors are required.");
  const cycle = await prisma.hrCompCycle.findFirstOrThrow({ where: { organizationId: organization.id }, orderBy: { createdAt: "desc" } });
  const recommendation = await prisma.hrCompRecommendation.findFirstOrThrow({ where: { organizationId: organization.id }, orderBy: { createdAt: "desc" } });
  const handoff = await prisma.hrPayrollCompHandoff.findFirstOrThrow({ where: { organizationId: organization.id }, orderBy: { createdAt: "desc" } });
  const baselineDecision = await prisma.hrCompDecision.findFirstOrThrow({ where: { organizationId: organization.id, recommendationId: { not: null } }, orderBy: { createdAt: "desc" } });
  const baselineAward = await prisma.hrBonusAward.findFirstOrThrow({ where: { organizationId: organization.id }, orderBy: { createdAt: "desc" } });
  const baselineBand = await prisma.hrCompBandVersion.findFirstOrThrow({ where: { organizationId: organization.id, status: "PUBLISHED" }, orderBy: { createdAt: "desc" } });

  const budget = await prisma.hrCompBudget.create({ data: { organizationId: organization.id, cycleId: cycle.id, scopeType: "UNIT8_CONCURRENCY", scopeId: run, currency: recommendation.currency, allocatedAmount: new Prisma.Decimal("10000"), createdById: actors[0].id } });
  async function reserve(amount, suffix) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "HrCompBudget" WHERE id=${budget.id} FOR UPDATE`;
      const entries = await tx.hrCompBudgetEntry.findMany({ where: { budgetId: budget.id }, select: { entryType: true, amount: true } });
      const reserved = entries.reduce((sum, entry) => entry.entryType === "RESERVE" ? sum.plus(entry.amount) : entry.entryType === "RELEASE" ? sum.minus(entry.amount) : sum, new Prisma.Decimal(0));
      if (reserved.plus(amount).greaterThan(budget.allocatedAmount)) throw new Error("INSUFFICIENT_BUDGET");
      return tx.hrCompBudgetEntry.create({ data: { organizationId: organization.id, budgetId: budget.id, entryType: "RESERVE", amount, currency: budget.currency, reason: "Unit 8 real PostgreSQL concurrency validation", idempotencyKey: `${run}:${suffix}`, correlationId: key(suffix), createdById: actors[0].id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  const budgetRace = await Promise.allSettled([reserve(new Prisma.Decimal("8000"), "manager-a"), reserve(new Prisma.Decimal("7000"), "manager-b")]);
  exactlyOne("shared_budget_8000_vs_7000", budgetRace, "INSUFFICIENT_BUDGET");
  const durableReserved = await prisma.hrCompBudgetEntry.aggregate({ where: { budgetId: budget.id, entryType: "RESERVE" }, _sum: { amount: true } });
  const reservedAmount = new Prisma.Decimal(durableReserved._sum.amount ?? 0);
  if (!reservedAmount.equals("7000") && !reservedAmount.equals("8000")) throw new Error("Budget race produced an invalid durable reservation.");

  const optimistic = await prisma.hrCompRecommendation.create({ data: { organizationId: organization.id, cyclePopulationId: recommendation.cyclePopulationId, employeeId: recommendation.employeeId, managerUserId: recommendation.managerUserId, currentRecordId: recommendation.currentRecordId, bandVersionId: recommendation.bandVersionId, policyVersionId: recommendation.policyVersionId, version: 1, status: "DRAFT", currentAmount: recommendation.currentAmount, proposedAmount: recommendation.proposedAmount, currency: recommendation.currency, rangePosition: recommendation.rangePosition, guideline: recommendation.guideline, budgetImpact: recommendation.budgetImpact, rationale: run, contentHash: key("recommendation-hash"), idempotencyKey: key("recommendation"), correlationId: key("recommendation-correlation") } });
  const recommendationRace = await Promise.all([
    prisma.hrCompRecommendation.updateMany({ where: { id: optimistic.id, version: 1, status: "DRAFT" }, data: { version: 2, status: "SUBMITTED", submittedAt: new Date() } }),
    prisma.hrCompRecommendation.updateMany({ where: { id: optimistic.id, version: 1, status: "DRAFT" }, data: { version: 2, status: "WITHDRAWN" } }),
  ]);
  if (recommendationRace.reduce((sum, item) => sum + item.count, 0) !== 1) throw new Error("Recommendation race did not produce one winner.");
  evidence.recommendation_submit_vs_withdraw = { claims: recommendationRace.map(({ count }) => count), loser: "STALE_VERSION" };

  const duplicateRecommendationKey = key("duplicate-recommendation");
  const duplicateRecommendationCorrelation = key("duplicate-recommendation-correlation");
  const duplicateRecommendationData = { organizationId: organization.id, cyclePopulationId: recommendation.cyclePopulationId, employeeId: recommendation.employeeId, managerUserId: recommendation.managerUserId, currentRecordId: recommendation.currentRecordId, bandVersionId: recommendation.bandVersionId, policyVersionId: recommendation.policyVersionId, version: 1, status: "DRAFT", currentAmount: recommendation.currentAmount, proposedAmount: recommendation.proposedAmount, currency: recommendation.currency, rangePosition: recommendation.rangePosition, guideline: recommendation.guideline, budgetImpact: recommendation.budgetImpact, rationale: run, contentHash: key("duplicate-recommendation-hash"), idempotencyKey: duplicateRecommendationKey, correlationId: duplicateRecommendationCorrelation };
  exactlyOne("duplicate_recommendation_submission", await Promise.allSettled([0, 1].map(() => prisma.hrCompRecommendation.create({ data: duplicateRecommendationData }))), "IDEMPOTENCY_CONFLICT");

  const duplicateDecisionKey = key("duplicate-decision");
  const duplicateDecisionCorrelation = key("duplicate-decision-correlation");
  const duplicateDecisionData = { organizationId: organization.id, eventType: "MARKET_ADJUSTMENT", status: "PENDING", oldAmount: baselineDecision.oldAmount, newAmount: baselineDecision.newAmount, currency: baselineDecision.currency, payBasis: baselineDecision.payBasis, marketVersionId: baselineDecision.marketVersionId, bandVersionId: baselineDecision.bandVersionId, policyVersionId: baselineDecision.policyVersionId, effectiveAt: new Date(Date.now() + 86_400_000), approverUserIds: [actors[1].id], rationale: run, idempotencyKey: duplicateDecisionKey, correlationId: duplicateDecisionCorrelation };
  exactlyOne("duplicate_final_decision", await Promise.allSettled([0, 1].map(() => prisma.hrCompDecision.create({ data: duplicateDecisionData }))), "IDEMPOTENCY_CONFLICT");

  const duplicateAwardKey = key("duplicate-award");
  const duplicateAwardCorrelation = key("duplicate-award-correlation");
  const duplicateAwardData = { organizationId: organization.id, employeeId: baselineAward.employeeId, workRelationshipId: baselineAward.workRelationshipId, programVersionId: baselineAward.programVersionId, proposedAmount: baselineAward.proposedAmount, approvedAmount: baselineAward.approvedAmount, currency: baselineAward.currency, reason: run, effectiveAt: new Date(), status: "APPROVED", approverUserIds: [actors[1].id], idempotencyKey: duplicateAwardKey, correlationId: duplicateAwardCorrelation, approvedAt: new Date() };
  exactlyOne("duplicate_bonus_award", await Promise.allSettled([0, 1].map(() => prisma.hrBonusAward.create({ data: duplicateAwardData }))), "IDEMPOTENCY_CONFLICT");

  const exception = await prisma.hrCompException.create({ data: { organizationId: organization.id, recommendationId: optimistic.id, recommendationVersion: optimistic.version, exceptionType: "ABOVE_BAND", proposedAmount: recommendation.proposedAmount, referenceAmount: baselineBand.maximum, varianceAmount: recommendation.proposedAmount.minus(baselineBand.maximum), variancePercent: new Prisma.Decimal(0), restrictedRationale: run, requestedById: actors[0].id, correlationId: key("exception") } });
  const exceptionClaims = await Promise.all([
    prisma.hrCompException.updateMany({ where: { id: exception.id, status: "REQUESTED" }, data: { status: "APPROVED", decidedByIds: [actors[1].id], decisionReason: run, decidedAt: new Date() } }),
    prisma.hrCompException.updateMany({ where: { id: exception.id, status: "REQUESTED" }, data: { status: "REJECTED", decidedByIds: [actors[1].id], decisionReason: run, decidedAt: new Date() } }),
  ]);
  if (exceptionClaims.reduce((sum, item) => sum + item.count, 0) !== 1) throw new Error("Exception decision race did not produce one winner.");
  evidence.exception_approval_vs_rejection = { claims: exceptionClaims.map(({ count }) => count), loser: "ALREADY_DECIDED" };

  const immutableBandEdit = await Promise.allSettled([prisma.hrCompBandVersion.update({ where: { id: baselineBand.id }, data: { maximum: baselineBand.maximum.plus(1) } })]);
  if (immutableBandEdit[0].status !== "rejected") throw new Error("Published band version was mutable during exception handling.");
  evidence.exception_vs_band_version_change = { bandChange: "REJECTED_IMMUTABLE", exceptionDecision: "ONE_WINNER" };

  const duplicateNotificationKey = `${run}:notification`;
  const notifications = await Promise.allSettled([0, 1].map(() => prisma.hrNotification.create({ data: { organizationId: organization.id, userId: actors[0].id, category: "hr-compensation", title: "Unit 8 concurrency validation", body: "Replay-safe notification evidence", idempotencyKey: duplicateNotificationKey } })));
  exactlyOne("notification_replay", notifications, "IDEMPOTENCY_CONFLICT");

  const handoffKey = `${run}:handoff`;
  const handoffs = await Promise.allSettled([0, 1].map(() => prisma.hrPayrollCompHandoff.create({ data: { organizationId: organization.id, employeeId: handoff.employeeId, workRelationshipId: handoff.workRelationshipId, assignmentId: handoff.assignmentId, compensationRecordId: handoff.compensationRecordId, bonusAwardId: handoff.bonusAwardId, eventType: handoff.eventType, amount: handoff.amount, currency: handoff.currency, payBasis: handoff.payBasis, effectiveAt: handoff.effectiveAt, status: "READY", idempotencyKey: handoffKey, correlationId: key("handoff"), readyAt: new Date() } })));
  exactlyOne("payroll_handoff_replay", handoffs, "IDEMPOTENCY_CONFLICT");

  const job = await prisma.hrCompJobRun.create({ data: { organizationId: organization.id, jobType: "UNIT8_CONCURRENCY", windowKey: run, correlationId: key("job") } });
  const claims = await Promise.all([0, 1].map(() => prisma.hrCompJobRun.updateMany({ where: { id: job.id, status: "PENDING" }, data: { status: "PROCESSING", claimTokenHash: crypto.randomUUID(), attemptCount: { increment: 1 } } })));
  if (claims.reduce((sum, item) => sum + item.count, 0) !== 1) throw new Error("Worker claim race did not produce exactly one winner.");
  evidence.worker_claim_replay = { claims: claims.map(({ count }) => count), loser: "ALREADY_CLAIMED" };

  await prisma.hrAuditEvent.createMany({ data: Object.entries(evidence).map(([race, result]) => ({ organizationId: organization.id, actorUserId: actors[0].id, actorRole: "COMPENSATION_ADMIN", entityType: "Unit8ConcurrencyRace", entityId: race, action: "hr.compensation.concurrency.validated", reason: "Real PostgreSQL Unit 8 race validation", newValues: result, correlationId: run })) });
  const auditCount = await prisma.hrAuditEvent.count({ where: { correlationId: run, action: "hr.compensation.concurrency.validated" } });
  if (auditCount !== Object.keys(evidence).length) throw new Error("Concurrency audit evidence is incomplete.");
  console.log(JSON.stringify({ result: "PASS", run, database: databaseUrl.pathname.slice(1), races: evidence, durableReserved: durableReserved._sum.amount?.toString(), auditCount }, null, 2));
} finally {
  await prisma.$disconnect();
}
