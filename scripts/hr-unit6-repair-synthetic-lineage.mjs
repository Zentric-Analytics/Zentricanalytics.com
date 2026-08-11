import { PrismaClient } from "@prisma/client";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
if (process.env.HR_UNIT6_REPAIR_CONFIRM !== "staging-synthetic-only" || databaseUrl.pathname.slice(1) !== "zentric_analytics_staging") {
  throw new Error("Refusing Unit 6 lineage repair outside the explicitly confirmed staging database.");
}

const prisma = new PrismaClient();
let repaired = 0;
try {
  const sessions = await prisma.hrClockSession.findMany({ where: { correlationId: { startsWith: "unit6-concurrency-" }, openedByEventId: { endsWith: "-duplicate" } } });
  for (const session of sessions) {
    const opening = await prisma.hrTimeEvent.findFirstOrThrow({ where: { organizationId: session.organizationId, correlationId: session.correlationId, assignmentId: session.assignmentId, eventType: "CLOCK_IN" }, orderBy: { createdAt: "asc" } });
    await prisma.$transaction(async (tx) => {
      await tx.hrClockSession.update({ where: { id: session.id }, data: { openedByEventId: opening.id } });
      await tx.hrAuditEvent.create({ data: { organizationId: session.organizationId, actorUserId: opening.actorUserId, actorRole: "SYSTEM", entityType: "HrClockSession", entityId: session.id, action: "hr.time.synthetic_lineage.repaired", previousValues: { openedByEventId: session.openedByEventId }, newValues: { openedByEventId: opening.id }, reason: "Repair legacy Unit 6 concurrency fixture lineage; no employee time values changed.", correlationId: session.correlationId } });
    });
    repaired += 1;
  }
  console.log(JSON.stringify({ database: databaseUrl.pathname.slice(1), repaired, result: "PASS" }));
} finally {
  await prisma.$disconnect();
}
