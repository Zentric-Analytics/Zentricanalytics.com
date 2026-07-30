import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";

type Context = { organizationId: string; actorUserId: string; actorRole?: string };
type EntityType = "DEPARTMENT" | "TEAM" | "POSITION";

async function loadEntity(tx: Prisma.TransactionClient, organizationId: string, entityType: EntityType, entityId: string) {
  if (entityType === "DEPARTMENT") return tx.hrDepartment.findFirstOrThrow({ where: { id: entityId, organizationId } });
  if (entityType === "TEAM") return tx.hrTeam.findFirstOrThrow({ where: { id: entityId, organizationId } });
  return tx.hrPosition.findFirstOrThrow({ where: { id: entityId, organizationId } });
}

export async function requestOrganizationChange(tx: Prisma.TransactionClient, context: Context, input: { entityType: EntityType; entityId: string; effectiveAt: Date; name: string; reason: string }) {
  if (input.effectiveAt <= new Date()) throw new Error("A scheduled organization change must be future dated.");
  const current = await loadEntity(tx, context.organizationId, input.entityType, input.entityId);
  const change = await tx.hrOrganizationChange.create({ data: { organizationId: context.organizationId, entityType: input.entityType, entityId: input.entityId, status: "PENDING_APPROVAL", effectiveAt: input.effectiveAt, payload: { name: input.name, reason: input.reason }, requestedById: context.actorUserId } });
  await appendHrAudit(tx, { ...context, entityType: "HrOrganizationChange", entityId: change.id, action: "hr.organization.change_requested", previousValues: { name: "title" in current ? current.title : current.name }, newValues: { name: input.name, effectiveAt: input.effectiveAt }, reason: input.reason });
  return change;
}

export async function approveOrganizationChange(tx: Prisma.TransactionClient, context: Context, changeId: string, reason: string) {
  const change = await tx.hrOrganizationChange.findFirstOrThrow({ where: { id: changeId, organizationId: context.organizationId, status: "PENDING_APPROVAL" } });
  if (change.requestedById === context.actorUserId) throw new Error("Organization change requester cannot approve their own change.");
  await tx.hrOrganizationChange.update({ where: { id: change.id }, data: { status: "SCHEDULED", approvedById: context.actorUserId, approvedAt: new Date() } });
  await appendHrAudit(tx, { ...context, entityType: "HrOrganizationChange", entityId: change.id, action: "hr.organization.change_approved", previousValues: { status: change.status }, newValues: { status: "SCHEDULED", effectiveAt: change.effectiveAt }, reason });
}

async function activateChange(changeId: string, now: Date) {
  return prisma.$transaction(async tx => {
    const change = await tx.hrOrganizationChange.findFirstOrThrow({ where: { id: changeId, status: "SCHEDULED", effectiveAt: { lte: now } } });
    const entityType = change.entityType as EntityType;
    const current = await loadEntity(tx, change.organizationId, entityType, change.entityId);
    const payload = change.payload as { name: string; reason: string };
    const latest = await tx.hrOrganizationStructureRevision.findFirst({ where: { organizationId: change.organizationId, entityType, entityId: change.entityId }, orderBy: { version: "desc" } });
    if (latest && !latest.effectiveTo) await tx.hrOrganizationStructureRevision.update({ where: { id: latest.id }, data: { effectiveTo: change.effectiveAt } });
    await tx.hrOrganizationStructureRevision.create({ data: { organizationId: change.organizationId, entityType, entityId: change.entityId, version: (latest?.version ?? 0) + 1, payload: { previousName: "title" in current ? current.title : current.name, name: payload.name, changeId: change.id }, effectiveFrom: change.effectiveAt, createdById: change.approvedById! } });
    if (entityType === "DEPARTMENT") await tx.hrDepartment.update({ where: { id: change.entityId }, data: { name: payload.name } });
    else if (entityType === "TEAM") await tx.hrTeam.update({ where: { id: change.entityId }, data: { name: payload.name } });
    else await tx.hrPosition.update({ where: { id: change.entityId }, data: { title: payload.name, version: { increment: 1 } } });
    await tx.hrOrganizationChange.update({ where: { id: change.id }, data: { status: "COMPLETED", completedAt: now, attempts: { increment: 1 }, failureCode: null } });
    await appendHrAudit(tx, { organizationId: change.organizationId, actorUserId: change.approvedById ?? undefined, entityType: "HrOrganizationChange", entityId: change.id, action: "hr.organization.change_activated", previousValues: { name: "title" in current ? current.title : current.name }, newValues: { name: payload.name, effectiveAt: change.effectiveAt }, reason: payload.reason });
    return change.id;
  }, { isolationLevel: "Serializable" });
}

export async function activateDueOrganizationChanges(now = new Date(), limit = 25) {
  const due = await prisma.hrOrganizationChange.findMany({ where: { status: "SCHEDULED", effectiveAt: { lte: now } }, select: { id: true }, orderBy: { effectiveAt: "asc" }, take: limit });
  const outcomes: Array<{ id: string; status: "COMPLETED" | "FAILED" }> = [];
  for (const item of due) {
    try { await activateChange(item.id, now); outcomes.push({ id: item.id, status: "COMPLETED" }); }
    catch (error) {
      const code = error instanceof Error ? error.message.slice(0, 120) : "Unknown activation failure";
      await prisma.hrOrganizationChange.updateMany({ where: { id: item.id, status: "SCHEDULED" }, data: { status: "FAILED", failedAt: now, failureCode: code, attempts: { increment: 1 } } });
      outcomes.push({ id: item.id, status: "FAILED" });
    }
  }
  return outcomes;
}
