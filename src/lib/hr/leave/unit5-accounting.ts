import { Prisma, type HrLeaveEntryKind, type HrLeaveRequestLifecycleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { assertIndependentLeaveApproval, assertUnit5RequestTransition, projectedPeriodBalance } from "./unit5";
import { createWorkforceEventDraft, submitWorkforceEvent } from "@/lib/hr/workforce/commands";
import { capAccrual, scheduledAccrualAmount } from "./engine";

type Tx = Prisma.TransactionClient;
type ProjectionField = "granted" | "accrued" | "carriedOver" | "carriedOut" | "adjusted" | "reserved" | "consumed" | "expired";
const projectionField: Partial<Record<HrLeaveEntryKind, ProjectionField>> = { GRANT: "granted", ACCRUAL: "accrued", CARRYOVER_IN: "carriedOver", CARRYOVER_OUT: "carriedOut", RESERVATION: "reserved", CONSUMPTION: "consumed", EXPIRY: "expired", ADJUSTMENT: "adjusted", CORRECTION: "adjusted" };

async function latestStatus(tx: Tx, requestVersionId: string): Promise<HrLeaveRequestLifecycleStatus> {
  const latest = await tx.hrLeaveTransition.findFirst({ where: { requestVersionId }, orderBy: { createdAt: "desc" } });
  return latest?.toStatus ?? (await tx.hrLeaveRequestVersion.findUniqueOrThrow({ where: { id: requestVersionId }, select: { lifecycleStatus: true } })).lifecycleStatus;
}

export async function transitionUnit5Request(input: { organizationId: string; requestVersionId: string; from: HrLeaveRequestLifecycleStatus; to: HrLeaveRequestLifecycleStatus; actorUserId: string; reason?: string; idempotencyKey: string }) {
  return prisma.$transaction(async (tx) => {
    const version = await tx.hrLeaveRequestVersion.findFirstOrThrow({ where: { id: input.requestVersionId, organizationId: input.organizationId } });
    const status = await latestStatus(tx, version.id);
    if (status === input.to) return { applied: false, status };
    if (status !== input.from) throw new Error(`This leave request is ${status.toLowerCase().replaceAll("_", " ")}; reload the latest decision state.`);
    await transition(tx, { requestVersionId: version.id, from: status, to: input.to, actorUserId: input.actorUserId, reason: input.reason, idempotencyKey: input.idempotencyKey, correlationId: version.correlationId });
    await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, entityType: "HrLeaveRequestVersion", entityId: version.id, action: `hr.leave.unit5.${input.to.toLowerCase()}`, previousValues: { status }, newValues: { status: input.to }, reason: input.reason, correlationId: version.correlationId });
    return { applied: true, status: input.to };
  }, { isolationLevel: "Serializable" });
}

async function transition(tx: Tx, input: { requestVersionId: string; from: HrLeaveRequestLifecycleStatus; to: HrLeaveRequestLifecycleStatus; actorUserId?: string; reason?: string; idempotencyKey: string; correlationId: string }) {
  assertUnit5RequestTransition(input.from, input.to);
  return tx.hrLeaveTransition.create({ data: { requestVersionId: input.requestVersionId, fromStatus: input.from, toStatus: input.to, actorUserId: input.actorUserId, reason: input.reason, idempotencyKey: input.idempotencyKey, correlationId: input.correlationId } });
}

async function postEntry(tx: Tx, input: { organizationId: string; accountPeriodId: string; leavePolicyId: string; kind: HrLeaveEntryKind; amount: Prisma.Decimal | number; impactSign?: 1 | -1; unit: "DAYS" | "HOURS"; effectiveAt: Date; sourceType: string; sourceId: string; actorUserId?: string; workerKey?: string; reason: string; correlationId: string; idempotencyKey: string; reversalOfId?: string }) {
  const existing = await tx.hrLeaveLedgerEntry.findUnique({ where: { organizationId_idempotencyKey: { organizationId: input.organizationId, idempotencyKey: input.idempotencyKey } } });
  if (existing) return { entry: existing, applied: false };
  const amount = new Prisma.Decimal(input.amount);
  if (amount.lte(0)) throw new Error("Authoritative leave ledger entries require a positive amount.");
  const field = projectionField[input.kind];
  const impactSign = input.impactSign ?? 1;
  if (field) await tx.hrLeaveAccountPeriod.update({ where: { id: input.accountPeriodId }, data: { [field]: { increment: amount.mul(impactSign) }, version: { increment: 1 } } });
  else if (input.kind === "RESERVATION_RELEASE") await tx.hrLeaveAccountPeriod.update({ where: { id: input.accountPeriodId }, data: { reserved: { decrement: amount }, version: { increment: 1 } } });
  else if (input.kind === "REVERSAL") {
    if (!input.reversalOfId) throw new Error("A reversal must identify the original ledger entry.");
    const original = await tx.hrLeaveLedgerEntry.findUniqueOrThrow({ where: { id: input.reversalOfId } });
    const originalField = projectionField[original.kind];
    if (!originalField) throw new Error("This ledger entry kind requires an explicit correction rather than automatic reversal.");
    await tx.hrLeaveAccountPeriod.update({ where: { id: input.accountPeriodId }, data: { [originalField]: { increment: amount.mul(-original.impactSign) }, version: { increment: 1 } } });
  }
  return { entry: await tx.hrLeaveLedgerEntry.create({ data: { ...input, amount, impactSign: input.kind === "REVERSAL" && input.reversalOfId ? -(await tx.hrLeaveLedgerEntry.findUniqueOrThrow({ where: { id: input.reversalOfId } })).impactSign : impactSign } }), applied: true };
}

