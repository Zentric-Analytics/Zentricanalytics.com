import crypto from "node:crypto";
import { Prisma, type HrCompEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { assertBudgetAvailable, assertCurrency, assertIndependentCompensationApproval, compensationHash, parseMoney, payrollHandoffKey, promotionRecommendationFloor, reconcileBudget } from "./domain";

export type CompensationContext = { organizationId: string; actorUserId: string; actorRole?: string };

export async function withCompensationSerializableRetry<T>(operation: () => Promise<T>, maximumAttempts = 4): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try { return await operation(); } catch (error) {
      last = error;
      const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "";
      if (!["P2034", "P2002"].includes(code) || attempt === maximumAttempts) throw error;
    }
  }
  throw last;
}

export async function reserveCompensationBudget(context: CompensationContext, input: { budgetId: string; recommendationId: string; amount: string; idempotencyKey: string; correlationId?: string }) {
  return withCompensationSerializableRetry(() => prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "HrCompBudget" WHERE id = ${input.budgetId} AND "organizationId" = ${context.organizationId} FOR UPDATE`;
    const budget = await tx.hrCompBudget.findFirstOrThrow({ where: { id: input.budgetId, organizationId: context.organizationId } });
    const existing = await tx.hrCompBudgetEntry.findUnique({ where: { budgetId_idempotencyKey: { budgetId: budget.id, idempotencyKey: input.idempotencyKey } } });
    if (existing) return existing;
    const entries = await tx.hrCompBudgetEntry.findMany({ where: { budgetId: budget.id }, select: { entryType: true, amount: true } });
    assertBudgetAvailable(budget.allocatedAmount, entries, input.amount);
    const entry = await tx.hrCompBudgetEntry.create({ data: { organizationId: context.organizationId, budgetId: budget.id, recommendationId: input.recommendationId, entryType: "RESERVE", amount: parseMoney(input.amount), currency: budget.currency, reason: "Approved compensation recommendation budget reservation", idempotencyKey: input.idempotencyKey, correlationId: input.correlationId ?? crypto.randomUUID(), createdById: context.actorUserId } });
    await appendHrAudit(tx, { ...context, entityType: "HrCompBudgetEntry", entityId: entry.id, action: "hr.compensation.budget.reserved", newValues: { budgetId: budget.id, recommendationId: input.recommendationId, currency: budget.currency }, correlationId: entry.correlationId });
    return entry;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function releaseCompensationBudget(context: CompensationContext, input: { budgetId: string; recommendationId: string; amount: string; reason: string; idempotencyKey: string }) {
  return withCompensationSerializableRetry(() => prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "HrCompBudget" WHERE id = ${input.budgetId} AND "organizationId" = ${context.organizationId} FOR UPDATE`;
    const budget = await tx.hrCompBudget.findFirstOrThrow({ where: { id: input.budgetId, organizationId: context.organizationId } });
    const entries = await tx.hrCompBudgetEntry.findMany({ where: { budgetId: budget.id }, select: { entryType: true, amount: true } });
    const state = reconcileBudget(budget.allocatedAmount, entries);
    if (new Prisma.Decimal(parseMoney(input.amount)).greaterThan(state.reserved)) throw new Error("Cannot release more budget than is reserved.");
    return tx.hrCompBudgetEntry.upsert({ where: { budgetId_idempotencyKey: { budgetId: budget.id, idempotencyKey: input.idempotencyKey } }, update: {}, create: { organizationId: context.organizationId, budgetId: budget.id, recommendationId: input.recommendationId, entryType: "RELEASE", amount: parseMoney(input.amount), currency: budget.currency, reason: input.reason, idempotencyKey: input.idempotencyKey, correlationId: crypto.randomUUID(), createdById: context.actorUserId } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function finalizeCompensationDecision(context: CompensationContext, input: { recommendationId: string; recommendationVersion: number; budgetId: string; effectiveAt: Date; eventType: HrCompEventType; rationale: string; exceptionId?: string; correlationId?: string }) {
  return withCompensationSerializableRetry(() => prisma.$transaction(async (tx) => {
    const recommendation = await tx.hrCompRecommendation.findFirstOrThrow({ where: { id: input.recommendationId, organizationId: context.organizationId, version: input.recommendationVersion, status: "HR_REVIEW" } });
    assertIndependentCompensationApproval({ actorUserId: context.actorUserId, managerUserId: recommendation.managerUserId });
    const band = await tx.hrCompBandVersion.findFirstOrThrow({ where: { id: recommendation.bandVersionId, organizationId: context.organizationId, status: "PUBLISHED", effectiveFrom: { lte: input.effectiveAt }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveAt } }] } });
    const bandIdentity = await tx.hrCompBand.findFirstOrThrow({ where: { id: band.bandId, organizationId: context.organizationId } });
    const marketVersion = await tx.hrCompMarketVersion.findFirstOrThrow({ where: { organizationId: context.organizationId, marketId: bandIdentity.marketId, status: "PUBLISHED", effectiveFrom: { lte: input.effectiveAt }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveAt } }] } });
    const policy = await tx.hrCompPolicyVersion.findFirstOrThrow({ where: { id: recommendation.policyVersionId, organizationId: context.organizationId, status: "PUBLISHED" } });
    const exceptionApproved = input.exceptionId ? Boolean(await tx.hrCompException.findFirst({ where: { id: input.exceptionId, organizationId: context.organizationId, status: "APPROVED" } })) : false;
    if (input.eventType === "PROMOTION") promotionRecommendationFloor(recommendation.currentAmount, band.minimum, recommendation.proposedAmount, exceptionApproved);
    if (recommendation.proposedAmount.greaterThan(band.maximum) && !exceptionApproved) throw new Error("Above-band compensation requires an approved exception.");
    const decisionKey = `unit8:decision:${recommendation.id}:v${recommendation.version}`;
    await tx.$queryRaw`SELECT id FROM "HrCompBudget" WHERE id = ${input.budgetId} AND "organizationId" = ${context.organizationId} FOR UPDATE`;
    const budget = await tx.hrCompBudget.findFirstOrThrow({ where: { id: input.budgetId, organizationId: context.organizationId } });
    const budgetEntries = await tx.hrCompBudgetEntry.findMany({ where: { budgetId: budget.id }, select: { entryType: true, amount: true } });
    const budgetState = reconcileBudget(budget.allocatedAmount, budgetEntries);
    if (recommendation.budgetImpact.greaterThan(budgetState.reserved)) throw new Error("Final decision cannot consume more budget than the recommendation reserved.");
    const decision = await tx.hrCompDecision.upsert({ where: { organizationId_idempotencyKey: { organizationId: context.organizationId, idempotencyKey: decisionKey } }, update: {}, create: { organizationId: context.organizationId, recommendationId: recommendation.id, recommendationVersion: recommendation.version, exceptionId: input.exceptionId, eventType: input.eventType, status: input.effectiveAt <= new Date() ? "EFFECTIVE" : "SCHEDULED", oldAmount: recommendation.currentAmount, newAmount: recommendation.proposedAmount, currency: assertCurrency(recommendation.currency), payBasis: bandIdentity.payBasis, marketVersionId: marketVersion.id, bandVersionId: band.id, policyVersionId: policy.id, effectiveAt: input.effectiveAt, approverUserIds: [context.actorUserId], rationale: input.rationale, idempotencyKey: decisionKey, correlationId: input.correlationId ?? crypto.randomUUID(), approvedAt: new Date() } });
    await tx.hrCompBudgetEntry.upsert({ where: { budgetId_idempotencyKey: { budgetId: budget.id, idempotencyKey: `consume:${decision.id}` } }, update: {}, create: { organizationId: context.organizationId, budgetId: budget.id, recommendationId: recommendation.id, decisionId: decision.id, entryType: "CONSUME", amount: recommendation.budgetImpact, currency: budget.currency, reason: "Final compensation decision", idempotencyKey: `consume:${decision.id}`, correlationId: crypto.randomUUID(), createdById: context.actorUserId } });
    await tx.hrCompRecommendation.update({ where: { id: recommendation.id }, data: { status: "APPROVED" } });
    await appendHrAudit(tx, { ...context, entityType: "HrCompDecision", entityId: decision.id, action: "hr.compensation.decision.approved", newValues: { eventType: input.eventType, effectiveAt: input.effectiveAt, bandVersionId: band.id, policyVersionId: policy.id }, reason: input.rationale, correlationId: decision.correlationId });
    return decision;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function activateCompensationDecision(context: CompensationContext, decisionId: string, now = new Date()) {
  return withCompensationSerializableRetry(() => prisma.$transaction(async (tx) => {
    const decision = await tx.hrCompDecision.findFirstOrThrow({ where: { id: decisionId, organizationId: context.organizationId, status: { in: ["SCHEDULED", "EFFECTIVE"] }, effectiveAt: { lte: now } } });
    const existing = await tx.hrCompensationRecord.findUnique({ where: { decisionId: decision.id } });
    if (existing) return existing;
    const recommendation = decision.recommendationId ? await tx.hrCompRecommendation.findUniqueOrThrow({ where: { id: decision.recommendationId } }) : null;
    if (!recommendation) throw new Error("A base compensation decision requires its approved recommendation.");
    const population = await tx.hrCompCyclePopulation.findUniqueOrThrow({ where: { id: recommendation.cyclePopulationId } });
    const aggregate = await tx.hrEmployeeCompensation.findFirstOrThrow({ where: { organizationId: context.organizationId, employeeId: recommendation.employeeId, workRelationshipId: population.workRelationshipId } });
    const prior = aggregate.currentRecordId ? await tx.hrCompensationRecord.findUnique({ where: { id: aggregate.currentRecordId } }) : null;
    if (prior && prior.effectiveFrom < decision.effectiveAt && (!prior.effectiveTo || prior.effectiveTo > decision.effectiveAt)) await tx.hrCompensationRecord.update({ where: { id: prior.id }, data: { effectiveTo: decision.effectiveAt, status: "SUPERSEDED" } });
    const payload = { decisionId: decision.id, employeeId: recommendation.employeeId, workRelationshipId: population.workRelationshipId, assignmentId: population.assignmentId, amount: decision.newAmount.toString(), currency: decision.currency, payBasis: decision.payBasis, marketVersionId: decision.marketVersionId, bandVersionId: decision.bandVersionId, policyVersionId: decision.policyVersionId, effectiveFrom: decision.effectiveAt };
    if (!decision.marketVersionId || !decision.bandVersionId || !decision.payBasis) throw new Error("Decision is missing payroll-authoritative compensation references.");
    const record = await tx.hrCompensationRecord.create({ data: { organizationId: context.organizationId, employeeCompensationId: aggregate.id, employeeId: recommendation.employeeId, workRelationshipId: population.workRelationshipId, assignmentId: population.assignmentId, previousRecordId: prior?.id, decisionId: decision.id, eventType: decision.eventType as HrCompEventType, status: "EFFECTIVE", amount: decision.newAmount, currency: decision.currency, payBasis: decision.payBasis, marketVersionId: decision.marketVersionId, bandVersionId: decision.bandVersionId, policyVersionId: decision.policyVersionId, effectiveFrom: decision.effectiveAt, approvedAt: decision.approvedAt ?? now, contentHash: compensationHash(payload), idempotencyKey: `record:${decision.id}`, correlationId: decision.correlationId } });
    await tx.hrEmployeeCompensation.update({ where: { id: aggregate.id }, data: { currentRecordId: record.id } });
    await tx.hrCompDecision.update({ where: { id: decision.id }, data: { status: "EFFECTIVE" } });
    await tx.hrPayrollCompHandoff.upsert({ where: { organizationId_idempotencyKey: { organizationId: context.organizationId, idempotencyKey: payrollHandoffKey("record", record.id) } }, update: {}, create: { organizationId: context.organizationId, employeeId: record.employeeId, workRelationshipId: record.workRelationshipId, assignmentId: record.assignmentId, compensationRecordId: record.id, eventType: record.eventType, amount: record.amount, currency: record.currency, payBasis: record.payBasis, effectiveAt: record.effectiveFrom, idempotencyKey: payrollHandoffKey("record", record.id), correlationId: crypto.randomUUID() } });
    const employee = await tx.hrEmployee.findUniqueOrThrow({ where: { id: record.employeeId } });
    const recipient = employee.preferredNotificationEmail ?? employee.companyEmail ?? employee.personalEmail;
    if (recipient) await enqueueHrEmail(tx, { organizationId: context.organizationId, recipient, template: "hr-compensation-effective", subject: "Your compensation update is effective", payload: { recipientName: employee.preferredName ?? employee.legalFirstName, href: "/hr/employee/compensation", decisionId: decision.id }, idempotencyKey: `unit8-effective:${decision.id}:${recipient}` });
    await appendHrAudit(tx, { ...context, entityType: "HrCompensationRecord", entityId: record.id, action: "hr.compensation.record.effective", newValues: { decisionId: decision.id, eventType: record.eventType, effectiveFrom: record.effectiveFrom, currency: record.currency }, correlationId: record.correlationId });
    return record;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function compensationBudgetState(organizationId: string, budgetId: string) {
  const budget = await prisma.hrCompBudget.findFirstOrThrow({ where: { id: budgetId, organizationId } });
  const entries = await prisma.hrCompBudgetEntry.findMany({ where: { budgetId }, select: { entryType: true, amount: true } });
  return reconcileBudget(budget.allocatedAmount, entries);
}
