import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { appendHrAudit } from "@/lib/hr/audit";

type Tx = Prisma.TransactionClient;
type Context = { organizationId: string; actorUserId: string; actorRole?: string };

export async function createShiftTemplateVersion(tx: Tx, context: Context, input: { code: string; name: string; timezone: string; startsAt: Date; endsAt: Date; effectiveFrom: Date }) {
  if (!input.code.trim() || !input.name.trim() || input.endsAt <= input.startsAt) throw new Error("A valid shift code, name, and time range are required.");
  try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }).format(input.effectiveFrom); } catch { throw new Error("Shift timezone must be a valid IANA timezone."); }
  const template = await tx.hrShiftTemplate.create({ data: { organizationId: context.organizationId, code: input.code.trim().toUpperCase(), name: input.name.trim() } });
  const version = await tx.hrShiftTemplateVersion.create({ data: { shiftTemplateId: template.id, version: 1, timezone: input.timezone, segments: [{ start: input.startsAt.toISOString(), end: input.endsAt.toISOString() }], effectiveFrom: input.effectiveFrom, publishedAt: new Date(), createdById: context.actorUserId } });
  await appendHrAudit(tx, { ...context, entityType: "HrShiftTemplateVersion", entityId: version.id, action: "hr.time.shift.published", newValues: { shiftTemplateId: template.id, code: template.code, version: version.version, timezone: version.timezone, effectiveFrom: version.effectiveFrom }, correlationId: crypto.randomUUID() });
  return { template, version };
}

export async function assignPublishedShift(tx: Tx, context: Context, input: { employeeId: string; shiftTemplateVersionId: string; businessDate: Date; startsAt: Date; endsAt: Date; reason: string }) {
  if (!input.reason.trim() || input.endsAt <= input.startsAt) throw new Error("A valid shift range and assignment reason are required.");
  const [employee, relationship, assignment, version] = await Promise.all([
    tx.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: context.organizationId, employmentStatus: "ACTIVE" } }),
    tx.hrWorkRelationship.findFirstOrThrow({ where: { employeeId: input.employeeId, organizationId: context.organizationId, status: "ACTIVE" }, orderBy: { startedAt: "desc" } }),
    tx.hrEmployeeAssignment.findFirstOrThrow({ where: { employeeId: input.employeeId, organizationId: context.organizationId, status: "ACTIVE", effectiveFrom: { lte: input.startsAt }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.startsAt } }] }, orderBy: { effectiveFrom: "desc" } }),
    tx.hrShiftTemplateVersion.findFirstOrThrow({ where: { id: input.shiftTemplateVersionId, publishedAt: { not: null }, shiftTemplate: { organizationId: context.organizationId } }, include: { shiftTemplate: true } }),
  ]);
  const shift = await tx.hrShiftAssignment.create({ data: { organizationId: context.organizationId, employeeId: employee.id, workRelationshipId: relationship.id, assignmentId: assignment.id, shiftTemplateId: version.shiftTemplateId, shiftTemplateVersionId: version.id, businessDate: input.businessDate, startsAt: input.startsAt, endsAt: input.endsAt, publishedAt: new Date(), assignedById: context.actorUserId, reason: input.reason.trim() } });
  await appendHrAudit(tx, { ...context, entityType: "HrShiftAssignment", entityId: shift.id, action: "hr.time.shift.assigned", newValues: { employeeId: employee.id, workRelationshipId: relationship.id, assignmentId: assignment.id, shiftTemplateVersionId: version.id, businessDate: shift.businessDate, startsAt: shift.startsAt, endsAt: shift.endsAt }, reason: shift.reason, correlationId: crypto.randomUUID() });
  return shift;
}