export async function ensureUnit5AccountPeriod(input: { organizationId: string; employeeId: string; leaveTypeId: string; leavePolicyId: string; unit: "DAYS" | "HOURS"; periodStart: Date; periodEnd: Date; grant: number; actorUserId: string; correlationId: string }) {
  return prisma.$transaction(async (tx) => {
    const account = await tx.hrLeaveAccount.upsert({ where: { organizationId_employeeId_leaveTypeId_unit: { organizationId: input.organizationId, employeeId: input.employeeId, leaveTypeId: input.leaveTypeId, unit: input.unit } }, update: {}, create: { organizationId: input.organizationId, employeeId: input.employeeId, leaveTypeId: input.leaveTypeId, unit: input.unit } });
    const period = await tx.hrLeaveAccountPeriod.upsert({ where: { accountId_periodStart_periodEnd: { accountId: account.id, periodStart: input.periodStart, periodEnd: input.periodEnd } }, update: {}, create: { accountId: account.id, leavePolicyId: input.leavePolicyId, periodStart: input.periodStart, periodEnd: input.periodEnd } });
    if (input.grant > 0) await postEntry(tx, { organizationId: input.organizationId, accountPeriodId: period.id, leavePolicyId: input.leavePolicyId, kind: "GRANT", amount: input.grant, unit: input.unit, effectiveAt: input.periodStart, sourceType: "POLICY_PERIOD", sourceId: period.id, actorUserId: input.actorUserId, reason: "Unit 5 opening entitlement grant", correlationId: input.correlationId, idempotencyKey: `unit5-grant:${period.id}` });
    await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, entityType: "HrLeaveAccountPeriod", entityId: period.id, action: "hr.leave.unit5.account_period.created", newValues: { accountId: account.id, policyId: input.leavePolicyId, grant: input.grant }, correlationId: input.correlationId });
    return { account, period: await tx.hrLeaveAccountPeriod.findUniqueOrThrow({ where: { id: period.id } }) };
  }, { isolationLevel: "Serializable" });
}

export async function adjustUnit5BalanceFromLegacy(input: { organizationId: string; legacyBalanceId: string; amount: number; actorUserId: string; actorRole?: string; reason: string; correlationId: string }) {
  if (!Number.isFinite(input.amount) || input.amount === 0) throw new Error("A non-zero finite leave adjustment is required.");
  return prisma.$transaction(async (tx) => {
    const balance = await tx.hrLeaveBalance.findFirstOrThrow({ where: { id: input.legacyBalanceId, organizationId: input.organizationId }, include: { leaveType: true } });
    const periodStart = new Date(Date.UTC(balance.periodYear, 0, 1));
    const periodEnd = new Date(Date.UTC(balance.periodYear + 1, 0, 1));
    const account = await tx.hrLeaveAccount.upsert({ where: { organizationId_employeeId_leaveTypeId_unit: { organizationId: input.organizationId, employeeId: balance.employeeId, leaveTypeId: balance.leaveTypeId, unit: balance.leaveType.unit } }, update: {}, create: { organizationId: input.organizationId, employeeId: balance.employeeId, leaveTypeId: balance.leaveTypeId, unit: balance.leaveType.unit } });
    const period = await tx.hrLeaveAccountPeriod.upsert({ where: { accountId_periodStart_periodEnd: { accountId: account.id, periodStart, periodEnd } }, update: {}, create: { accountId: account.id, leavePolicyId: balance.leavePolicyId, periodStart, periodEnd } });
    await postEntry(tx, { organizationId: input.organizationId, accountPeriodId: period.id, leavePolicyId: balance.leavePolicyId, kind: "ADJUSTMENT", amount: Math.abs(input.amount), impactSign: input.amount > 0 ? 1 : -1, unit: balance.leaveType.unit, effectiveAt: new Date(), sourceType: "HR_ADJUSTMENT", sourceId: balance.id, actorUserId: input.actorUserId, reason: input.reason, correlationId: input.correlationId, idempotencyKey: `unit5-adjustment:${input.correlationId}` });
    await tx.hrLeaveBalance.update({ where: { id: balance.id }, data: { adjusted: { increment: input.amount } } });
    await tx.hrLeaveLedger.create({ data: { balanceId: balance.id, type: "ADJUSTMENT", amount: input.amount, effectiveAt: new Date(), reason: input.reason, actorUserId: input.actorUserId, idempotencyKey: `leave-adjustment:${input.correlationId}` } });
    await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, actorRole: input.actorRole, entityType: "HrLeaveAccountPeriod", entityId: period.id, action: "hr.leave.unit5.balance.adjusted", newValues: { amount: input.amount, impactSign: input.amount > 0 ? 1 : -1, legacyBalanceId: balance.id }, reason: input.reason, correlationId: input.correlationId });
    return period.id;
  }, { isolationLevel: "Serializable" });
}

