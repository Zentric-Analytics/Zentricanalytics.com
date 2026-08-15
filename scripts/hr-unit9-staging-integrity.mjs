import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
if (process.env.HR_UNIT9_STAGING_INTEGRITY_CONFIRM !== "staging-only" || databaseUrl.pathname.slice(1) !== "zentric_analytics_staging") throw new Error("Refusing Unit 9 integrity validation outside the explicitly confirmed staging database.");
const prisma = new PrismaClient();
const count = (rows) => Number(rows[0]?.count ?? 0);
const expectedMigrationCount = fs.readdirSync(new URL("../prisma/migrations", import.meta.url), { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;

try {
  const checks = {
    migrationCount: count(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`),
    failedMigrations: count(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL`),
    orphanRuns: count(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrPayrollAuthoritativeRun" r LEFT JOIN "HrPayrollPayGroup" g ON g.id=r."payGroupId" AND g."organizationId"=r."organizationId" LEFT JOIN "HrPayrollCalendarPeriod" p ON p.id=r."calendarPeriodId" AND p."organizationId"=r."organizationId" LEFT JOIN "HrPayrollJurisdictionVersion" j ON j.id=r."jurisdictionVersionId" AND j."organizationId"=r."organizationId" WHERE g.id IS NULL OR p.id IS NULL OR j.id IS NULL`),
    orphanSnapshots: count(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrPayrollInputSnapshot" s LEFT JOIN "HrPayrollAuthoritativeRun" r ON r.id=s."payrollRunId" AND r."organizationId"=s."organizationId" LEFT JOIN "HrEmployee" e ON e.id=s."employeeId" AND e."organizationId"=s."organizationId" LEFT JOIN "HrPerson" p ON p.id=s."personId" AND p."organizationId"=s."organizationId" LEFT JOIN "HrWorkRelationship" w ON w.id=s."workRelationshipId" AND w."organizationId"=s."organizationId" LEFT JOIN "HrEmployeeAssignment" a ON a.id=s."assignmentId" AND a."organizationId"=s."organizationId" WHERE r.id IS NULL OR e.id IS NULL OR p.id IS NULL OR w.id IS NULL OR a.id IS NULL`),
    orphanResults: count(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrPayrollAuthoritativeResult" x LEFT JOIN "HrPayrollAuthoritativeRun" r ON r.id=x."payrollRunId" AND r."organizationId"=x."organizationId" LEFT JOIN "HrPayrollCalculationAttempt" a ON a.id=x."calculationAttemptId" AND a."payrollRunId"=x."payrollRunId" LEFT JOIN "HrPayrollInputSnapshot" s ON s.id=x."inputSnapshotId" AND s."employeeId"=x."employeeId" WHERE r.id IS NULL OR a.id IS NULL OR s.id IS NULL`),
    duplicateSelectedResults: count(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM (SELECT "payrollRunId","employeeId" FROM "HrPayrollAuthoritativeResult" WHERE "authoritativeAt" IS NOT NULL GROUP BY 1,2 HAVING COUNT(*)>1) q`),
    duplicateAttempts: count(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM (SELECT "payrollRunId","attemptNumber" FROM "HrPayrollCalculationAttempt" GROUP BY 1,2 HAVING COUNT(*)>1) q`),
    brokenGrossToNet: count(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrPayrollAuthoritativeResult" WHERE ROUND(("grossEarnings" + "adjustments" - "paye" - "employeeDeductions")::numeric,4) <> ROUND("netPay"::numeric,4)`),
    employerContributionDeductedFromNet: count(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrPayrollAuthoritativeResult" WHERE ROUND(("grossEarnings" + "adjustments" - "paye" - "employeeDeductions" - "employerContributions")::numeric,4) = ROUND("netPay"::numeric,4) AND "employerContributions" <> 0`),
    makerCheckerViolations: count(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrPayrollRunApproval" a JOIN "HrPayrollAuthoritativeRun" r ON r.id=a."payrollRunId" WHERE a."actorUserId" IN (r."createdById",r."calculatedById",r."reconciledById")`),
    uncertifiedFinalizations: count(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrPayrollAuthoritativeRun" r JOIN "HrPayrollJurisdictionVersion" j ON j.id=r."jurisdictionVersionId" WHERE r.status='FINALIZED' AND j.status NOT IN ('CERTIFIED','ACTIVE')`),
    unbalancedJournals: count(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrPayrollJournalBatch" WHERE ROUND("totalDebit"::numeric,4)<>ROUND("totalCredit"::numeric,4)`),
    payslipsWithoutFinalizedResult: count(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrPayrollPayslipVersion" p LEFT JOIN "HrPayrollAuthoritativeResult" r ON r.id=p."payrollResultId" AND r."organizationId"=p."organizationId" WHERE r.id IS NULL OR r."finalizedAt" IS NULL`),
    instructionsWithoutVerifiedDestination: count(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "HrPayrollPaymentInstruction" i LEFT JOIN "HrPayrollPaymentDestinationVersion" d ON d.id=i."destinationVersionId" AND d."organizationId"=i."organizationId" WHERE d.id IS NULL OR d."verificationStatus"<>'VERIFIED'`),
    duplicatePaymentInstructions: count(await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM (SELECT "organizationId","logicalKey" FROM "HrPayrollPaymentInstruction" GROUP BY 1,2 HAVING COUNT(*)>1) q`),
  };
  if (checks.migrationCount !== expectedMigrationCount) throw new Error(`Expected ${expectedMigrationCount} applied migrations from the exact candidate, found ${checks.migrationCount}.`);
  const failures = Object.entries(checks).filter(([key, value]) => key !== "migrationCount" && value !== 0);
  if (failures.length) throw new Error(`Unit 9 integrity failures: ${JSON.stringify(Object.fromEntries(failures))}`);
  console.log(JSON.stringify({ result: "PASS", database: databaseUrl.pathname.slice(1), checks, populations: { runs: await prisma.hrPayrollAuthoritativeRun.count(), results: await prisma.hrPayrollAuthoritativeResult.count(), attempts: await prisma.hrPayrollCalculationAttempt.count(), destinations: await prisma.hrPayrollPaymentDestinationVersion.count() } }, null, 2));
} finally {
  await prisma.$disconnect();
}
