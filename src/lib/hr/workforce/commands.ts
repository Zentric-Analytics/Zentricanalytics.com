import crypto from "node:crypto";
import type { HrWorkforceEventType, Prisma } from "@prisma/client";
import { appendHrAudit } from "@/lib/hr/audit";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import {
  assertEffectiveDateNotEarly,
  assertEventVersion,
  assertIndependentApproval,
  assertSupportedImpactSnapshot,
  assertWorkforceEventTransition,
  changedImpactKeys,
  eventsConflict,
  type WorkforceImpactSnapshot,
} from "./events";

type Context = { organizationId: string; actorUserId: string; actorRole?: string };

type DraftInput = {
  employeeId: string;
  workRelationshipId?: string;
  type: HrWorkforceEventType;
  reason: string;
  proposedSnapshot: WorkforceImpactSnapshot;
  requestedEffectiveAt: Date;
  idempotencyKey: string;
  ownerUserId?: string;
};

function reference() {
  return `WFE-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function json(value: WorkforceImpactSnapshot): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function currentAssignmentSnapshot(tx: Prisma.TransactionClient, organizationId: string, employeeId: string) {
  const assignment = await tx.hrEmployeeAssignment.findFirst({
    where: { organizationId, employeeId, isPrimary: true, status: "ACTIVE" },
    include: { position: true },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!assignment) throw new Error("The employee does not have an active primary assignment.");
  const supervisor = await tx.hrSupervisorAssignment.findFirst({ where: { organizationId, assignedEmployeeId: employeeId, status: "ACTIVE", effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] }, orderBy: { effectiveFrom: "desc" } });
  return {
    assignment,
    snapshot: {
      positionId: assignment.positionId,
      departmentId: assignment.departmentId,
      teamId: assignment.teamId,
      locationId: assignment.locationId,
      legalEntityId: assignment.legalEntityId,
      jobProfileId: assignment.position.jobProfileId,
      gradeId: assignment.position.gradeId,
      managerEmployeeId: supervisor?.supervisorEmployeeId ?? null,
      employmentType: assignment.employmentType,
    } satisfies WorkforceImpactSnapshot,
  };
}

export async function createWorkforceEventDraft(tx: Prisma.TransactionClient, context: Context, input: DraftInput) {
  assertSupportedImpactSnapshot(input.proposedSnapshot);
  const employee = await tx.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: context.organizationId } });
  const { snapshot } = await currentAssignmentSnapshot(tx, context.organizationId, employee.id);
  const changed = changedImpactKeys(snapshot, input.proposedSnapshot);
  if (!changed.length) throw new Error("The proposed workforce event does not change the employee's current assignment.");

  if (input.workRelationshipId) {
    await tx.hrWorkRelationship.findFirstOrThrow({ where: { id: input.workRelationshipId, organizationId: context.organizationId, employeeId: employee.id, status: { in: ["ACTIVE", "NOTICE_PERIOD", "SUSPENDED"] } } });
  }

  const existing = await tx.hrWorkforceEvent.findUnique({
    where: { organizationId_idempotencyKey: { organizationId: context.organizationId, idempotencyKey: input.idempotencyKey } },
  });
  if (existing) return existing;

  const openEvents = await tx.hrWorkforceEvent.findMany({
    where: {
      organizationId: context.organizationId,
      employeeId: employee.id,
      requestedEffectiveAt: input.requestedEffectiveAt,
      status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "SCHEDULED", "APPLYING"] },
    },
    select: { id: true, proposedSnapshot: true },
  });
  for (const open of openEvents) {
    if (eventsConflict(
      { employeeId: employee.id, effectiveAt: input.requestedEffectiveAt, changes: open.proposedSnapshot as WorkforceImpactSnapshot },
      { employeeId: employee.id, effectiveAt: input.requestedEffectiveAt, changes: input.proposedSnapshot },
    )) throw new Error(`A conflicting workforce event (${open.id}) already owns one or more proposed fields for this effective date.`);
  }

  const correlationId = crypto.randomUUID();
  const event = await tx.hrWorkforceEvent.create({
    data: {
      organizationId: context.organizationId,
      employeeId: employee.id,
      workRelationshipId: input.workRelationshipId,
      reference: reference(),
      type: input.type,
      reason: input.reason,
      currentSnapshot: json(snapshot),
      proposedSnapshot: json(input.proposedSnapshot),
      requestedEffectiveAt: input.requestedEffectiveAt,
      initiatedById: context.actorUserId,
      ownerUserId: input.ownerUserId,
      idempotencyKey: input.idempotencyKey,
      correlationId,
      versions: { create: { version: 1, currentSnapshot: json(snapshot), proposedSnapshot: json(input.proposedSnapshot), reason: input.reason, createdById: context.actorUserId } },
    },
  });
  await appendHrAudit(tx, { ...context, entityType: "HrWorkforceEvent", entityId: event.id, action: "hr.workforce_event.created", newValues: { type: event.type, version: event.version, effectiveAt: event.requestedEffectiveAt, changedFields: changed }, reason: input.reason, correlationId });
  return event;
}

export async function submitWorkforceEvent(tx: Prisma.TransactionClient, context: Context, eventId: string, expectedVersion: number) {
  const event = await tx.hrWorkforceEvent.findFirstOrThrow({ where: { id: eventId, organizationId: context.organizationId } });
  assertEventVersion(expectedVersion, event.version);
  assertWorkforceEventTransition(event.status, "SUBMITTED");
  const result = await tx.hrWorkforceEvent.updateMany({ where: { id: event.id, organizationId: context.organizationId, version: expectedVersion, status: event.status }, data: { status: "SUBMITTED", submittedAt: new Date() } });
  if (result.count !== 1) throw new Error("This workforce event changed while it was being submitted.");
  await appendHrAudit(tx, { ...context, entityType: "HrWorkforceEvent", entityId: event.id, action: "hr.workforce_event.submitted", previousValues: { status: event.status }, newValues: { status: "SUBMITTED", version: event.version }, reason: event.reason, correlationId: event.correlationId });
}

export async function approveWorkforceEvent(tx: Prisma.TransactionClient, context: Context, eventId: string, expectedVersion: number, reason: string) {
  const event = await tx.hrWorkforceEvent.findFirstOrThrow({ where: { id: eventId, organizationId: context.organizationId } });
  assertEventVersion(expectedVersion, event.version);
  assertIndependentApproval(event.initiatedById, context.actorUserId);
  if (!event.workflowInstanceId) throw new Error("A workforce event cannot be approved until its governed approval workflow is attached.");
  const workflow = await tx.hrWorkflowInstance.findFirstOrThrow({ where: { id: event.workflowInstanceId, organizationId: context.organizationId, subjectId: event.id, status: "APPROVED" } });
  const reviewStatus = event.status === "SUBMITTED" ? "UNDER_REVIEW" : event.status;
  if (event.status === "SUBMITTED") assertWorkforceEventTransition("SUBMITTED", "UNDER_REVIEW");
  assertWorkforceEventTransition(reviewStatus, "APPROVED");
  const nextStatus = event.requestedEffectiveAt > new Date() ? "SCHEDULED" : "APPROVED";
  const result = await tx.hrWorkforceEvent.updateMany({ where: { id: event.id, version: expectedVersion, status: event.status }, data: { status: nextStatus, approvedAt: workflow.completedAt ?? new Date(), scheduledAt: nextStatus === "SCHEDULED" ? new Date() : null } });
  if (result.count !== 1) throw new Error("This workforce event changed while it was being approved.");
  await appendHrAudit(tx, { ...context, entityType: "HrWorkforceEvent", entityId: event.id, action: nextStatus === "SCHEDULED" ? "hr.workforce_event.scheduled" : "hr.workforce_event.approved", previousValues: { status: event.status }, newValues: { status: nextStatus, version: event.version, effectiveAt: event.requestedEffectiveAt }, reason, correlationId: event.correlationId });
  const employee = await tx.hrEmployee.findUniqueOrThrow({ where: { id: event.employeeId } });
  const recipient = employee.preferredNotificationEmail ?? employee.companyEmail ?? employee.personalEmail;
  if (recipient) await enqueueHrEmail(tx, { organizationId: context.organizationId, recipient, template: "hr-workforce-event-approved", subject: "Workforce change approved", payload: { recipientName: employee.preferredName ?? employee.legalFirstName, href: "/hr/employee/profile", workforceEventId: event.id }, idempotencyKey: `workforce-event-approved:${event.id}:v${event.version}` });
}

export async function applyWorkforceEvent(tx: Prisma.TransactionClient, context: Context, eventId: string, now = new Date()) {
  const event = await tx.hrWorkforceEvent.findFirstOrThrow({ where: { id: eventId, organizationId: context.organizationId } });
  if (event.status === "APPLIED") return event;
  if (!["APPROVED", "SCHEDULED", "FAILED"].includes(event.status)) throw new Error(`Workforce event ${event.reference} is not eligible for application.`);
  assertEffectiveDateNotEarly(event.requestedEffectiveAt, now);
  const claim = await tx.hrWorkforceEvent.updateMany({ where: { id: event.id, version: event.version, status: event.status }, data: { status: "APPLYING", failureReason: null, failedAt: null } });
  if (claim.count !== 1) throw new Error("Another worker or administrator already claimed this workforce event.");

  const attemptNumber = await tx.hrWorkforceEventExecutionAttempt.count({ where: { eventId: event.id, eventVersion: event.version } }) + 1;
  const attempt = await tx.hrWorkforceEventExecutionAttempt.create({ data: { eventId: event.id, eventVersion: event.version, attemptNumber, claimTokenHash: crypto.createHash("sha256").update(crypto.randomUUID()).digest("hex"), status: "PROCESSING" } });
  const proposed = event.proposedSnapshot as WorkforceImpactSnapshot;
  const { assignment } = await currentAssignmentSnapshot(tx, context.organizationId, event.employeeId);
  const appliedEffectiveAt = event.requestedEffectiveAt < now ? now : event.requestedEffectiveAt;

  let targetPosition = null;
  if (proposed.positionId) {
    targetPosition = await tx.hrPosition.findFirstOrThrow({ where: { id: proposed.positionId, organizationId: context.organizationId, status: "ACTIVE", lifecycleStatus: { in: ["OPEN", "PARTIALLY_FILLED", "FILLED"] } } });
    const occupied = await tx.hrEmployeeAssignment.count({ where: { organizationId: context.organizationId, positionId: targetPosition.id, status: "ACTIVE", employeeId: { not: event.employeeId } } });
    if (occupied >= targetPosition.headcountLimit) throw new Error("The target position no longer has available capacity.");
    if (proposed.departmentId && proposed.departmentId !== targetPosition.departmentId) throw new Error("The proposed department does not match the target position.");
    if (proposed.teamId !== undefined && proposed.teamId !== targetPosition.teamId) throw new Error("The proposed team does not match the target position.");
  }
  if (proposed.departmentId) await tx.hrDepartment.findFirstOrThrow({ where: { id: proposed.departmentId, organizationId: context.organizationId, status: "ACTIVE" } });
  if (proposed.teamId) {
    const team = await tx.hrTeam.findFirstOrThrow({ where: { id: proposed.teamId, organizationId: context.organizationId, status: "ACTIVE" } });
    const destinationDepartmentId = proposed.departmentId ?? targetPosition?.departmentId ?? assignment.departmentId;
    if (team.departmentId !== destinationDepartmentId) throw new Error("The proposed team does not belong to the destination department.");
  }
  if (proposed.locationId) await tx.hrLocation.findFirstOrThrow({ where: { id: proposed.locationId, organizationId: context.organizationId, status: "ACTIVE" } });
  if (proposed.legalEntityId) await tx.hrLegalEntity.findFirstOrThrow({ where: { id: proposed.legalEntityId, organizationId: context.organizationId, status: "ACTIVE" } });
  if (proposed.gradeId) await tx.hrGrade.findFirstOrThrow({ where: { id: proposed.gradeId, organizationId: context.organizationId, status: "ACTIVE" } });
  if (proposed.jobProfileId) await tx.hrJobProfile.findFirstOrThrow({ where: { id: proposed.jobProfileId, organizationId: context.organizationId, status: "ACTIVE" } });
  if (!targetPosition && proposed.departmentId && proposed.departmentId !== assignment.departmentId) throw new Error("A cross-department transfer requires a compatible target position.");
  if (proposed.gradeId && (!targetPosition || targetPosition.gradeId !== proposed.gradeId)) throw new Error("A grade change requires a target position in that grade.");
  if (proposed.jobProfileId && (!targetPosition || targetPosition.jobProfileId !== proposed.jobProfileId)) throw new Error("A job change requires a target position with that job profile.");
  if (proposed.managerEmployeeId) {
    if (proposed.managerEmployeeId === event.employeeId) throw new Error("An employee cannot be their own manager.");
    await tx.hrEmployee.findFirstOrThrow({ where: { id: proposed.managerEmployeeId, organizationId: context.organizationId, employmentStatus: { in: ["ACTIVE", "ON_LEAVE", "NOTICE_PERIOD"] } } });
  }

  const assignmentFields = ["positionId", "departmentId", "teamId", "locationId", "legalEntityId", "employmentType"] as const;
  if (assignmentFields.some((field) => Object.prototype.hasOwnProperty.call(proposed, field))) {
    const updated = await tx.hrEmployeeAssignment.updateMany({ where: { id: assignment.id, version: assignment.version, status: "ACTIVE" }, data: { status: "ENDED", effectiveTo: appliedEffectiveAt, endedAt: now, endedById: context.actorUserId, version: { increment: 1 } } });
    if (updated.count !== 1) throw new Error("The employee assignment changed before this event could be applied.");
    await tx.hrEmployeeAssignment.create({ data: {
      organizationId: assignment.organizationId,
      employeeId: assignment.employeeId,
      departmentId: proposed.departmentId ?? targetPosition?.departmentId ?? assignment.departmentId,
      teamId: Object.prototype.hasOwnProperty.call(proposed, "teamId") ? proposed.teamId : targetPosition?.teamId ?? assignment.teamId,
      positionId: proposed.positionId ?? assignment.positionId,
      employmentType: (proposed.employmentType as typeof assignment.employmentType | undefined) ?? assignment.employmentType,
      location: assignment.location,
      effectiveFrom: appliedEffectiveAt,
      status: "ACTIVE",
      reason: `${event.type}: ${event.reason}`,
      createdById: context.actorUserId,
      legalEntityId: Object.prototype.hasOwnProperty.call(proposed, "legalEntityId") ? proposed.legalEntityId : assignment.legalEntityId,
      businessUnitId: assignment.businessUnitId,
      divisionId: assignment.divisionId,
      locationId: Object.prototype.hasOwnProperty.call(proposed, "locationId") ? proposed.locationId : assignment.locationId,
      costCenterId: assignment.costCenterId,
      isPrimary: true,
      fte: assignment.fte,
      placementSnapshot: { workforceEventId: event.id, priorAssignmentId: assignment.id },
    } });
  }

  if (Object.prototype.hasOwnProperty.call(proposed, "managerEmployeeId")) {
    const activeManagers = await tx.hrSupervisorAssignment.findMany({ where: { organizationId: context.organizationId, assignedEmployeeId: event.employeeId, status: "ACTIVE" } });
    for (const manager of activeManagers) await tx.hrSupervisorAssignment.update({ where: { id: manager.id }, data: { status: "ENDED", effectiveTo: appliedEffectiveAt, endedAt: now, endedByUserId: context.actorUserId, endReason: `${event.type}: ${event.reason}` } });
    if (proposed.managerEmployeeId) await tx.hrSupervisorAssignment.create({ data: { organizationId: context.organizationId, supervisorEmployeeId: proposed.managerEmployeeId, assignedEmployeeId: event.employeeId, assignmentType: "DIRECT_REPORT", status: "ACTIVE", effectiveFrom: appliedEffectiveAt, capabilities: { source: "workforce-event", eventId: event.id }, assignedByUserId: context.actorUserId, reason: `${event.type}: ${event.reason}` } });
  }

  if (Object.prototype.hasOwnProperty.call(proposed, "workMode")) {
    await tx.hrEmployee.update({ where: { id: event.employeeId }, data: { workMode: proposed.workMode as "ONSITE" | "HYBRID" | "REMOTE" } });
  }
  if (Object.prototype.hasOwnProperty.call(proposed, "employmentStatus")) {
    const employee = await tx.hrEmployee.findUniqueOrThrow({ where: { id: event.employeeId } });
    await tx.hrEmployee.update({ where: { id: employee.id }, data: { employmentStatus: proposed.employmentStatus as typeof employee.employmentStatus } });
    await tx.hrEmployeeStatusHistory.create({ data: { organizationId: context.organizationId, employeeId: employee.id, previousStatus: employee.employmentStatus, newStatus: proposed.employmentStatus as typeof employee.employmentStatus, effectiveAt: appliedEffectiveAt, reason: event.reason, changedById: context.actorUserId } });
  }

  await tx.hrWorkforceEventExecutionAttempt.update({ where: { id: attempt.id }, data: { status: "COMPLETED", completedAt: now } });
  await tx.hrWorkforceEvent.update({ where: { id: event.id }, data: { status: "APPLIED", appliedAt: now } });
  await appendHrAudit(tx, { ...context, entityType: "HrWorkforceEvent", entityId: event.id, action: "hr.workforce_event.applied", previousValues: { status: event.status }, newValues: { status: "APPLIED", version: event.version, requestedEffectiveAt: event.requestedEffectiveAt, appliedEffectiveAt, changedFields: Object.keys(proposed) }, reason: event.reason, correlationId: event.correlationId });
  const notifiedEmployee = await tx.hrEmployee.findUniqueOrThrow({ where: { id: event.employeeId } });
  const recipient = notifiedEmployee.preferredNotificationEmail ?? notifiedEmployee.companyEmail ?? notifiedEmployee.personalEmail;
  if (recipient) await enqueueHrEmail(tx, { organizationId: context.organizationId, recipient, template: "hr-workforce-event-applied", subject: "Workforce change is now effective", payload: { recipientName: notifiedEmployee.preferredName ?? notifiedEmployee.legalFirstName, href: "/hr/employee/profile", workforceEventId: event.id }, idempotencyKey: `workforce-event-applied:${event.id}:v${event.version}` });
}