export async function accrueUnit5Assignment(input: { organizationId: string; assignmentId: string; effectiveAt: Date; actorUserId: string; actorRole?: string }) {
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.hrEmployeeLeavePolicy.findFirstOrThrow({ where: { id: input.assignmentId, employee: { organizationId: input.organizationId }, status: "ACTIVE" }, include: { employee: true, leavePolicy: { include: { leaveType: true } } } });
    const policy = assignment.leavePolicy;
    if (!["MONTHLY", "QUARTERLY"].includes(policy.accrualFrequency)) return { applied: false, amount: 0 };
    const year = input.effectiveAt.getUTCFullYear();
    const quarter = Math.floor(input.effectiveAt.getUTCMonth() / 3) + 1;
    const windowKey = policy.accrualFrequency === "MONTHLY" ? `${year}-${String(input.effectiveAt.getUTCMonth() + 1).padStart(2, "0")}` : `${year}-Q${quarter}`;
    const account = await tx.hrLeaveAccount.upsert({ where: { organizationId_employeeId_leaveTypeId_unit: { organizationId: input.organizationId, employeeId: assignment.employeeId, leaveTypeId: policy.leaveTypeId, unit: policy.leaveType.unit } }, update: {}, create: { organizationId: input.organizationId, employeeId: assignment.employeeId, leaveTypeId: policy.leaveTypeId, unit: policy.leaveType.unit } });
    const periodStart = new Date(Date.UTC(year, 0, 1)); const periodEnd = new Date(Date.UTC(year + 1, 0, 1));
    const period = await tx.hrLeaveAccountPeriod.upsert({ where: { accountId_periodStart_periodEnd: { accountId: account.id, periodStart, periodEnd } }, update: {}, create: { accountId: account.id, leavePolicyId: policy.id, periodStart, periodEnd } });
    const available = projectedPeriodBalance({ granted: Number(period.granted), accrued: Number(period.accrued), carriedOver: Number(period.carriedOver), carriedOut: Number(period.carriedOut), adjusted: Number(period.adjusted), reserved: Number(period.reserved), consumed: Number(period.consumed), expired: Number(period.expired) });
    const amount = Math.round(capAccrual(scheduledAccrualAmount({ entitlement: Number(policy.entitlement), accrualFrequency: policy.accrualFrequency, accrualAmount: policy.accrualAmount ? Number(policy.accrualAmount) : null }), available, policy.maximumBalance ? Number(policy.maximumBalance) : null) * 10_000) / 10_000;
    if (amount <= 0) return { applied: false, amount: 0 };
    const correlationId = `unit5-accrual:${assignment.id}:${windowKey}`;
    const posted = await postEntry(tx, { organizationId: input.organizationId, accountPeriodId: period.id, leavePolicyId: policy.id, kind: "ACCRUAL", amount, unit: policy.leaveType.unit, effectiveAt: input.effectiveAt, sourceType: "POLICY_ACCRUAL", sourceId: assignment.id, actorUserId: input.actorUserId, workerKey: windowKey, reason: `${policy.accrualFrequency.toLowerCase()} policy accrual`, correlationId, idempotencyKey: correlationId });
    if (!posted.applied) return { applied: false, amount };
    const legacy = await tx.hrLeaveBalance.upsert({ where: { employeeId_leaveTypeId_periodYear: { employeeId: assignment.employeeId, leaveTypeId: policy.leaveTypeId, periodYear: year } }, update: { leavePolicyId: policy.id, accrued: { increment: amount } }, create: { organizationId: input.organizationId, employeeId: assignment.employeeId, leaveTypeId: policy.leaveTypeId, leavePolicyId: policy.id, periodYear: year, accrued: amount } });
    await tx.hrLeaveLedger.create({ data: { balanceId: legacy.id, type: "ACCRUAL", amount, effectiveAt: input.effectiveAt, reason: `${policy.accrualFrequency.toLowerCase()} policy accrual`, actorUserId: input.actorUserId, idempotencyKey: `leave-accrual:${legacy.id}:${windowKey}` } });
    await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, actorRole: input.actorRole, entityType: "HrLeaveAccountPeriod", entityId: period.id, action: "hr.leave.unit5.accrued", newValues: { amount, windowKey, policyId: policy.id }, correlationId });
    return { applied: true, amount };
  }, { isolationLevel: "Serializable" });
}

