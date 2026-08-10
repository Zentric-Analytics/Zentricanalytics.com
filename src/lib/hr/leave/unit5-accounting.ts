import { Prisma, type HrLeaveEntryKind, type HrLeaveRequestLifecycleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { assertIndependentLeaveApproval, assertUnit5RequestTransition, projectedPeriodBalance } from "./unit5";

type Tx = Prisma.TransactionClient;
type ProjectionField = "granted" | "accrued" | "carriedOver" | "adjusted" | "reserved" | "consumed" | "expired";
const projectionField: Partial<Record<HrLeaveEntryKind, ProjectionField>> = { GRANT: "granted", ACCRUAL: "accrued", CARRYOVER_IN: "carriedOver", RESERVATION: "reserved", CONSUMPTION: "consumed", EXPIRY: "expired", ADJUSTMENT: "adjusted", CORRECTION: "adjusted" };

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

async function postEntry(tx: Tx, input: { organizationId: string; accountPeriodId: string; leavePolicyId: string; kind: HrLeaveEntryKind; amount: Prisma.Decimal | number; unit: "DAYS" | "HOURS"; effectiveAt: Date; sourceType: string; sourceId: string; actorUserId?: string; workerKey?: string; reason: string; correlationId: string; idempotencyKey: string; reversalOfId?: string }) {
  const existing = await tx.hrLeaveLedgerEntry.findUnique({ where: { organizationId_idempotencyKey: { organizationId: input.organizationId, idempotencyKey: input.idempotencyKey } } });
  if (existing) return { entry: existing, applied: false };
  const amount = new Prisma.Decimal(input.amount);
  if (amount.lte(0)) throw new Error("Authoritative leave ledger entries require a positive amount.");
  const field = projectionField[input.kind];
  if (field) await tx.hrLeaveAccountPeriod.update({ where: { id: input.accountPeriodId }, data: { [field]: { increment: amount }, version: { increment: 1 } } });
  else if (input.kind === "RESERVATION_RELEASE") await tx.hrLeaveAccountPeriod.update({ where: { id: input.accountPeriodId }, data: { reserved: { decrement: amount }, version: { increment: 1 } } });
  else if (input.kind === "REVERSAL") {
    if (!input.reversalOfId) throw new Error("A reversal must identify the original ledger entry.");
    const original = await tx.hrLeaveLedgerEntry.findUniqueOrThrow({ where: { id: input.reversalOfId } });
    const originalField = projectionField[original.kind];
    if (!originalField) throw new Error("This ledger entry kind requires an explicit correction rather than automatic reversal.");
    await tx.hrLeaveAccountPeriod.update({ where: { id: input.accountPeriodId }, data: { [originalField]: { decrement: amount }, version: { increment: 1 } } });
  }
  return { entry: await tx.hrLeaveLedgerEntry.create({ data: { ...input, amount } }), applied: true };
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

function amountsByPeriod(segments: Array<{ accountPeriodId: string | null; chargeableAmount: Prisma.Decimal }>) {
  const groups = new Map<string, Prisma.Decimal>();
  for (const segment of segments) if (segment.accountPeriodId) groups.set(segment.accountPeriodId, (groups.get(segment.accountPeriodId) ?? new Prisma.Decimal(0)).plus(segment.chargeableAmount));
  return groups;
}

export async function reserveUnit5Request(input: { organizationId: string; requestVersionId: string; reviewerUserId: string; reason?: string; idempotencyKey: string }) {
  return prisma.$transaction(async (tx) => {
    const version = await tx.hrLeaveRequestVersion.findFirstOrThrow({ where: { id: input.requestVersionId, organizationId: input.organizationId }, include: { segments: true } });
    assertIndependentLeaveApproval(version.createdById, input.reviewerUserId);
    const status = await latestStatus(tx, version.id);
    if (["APPROVED", "SCHEDULED"].includes(status)) return { applied: false, status };
    if (status !== "UNDER_REVIEW") throw new Error("Only a request under review can receive final approval.");
    const groups = amountsByPeriod(version.segments);
    for (const accountPeriodId of [...groups.keys()].sort()) {
      await tx.$queryRaw`SELECT id FROM "HrLeaveAccountPeriod" WHERE id = ${accountPeriodId} FOR UPDATE`;
      const period = await tx.hrLeaveAccountPeriod.findUniqueOrThrow({ where: { id: accountPeriodId }, include: { leavePolicy: true } });
      const available = projectedPeriodBalance({ granted: Number(period.granted), accrued: Number(period.accrued), carriedOver: Number(period.carriedOver), adjusted: Number(period.adjusted), reserved: Number(period.reserved), consumed: Number(period.consumed), expired: Number(period.expired) });
      const amount = groups.get(accountPeriodId)!;
      if (!period.leavePolicy.allowNegativeBalance && amount.gt(available)) throw new Error("Final approval cannot reserve more than the current spendable entitlement.");
      await postEntry(tx, { organizationId: input.organizationId, accountPeriodId, leavePolicyId: version.leavePolicyId, kind: "RESERVATION", amount, unit: version.unit, effectiveAt: new Date(), sourceType: "LEAVE_REQUEST_VERSION", sourceId: version.id, actorUserId: input.reviewerUserId, reason: input.reason ?? "Final approval reservation", correlationId: version.correlationId, idempotencyKey: `unit5-reservation:${version.id}:${accountPeriodId}` });
    }
    await transition(tx, { requestVersionId: version.id, from: status, to: "APPROVED", actorUserId: input.reviewerUserId, reason: input.reason, idempotencyKey: input.idempotencyKey, correlationId: version.correlationId });
    await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.reviewerUserId, entityType: "HrLeaveRequestVersion", entityId: version.id, action: "hr.leave.unit5.final_approved", newValues: { reservedPeriods: [...groups.keys()] }, reason: input.reason, correlationId: version.correlationId });
    return { applied: true, status: "APPROVED" as const };
  }, { isolationLevel: "Serializable" });
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
  const ledger = { granted: 0, accrued: 0, carriedOver: 0, adjusted: 0, reserved: 0, consumed: 0, expired: 0 };
  for (const entry of period.entries) { const amount = Number(entry.amount); if (entry.kind === "GRANT") ledger.granted += amount; if (entry.kind === "ACCRUAL") ledger.accrued += amount; if (entry.kind === "CARRYOVER_IN") ledger.carriedOver += amount; if (["ADJUSTMENT", "CORRECTION"].includes(entry.kind)) ledger.adjusted += amount; if (entry.kind === "RESERVATION") ledger.reserved += amount; if (entry.kind === "RESERVATION_RELEASE") ledger.reserved -= amount; if (entry.kind === "CONSUMPTION") ledger.consumed += amount; if (entry.kind === "EXPIRY") ledger.expired += amount; }
  const projection = { granted: Number(period.granted), accrued: Number(period.accrued), carriedOver: Number(period.carriedOver), adjusted: Number(period.adjusted), reserved: Number(period.reserved), consumed: Number(period.consumed), expired: Number(period.expired) };
  const differences = Object.fromEntries(Object.keys(ledger).map((key) => [key, Number((projection[key as keyof typeof projection] - ledger[key as keyof typeof ledger]).toFixed(4))]));
  return { balanced: Object.values(differences).every((value) => value === 0), ledger, projection, differences };
}
