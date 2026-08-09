import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
const baseUrl = process.env.HR_INTERNAL_BASE_URL ?? "http://127.0.0.1:10000";
const workerSecret = process.env.ORGANIZATION_WORKER_SECRET;
if (process.env.HR_UNIT4_STAGING_CONCURRENCY_CONFIRM !== "staging-only" || databaseUrl.pathname.slice(1) !== "zentric_analytics_staging") {
  throw new Error("Refusing Unit 4 concurrency validation: explicit staging confirmation and zentric_analytics_staging are required.");
}
if (!workerSecret || workerSecret.length < 64) throw new Error("A valid staging worker secret is required.");

const prisma = new PrismaClient();
const run = `unit4-concurrency-${Date.now()}`;
const now = new Date();
const headers = { authorization: `Bearer ${workerSecret}` };

async function invokeWorker() {
  const response = await fetch(`${baseUrl}/api/internal/hr/workforce-events`, { method: "POST", headers });
  if (!response.ok) throw new Error(`Workforce worker returned ${response.status}.`);
  return response.json();
}

try {
  const organization = await prisma.hrOrganization.findFirstOrThrow({ select: { id: true } });
  const actors = await prisma.hrUser.findMany({ where: { organizationId: organization.id, status: "ACTIVE" }, select: { id: true }, take: 2 });
  if (actors.length < 2) throw new Error("Two active staging actors are required for independent evidence.");
  const [initiator, approver] = actors;
  const template = await prisma.hrLifecycleTemplate.findFirstOrThrow({
    where: { organizationId: organization.id, type: "OFFBOARDING", active: true },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
  });
  const position = await prisma.hrPosition.findFirstOrThrow({
    where: { organizationId: organization.id, status: "ACTIVE", lifecycleStatus: { in: ["OPEN", "PARTIALLY_FILLED"] } },
    include: { department: true },
  });

  async function createWorkerFixture(tx, label, workMode) {
    const person = await tx.hrPerson.create({ data: { organizationId: organization.id, identityKeyHash: crypto.createHash("sha256").update(`${run}:${label}`).digest("hex") } });
    const employee = await tx.hrEmployee.create({ data: {
      organizationId: organization.id, personId: person.id, employeeNumber: `U4-${Date.now()}-${label}`,
      legalFirstName: "UnitFour", lastName: label, employmentStatus: "ACTIVE", startDate: now, workMode,
    } });
    const relationship = await tx.hrWorkRelationship.create({ data: {
      organizationId: organization.id, personId: person.id, employeeId: employee.id,
      relationshipRef: `WR-U4-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, status: "ACTIVE", startedAt: now,
    } });
    const assignment = await tx.hrEmployeeAssignment.create({ data: {
      organizationId: organization.id, employeeId: employee.id, departmentId: position.departmentId,
      teamId: position.teamId, positionId: position.id, employmentType: "FULL_TIME", effectiveFrom: now,
      status: "ACTIVE", reason: `${run} isolated concurrency fixture`, createdById: initiator.id,
      legalEntityId: position.legalEntityId, isPrimary: true,
    } });
    return { employee, relationship, assignment };
  }

  const { eventFixture, event, separationFixture, lifecycle, separation } = await prisma.$transaction(async (tx) => {
    const eventFixture = await createWorkerFixture(tx, "EventRace", "ONSITE");
    const event = await tx.hrWorkforceEvent.create({ data: {
      organizationId: organization.id, employeeId: eventFixture.employee.id, workRelationshipId: eventFixture.relationship.id,
      reference: `WFE-U4-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, type: "WORK_ARRANGEMENT_CHANGE", status: "APPROVED",
      reason: `${run} exactly-once workforce event`, currentSnapshot: { workMode: "ONSITE" }, proposedSnapshot: { workMode: "REMOTE" },
      requestedEffectiveAt: now, initiatedById: initiator.id, idempotencyKey: `${run}:event`, correlationId: `${run}:event`,
    } });

    const separationFixture = await createWorkerFixture(tx, "SeparationRace", "HYBRID");
    const lifecycle = await tx.hrLifecycleInstance.create({ data: {
      organizationId: organization.id, templateId: template.id, employeeId: separationFixture.employee.id,
      type: "OFFBOARDING", status: "COMPLETED", effectiveDate: now, reason: `${run} exactly-once separation`,
      payrollStopDate: now, finalPayrollRequired: true, leaveReconciliation: "Concurrency fixture reconciled",
      startedAt: now, completedAt: now, finalCommunicationSentAt: now, createdById: initiator.id,
      tasks: { create: template.tasks.map((task) => ({
        organizationId: organization.id, templateTaskKey: task.key, title: task.title, description: task.description,
        ownerType: task.ownerType, dueAt: now, required: task.required, status: "COMPLETED", instructions: task.instructions,
        predecessorKeys: task.predecessorKeys, completionNotes: `${run} completed prerequisite`, completedAt: now, completedById: initiator.id,
      })) },
    } });
    const separation = await tx.hrSeparationCase.create({ data: {
      organizationId: organization.id, employeeId: separationFixture.employee.id, workRelationshipId: separationFixture.relationship.id,
      type: "OTHER", status: "SCHEDULED", reason: `${run} exactly-once separation`, initiatedById: initiator.id,
      noticeDate: now, finalWorkingDate: now, approvedById: approver.id, approvedAt: now, correlationId: `${run}:separation`,
    } });
    return { eventFixture, event, separationFixture, lifecycle, separation };
  }, { isolationLevel: "Serializable" });

  const responses = await Promise.all([invokeWorker(), invokeWorker()]);
  await invokeWorker();

  const [eventAfter, eventAttempts, eventAudits, separationAfter, separationAudits, separationHistory, lifecycleAfter] = await Promise.all([
    prisma.hrWorkforceEvent.findUniqueOrThrow({ where: { id: event.id } }),
    prisma.hrWorkforceEventExecutionAttempt.count({ where: { eventId: event.id, status: "COMPLETED" } }),
    prisma.hrAuditEvent.count({ where: { correlationId: `${run}:event`, action: "hr.workforce_event.applied" } }),
    prisma.hrSeparationCase.findUniqueOrThrow({ where: { id: separation.id } }),
    prisma.hrAuditEvent.count({ where: { correlationId: `${run}:separation`, action: "hr.separation.applied" } }),
    prisma.hrEmployeeStatusHistory.count({ where: { employeeId: separationFixture.employee.id, newStatus: "TERMINATED" } }),
    prisma.hrLifecycleInstance.findUniqueOrThrow({ where: { id: lifecycle.id } }),
  ]);
  const [eventEmployee, separationEmployee, separationRelationship, activeAssignments, endedAssignments] = await Promise.all([
    prisma.hrEmployee.findUniqueOrThrow({ where: { id: eventFixture.employee.id } }),
    prisma.hrEmployee.findUniqueOrThrow({ where: { id: separationFixture.employee.id } }),
    prisma.hrWorkRelationship.findUniqueOrThrow({ where: { id: separationFixture.relationship.id } }),
    prisma.hrEmployeeAssignment.count({ where: { employeeId: separationFixture.employee.id, status: "ACTIVE" } }),
    prisma.hrEmployeeAssignment.count({ where: { employeeId: separationFixture.employee.id, status: "ENDED" } }),
  ]);

  const evidence = {
    run, database: databaseUrl.pathname.slice(1), responses,
    workforceEvent: { status: eventAfter.status, completedAttempts: eventAttempts, audits: eventAudits, workMode: eventEmployee.workMode },
    separation: {
      status: separationAfter.status, audits: separationAudits, statusHistory: separationHistory,
      employeeStatus: separationEmployee.employmentStatus, relationshipStatus: separationRelationship.status,
      activeAssignments, endedAssignments, companyEmailDisabledAt: lifecycleAfter.companyEmailDisabledAt?.toISOString() ?? null,
    },
  };
  if (eventAfter.status !== "APPLIED" || eventAttempts !== 1 || eventAudits !== 1 || eventEmployee.workMode !== "REMOTE") throw new Error("Workforce event did not apply exactly once.");
  if (separationAfter.status !== "APPLIED" || separationAudits !== 1 || separationHistory !== 1 || separationEmployee.employmentStatus !== "TERMINATED" || separationRelationship.status !== "ENDED" || activeAssignments !== 0 || endedAssignments !== 1 || !lifecycleAfter.companyEmailDisabledAt) throw new Error("Separation did not apply exactly once.");
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await prisma.$disconnect();
}
