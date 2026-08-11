import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
if (process.env.HR_UNIT6_STAGING_CONCURRENCY_CONFIRM !== "staging-only" || databaseUrl.pathname.slice(1) !== "zentric_analytics_staging") {
  throw new Error("Refusing Unit 6 concurrency validation: explicit staging confirmation and zentric_analytics_staging are required.");
}

const prisma = new PrismaClient();
const run = `unit6-concurrency-${Date.now()}`;
const now = new Date();
const businessDate = new Date(Date.UTC(2095, 0, 1) + (Date.now() % (300 * 86_400_000)));

try {
  const organization = await prisma.hrOrganization.findFirstOrThrow({ select: { id: true } });
  const assignment = await prisma.hrEmployeeAssignment.findFirstOrThrow({
    where: { organizationId: organization.id, status: "ACTIVE" },
    select: { id: true, employeeId: true, createdById: true },
  });
  const relationship = await prisma.hrWorkRelationship.findFirstOrThrow({
    where: { organizationId: organization.id, employeeId: assignment.employeeId, status: "ACTIVE" },
    select: { id: true },
  });

  const policy = await prisma.hrTimePolicy.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "UNIT6_CONCURRENCY" } },
    update: { status: "ACTIVE" },
    create: { organizationId: organization.id, code: "UNIT6_CONCURRENCY", name: "Unit 6 Concurrency Fixture" },
  });
  const policyVersion = await prisma.hrTimePolicyVersion.upsert({
    where: { timePolicyId_version: { timePolicyId: policy.id, version: 1 } },
    update: {},
    create: { timePolicyId: policy.id, version: 1, trackingMode: "CLOCK", timezone: "UTC", effectiveFrom: new Date("2090-01-01T00:00:00.000Z"), publishedAt: now, createdById: assignment.createdById },
  });

  const eventInput = {
    organizationId: organization.id, employeeId: assignment.employeeId, workRelationshipId: relationship.id,
    assignmentId: assignment.id, eventType: "CLOCK_IN", source: "WEB", occurredAt: now, receivedAt: now,
    timezone: "UTC", localDate: businessDate, localTime: "09:00", utcOffsetMinutes: 0,
    idempotencyKey: `${run}:event`, payloadHash: crypto.createHash("sha256").update(run).digest("hex"),
    authoritative: true, actorUserId: assignment.createdById, correlationId: run,
  };
  const duplicateEventAttempts = await Promise.allSettled([
    prisma.hrTimeEvent.create({ data: eventInput }), prisma.hrTimeEvent.create({ data: eventInput }),
  ]);
  const eventCount = await prisma.hrTimeEvent.count({ where: { organizationId: organization.id, idempotencyKey: eventInput.idempotencyKey } });
  if (duplicateEventAttempts.filter(({ status }) => status === "fulfilled").length !== 1 || eventCount !== 1) throw new Error("Time-event idempotency did not produce exactly one durable event.");
  const openedByEvent = await prisma.hrTimeEvent.findUniqueOrThrow({ where: { organizationId_idempotencyKey: { organizationId: organization.id, idempotencyKey: eventInput.idempotencyKey } } });

  const sessionData = { organizationId: organization.id, employeeId: assignment.employeeId, workRelationshipId: relationship.id, assignmentId: assignment.id, timePolicyVersionId: policyVersion.id, businessDate, openedByEventId: openedByEvent.id, status: "CLOCKED_IN", startedAt: now, correlationId: run };
  const openSessionAttempts = await Promise.allSettled([
    prisma.hrClockSession.create({ data: sessionData }), prisma.hrClockSession.create({ data: { ...sessionData, openedByEventId: `${openedByEvent.id}-duplicate` } }),
  ]);
  const openSessionCount = await prisma.hrClockSession.count({ where: { organizationId: organization.id, assignmentId: assignment.id, status: { in: ["CLOCKED_IN", "ON_BREAK"] } } });
  if (openSessionAttempts.filter(({ status }) => status === "fulfilled").length !== 1 || openSessionCount !== 1) throw new Error("Open-session uniqueness did not produce exactly one active session.");

  const correction = await prisma.hrTimeCorrection.create({ data: { organizationId: organization.id, employeeId: assignment.employeeId, sourceEventId: openedByEvent.id, status: "SUBMITTED", requestedChanges: { localTime: "09:05" }, reason: run, requestedById: assignment.createdById, correlationId: `${run}:correction` } });
  const correctionClaims = await Promise.all([
    prisma.hrTimeCorrection.updateMany({ where: { id: correction.id, version: 1, status: "SUBMITTED" }, data: { status: "APPROVED", version: { increment: 1 }, reviewedById: assignment.createdById, reviewedAt: now } }),
    prisma.hrTimeCorrection.updateMany({ where: { id: correction.id, version: 1, status: "SUBMITTED" }, data: { status: "REJECTED", version: { increment: 1 }, reviewedById: assignment.createdById, reviewedAt: now } }),
  ]);
  if (correctionClaims.reduce((sum, { count }) => sum + count, 0) !== 1) throw new Error("Correction decision race did not produce one winner and one stale loser.");

  const period = await prisma.hrAttendancePeriod.create({ data: { organizationId: organization.id, timezone: "UTC", startsOn: businessDate, endsOn: new Date(businessDate.getTime() + 7 * 86_400_000), status: "APPROVED", correlationId: `${run}:period` } });
  const lockClaims = await Promise.all([
    prisma.hrAttendancePeriod.updateMany({ where: { id: period.id, status: "APPROVED", version: 1 }, data: { status: "LOCKED", version: { increment: 1 }, lockedAt: now, lockedById: assignment.createdById, lockHash: crypto.createHash("sha256").update(`${run}:a`).digest("hex") } }),
    prisma.hrAttendancePeriod.updateMany({ where: { id: period.id, status: "APPROVED", version: 1 }, data: { status: "LOCKED", version: { increment: 1 }, lockedAt: now, lockedById: assignment.createdById, lockHash: crypto.createHash("sha256").update(`${run}:b`).digest("hex") } }),
  ]);
  if (lockClaims.reduce((sum, { count }) => sum + count, 0) !== 1) throw new Error("Attendance-period lock race did not produce one winner and one stale loser.");

  const worker = await prisma.hrTimeWorkerRun.create({ data: { organizationId: organization.id, jobType: "UNIT6_CONCURRENCY", windowKey: run, correlationId: `${run}:worker` } });
  const leaseToken = crypto.randomUUID();
  const workerClaims = await Promise.all([
    prisma.hrTimeWorkerRun.updateMany({ where: { id: worker.id, status: "PENDING" }, data: { status: "RUNNING", leaseToken, leaseExpiresAt: new Date(now.getTime() + 300_000), attemptCount: { increment: 1 } } }),
    prisma.hrTimeWorkerRun.updateMany({ where: { id: worker.id, status: "PENDING" }, data: { status: "RUNNING", leaseToken: crypto.randomUUID(), leaseExpiresAt: new Date(now.getTime() + 300_000), attemptCount: { increment: 1 } } }),
  ]);
  const workerAfter = await prisma.hrTimeWorkerRun.findUniqueOrThrow({ where: { id: worker.id } });
  if (workerClaims.reduce((sum, { count }) => sum + count, 0) !== 1 || workerAfter.attemptCount !== 1) throw new Error("Worker lease race did not produce exactly one claim.");

  console.log(JSON.stringify({ run, database: databaseUrl.pathname.slice(1), organizationId: organization.id, assignmentId: assignment.id, results: { duplicateEvent: { attempts: 2, durable: eventCount, winnerCount: 1 }, openSession: { attempts: 2, durableOpenSessions: openSessionCount, winnerCount: 1 }, correctionDecision: { claims: correctionClaims.map(({ count }) => count) }, periodLock: { claims: lockClaims.map(({ count }) => count) }, workerLease: { claims: workerClaims.map(({ count }) => count), attemptCount: workerAfter.attemptCount } }, result: "PASS" }, null, 2));
} finally {
  await prisma.$disconnect();
}
