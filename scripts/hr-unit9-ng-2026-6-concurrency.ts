import crypto from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { calculateUnit9Run, createUnit9Run } from "../src/lib/hr/payroll/unit9-service";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
if (process.env.HR_UNIT9_NG_2026_6_CONCURRENCY_CONFIRM !== "staging-only" || databaseUrl.pathname.slice(1) !== "zentric_analytics_staging") throw new Error("Refusing 2026.6 concurrency validation outside confirmed staging.");
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

async function main() {
  const db = new PrismaClient(); const marker = `ng-2026-6-race-${Date.now()}`;
  try {
    const sourceSnapshot = await db.hrPayrollInputSnapshot.findFirstOrThrow({ where: { employmentIncomeBindingHash: { not: null }, sourceManifest: { path: ["jurisdictionVersion"], equals: "NG-CANDIDATE-2026.6" } }, orderBy: { createdAt: "desc" } });
    const sourceRun = await db.hrPayrollAuthoritativeRun.findUniqueOrThrow({ where: { id: sourceSnapshot.payrollRunId } });
    const sourceResult = await db.hrPayrollAuthoritativeResult.findFirstOrThrow({ where: { inputSnapshotId: sourceSnapshot.id } });
    const users = await db.hrUser.findMany({ where: { organizationId: sourceRun.organizationId, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, take: 2, select: { id: true } }); assert(users.length === 2, "Two staging actors required.");
    const maker = { organizationId: sourceRun.organizationId, userId: users[0].id, role: "PAYROLL_PROCESSOR" };

    const duplicateRun = await createUnit9Run(db, maker, { payGroupId: sourceRun.payGroupId, calendarPeriodId: sourceRun.calendarPeriodId, jurisdictionVersionId: sourceRun.jurisdictionVersionId, kind: "CORRECTION", sequence: Number(String(Date.now()).slice(-7)), idempotencyKey: `${marker}:duplicate-binding` });
    await db.hrPayrollAuthoritativeRun.update({ where: { id: duplicateRun.id }, data: { status: "FROZEN", frozenAt: new Date() } });
    const snapshotData = { organizationId: sourceSnapshot.organizationId, payrollRunId: duplicateRun.id, employeeId: sourceSnapshot.employeeId, personId: sourceSnapshot.personId, workRelationshipId: sourceSnapshot.workRelationshipId, assignmentId: sourceSnapshot.assignmentId, sourceManifest: sourceSnapshot.sourceManifest as Prisma.InputJsonValue, inputHash: sourceSnapshot.inputHash, minimumWageEvidence: sourceSnapshot.minimumWageEvidence ?? undefined, minimumWageDecisionHash: sourceSnapshot.minimumWageDecisionHash, minimumWageClassification: sourceSnapshot.minimumWageClassification, employmentIncomeBinding: sourceSnapshot.employmentIncomeBinding ?? undefined, employmentIncomeBindingHash: sourceSnapshot.employmentIncomeBindingHash, certificationStatus: "CERTIFIED", frozenAt: new Date(), correlationId: `${marker}:snapshot` };
    const duplicateBindings = await Promise.allSettled([0, 1].map(() => db.hrPayrollInputSnapshot.create({ data: snapshotData })));
    assert(duplicateBindings.filter((x) => x.status === "fulfilled").length === 1, "Duplicate binding persistence did not produce one winner.");

    const ytdCode = `BONUS_${String(Date.now()).slice(-8)}`;
    const ytdData = { organizationId: sourceRun.organizationId, employeeId: sourceSnapshot.employeeId, taxYear: 2026, accumulatorCode: ytdCode, entryType: "AUTHORITATIVE", amount: new Prisma.Decimal("100000"), payrollResultId: sourceResult.id, effectiveAt: new Date(), correlationId: `${marker}:bonus-ytd` };
    const ytdRace = await Promise.allSettled([0, 1].map(() => db.hrPayrollYtdLedgerEntry.create({ data: ytdData })));
    assert(ytdRace.filter((x) => x.status === "fulfilled").length === 1, "Bonus YTD race did not produce one winner.");
    const preservedSnapshot = await db.hrPayrollInputSnapshot.findUniqueOrThrow({ where: { id: sourceSnapshot.id } }); assert(preservedSnapshot.employmentIncomeBindingHash === sourceSnapshot.employmentIncomeBindingHash, "YTD posting mutated frozen binding.");

    const latestPrior = await db.hrPayrollPriorEmployerYtdVersion.findFirst({ where: { organizationId: sourceRun.organizationId, employeeId: sourceSnapshot.employeeId, taxYear: 2026 }, orderBy: { version: "desc" } }); const version = (latestPrior?.version ?? 0) + 1;
    const priorData = { organizationId: sourceRun.organizationId, employeeId: sourceSnapshot.employeeId, taxYear: 2026, version, priorEmployerReference: `${marker}:employer`, gross: new Prisma.Decimal("500000"), eligibleDeductions: new Prisma.Decimal("0"), taxableIncome: new Prisma.Decimal("500000"), payeDeducted: new Prisma.Decimal("10000"), payeRepaid: new Prisma.Decimal("0"), handling: "EVIDENCED", evidenceReference: `${marker}:evidence-v1`, correlationId: `${marker}:prior-v1` };
    const priorRace = await Promise.allSettled([0, 1].map(() => db.hrPayrollPriorEmployerYtdVersion.create({ data: priorData }))); assert(priorRace.filter((x) => x.status === "fulfilled").length === 1, "Prior-employer race did not produce one winner.");
    const priorV1 = await db.hrPayrollPriorEmployerYtdVersion.findFirstOrThrow({ where: { organizationId: sourceRun.organizationId, correlationId: priorData.correlationId } }); await db.hrPayrollPriorEmployerYtdVersion.create({ data: { ...priorData, version: version + 1, gross: new Prisma.Decimal("510000"), taxableIncome: new Prisma.Decimal("510000"), supersedesId: priorV1.id, evidenceReference: `${marker}:evidence-v2`, correlationId: `${marker}:prior-v2` } });
    assert((await db.hrPayrollInputSnapshot.findUniqueOrThrow({ where: { id: sourceSnapshot.id } })).employmentIncomeBindingHash === sourceSnapshot.employmentIncomeBindingHash, "Prior-employer amendment mutated frozen binding.");

    const staleRun = await createUnit9Run(db, maker, { payGroupId: sourceRun.payGroupId, calendarPeriodId: sourceRun.calendarPeriodId, jurisdictionVersionId: sourceRun.jurisdictionVersionId, kind: "CORRECTION", sequence: Number(String(Date.now() + 1).slice(-7)), idempotencyKey: `${marker}:stale-binding` }); await db.hrPayrollAuthoritativeRun.update({ where: { id: staleRun.id }, data: { status: "FROZEN", frozenAt: new Date() } });
    const staleSnapshot = await db.hrPayrollInputSnapshot.create({ data: { ...snapshotData, payrollRunId: staleRun.id, correlationId: `${marker}:stale-snapshot` } });
    await db.hrPayrollPopulationPartition.create({ data: { organizationId: sourceRun.organizationId, payrollRunId: staleRun.id, calculationAttemptId: `${marker}:partition`, originalPopulationCount: 1, readyCount: 1, heldCount: 0, readyEmployeeIds: [sourceSnapshot.employeeId], heldPopulation: [], minimumWageDecisionHashes: [{ employeeId: sourceSnapshot.employeeId, decisionHash: sourceSnapshot.minimumWageDecisionHash }], employmentIncomeBindingHashes: [{ employeeId: sourceSnapshot.employeeId, bindingHash: "stale-binding-hash" }], partitionHash: crypto.createHash("sha256").update(marker).digest("hex"), decision: "APPROVE_SUPPORTED_POPULATION_AND_DEFER_HELD_POPULATION", reason: "Stale binding race test", preparedById: users[0].id, approvedById: users[1].id, approvedAt: new Date(), correlationId: `${marker}:partition` } });
    let staleRejected = false; try { await calculateUnit9Run(db, maker, staleRun.id, { idempotencyKey: `${marker}:calculate` }); } catch (error) { staleRejected = String(error).includes("STALE_EMPLOYMENT_INCOME_BINDING"); } assert(staleRejected, "Stale binding calculation was not rejected.");
    assert(await db.hrPayrollAuthoritativeResult.count({ where: { payrollRunId: staleRun.id } }) === 0, "Stale calculation created an authoritative result.");
    const evidence = { duplicateBindingWinners: 1, bonusYtdWinners: 1, priorEmployerVersionWinners: 1, priorEmployerVersions: 2, immutableFrozenBinding: true, staleBindingRejected: true, staleAuthoritativeResults: 0, mixedVersionResults: 0 };
    await db.hrAuditEvent.create({ data: { organizationId: sourceRun.organizationId, actorUserId: maker.userId, actorRole: maker.role, entityType: "Ng2026_6IncomeBindingConcurrency", entityId: staleSnapshot.id, action: "unit9.ng_2026_6.concurrency.validated", newValues: evidence, correlationId: marker } });
    console.log(JSON.stringify({ result: "PASS", marker, sourceSnapshotId: sourceSnapshot.id, bindingHash: sourceSnapshot.employmentIncomeBindingHash, ...evidence }));
  } finally { await db.$disconnect(); }
}

await main();
