import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { createWorkforceEventDraft, submitWorkforceEvent } from "@/lib/hr/workforce/commands";

export async function submitUnit5ReturnToWork(input: { organizationId: string; longAbsenceId: string; actorUserId: string; actorRole?: string; returnAt: Date; reason: string }) {
  return prisma.$transaction(async (tx) => {
    const absence = await tx.hrLeaveLongAbsence.findFirstOrThrow({ where: { id: input.longAbsenceId, organizationId: input.organizationId }, include: { employee: true, startWorkforceEvent: true } });
    if (absence.returnWorkforceEventId) return { applied: false, eventId: absence.returnWorkforceEventId };
    if (absence.startWorkforceEvent?.status !== "APPLIED" || absence.employee.employmentStatus !== "ON_LEAVE") throw new Error("Return to work cannot be submitted until the governed leave-of-absence event is effective.");
    const relationship = await tx.hrWorkRelationship.findFirstOrThrow({ where: { organizationId: input.organizationId, employeeId: absence.employeeId, status: { in: ["ACTIVE", "NOTICE_PERIOD", "SUSPENDED"] } }, orderBy: { startedAt: "desc" } });
    const returnCorrelationId = crypto.createHash("sha256").update(`unit5-long-absence-return:${absence.correlationId}`).digest("hex");
    const event = await createWorkforceEventDraft(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, actorRole: input.actorRole }, { employeeId: absence.employeeId, workRelationshipId: relationship.id, type: "RETURN_FROM_LEAVE", reason: input.reason, proposedSnapshot: { employmentStatus: "ACTIVE" }, requestedEffectiveAt: input.returnAt, idempotencyKey: `unit5-long-absence-return:${absence.id}`, correlationId: returnCorrelationId });
    await submitWorkforceEvent(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, actorRole: input.actorRole }, event.id, event.version);
    await tx.hrLeaveLongAbsence.update({ where: { id: absence.id }, data: { returnWorkforceEventId: event.id, actualReturnAt: input.returnAt, status: "RETURN_EVENT_SUBMITTED" } });
    await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, actorRole: input.actorRole, entityType: "HrLeaveLongAbsence", entityId: absence.id, action: "hr.leave.long_absence.return_submitted", newValues: { eventId: event.id, returnAt: input.returnAt }, reason: input.reason, correlationId: absence.correlationId });
    return { applied: true, eventId: event.id };
  }, { isolationLevel: "Serializable" });
}
