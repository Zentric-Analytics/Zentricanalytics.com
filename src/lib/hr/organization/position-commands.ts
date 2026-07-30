import type { HrPositionLifecycleStatus, Prisma } from "@prisma/client";
import { appendHrAudit } from "@/lib/hr/audit";
import { assertPositionTransition, positionOccupancyStatus } from "./validation";

type CommandContext = { organizationId: string; actorUserId: string; actorRole?: string };

export async function submitPosition(tx: Prisma.TransactionClient, context: CommandContext, input: { positionId: string; reason: string }) {
  const position = await tx.hrPosition.findFirstOrThrow({ where: { id: input.positionId, organizationId: context.organizationId } });
  assertPositionTransition(position.lifecycleStatus, "PENDING_APPROVAL");
  if (!position.departmentId || position.headcountLimit < 1 || position.fullTimeEquivalent.lte(0)) throw new Error("Position placement and capacity must be complete before submission.");
  await tx.hrPosition.update({ where: { id: position.id }, data: { lifecycleStatus: "PENDING_APPROVAL", requestedById: context.actorUserId, version: { increment: 1 } } });
  await tx.hrPositionApproval.create({ data: { organizationId: context.organizationId, positionId: position.id, requestedById: context.actorUserId, reason: input.reason } });
  await appendHrAudit(tx, { ...context, entityType: "HrPosition", entityId: position.id, action: "hr.position.submitted", previousValues: { lifecycleStatus: position.lifecycleStatus }, newValues: { lifecycleStatus: "PENDING_APPROVAL" }, reason: input.reason });
}

export async function decidePosition(tx: Prisma.TransactionClient, context: CommandContext, input: { positionId: string; approve: boolean; reason: string }) {
  const position = await tx.hrPosition.findFirstOrThrow({ where: { id: input.positionId, organizationId: context.organizationId, lifecycleStatus: "PENDING_APPROVAL" } });
  if (position.requestedById === context.actorUserId) throw new Error("Position requester cannot approve or reject their own request.");
  const target: HrPositionLifecycleStatus = input.approve ? "APPROVED" : "REJECTED";
  assertPositionTransition(position.lifecycleStatus, target);
  await tx.hrPosition.update({ where: { id: position.id }, data: { lifecycleStatus: target, approvedById: input.approve ? context.actorUserId : null, approvedAt: input.approve ? new Date() : null, version: { increment: 1 } } });
  await tx.hrPositionApproval.updateMany({ where: { organizationId: context.organizationId, positionId: position.id, decision: null }, data: { decidedById: context.actorUserId, decision: input.approve ? "APPROVED" : "REJECTED", decisionReason: input.reason, decidedAt: new Date() } });
  await appendHrAudit(tx, { ...context, entityType: "HrPosition", entityId: position.id, action: input.approve ? "hr.position.approved" : "hr.position.rejected", previousValues: { lifecycleStatus: position.lifecycleStatus }, newValues: { lifecycleStatus: target }, reason: input.reason });
}

export async function changePositionState(tx: Prisma.TransactionClient, context: CommandContext, input: { positionId: string; target: HrPositionLifecycleStatus; reason: string }) {
  const position = await tx.hrPosition.findFirstOrThrow({ where: { id: input.positionId, organizationId: context.organizationId } });
  assertPositionTransition(position.lifecycleStatus, input.target);
  const active = await tx.hrEmployeeAssignment.count({ where: { organizationId: context.organizationId, positionId: position.id, status: "ACTIVE", OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] } });
  if (active && ["CLOSED", "CANCELLED"].includes(input.target)) throw new Error("Transfer or end active occupants before closing this position.");
  await tx.hrPosition.update({ where: { id: position.id }, data: { lifecycleStatus: input.target, version: { increment: 1 } } });
  await appendHrAudit(tx, { ...context, entityType: "HrPosition", entityId: position.id, action: "hr.position.state_changed", previousValues: { lifecycleStatus: position.lifecycleStatus }, newValues: { lifecycleStatus: input.target }, reason: input.reason });
}

export async function reconcilePositionOccupancy(tx: Prisma.TransactionClient, context: CommandContext, positionId: string) {
  const position = await tx.hrPosition.findFirstOrThrow({ where: { id: positionId, organizationId: context.organizationId } });
  const active = await tx.hrEmployeeAssignment.findMany({ where: { organizationId: context.organizationId, positionId, status: "ACTIVE", OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] }, select: { fte: true } });
  const next = positionOccupancyStatus({ activeCount: active.length, occupiedFte: active.reduce((sum, item) => sum + item.fte.toNumber(), 0), headcountLimit: position.headcountLimit, fullTimeEquivalent: position.fullTimeEquivalent.toNumber() });
  if (!["OPEN", "PARTIALLY_FILLED", "FILLED"].includes(position.lifecycleStatus)) {
    if (active.length) throw new Error("Only open positions can have active occupants.");
    return position.lifecycleStatus;
  }
  if (next !== position.lifecycleStatus) await tx.hrPosition.update({ where: { id: position.id }, data: { lifecycleStatus: next, version: { increment: 1 } } });
  return next;
}
