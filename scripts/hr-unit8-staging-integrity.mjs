import { Prisma, PrismaClient } from "@prisma/client";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
if (process.env.HR_UNIT8_STAGING_INTEGRITY_CONFIRM !== "staging-only" || databaseUrl.pathname.slice(1) !== "zentric_analytics_staging") {
  throw new Error("Refusing Unit 8 integrity validation outside the explicitly confirmed staging database.");
}

const prisma = new PrismaClient();
const scalar = (rows) => Number(rows[0]?.count ?? 0);

try {
  const checks = {
    orphanCompensationRecords: scalar(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrCompensationRecord" r LEFT JOIN "HrEmployee" e ON e.id=r."employeeId" AND e."organizationId"=r."organizationId" LEFT JOIN "HrWorkRelationship" w ON w.id=r."workRelationshipId" AND w."organizationId"=r."organizationId" LEFT JOIN "HrEmployeeAssignment" a ON a.id=r."assignmentId" AND a."organizationId"=r."organizationId" LEFT JOIN "HrCompDecision" d ON d.id=r."decisionId" AND d."organizationId"=r."organizationId" LEFT JOIN "HrCompBandVersion" b ON b.id=r."bandVersionId" AND b."organizationId"=r."organizationId" LEFT JOIN "HrCompPolicyVersion" p ON p.id=r."policyVersionId" AND p."organizationId"=r."organizationId" WHERE e.id IS NULL OR w.id IS NULL OR a.id IS NULL OR d.id IS NULL OR b.id IS NULL OR p.id IS NULL`),
    invalidCurrentRecordPointers: scalar(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrEmployeeCompensation" c LEFT JOIN "HrCompensationRecord" r ON r.id=c."currentRecordId" AND r."employeeCompensationId"=c.id AND r."organizationId"=c."organizationId" WHERE c."currentRecordId" IS NOT NULL AND r.id IS NULL`),
    authoritativeOverlaps: scalar(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrCompensationRecord" a JOIN "HrCompensationRecord" b ON a.id < b.id AND a."organizationId"=b."organizationId" AND a."employeeCompensationId"=b."employeeCompensationId" AND tsrange(a."effectiveFrom", COALESCE(a."effectiveTo", 'infinity'::timestamp), '[)') && tsrange(b."effectiveFrom", COALESCE(b."effectiveTo", 'infinity'::timestamp), '[)')`),
    brokenCorrectionLineage: scalar(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrCompensationRecord" r LEFT JOIN "HrCompensationRecord" old ON old.id=r."correctedRecordId" AND old."organizationId"=r."organizationId" LEFT JOIN "HrCompRetroactiveSignal" s ON s."newRecordId"=r.id AND s."organizationId"=r."organizationId" WHERE r."eventType"='CORRECTION' AND (r."correctedRecordId" IS NULL OR old.id IS NULL OR s.id IS NULL)`),
    orphanPayrollHandoffs: scalar(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrPayrollCompHandoff" h LEFT JOIN "HrCompensationRecord" r ON r.id=h."compensationRecordId" AND r."organizationId"=h."organizationId" LEFT JOIN "HrBonusAward" a ON a.id=h."bonusAwardId" AND a."organizationId"=h."organizationId" LEFT JOIN "HrCompRetroactiveSignal" s ON s.id=h."retroactiveSignalId" AND s."organizationId"=h."organizationId" WHERE (h."compensationRecordId" IS NOT NULL AND r.id IS NULL) OR (h."bonusAwardId" IS NOT NULL AND a.id IS NULL) OR (h."retroactiveSignalId" IS NOT NULL AND s.id IS NULL) OR (h."compensationRecordId" IS NULL AND h."bonusAwardId" IS NULL AND h."retroactiveSignalId" IS NULL)`),
    duplicateRecommendationDecisions: scalar(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM (SELECT "recommendationId" FROM "HrCompDecision" WHERE "recommendationId" IS NOT NULL GROUP BY "recommendationId" HAVING COUNT(*) > 1) x`),
    duplicatePayrollHandoffs: scalar(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM (SELECT "organizationId", "idempotencyKey" FROM "HrPayrollCompHandoff" GROUP BY "organizationId", "idempotencyKey" HAVING COUNT(*) > 1) x`),
    missingFixtureRecordAudit: scalar(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrCompensationRecord" r LEFT JOIN "HrAuditEvent" a ON a."organizationId"=r."organizationId" AND a."entityId"=r.id WHERE r."idempotencyKey" LIKE 'unit8-validation-%' AND a.id IS NULL`),
    failedCompensationOutbox: await prisma.hrEmailOutbox.count({ where: { template: { startsWith: "hr-compensation" }, status: { in: ["FAILED", "ABANDONED"] } } }),
  };

  const budgets = await prisma.hrCompBudget.findMany();
  const allEntries = await prisma.hrCompBudgetEntry.findMany({ select: { budgetId: true, entryType: true, amount: true } });
  let invalidBudgets = 0;
  for (const budget of budgets) {
    let reserved = new Prisma.Decimal(0); let consumed = new Prisma.Decimal(0); let adjusted = new Prisma.Decimal(0);
    for (const entry of allEntries.filter(({ budgetId }) => budgetId === budget.id)) {
      if (["ALLOCATE", "ADJUST"].includes(entry.entryType)) adjusted = adjusted.plus(entry.amount);
      if (entry.entryType === "RESERVE") reserved = reserved.plus(entry.amount);
      if (entry.entryType === "RELEASE") reserved = reserved.minus(entry.amount);
      if (entry.entryType === "CONSUME") { reserved = reserved.minus(entry.amount); consumed = consumed.plus(entry.amount); }
    }
    if (reserved.isNegative() || budget.allocatedAmount.plus(adjusted).minus(reserved).minus(consumed).isNegative()) invalidBudgets += 1;
  }
  checks.invalidBudgetLedgers = invalidBudgets;

  const failures = Object.entries(checks).filter(([, count]) => count !== 0);
  if (failures.length) throw new Error(`Unit 8 integrity failures: ${JSON.stringify(Object.fromEntries(failures))}`);
  console.log(JSON.stringify({ result: "PASS", database: databaseUrl.pathname.slice(1), checks, budgetsInspected: budgets.length }, null, 2));
} finally {
  await prisma.$disconnect();
}