export async function processUnit5CarryOver(input: { organizationId: string; effectiveAt: Date; actorUserId: string; actorRole?: string }) {
  const targetYear = input.effectiveAt.getUTCFullYear();
  const periodStart = new Date(Date.UTC(targetYear, 0, 1));
  const periodEnd = new Date(Date.UTC(targetYear + 1, 0, 1));
  const priorPeriods = await prisma.hrLeaveAccountPeriod.findMany({
    where: { account: { organizationId: input.organizationId }, periodStart: new Date(Date.UTC(targetYear - 1, 0, 1)), periodEnd: periodStart },
    select: { id: true },
  });
  const results: Array<{ sourcePeriodId: string; targetPeriodId?: string; carried: number; expired: number }> = [];

  for (const candidate of priorPeriods) {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "HrLeaveAccountPeriod" WHERE id = ${candidate.id} FOR UPDATE`;
      const source = await tx.hrLeaveAccountPeriod.findUniqueOrThrow({ where: { id: candidate.id }, include: { account: true, leavePolicy: { include: { leaveType: true } } } });
      const limit = source.leavePolicy.carryOverLimit ? Number(source.leavePolicy.carryOverLimit) : 0;
      const spendable = projectedPeriodBalance({ granted: Number(source.granted), accrued: Number(source.accrued), carriedOver: Number(source.carriedOver), carriedOut: Number(source.carriedOut), adjusted: Number(source.adjusted), reserved: Number(source.reserved), consumed: Number(source.consumed), expired: Number(source.expired) });
      const amount = Math.round(Math.max(0, Math.min(spendable, limit)) * 10_000) / 10_000;
      if (amount <= 0) return { sourcePeriodId: source.id, carried: 0, expired: 0 };

      const targetPolicy = await tx.hrLeavePolicy.findFirst({
        where: { organizationId: input.organizationId, leaveTypeId: source.account.leaveTypeId, status: "ACTIVE", effectiveFrom: { lte: input.effectiveAt }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveAt } }] },
        orderBy: { version: "desc" },
      }) ?? source.leavePolicy;
      const target = await tx.hrLeaveAccountPeriod.upsert({
        where: { accountId_periodStart_periodEnd: { accountId: source.accountId, periodStart, periodEnd } },
        update: {},
        create: { accountId: source.accountId, leavePolicyId: targetPolicy.id, periodStart, periodEnd },
      });
      if (targetPolicy.accrualFrequency === "ANNUALLY" && Number(targetPolicy.entitlement) > 0) await postEntry(tx, { organizationId: input.organizationId, accountPeriodId: target.id, leavePolicyId: targetPolicy.id, kind: "GRANT", amount: targetPolicy.entitlement, unit: source.account.unit, effectiveAt: periodStart, sourceType: "POLICY_PERIOD", sourceId: target.id, actorUserId: input.actorUserId, workerKey: String(targetYear), reason: `Opening entitlement for ${targetYear}`, correlationId: `unit5-grant:${target.id}`, idempotencyKey: `unit5-grant:${target.id}` });
      const correlationId = `unit5-carryover:${source.id}:${targetYear}`;
      const carriedOut = await postEntry(tx, { organizationId: input.organizationId, accountPeriodId: source.id, leavePolicyId: source.leavePolicyId, kind: "CARRYOVER_OUT", amount, unit: source.account.unit, effectiveAt: input.effectiveAt, sourceType: "LEAVE_ACCOUNT_PERIOD", sourceId: target.id, actorUserId: input.actorUserId, workerKey: String(targetYear), reason: `Carryover to ${targetYear}`, correlationId, idempotencyKey: `${correlationId}:out` });
      await postEntry(tx, { organizationId: input.organizationId, accountPeriodId: target.id, leavePolicyId: targetPolicy.id, kind: "CARRYOVER_IN", amount, unit: source.account.unit, effectiveAt: input.effectiveAt, sourceType: "LEAVE_ACCOUNT_PERIOD", sourceId: source.id, actorUserId: input.actorUserId, workerKey: String(targetYear), reason: `Carryover from ${targetYear - 1}`, correlationId, idempotencyKey: `${correlationId}:in` });
      if (carriedOut.applied) await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, actorRole: input.actorRole, entityType: "HrLeaveAccountPeriod", entityId: target.id, action: "hr.leave.unit5.carried_over", newValues: { amount, sourcePeriodId: source.id, targetPeriodId: target.id }, correlationId });
      return { sourcePeriodId: source.id, targetPeriodId: target.id, carried: carriedOut.applied ? amount : 0, expired: 0 };
    }, { isolationLevel: "Serializable" });
    results.push(result);
  }

  const expiring = await prisma.hrLeaveAccountPeriod.findMany({
    where: { account: { organizationId: input.organizationId }, periodStart, periodEnd, carriedOver: { gt: 0 }, leavePolicy: { carryOverExpiryMonth: { lte: input.effectiveAt.getUTCMonth() + 1 } } },
    select: { id: true },
  });
  for (const candidate of expiring) {
    const expired = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "HrLeaveAccountPeriod" WHERE id = ${candidate.id} FOR UPDATE`;
      const period = await tx.hrLeaveAccountPeriod.findUniqueOrThrow({ where: { id: candidate.id }, include: { account: true, leavePolicy: true } });
      const spendable = projectedPeriodBalance({ granted: Number(period.granted), accrued: Number(period.accrued), carriedOver: Number(period.carriedOver), carriedOut: Number(period.carriedOut), adjusted: Number(period.adjusted), reserved: Number(period.reserved), consumed: Number(period.consumed), expired: Number(period.expired) });
      const unexpiredCarryover = Math.max(0, Number(period.carriedOver) - Number(period.expired));
      const amount = Math.round(Math.max(0, Math.min(unexpiredCarryover, spendable)) * 10_000) / 10_000;
      if (amount <= 0) return 0;
      const correlationId = `unit5-carryover-expiry:${period.id}:${targetYear}`;
      const posted = await postEntry(tx, { organizationId: input.organizationId, accountPeriodId: period.id, leavePolicyId: period.leavePolicyId, kind: "EXPIRY", amount, unit: period.account.unit, effectiveAt: input.effectiveAt, sourceType: "LEAVE_ACCOUNT_PERIOD", sourceId: period.id, actorUserId: input.actorUserId, workerKey: String(targetYear), reason: `Carryover expired under policy version ${period.leavePolicy.version}`, correlationId, idempotencyKey: correlationId });
      if (posted.applied) await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, actorRole: input.actorRole, entityType: "HrLeaveAccountPeriod", entityId: period.id, action: "hr.leave.unit5.carryover_expired", newValues: { amount, protectedReservation: Number(period.reserved) }, correlationId });
      return posted.applied ? amount : 0;
    }, { isolationLevel: "Serializable" });
    const existing = results.find((item) => item.targetPeriodId === candidate.id);
    if (existing) existing.expired = expired;
    else results.push({ sourcePeriodId: candidate.id, targetPeriodId: candidate.id, carried: 0, expired });
  }
  return results;
}

