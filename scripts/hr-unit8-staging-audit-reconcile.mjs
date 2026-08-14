import { PrismaClient } from "@prisma/client";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
if (process.env.HR_UNIT8_STAGING_AUDIT_CONFIRM !== "staging-only" || databaseUrl.pathname.slice(1) !== "zentric_analytics_staging") {
  throw new Error("Refusing Unit 8 audit reconciliation outside the explicitly confirmed staging database.");
}

const prisma = new PrismaClient();
try {
  const records = await prisma.hrCompensationRecord.findMany({ where: { idempotencyKey: { startsWith: "unit8-validation-" } }, orderBy: { createdAt: "asc" } });
  let appended = 0;
  for (const record of records) {
    const existing = await prisma.hrAuditEvent.findFirst({ where: { organizationId: record.organizationId, entityType: "HrCompensationRecord", entityId: record.id } });
    if (existing) continue;
    const decision = await prisma.hrCompDecision.findUniqueOrThrow({ where: { id: record.decisionId }, select: { approverUserIds: true } });
    const actorUserId = decision.approverUserIds[0] ?? (await prisma.hrUser.findFirstOrThrow({ where: { organizationId: record.organizationId, status: "ACTIVE" }, select: { id: true } })).id;
    await prisma.hrAuditEvent.create({ data: { organizationId: record.organizationId, actorUserId, actorRole: "COMPENSATION_ADMIN", entityType: "HrCompensationRecord", entityId: record.id, action: "hr.compensation.record.audit_reconciled", reason: "Append-only Unit 8 staging audit reconciliation; authoritative compensation was not modified", newValues: { decisionId: record.decisionId, eventType: record.eventType, effectiveFrom: record.effectiveFrom, contentHash: record.contentHash }, correlationId: record.correlationId } });
    appended += 1;
  }
  const missing = await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrCompensationRecord" r LEFT JOIN "HrAuditEvent" a ON a."organizationId"=r."organizationId" AND a."entityType"='HrCompensationRecord' AND a."entityId"=r.id WHERE r."idempotencyKey" LIKE 'unit8-validation-%' AND a.id IS NULL`;
  if (missing[0].count !== 0) throw new Error("Unit 8 audit reconciliation remains incomplete.");
  console.log(JSON.stringify({ result: "PASS", database: databaseUrl.pathname.slice(1), inspected: records.length, appended, missing: 0 }));
} finally {
  await prisma.$disconnect();
}
