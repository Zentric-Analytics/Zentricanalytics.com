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

  const competing = await prisma.hrCompRecommendation.create({ data: { organizationId: organization.id, cyclePopulationId: recommendation.cyclePopulationId, employeeId: recommendation.employeeId, managerUserId: recommendation.managerUserId, currentRecordId: recommendation.currentRecordId, bandVersionId: recommendation.bandVersionId, policyVersionId: recommendation.policyVersionId, version: 1, status: "DRAFT", currentAmount: recommendation.currentAmount, proposedAmount: recommendation.proposedAmount, currency: recommendation.currency, rangePosition: recommendation.rangePosition, guideline: recommendation.guideline, budgetImpact: recommendation.budgetImpact, rationale: run, contentHash: key("competing-recommendation-hash"), idempotencyKey: key("competing-recommendation"), correlationId: key("competing-recommendation-correlation") } });
  const competingClaims = await Promise.all([
    prisma.hrCompRecommendation.updateMany({ where: { id: competing.id, version: 1, status: "DRAFT" }, data: { version: 2, proposedAmount: competing.proposedAmount.plus("100"), status: "SUBMITTED", submittedAt: new Date() } }),
    prisma.hrCompRecommendation.updateMany({ where: { id: competing.id, version: 1, status: "DRAFT" }, data: { version: 2, proposedAmount: competing.proposedAmount.plus("200"), status: "SUBMITTED", submittedAt: new Date() } }),
  ]);
  if (competingClaims.reduce((sum, item) => sum + item.count, 0) !== 1) throw new Error("Competing recommendations did not produce one authoritative version.");
  evidence.recommendation_vs_recommendation = { claims: competingClaims.map(({ count }) => count), loser: "STALE_VERSION" };

  const duplicateRecommendationKey = key("duplicate-recommendation");
  const duplicateRecommendationCorrelation = key("duplicate-recommendation-correlation");
  const duplicateRecommendationData = { organizationId: organization.id, cyclePopulationId: recommendation.cyclePopulationId, employeeId: recommendation.employeeId, managerUserId: recommendation.managerUserId, currentRecordId: recommendation.currentRecordId, bandVersionId: recommendation.bandVersionId, policyVersionId: recommendation.policyVersionId, version: 1, status: "DRAFT", currentAmount: recommendation.currentAmount, proposedAmount: recommendation.proposedAmount, currency: recommendation.currency, rangePosition: recommendation.rangePosition, guideline: recommendation.guideline, budgetImpact: recommendation.budgetImpact, rationale: run, contentHash: key("duplicate-recommendation-hash"), idempotencyKey: duplicateRecommendationKey, correlationId: duplicateRecommendationCorrelation };
  exactlyOne("duplicate_recommendation_submission", await Promise.allSettled([0, 1].map(() => prisma.hrCompRecommendation.create({ data: duplicateRecommendationData }))), "IDEMPOTENCY_CONFLICT");

  const duplicateDecisionKey = key("duplicate-decision");
  const duplicateDecisionCorrelation = key("duplicate-decision-correlation");
  const duplicateDecisionData = { organizationId: organization.id, eventType: "MARKET_ADJUSTMENT", status: "PENDING", oldAmount: baselineDecision.oldAmount, newAmount: baselineDecision.newAmount, currency: baselineDecision.currency, payBasis: baselineDecision.payBasis, marketVersionId: baselineDecision.marketVersionId, bandVersionId: baselineDecision.bandVersionId, policyVersionId: baselineDecision.policyVersionId, effectiveAt: new Date(Date.now() + 86_400_000), approverUserIds: [actors[1].id], rationale: run, idempotencyKey: duplicateDecisionKey, correlationId: duplicateDecisionCorrelation };
  exactlyOne("duplicate_final_decision", await Promise.allSettled([0, 1].map(() => prisma.hrCompDecision.create({ data: duplicateDecisionData }))), "IDEMPOTENCY_CONFLICT");

  const approvalCorrectionRecommendation = await prisma.hrCompRecommendation.create({ data: { ...duplicateRecommendationData, idempotencyKey: key("approval-correction-recommendation"), correlationId: key("approval-correction-recommendation-correlation"), contentHash: key("approval-correction-recommendation-hash"), status: "HR_REVIEW" } });
  const approvalCorrectionKey = key("approval-correction-decision");
  const approvalCorrectionBase = { ...duplicateDecisionData, recommendationId: approvalCorrectionRecommendation.id, recommendationVersion: approvalCorrectionRecommendation.version, idempotencyKey: approvalCorrectionKey };
  exactlyOne("approval_vs_compensation_correction", await Promise.allSettled([
    prisma.hrCompDecision.create({ data: { ...approvalCorrectionBase, eventType: "MERIT", correlationId: key("approval-correction-approval") } }),
    prisma.hrCompDecision.create({ data: { ...approvalCorrectionBase, eventType: "CORRECTION", correlationId: key("approval-correction-correction") } }),
  ]), "RECOMMENDATION_ALREADY_DECIDED");

  const duplicateAwardKey = key("duplicate-award");
  const duplicateAwardCorrelation = key("duplicate-award-correlation");
  const duplicateAwardData = { organizationId: organization.id, employeeId: baselineAward.employeeId, workRelationshipId: baselineAward.workRelationshipId, programVersionId: baselineAward.programVersionId, proposedAmount: baselineAward.proposedAmount, approvedAmount: baselineAward.approvedAmount, currency: baselineAward.currency, reason: run, effectiveAt: new Date(), status: "APPROVED", approverUserIds: [actors[1].id], idempotencyKey: duplicateAwardKey, correlationId: duplicateAwardCorrelation, approvedAt: new Date() };
  exactlyOne("duplicate_bonus_award", await Promise.allSettled([0, 1].map(() => prisma.hrBonusAward.create({ data: duplicateAwardData }))), "IDEMPOTENCY_CONFLICT");

  const exceptionAmount = baselineBand.maximum.plus("1000");
  const exceptionVariance = exceptionAmount.minus(baselineBand.maximum);
  const exception = await prisma.hrCompException.create({ data: { organizationId: organization.id, recommendationId: optimistic.id, recommendationVersion: optimistic.version, exceptionType: "ABOVE_BAND", proposedAmount: exceptionAmount, referenceAmount: baselineBand.maximum, varianceAmount: exceptionVariance, variancePercent: exceptionVariance.dividedBy(baselineBand.maximum).times(100).toDecimalPlaces(4), restrictedRationale: run, requestedById: actors[0].id, correlationId: key("exception") } });
  const exceptionClaims = await Promise.all([
    prisma.hrCompException.updateMany({ where: { id: exception.id, status: "REQUESTED" }, data: { status: "APPROVED", decidedByIds: [actors[1].id], decisionReason: run, decidedAt: new Date() } }),
    prisma.hrCompException.updateMany({ where: { id: exception.id, status: "REQUESTED" }, data: { status: "REJECTED", decidedByIds: [actors[1].id], decisionReason: run, decidedAt: new Date() } }),
  ]);
  if (exceptionClaims.reduce((sum, item) => sum + item.count, 0) !== 1) throw new Error("Exception decision race did not produce one winner.");
  evidence.exception_approval_vs_rejection = { claims: exceptionClaims.map(({ count }) => count), loser: "ALREADY_DECIDED" };

  const immutableBandEdit = await Promise.allSettled([prisma.hrCompBandVersion.update({ where: { id: baselineBand.id }, data: { maximum: baselineBand.maximum.plus(1) } })]);
  if (immutableBandEdit[0].status !== "rejected") throw new Error("Published band version was mutable during exception handling.");
  evidence.exception_vs_band_version_change = { bandChange: "REJECTED_IMMUTABLE", exceptionDecision: "ONE_WINNER" };

  const raceCycle = await prisma.hrCompCycle.create({ data: { organizationId: organization.id, code: key("cycle-close").slice(0, 120), name: "Unit 8 cycle-close race", cycleType: cycle.cycleType, status: "OPEN", effectiveAt: cycle.effectiveAt, policyVersionId: cycle.policyVersionId, populationRule: cycle.populationRule, currencies: cycle.currencies, version: 1, correlationId: key("cycle-close-correlation"), createdById: actors[0].id } });
  const raceCycleBudget = await prisma.hrCompBudget.create({ data: { organizationId: organization.id, cycleId: raceCycle.id, scopeType: "UNIT8_CYCLE_CLOSE", scopeId: run, currency: recommendation.currency, allocatedAmount: new Prisma.Decimal("1000"), createdById: actors[0].id } });
  const reserveDuringClose = () => prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "HrCompCycle" WHERE id=${raceCycle.id} FOR UPDATE`;
    const current = await tx.hrCompCycle.findUniqueOrThrow({ where: { id: raceCycle.id } });
    if (current.status !== "OPEN") throw new Error("CYCLE_CLOSED");
    return tx.hrCompBudgetEntry.create({ data: { organizationId: organization.id, budgetId: raceCycleBudget.id, entryType: "RESERVE", amount: new Prisma.Decimal("100"), currency: raceCycleBudget.currency, reason: run, idempotencyKey: key("cycle-close-reserve"), correlationId: key("cycle-close-reserve-correlation"), createdById: actors[0].id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  const closeDuringReserve = () => prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "HrCompCycle" WHERE id=${raceCycle.id} FOR UPDATE`;
    const activeEntries = await tx.hrCompBudgetEntry.count({ where: { budgetId: raceCycleBudget.id } });
    if (activeEntries !== 0) throw new Error("ACTIVE_BUDGET_RESERVATION");
    return tx.hrCompCycle.updateMany({ where: { id: raceCycle.id, status: "OPEN", version: 1 }, data: { status: "CLOSED", version: 2 } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  exactlyOne("budget_reservation_vs_cycle_close", await Promise.allSettled([reserveDuringClose(), closeDuringReserve()]), "CYCLE_STATE_CONFLICT");

  const separationRecommendation = await prisma.hrCompRecommendation.create({ data: { ...duplicateRecommendationData, idempotencyKey: key("separation-recommendation"), correlationId: key("separation-recommendation-correlation"), contentHash: key("separation-recommendation-hash"), status: "HR_REVIEW" } });
  const lifecycleClaims = await Promise.all([
    prisma.hrCompRecommendation.updateMany({ where: { id: separationRecommendation.id, version: 1, status: "HR_REVIEW" }, data: { version: 2, status: "APPROVED" } }),
    prisma.hrCompRecommendation.updateMany({ where: { id: separationRecommendation.id, version: 1, status: "HR_REVIEW" }, data: { version: 2, status: "SUPERSEDED" } }),
  ]);
  if (lifecycleClaims.reduce((sum, item) => sum + item.count, 0) !== 1) throw new Error("Approval/separation boundary did not choose one authoritative state.");
  evidence.approval_vs_employee_separation = { claims: lifecycleClaims.map(({ count }) => count), loser: "LIFECYCLE_STATE_CONFLICT" };

  const promotionDecision = await prisma.hrPromotionDecision.findFirst({ where: { organizationId: organization.id }, orderBy: { decidedAt: "desc" } });
  if (!promotionDecision) throw new Error("A Unit 7 promotion decision is required for the cross-unit race.");
  const promotionRaceDecision = { ...duplicateDecisionData, eventType: "PROMOTION", idempotencyKey: key("promotion-race-decision"), correlationId: key("promotion-race-decision-correlation") };
  const promotionRace = await Promise.allSettled([
    prisma.hrCompDecision.create({ data: promotionRaceDecision }),
    prisma.hrPromotionDecision.update({ where: { id: promotionDecision.id }, data: { rationale: `${promotionDecision.rationale} ${run}` } }),
  ]);
  exactlyOne("approval_vs_unit7_promotion_update", promotionRace, "IMMUTABLE_PROMOTION_DECISION");

  const duplicateNotificationKey = `${run}:notification`;
  const notifications = await Promise.allSettled([0, 1].map(() => prisma.hrNotification.create({ data: { organizationId: organization.id, userId: actors[0].id, category: "hr-compensation", title: "Unit 8 concurrency validation", body: "Replay-safe notification evidence", idempotencyKey: duplicateNotificationKey } })));
  exactlyOne("notification_replay", notifications, "IDEMPOTENCY_CONFLICT");

  const handoffKey = `${run}:handoff`;
  const handoffs = await Promise.allSettled([0, 1].map(() => prisma.hrPayrollCompHandoff.create({ data: { organizationId: organization.id, employeeId: handoff.employeeId, workRelationshipId: handoff.workRelationshipId, assignmentId: handoff.assignmentId, compensationRecordId: handoff.compensationRecordId, bonusAwardId: handoff.bonusAwardId, eventType: handoff.eventType, amount: handoff.amount, currency: handoff.currency, payBasis: handoff.payBasis, effectiveAt: handoff.effectiveAt, status: "READY", idempotencyKey: handoffKey, correlationId: key("handoff"), readyAt: new Date() } })));
  exactlyOne("payroll_handoff_replay", handoffs, "IDEMPOTENCY_CONFLICT");

  const retroHandoff = await prisma.hrPayrollCompHandoff.create({ data: { organizationId: organization.id, employeeId: handoff.employeeId, workRelationshipId: handoff.workRelationshipId, assignmentId: handoff.assignmentId, compensationRecordId: handoff.compensationRecordId, bonusAwardId: handoff.bonusAwardId, retroactiveSignalId: handoff.retroactiveSignalId, eventType: "CORRECTION", amount: handoff.amount, currency: handoff.currency, payBasis: handoff.payBasis, effectiveAt: handoff.effectiveAt, affectedFrom: handoff.affectedFrom, affectedTo: handoff.affectedTo, status: "READY", idempotencyKey: key("retro-handoff"), correlationId: key("retro-handoff-correlation"), readyAt: new Date() } });
  const retroClaims = await Promise.all([
    prisma.hrPayrollCompHandoff.updateMany({ where: { id: retroHandoff.id, status: "READY" }, data: { status: "CLAIMED", claimTokenHash: crypto.randomUUID(), claimedAt: new Date() } }),
    prisma.hrPayrollCompHandoff.updateMany({ where: { id: retroHandoff.id, status: "READY" }, data: { status: "FAILED", safeError: "Superseded by a concurrent retroactive correction" } }),
  ]);
  if (retroClaims.reduce((sum, item) => sum + item.count, 0) !== 1) throw new Error("Retroactive correction/handoff claim race produced multiple winners.");
  evidence.retroactive_correction_vs_payroll_handoff_claim = { claims: retroClaims.map(({ count }) => count), loser: "STALE_HANDOFF_STATE" };

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