function amountsByPeriod(segments: Array<{ accountPeriodId: string | null; chargeableAmount: Prisma.Decimal }>) {
  const groups = new Map<string, Prisma.Decimal>();
  for (const segment of segments) if (segment.accountPeriodId) groups.set(segment.accountPeriodId, (groups.get(segment.accountPeriodId) ?? new Prisma.Decimal(0)).plus(segment.chargeableAmount));
  return groups;
}

export type ReserveUnit5RequestInput = { organizationId: string; requestVersionId: string; reviewerUserId: string; reason?: string; idempotencyKey: string };

export async function reserveUnit5RequestInTransaction(tx: Tx, input: ReserveUnit5RequestInput) {
    const version = await tx.hrLeaveRequestVersion.findFirstOrThrow({ where: { id: input.requestVersionId, organizationId: input.organizationId }, include: { segments: { orderBy: { sequence: "asc" } }, evidence: true, leavePolicy: { include: { leaveType: true } } } });
    assertIndependentLeaveApproval(version.createdById, input.reviewerUserId);
    const status = await latestStatus(tx, version.id);
    if (["APPROVED", "SCHEDULED"].includes(status)) return { applied: false, status };
    if (status !== "UNDER_REVIEW") throw new Error("Only a request under review can receive final approval.");
    if ((version.leavePolicy.leaveType.requiresAttachment || version.leavePolicy.evidenceClass) && !version.evidence.some(({ status: evidenceStatus }) => evidenceStatus === "SATISFIED")) throw new Error("Required confidential leave evidence must complete secure scanning before final approval.");
    const groups = amountsByPeriod(version.segments);
    for (const accountPeriodId of [...groups.keys()].sort()) {
      await tx.$queryRaw`SELECT id FROM "HrLeaveAccountPeriod" WHERE id = ${accountPeriodId} FOR UPDATE`;
      const period = await tx.hrLeaveAccountPeriod.findUniqueOrThrow({ where: { id: accountPeriodId }, include: { leavePolicy: true } });
      const available = projectedPeriodBalance({ granted: Number(period.granted), accrued: Number(period.accrued), carriedOver: Number(period.carriedOver), carriedOut: Number(period.carriedOut), adjusted: Number(period.adjusted), reserved: Number(period.reserved), consumed: Number(period.consumed), expired: Number(period.expired) });
      const amount = groups.get(accountPeriodId)!;
      const nonNumericEntitlement = ["UNLIMITED", "UNPAID", "STATUTORY", "LONG_TERM"].includes(period.leavePolicy.entitlementModel);
      if (!period.leavePolicy.allowNegativeBalance && !nonNumericEntitlement && amount.gt(available)) throw new Error("Final approval cannot reserve more than the current spendable entitlement.");
      await postEntry(tx, { organizationId: input.organizationId, accountPeriodId, leavePolicyId: version.leavePolicyId, kind: "RESERVATION", amount, unit: version.unit, effectiveAt: new Date(), sourceType: "LEAVE_REQUEST_VERSION", sourceId: version.id, actorUserId: input.reviewerUserId, reason: input.reason ?? "Final approval reservation", correlationId: version.correlationId, idempotencyKey: `unit5-reservation:${version.id}:${accountPeriodId}` });
    }
    await transition(tx, { requestVersionId: version.id, from: status, to: "APPROVED", actorUserId: input.reviewerUserId, reason: input.reason, idempotencyKey: input.idempotencyKey, correlationId: version.correlationId });
    if (version.leavePolicy.entitlementModel === "LONG_TERM") {
      const existing = await tx.hrLeaveLongAbsence.findUnique({ where: { requestVersionId: version.id } });
      if (!existing) {
        const relationship = await tx.hrWorkRelationship.findFirstOrThrow({ where: { organizationId: input.organizationId, employeeId: version.employeeId, status: { in: ["ACTIVE", "NOTICE_PERIOD", "SUSPENDED"] } }, orderBy: { startedAt: "desc" } });
        const start = version.segments[0]?.startsAt;
        const expectedReturnAt = version.segments.at(-1)?.endsAt;
        if (!start || !expectedReturnAt) throw new Error("Long-term leave requires an effective schedule calculation.");
        const event = await createWorkforceEventDraft(tx, { organizationId: input.organizationId, actorUserId: input.reviewerUserId, actorRole: "LEAVE_APPROVER" }, { employeeId: version.employeeId, workRelationshipId: relationship.id, type: "LEAVE_OF_ABSENCE", reason: input.reason ?? "Approved long-term leave", proposedSnapshot: { employmentStatus: "ON_LEAVE" }, requestedEffectiveAt: start, idempotencyKey: `unit5-long-absence-start:${version.id}`, correlationId: version.correlationId });
        await submitWorkforceEvent(tx, { organizationId: input.organizationId, actorUserId: input.reviewerUserId, actorRole: "LEAVE_APPROVER" }, event.id, event.version);
        await tx.hrLeaveLongAbsence.create({ data: { organizationId: input.organizationId, employeeId: version.employeeId, requestVersionId: version.id, startWorkforceEventId: event.id, status: "START_EVENT_SUBMITTED", expectedReturnAt, correlationId: version.correlationId } });
      }
    }
    await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.reviewerUserId, entityType: "HrLeaveRequestVersion", entityId: version.id, action: "hr.leave.unit5.final_approved", newValues: { reservedPeriods: [...groups.keys()] }, reason: input.reason, correlationId: version.correlationId });
    return { applied: true, status: "APPROVED" as const };
}

