import { prisma } from "../src/lib/prisma";
import { applyWorkforceEvent } from "../src/lib/hr/workforce/commands";
import { runUnit5OperationalWindow } from "../src/lib/hr/leave/unit5-operations";

const eventId = process.env.HR_UNIT5_BOUNDARY_EVENT_ID;
const effectiveAt = new Date(process.env.HR_UNIT5_BOUNDARY_AT ?? "");

if (process.env.HR_UNIT5_BOUNDARY_CONFIRM !== "staging-only") throw new Error("Set HR_UNIT5_BOUNDARY_CONFIRM=staging-only.");
if ((process.env.HR_ENVIRONMENT ?? "").toLowerCase() !== "staging") throw new Error("This boundary harness may run only in staging.");
if (!eventId || Number.isNaN(effectiveAt.getTime())) throw new Error("A workforce event ID and valid boundary timestamp are required.");

const event = await prisma.hrWorkforceEvent.findUniqueOrThrow({ where: { id: eventId } });
if (event.type !== "RETURN_FROM_LEAVE") throw new Error("The selected event is not a return-from-leave event.");
if (event.status !== "SCHEDULED") throw new Error(`The return event must be SCHEDULED, not ${event.status}.`);

const context = { organizationId: event.organizationId, actorUserId: event.initiatedById, actorRole: "STAGING_BOUNDARY_WORKER" };
await prisma.$transaction((tx) => applyWorkforceEvent(tx, context, event.id, effectiveAt), { isolationLevel: "Serializable" });
const firstWindow = await runUnit5OperationalWindow(effectiveAt);
await prisma.$transaction((tx) => applyWorkforceEvent(tx, context, event.id, effectiveAt), { isolationLevel: "Serializable" });
const replayWindow = await runUnit5OperationalWindow(effectiveAt);

const evidence = await prisma.hrWorkforceEvent.findUniqueOrThrow({
  where: { id: event.id },
  include: {
    executionAttempts: true,
    leaveAbsenceReturns: {
      include: {
        employee: { select: { id: true, employmentStatus: true } },
        requestVersion: { include: { transitions: { orderBy: { createdAt: "asc" } } } },
      },
    },
  },
});
const absence = evidence.leaveAbsenceReturns[0];
const audits = absence ? await prisma.hrAuditEvent.findMany({ where: { organizationId: event.organizationId, correlationId: absence.correlationId }, select: { id: true, entityType: true, entityId: true, action: true, correlationId: true }, orderBy: { createdAt: "asc" } }) : [];

console.log(JSON.stringify({
  environment: "staging",
  boundaryAt: effectiveAt.toISOString(),
  event: { id: evidence.id, reference: evidence.reference, status: evidence.status, type: evidence.type, attempts: evidence.executionAttempts.map(({ id, attemptNumber, status }) => ({ id, attemptNumber, status })) },
  absence: absence ? { id: absence.id, status: absence.status, employeeId: absence.employee.id, employeeStatus: absence.employee.employmentStatus, requestVersionId: absence.requestVersionId, transitions: absence.requestVersion.transitions.map(({ id, toStatus }) => ({ id, toStatus })) } : null,
  firstWindow: firstWindow.map(({ organizationId, jobType, status }) => ({ organizationId, jobType, status })),
  replayWindow: replayWindow.map(({ organizationId, jobType, status }) => ({ organizationId, jobType, status })),
  audits,
}, null, 2));

await prisma.$disconnect();
