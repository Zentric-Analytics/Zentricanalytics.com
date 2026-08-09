import crypto from "node:crypto";
import type { HrSeparationType, Prisma } from "@prisma/client";
import { appendHrAudit } from "@/lib/hr/audit";
import { assertSeparationExecution, assertSeparationTransition } from "./employment-lifecycles";

type Context = { organizationId: string; actorUserId: string; actorRole?: string };

export async function createSeparationCase(tx: Prisma.TransactionClient, context: Context, input: { employeeId: string; type: HrSeparationType; reason: string; finalWorkingDate: Date }) {
  const employee = await tx.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: context.organizationId, employmentStatus: { notIn: ["TERMINATED", "ARCHIVED"] } } });
  const relationship = await tx.hrWorkRelationship.findFirstOrThrow({ where: { organizationId: context.organizationId, employeeId: employee.id, status: { in: ["ACTIVE", "NOTICE_PERIOD", "SUSPENDED"] } }, orderBy: { startedAt: "desc" } });
  const open = await tx.hrSeparationCase.findFirst({ where: { organizationId: context.organizationId, employeeId: employee.id, status: { in: ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "SCHEDULED", "FAILED"] } } });
  if (open) throw new Error(`An open separation case (${open.id}) already exists for this employee.`);
  const correlationId = crypto.randomUUID();
  const separation = await tx.hrSeparationCase.create({ data: { organizationId: context.organizationId, employeeId: employee.id, workRelationshipId: relationship.id, type: input.type, status: "SUBMITTED", reason: input.reason, initiatedById: context.actorUserId, noticeDate: new Date(), finalWorkingDate: input.finalWorkingDate, correlationId } });
  await appendHrAudit(tx, { ...context, entityType: "HrSeparationCase", entityId: separation.id, action: "hr.separation.submitted", newValues: { type: separation.type, status: separation.status, finalWorkingDate: separation.finalWorkingDate, workRelationshipId: relationship.id }, reason: input.reason, correlationId });
  return separation;
}

export async function reviewSeparationCase(tx: Prisma.TransactionClient, context: Context, input: { separationId: string; expectedVersion: number; decision: "APPROVED" | "REJECTED"; reason: string }) {
  const separation = await tx.hrSeparationCase.findFirstOrThrow({ where: { id: input.separationId, organizationId: context.organizationId } });
  if (separation.initiatedById === context.actorUserId) throw new Error("A separation case requires independent review.");
  if (separation.version !== input.expectedVersion) throw new Error("This separation case changed while it was being reviewed.");
  const reviewStatus = separation.status === "SUBMITTED" ? "UNDER_REVIEW" : separation.status;
  if (separation.status === "SUBMITTED") assertSeparationTransition("SUBMITTED", "UNDER_REVIEW");
  assertSeparationTransition(reviewStatus, input.decision);
  const nextStatus = input.decision === "APPROVED" ? "SCHEDULED" : input.decision;
  const result = await tx.hrSeparationCase.updateMany({ where: { id: separation.id, organizationId: context.organizationId, version: input.expectedVersion, status: separation.status }, data: { status: nextStatus, version: { increment: 1 }, approvedById: input.decision === "APPROVED" ? context.actorUserId : null, approvedAt: input.decision === "APPROVED" ? new Date() : null } });
  if (result.count !== 1) throw new Error("This separation case was decided by another reviewer.");
  await appendHrAudit(tx, { ...context, entityType: "HrSeparationCase", entityId: separation.id, action: `hr.separation.${nextStatus.toLowerCase()}`, previousValues: { status: separation.status, version: separation.version }, newValues: { status: nextStatus, version: separation.version + 1 }, reason: input.reason, correlationId: separation.correlationId });
}

export async function applySeparationCase(tx: Prisma.TransactionClient, context: Context, separationId: string, now = new Date()) {
  const separation = await tx.hrSeparationCase.findFirstOrThrow({ where: { id: separationId, organizationId: context.organizationId }, include: { employee: { include: { user: true } } } });
  const lifecycle = await tx.hrLifecycleInstance.findFirst({ where: { organizationId: context.organizationId, employeeId: separation.employeeId, type: "OFFBOARDING", effectiveDate: separation.finalWorkingDate }, include: { tasks: true } });
  const requiredTasksOpen = lifecycle?.tasks.filter((task) => task.required && !["COMPLETED", "SKIPPED"].includes(task.status)).length ?? 1;
  assertSeparationExecution({ finalWorkingDate: separation.finalWorkingDate, now, requiredTasksOpen, status: separation.status });
  const claim = await tx.hrSeparationCase.updateMany({ where: { id: separation.id, version: separation.version, status: separation.status }, data: { status: "APPLIED", version: { increment: 1 }, appliedAt: now, failureReason: null } });
  if (claim.count !== 1) throw new Error("Another worker already applied this separation case.");
  await tx.hrEmployee.update({ where: { id: separation.employeeId }, data: { employmentStatus: "TERMINATED", terminationDate: separation.finalWorkingDate, terminationReason: separation.reason, companyEmailStatus: "DISABLED" } });
  await tx.hrEmployeeStatusHistory.create({ data: { organizationId: context.organizationId, employeeId: separation.employeeId, previousStatus: separation.employee.employmentStatus, newStatus: "TERMINATED", effectiveAt: separation.finalWorkingDate, reason: separation.reason, changedById: context.actorUserId } });
  await tx.hrWorkRelationship.update({ where: { id: separation.workRelationshipId }, data: { status: "ENDED", endedAt: separation.finalWorkingDate, endReason: separation.reason } });
  await tx.hrEmployeeAssignment.updateMany({ where: { employeeId: separation.employeeId, status: "ACTIVE" }, data: { status: "ENDED", effectiveTo: separation.finalWorkingDate, endedAt: now, endedById: context.actorUserId, version: { increment: 1 } } });
  await tx.hrSystemAccessAssignment.updateMany({ where: { employeeId: separation.employeeId, status: { in: ["REQUESTED", "ACTIVE", "SUSPENDED"] } }, data: { status: "REVOKED", endedAt: separation.finalWorkingDate, endedById: context.actorUserId, endReason: `Employment ended: ${separation.reason}` } });
  if (separation.employee.userId) {
    await tx.hrSession.updateMany({ where: { userId: separation.employee.userId, revokedAt: null }, data: { revokedAt: now } });
    await tx.hrUser.update({ where: { id: separation.employee.userId }, data: { status: "SUSPENDED", suspendedAt: now } });
  }
  await appendHrAudit(tx, { ...context, entityType: "HrSeparationCase", entityId: separation.id, action: "hr.separation.applied", previousValues: { status: separation.status, employeeStatus: separation.employee.employmentStatus }, newValues: { status: "APPLIED", employeeStatus: "TERMINATED", workRelationshipStatus: "ENDED" }, reason: separation.reason, correlationId: separation.correlationId });
}