export async function reserveUnit5Request(input: ReserveUnit5RequestInput) {
  return prisma.$transaction((tx) => reserveUnit5RequestInTransaction(tx, input), { isolationLevel: "Serializable" });
}

export async function startUnit5Leave(input: { organizationId: string; requestVersionId: string; effectiveAt: Date; workerKey: string }) {
  return prisma.$transaction(async (tx) => {
    const version = await tx.hrLeaveRequestVersion.findFirstOrThrow({ where: { id: input.requestVersionId, organizationId: input.organizationId }, include: { segments: true } });
    const status = await latestStatus(tx, version.id);
    if (["IN_PROGRESS", "COMPLETED"].includes(status)) return { applied: false, status };
    if (!["APPROVED", "SCHEDULED"].includes(status)) throw new Error("Only approved or scheduled leave can begin.");
    const groups = amountsByPeriod(version.segments);
    for (const accountPeriodId of [...groups.keys()].sort()) {
      await tx.$queryRaw`SELECT id FROM "HrLeaveAccountPeriod" WHERE id = ${accountPeriodId} FOR UPDATE`;
      const amount = groups.get(accountPeriodId)!;
      await postEntry(tx, { organizationId: input.organizationId, accountPeriodId, leavePolicyId: version.leavePolicyId, kind: "RESERVATION_RELEASE", amount, unit: version.unit, effectiveAt: input.effectiveAt, sourceType: "LEAVE_REQUEST_VERSION", sourceId: version.id, workerKey: input.workerKey, reason: "Leave start reservation conversion", correlationId: version.correlationId, idempotencyKey: `unit5-start-release:${version.id}:${accountPeriodId}` });
      await postEntry(tx, { organizationId: input.organizationId, accountPeriodId, leavePolicyId: version.leavePolicyId, kind: "CONSUMPTION", amount, unit: version.unit, effectiveAt: input.effectiveAt, sourceType: "LEAVE_REQUEST_VERSION", sourceId: version.id, workerKey: input.workerKey, reason: "Leave started", correlationId: version.correlationId, idempotencyKey: `unit5-consumption:${version.id}:${accountPeriodId}` });
    }
    await transition(tx, { requestVersionId: version.id, from: status, to: "IN_PROGRESS", reason: "Effective-dated worker started leave", idempotencyKey: `unit5-start-transition:${version.id}`, correlationId: version.correlationId });
    await appendHrAudit(tx, { organizationId: input.organizationId, entityType: "HrLeaveRequestVersion", entityId: version.id, action: "hr.leave.unit5.started", newValues: { effectiveAt: input.effectiveAt, workerKey: input.workerKey }, correlationId: version.correlationId });
    return { applied: true, status: "IN_PROGRESS" as const };
  }, { isolationLevel: "Serializable" });
}

