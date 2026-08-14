import { Prisma, PrismaClient } from "@prisma/client";

const target = new URL(process.env.RESTORE_DATABASE_URL ?? "postgresql://missing/missing");
const database = target.pathname.slice(1);
if (process.env.APP_ENV !== "staging" || process.env.DR_RESTORE_CONFIRM !== "isolated-restore" || !/^zentric_unit8_restore(?:_|$)/.test(database)) {
  throw new Error("Refusing Unit 8 validation outside an explicitly confirmed isolated staging restore target.");
}

const prisma = new PrismaClient({ datasourceUrl: target.toString() });
const scalar = (rows) => Number(rows[0]?.count ?? 0);
const requireEvidence = (condition, message) => { if (!condition) throw new Error(message); };

try {
  const migrations = await prisma.$queryRaw`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY started_at`;
  const pending = await prisma.$queryRaw`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL`;
  requireEvidence(migrations.length === 51 && pending.length === 0, "The restored database must contain exactly 51 completed migrations with none pending.");

  const checks = {
    orphanCompensationRecords: scalar(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrCompensationRecord" r LEFT JOIN "HrEmployee" e ON e.id=r."employeeId" AND e."organizationId"=r."organizationId" LEFT JOIN "HrWorkRelationship" w ON w.id=r."workRelationshipId" AND w."organizationId"=r."organizationId" LEFT JOIN "HrEmployeeAssignment" a ON a.id=r."assignmentId" AND a."organizationId"=r."organizationId" LEFT JOIN "HrCompDecision" d ON d.id=r."decisionId" AND d."organizationId"=r."organizationId" LEFT JOIN "HrCompMarketVersion" m ON m.id=r."marketVersionId" AND m."organizationId"=r."organizationId" LEFT JOIN "HrCompBandVersion" b ON b.id=r."bandVersionId" AND b."organizationId"=r."organizationId" LEFT JOIN "HrCompPolicyVersion" p ON p.id=r."policyVersionId" AND p."organizationId"=r."organizationId" WHERE e.id IS NULL OR w.id IS NULL OR a.id IS NULL OR d.id IS NULL OR m.id IS NULL OR b.id IS NULL OR p.id IS NULL`),
    invalidCurrentRecordPointers: scalar(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrEmployeeCompensation" c LEFT JOIN "HrCompensationRecord" r ON r.id=c."currentRecordId" AND r."employeeCompensationId"=c.id AND r."organizationId"=c."organizationId" WHERE c."currentRecordId" IS NOT NULL AND r.id IS NULL`),
    authoritativeOverlaps: scalar(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrCompensationRecord" a JOIN "HrCompensationRecord" b ON a.id < b.id AND a."organizationId"=b."organizationId" AND a."employeeCompensationId"=b."employeeCompensationId" AND tsrange(a."effectiveFrom", COALESCE(a."effectiveTo", 'infinity'::timestamp), '[)') && tsrange(b."effectiveFrom", COALESCE(b."effectiveTo", 'infinity'::timestamp), '[)')`),
    orphanRecommendations: scalar(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrCompRecommendation" r LEFT JOIN "HrCompCyclePopulation" p ON p.id=r."cyclePopulationId" AND p."organizationId"=r."organizationId" LEFT JOIN "HrCompensationRecord" c ON c.id=r."currentRecordId" AND c."organizationId"=r."organizationId" LEFT JOIN "HrCompBandVersion" b ON b.id=r."bandVersionId" AND b."organizationId"=r."organizationId" LEFT JOIN "HrCompPolicyVersion" v ON v.id=r."policyVersionId" AND v."organizationId"=r."organizationId" WHERE p.id IS NULL OR c.id IS NULL OR b.id IS NULL OR v.id IS NULL`),
    orphanCalibrationOrExceptions: scalar(await prisma.$queryRaw`SELECT (SELECT COUNT(*) FROM "HrCompCalibrationDecision" c LEFT JOIN "HrCompRecommendation" r ON r.id=c."recommendationId" AND r."organizationId"=c."organizationId" WHERE r.id IS NULL)::int + (SELECT COUNT(*) FROM "HrCompException" e LEFT JOIN "HrCompRecommendation" r ON r.id=e."recommendationId" AND r."organizationId"=e."organizationId" WHERE r.id IS NULL)::int AS count`),
    orphanBudgetEntries: scalar(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrCompBudgetEntry" e LEFT JOIN "HrCompBudget" b ON b.id=e."budgetId" AND b."organizationId"=e."organizationId" LEFT JOIN "HrCompRecommendation" r ON r.id=e."recommendationId" AND r."organizationId"=e."organizationId" LEFT JOIN "HrCompDecision" d ON d.id=e."decisionId" AND d."organizationId"=e."organizationId" WHERE b.id IS NULL OR (e."recommendationId" IS NOT NULL AND r.id IS NULL) OR (e."decisionId" IS NOT NULL AND d.id IS NULL)`),
    duplicateRecommendationDecisions: scalar(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM (SELECT "recommendationId" FROM "HrCompDecision" WHERE "recommendationId" IS NOT NULL GROUP BY "recommendationId" HAVING COUNT(*) > 1) x`),
    brokenCorrectionLineage: scalar(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrCompensationRecord" r LEFT JOIN "HrCompensationRecord" old ON old.id=r."correctedRecordId" AND old."organizationId"=r."organizationId" LEFT JOIN "HrCompRetroactiveSignal" s ON s."newRecordId"=r.id AND s."organizationId"=r."organizationId" WHERE r."eventType"='CORRECTION' AND (r."correctedRecordId" IS NULL OR old.id IS NULL OR s.id IS NULL)`),
    orphanRewardsOrStatements: scalar(await prisma.$queryRaw`SELECT (SELECT COUNT(*) FROM "HrBonusAward" a LEFT JOIN "HrEmployee" e ON e.id=a."employeeId" AND e."organizationId"=a."organizationId" LEFT JOIN "HrWorkRelationship" w ON w.id=a."workRelationshipId" AND w."organizationId"=a."organizationId" LEFT JOIN "HrBonusProgramVersion" p ON p.id=a."programVersionId" AND p."organizationId"=a."organizationId" WHERE e.id IS NULL OR w.id IS NULL OR p.id IS NULL)::int + (SELECT COUNT(*) FROM "HrCompStatement" s LEFT JOIN "HrDocumentVersion" v ON v.id=s."documentVersionId" LEFT JOIN "HrCompDecision" d ON d.id=s."decisionId" AND d."organizationId"=s."organizationId" LEFT JOIN "HrBonusAward" a ON a.id=s."awardId" AND a."organizationId"=s."organizationId" WHERE v.id IS NULL OR (s."decisionId" IS NOT NULL AND d.id IS NULL) OR (s."awardId" IS NOT NULL AND a.id IS NULL))::int AS count`),
    orphanPayrollHandoffs: scalar(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrPayrollCompHandoff" h LEFT JOIN "HrEmployee" e ON e.id=h."employeeId" AND e."organizationId"=h."organizationId" LEFT JOIN "HrWorkRelationship" w ON w.id=h."workRelationshipId" AND w."organizationId"=h."organizationId" LEFT JOIN "HrEmployeeAssignment" a ON a.id=h."assignmentId" AND a."organizationId"=h."organizationId" LEFT JOIN "HrCompensationRecord" r ON r.id=h."compensationRecordId" AND r."organizationId"=h."organizationId" LEFT JOIN "HrBonusAward" b ON b.id=h."bonusAwardId" AND b."organizationId"=h."organizationId" LEFT JOIN "HrCompRetroactiveSignal" s ON s.id=h."retroactiveSignalId" AND s."organizationId"=h."organizationId" WHERE e.id IS NULL OR w.id IS NULL OR a.id IS NULL OR (h."compensationRecordId" IS NOT NULL AND r.id IS NULL) OR (h."bonusAwardId" IS NOT NULL AND b.id IS NULL) OR (h."retroactiveSignalId" IS NOT NULL AND s.id IS NULL)`),
    duplicatePayrollHandoffs: scalar(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM (SELECT "organizationId", "idempotencyKey" FROM "HrPayrollCompHandoff" GROUP BY "organizationId", "idempotencyKey" HAVING COUNT(*) > 1) x`),
    orphanPromotionInputs: scalar(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrCompCyclePopulation" p LEFT JOIN "HrPromotionDecision" d ON d.id=p."promotionDecisionId" WHERE p."promotionDecisionId" IS NOT NULL AND d.id IS NULL`),
    missingCompensationAudit: scalar(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrCompensationRecord" r LEFT JOIN "HrAuditEvent" a ON a."organizationId"=r."organizationId" AND (a."entityId"=r.id OR a."correlationId"=r."correlationId") WHERE r."idempotencyKey" LIKE 'unit8-%' AND a.id IS NULL`),
    privacyGrantViolations: scalar(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrRolePermission" rp JOIN "HrRole" r ON r.id=rp."roleId" JOIN "HrPermission" p ON p.id=rp."permissionId" WHERE (r.key='PAYROLL_READER' AND p.key <> 'compensation.payroll_handoff.read') OR (r.key='HR_ADMIN' AND p.key LIKE 'compensation.%') OR (r.key='COMPENSATION_ADMIN' AND p.key NOT LIKE 'compensation.%')`),
  };

  const budgets = await prisma.hrCompBudget.findMany();
  const entries = await prisma.hrCompBudgetEntry.findMany({ select: { budgetId: true, entryType: true, amount: true } });
  let invalidBudgetLedgers = 0;
  for (const budget of budgets) {
    let reserved = new Prisma.Decimal(0); let consumed = new Prisma.Decimal(0); let adjusted = new Prisma.Decimal(0);
    for (const entry of entries.filter(({ budgetId }) => budgetId === budget.id)) {
      if (["ALLOCATE", "ADJUST"].includes(entry.entryType)) adjusted = adjusted.plus(entry.amount);
      if (entry.entryType === "RESERVE") reserved = reserved.plus(entry.amount);
      if (entry.entryType === "RELEASE") reserved = reserved.minus(entry.amount);
      if (entry.entryType === "CONSUME") { reserved = reserved.minus(entry.amount); consumed = consumed.plus(entry.amount); }
    }
    if (reserved.isNegative() || budget.allocatedAmount.plus(adjusted).minus(reserved).minus(consumed).isNegative()) invalidBudgetLedgers += 1;
  }
  checks.invalidBudgetLedgers = invalidBudgetLedgers;
  const failures = Object.fromEntries(Object.entries(checks).filter(([, count]) => count !== 0));
  requireEvidence(Object.keys(failures).length === 0, `Unit 8 restore integrity failures: ${JSON.stringify(failures)}`);

  const counts = {
    markets: await prisma.hrCompMarket.count(), bands: await prisma.hrCompBandVersion.count(), policies: await prisma.hrCompPolicyVersion.count(),
    recommendations: await prisma.hrCompRecommendation.count(), calibrations: await prisma.hrCompCalibrationDecision.count(), exceptions: await prisma.hrCompException.count(),
    decisions: await prisma.hrCompDecision.count(), records: await prisma.hrCompensationRecord.count(), corrections: await prisma.hrCompRetroactiveSignal.count(),
    rewards: await prisma.hrBonusAward.count(), statements: await prisma.hrCompStatement.count(), payrollHandoffs: await prisma.hrPayrollCompHandoff.count(), audits: await prisma.hrAuditEvent.count(),
  };
  requireEvidence(counts.markets && counts.bands && counts.policies && counts.decisions && counts.records && counts.payrollHandoffs && counts.audits, "Representative Unit 8 lineage is incomplete.");
  console.log(JSON.stringify({ result: "PASS", database, migrations: migrations.length, pendingMigrations: pending.length, checks, budgetsInspected: budgets.length, counts }, null, 2));
} finally {
  await prisma.$disconnect();
}