export async function completeUnit5Leave(input: { organizationId: string; requestVersionId: string; effectiveAt: Date; workerKey: string }) {
  return prisma.$transaction(async (tx) => {
    const version = await tx.hrLeaveRequestVersion.findFirstOrThrow({ where: { id: input.requestVersionId, organizationId: input.organizationId } });
    const status = await latestStatus(tx, version.id);
    if (status === "COMPLETED") return { applied: false, status };
    if (status !== "IN_PROGRESS") throw new Error("Only in-progress leave can be completed.");
    await transition(tx, { requestVersionId: version.id, from: status, to: "COMPLETED", reason: "Effective-dated worker completed leave", idempotencyKey: `unit5-complete-transition:${version.id}`, correlationId: version.correlationId });
    await appendHrAudit(tx, { organizationId: input.organizationId, entityType: "HrLeaveRequestVersion", entityId: version.id, action: "hr.leave.unit5.completed", newValues: { effectiveAt: input.effectiveAt, workerKey: input.workerKey }, correlationId: version.correlationId });
    return { applied: true, status: "COMPLETED" as const };
  }, { isolationLevel: "Serializable" });
}

export async function processDueUnit5Leave(now = new Date(), limit = 50) {
  const candidates = await prisma.hrLeaveRequestVersion.findMany({
    where: { AND: [{ transitions: { some: { toStatus: { in: ["APPROVED", "SCHEDULED", "IN_PROGRESS"] } } } }, { transitions: { none: { toStatus: { in: ["COMPLETED", "REJECTED", "CANCELLED", "WITHDRAWN"] } } } }] },
    include: { segments: { orderBy: { sequence: "asc" } }, transitions: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const results: Array<{ id: string; action: string; applied: boolean; error?: string }> = [];
  for (const candidate of candidates) {
    const current = candidate.transitions[0]?.toStatus ?? candidate.lifecycleStatus;
    const first = candidate.segments[0];
    const last = candidate.segments[candidate.segments.length - 1];
    try {
      if (["APPROVED", "SCHEDULED"].includes(current) && first && first.startsAt <= now) {
        const outcome = await startUnit5Leave({ organizationId: candidate.organizationId, requestVersionId: candidate.id, effectiveAt: first.startsAt, workerKey: `unit5-leave:${now.toISOString().slice(0, 10)}` });
        results.push({ id: candidate.id, action: "START", applied: outcome.applied });
      } else if (current === "IN_PROGRESS" && last && last.endsAt <= now) {
        const outcome = await completeUnit5Leave({ organizationId: candidate.organizationId, requestVersionId: candidate.id, effectiveAt: last.endsAt, workerKey: `unit5-leave:${now.toISOString().slice(0, 10)}` });
        results.push({ id: candidate.id, action: "COMPLETE", applied: outcome.applied });
      }
    } catch (error) {
      results.push({ id: candidate.id, action: current === "IN_PROGRESS" ? "COMPLETE" : "START", applied: false, error: error instanceof Error ? error.message : "Leave worker failed" });
    }
  }
  return results;
}

export async function cancelUnit5Leave(input: { organizationId: string; requestVersionId: string; actorUserId: string; reason: string; effectiveAt: Date }) {
  return prisma.$transaction(async (tx) => {
    const version = await tx.hrLeaveRequestVersion.findFirstOrThrow({ where: { id: input.requestVersionId, organizationId: input.organizationId }, include: { segments: true } });
    const status = await latestStatus(tx, version.id);
    if (status === "CANCELLED") return { applied: false, status };
    if (!["APPROVED", "SCHEDULED", "IN_PROGRESS"].includes(status)) throw new Error("Only approved, scheduled, or in-progress leave can be cancelled.");
    const groups = amountsByPeriod(version.segments);
    for (const accountPeriodId of [...groups.keys()].sort()) {
      await tx.$queryRaw`SELECT id FROM "HrLeaveAccountPeriod" WHERE id = ${accountPeriodId} FOR UPDATE`;
      const amount = groups.get(accountPeriodId)!;
      if (status === "IN_PROGRESS") {
        const consumption = await tx.hrLeaveLedgerEntry.findFirstOrThrow({ where: { organizationId: input.organizationId, accountPeriodId, sourceType: "LEAVE_REQUEST_VERSION", sourceId: version.id, kind: "CONSUMPTION" } });
        await postEntry(tx, { organizationId: input.organizationId, accountPeriodId, leavePolicyId: version.leavePolicyId, kind: "REVERSAL", amount, unit: version.unit, effectiveAt: input.effectiveAt, sourceType: "LEAVE_REQUEST_VERSION", sourceId: version.id, actorUserId: input.actorUserId, reason: input.reason, correlationId: version.correlationId, idempotencyKey: `unit5-cancel-consumption:${version.id}:${accountPeriodId}`, reversalOfId: consumption.id });
      } else {
        await postEntry(tx, { organizationId: input.organizationId, accountPeriodId, leavePolicyId: version.leavePolicyId, kind: "RESERVATION_RELEASE", amount, unit: version.unit, effectiveAt: input.effectiveAt, sourceType: "LEAVE_REQUEST_VERSION", sourceId: version.id, actorUserId: input.actorUserId, reason: input.reason, correlationId: version.correlationId, idempotencyKey: `unit5-cancel-reservation:${version.id}:${accountPeriodId}` });
      }
    }
    await transition(tx, { requestVersionId: version.id, from: status, to: "CANCELLATION_PENDING", actorUserId: input.actorUserId, reason: input.reason, idempotencyKey: `unit5-cancellation-pending:${version.id}`, correlationId: version.correlationId });
    await transition(tx, { requestVersionId: version.id, from: "CANCELLATION_PENDING", to: "CANCELLED", actorUserId: input.actorUserId, reason: input.reason, idempotencyKey: `unit5-cancelled:${version.id}`, correlationId: version.correlationId });
    await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, entityType: "HrLeaveRequestVersion", entityId: version.id, action: "hr.leave.unit5.cancelled", previousValues: { status }, newValues: { status: "CANCELLED", ledgerAction: status === "IN_PROGRESS" ? "CONSUMPTION_REVERSAL" : "RESERVATION_RELEASE" }, reason: input.reason, correlationId: version.correlationId });
    return { applied: true, status: "CANCELLED" as const };
  }, { isolationLevel: "Serializable" });
}

export async function reconcileUnit5Period(organizationId: string, accountPeriodId: string) {
  const period = await prisma.hrLeaveAccountPeriod.findFirstOrThrow({ where: { id: accountPeriodId, account: { organizationId } }, include: { entries: true } });
  const ledger = { granted: 0, accrued: 0, carriedOver: 0, carriedOut: 0, adjusted: 0, reserved: 0, consumed: 0, expired: 0 };
  for (const entry of period.entries) { const amount = Number(entry.amount); if (entry.kind === "GRANT") ledger.granted += amount; if (entry.kind === "ACCRUAL") ledger.accrued += amount; if (entry.kind === "CARRYOVER_IN") ledger.carriedOver += amount; if (entry.kind === "CARRYOVER_OUT") ledger.carriedOut += amount; if (["ADJUSTMENT", "CORRECTION"].includes(entry.kind)) ledger.adjusted += amount * entry.impactSign; if (entry.kind === "RESERVATION") ledger.reserved += amount; if (entry.kind === "RESERVATION_RELEASE") ledger.reserved -= amount; if (entry.kind === "CONSUMPTION") ledger.consumed += amount; if (entry.kind === "EXPIRY") ledger.expired += amount; }
  const projection = { granted: Number(period.granted), accrued: Number(period.accrued), carriedOver: Number(period.carriedOver), carriedOut: Number(period.carriedOut), adjusted: Number(period.adjusted), reserved: Number(period.reserved), consumed: Number(period.consumed), expired: Number(period.expired) };
  const differences = Object.fromEntries(Object.keys(ledger).map((key) => [key, Number((projection[key as keyof typeof projection] - ledger[key as keyof typeof ledger]).toFixed(4))]));
  return { balanced: Object.values(differences).every((value) => value === 0), ledger, projection, differences };
}
