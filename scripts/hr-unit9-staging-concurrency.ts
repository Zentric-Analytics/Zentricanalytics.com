import crypto from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { acknowledgeUnit9RemittanceSimulation, createUnit9RemittanceAmendmentSimulation } from "../src/lib/hr/payroll/unit9-financial-service";
import { calculateUnit9Run, createUnit9RetroTrigger, createUnit9Run, decideUnit9Run } from "../src/lib/hr/payroll/unit9-service";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
const enabled = process.env.HR_UNIT9_STAGING_CONCURRENCY_CONFIRM === "staging-only" && databaseUrl.pathname.slice(1) === "zentric_analytics_staging";
if (!enabled) throw new Error("Unit 9 concurrency validation is restricted to the confirmed staging database.");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
    const prisma = new PrismaClient();
    const marker = `unit9-concurrency-${Date.now()}`;
    try {
      const source = await prisma.hrPayrollAuthoritativeRun.findFirstOrThrow({ where: { status: "APPROVED", idempotencyKey: { startsWith: "unit9-staging-" } }, orderBy: { createdAt: "desc" } });
      const sourceSnapshot = await prisma.hrPayrollInputSnapshot.findFirstOrThrow({ where: { payrollRunId: source.id } });
      const users = await prisma.hrUser.findMany({ where: { organizationId: source.organizationId, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, take: 2, select: { id: true } });
      assert(users.length === 2, "Two independent staging actors are required.");
      const maker = { organizationId: source.organizationId, userId: users[0].id, role: "PAYROLL_PROCESSOR" };
      const checker = { organizationId: source.organizationId, userId: users[1].id, role: "PAYROLL_APPROVER" };
      const duplicateRunKey = `${marker}:duplicate-run`;
      const duplicateRuns = await Promise.allSettled([0, 1].map(() => createUnit9Run(prisma, maker, { payGroupId: source.payGroupId, calendarPeriodId: source.calendarPeriodId, jurisdictionVersionId: source.jurisdictionVersionId, kind: "CORRECTION", sequence: Number(String(Date.now()).slice(-7)), idempotencyKey: duplicateRunKey })));
      assert(duplicateRuns.filter(({ status }) => status === "fulfilled").length === 1, "Exactly one duplicate run request must win.");
      assert(await prisma.hrPayrollAuthoritativeRun.count({ where: { organizationId: source.organizationId, idempotencyKey: duplicateRunKey } }) === 1, "Duplicate run persisted more than once.");
      const run = duplicateRuns.find(({ status }) => status === "fulfilled");
      if (!run || run.status !== "fulfilled") throw new Error("Exactly one run creation must win.");
      await prisma.hrPayrollAuthoritativeRun.update({ where: { id: run.value.id }, data: { status: "FROZEN", frozenAt: new Date() } });
      await prisma.hrPayrollInputSnapshot.create({ data: { organizationId: sourceSnapshot.organizationId, payrollRunId: run.value.id, employeeId: sourceSnapshot.employeeId, personId: sourceSnapshot.personId, workRelationshipId: sourceSnapshot.workRelationshipId, assignmentId: sourceSnapshot.assignmentId, sourceManifest: sourceSnapshot.sourceManifest as Prisma.InputJsonValue, inputHash: sourceSnapshot.inputHash, certificationStatus: "CERTIFIED", frozenAt: new Date(), correlationId: crypto.randomUUID() } });

      const calculationKey = `${marker}:calculation`;
      const calculations = await Promise.allSettled([0, 1].map(() => calculateUnit9Run(prisma, maker, run.value.id, { idempotencyKey: calculationKey })));
      assert(calculations.some(({ status }) => status === "fulfilled"), "No concurrent calculation request completed.");
      assert(await prisma.hrPayrollCalculationAttempt.count({ where: { payrollRunId: run.value.id, status: "COMPLETED" } }) === 1, "Calculation completed more than once.");
      assert(await prisma.hrPayrollAuthoritativeResult.count({ where: { payrollRunId: run.value.id, authoritativeAt: { not: null } } }) === 1, "Authoritative result was not exactly once.");

      const decisionRace = await Promise.allSettled([
        decideUnit9Run(prisma, checker, run.value.id, { decision: "APPROVED", reason: "Concurrency approval path" }),
        calculateUnit9Run(prisma, maker, run.value.id, { reason: "Concurrent recalculation path", idempotencyKey: `${marker}:recalculate` }),
      ]);
      assert(decisionRace.filter(({ status }) => status === "fulfilled").length === 1, "Approval/recalculation race did not produce one winner.");
      const current = await prisma.hrPayrollAuthoritativeRun.findUniqueOrThrow({ where: { id: run.value.id } });
      if (current.status === "RECONCILED") await decideUnit9Run(prisma, checker, current.id, { decision: "APPROVED", reason: "Approve winning recalculation" });
      assert(await prisma.hrPayrollRunApproval.count({ where: { payrollRunId: run.value.id, decision: "APPROVED" } }) === 1, "Approval was not exactly once.");
      assert(await prisma.hrPayrollAuthoritativeResult.count({ where: { payrollRunId: run.value.id, authoritativeAt: { not: null } } }) === 1, "Decision race duplicated the authoritative result.");
      const authoritativeResult = await prisma.hrPayrollAuthoritativeResult.findFirstOrThrow({ where: { organizationId: source.organizationId, payrollRunId: run.value.id, authoritativeAt: { not: null } } });

      const latestPriorYtd = await prisma.hrPayrollPriorEmployerYtdVersion.findFirst({ where: { organizationId: source.organizationId, employeeId: sourceSnapshot.employeeId, taxYear: 2026 }, orderBy: { version: "desc" }, select: { version: true } });
      const priorYtdVersion = (latestPriorYtd?.version ?? 0) + 1;
      const priorYtd = { organizationId: source.organizationId, employeeId: sourceSnapshot.employeeId, taxYear: 2026, version: priorYtdVersion, priorEmployerReference: `${marker}:prior-employer`, gross: new Prisma.Decimal("100000"), eligibleDeductions: new Prisma.Decimal("10000"), taxableIncome: new Prisma.Decimal("90000"), payeDeducted: new Prisma.Decimal("9000"), payeRepaid: new Prisma.Decimal("0"), handling: "EVIDENCED", evidenceReference: `${marker}:evidence`, correlationId: `${marker}:prior-ytd-v1` };
      const priorYtdRace = await Promise.allSettled([0, 1].map(() => prisma.hrPayrollPriorEmployerYtdVersion.create({ data: priorYtd })));
      assert(priorYtdRace.filter(({ status }) => status === "fulfilled").length === 1, "Prior-YTD equivalent evidence race did not produce one winner.");
      assert(await prisma.hrPayrollPriorEmployerYtdVersion.count({ where: { organizationId: source.organizationId, employeeId: sourceSnapshot.employeeId, taxYear: 2026, version: priorYtdVersion } }) === 1, "Prior-YTD race persisted duplicate truth.");
      const priorV1 = await prisma.hrPayrollPriorEmployerYtdVersion.findFirstOrThrow({ where: { organizationId: source.organizationId, correlationId: priorYtd.correlationId } });
      await prisma.hrPayrollPriorEmployerYtdVersion.create({ data: { ...priorYtd, version: priorYtdVersion + 1, payeDeducted: new Prisma.Decimal("9500"), supersedesId: priorV1.id, correlationId: `${marker}:prior-ytd-v2` } });

      const accumulatorAmounts = { GROSS: "100000", TAXABLE_INCOME: "90000", PAYE_DEDUCTED: "9000", PAYE_REPAID: "3500", PENSION_EMPLOYEE: "8000", PENSION_EMPLOYER: "10000" } as const;
      const ytdRaceWinners: Record<string, number> = {};
      for (const [accumulatorCode, amount] of Object.entries(accumulatorAmounts)) {
        const data = { organizationId: source.organizationId, employeeId: sourceSnapshot.employeeId, taxYear: 2026, accumulatorCode, entryType: "AUTHORITATIVE", amount: new Prisma.Decimal(amount), payrollResultId: authoritativeResult.id, effectiveAt: new Date(), correlationId: `${marker}:ytd:${accumulatorCode}` };
        const raced = await Promise.allSettled([0, 1].map(() => prisma.hrPayrollYtdLedgerEntry.create({ data })));
        ytdRaceWinners[accumulatorCode] = raced.filter(({ status }) => status === "fulfilled").length;
        assert(ytdRaceWinners[accumulatorCode] === 1, `${accumulatorCode} YTD retry race did not produce one winner.`);
        const aggregate = await prisma.hrPayrollYtdLedgerEntry.aggregate({ where: { organizationId: source.organizationId, employeeId: sourceSnapshot.employeeId, taxYear: 2026, accumulatorCode, payrollResultId: authoritativeResult.id }, _sum: { amount: true }, _count: true });
        assert(aggregate._count === 1 && aggregate._sum.amount?.equals(amount), `${accumulatorCode} YTD aggregate did not reconcile exactly.`);
      }

      const retroInput = { sourceType: "PAYROLL" as const, sourceId: authoritativeResult.id, sourceVersion: `${marker}:v2`, previousVersion: `${marker}:v1`, affectedFrom: new Date("2026-08-01T00:00:00.000Z") };
      const retroRace = await Promise.allSettled([0, 1].map(() => createUnit9RetroTrigger(prisma, maker, retroInput)));
      assert(retroRace.some(({ status }) => status === "fulfilled"), "No retro trigger request won.");
      assert(await prisma.hrPayrollRetroTrigger.count({ where: { organizationId: source.organizationId, sourceType: retroInput.sourceType, sourceId: retroInput.sourceId, sourceVersion: retroInput.sourceVersion } }) === 1, "Retro trigger duplicated its logical lineage.");

      const remittance = await prisma.hrPayrollRemittanceBatch.create({ data: { organizationId: source.organizationId, jurisdictionVersionId: source.jurisdictionVersionId, periodKey: `${marker}:period`, category: "PAYE_REFUND_CREDIT", version: 1, totalAmount: new Prisma.Decimal("3500"), correlationId: `${marker}:remittance` } });
      const acknowledgementRace = await Promise.allSettled([0, 1].map(() => acknowledgeUnit9RemittanceSimulation(prisma, checker, remittance.id, `${marker}:ack`)));
      assert(acknowledgementRace.filter(({ status }) => status === "fulfilled").length >= 1, "No acknowledgement replay completed.");
      const acknowledged = await prisma.hrPayrollRemittanceBatch.findUniqueOrThrow({ where: { id: remittance.id } });
      assert(acknowledged.status === "ACKNOWLEDGED" && acknowledged.externalReference === `TEST:${marker}:ack`, "Acknowledgement did not preserve the winning test reference.");
      let conflictingAcknowledgementRejected = false;
      try { await acknowledgeUnit9RemittanceSimulation(prisma, checker, remittance.id, `${marker}:conflict`); } catch { conflictingAcknowledgementRejected = true; }
      assert(conflictingAcknowledgementRejected, "Conflicting acknowledgement silently overwrote history.");

      const amendmentInput = { idempotencyKey: `${marker}:amendment`, reason: "Correct synthetic PAYE refund liability", deltaManifest: { payeRefundDelta: "3500.00", realFiling: false } };
      const amendmentRace = await Promise.allSettled([0, 1].map(() => createUnit9RemittanceAmendmentSimulation(prisma, checker, remittance.id, amendmentInput)));
      assert(amendmentRace.some(({ status }) => status === "fulfilled"), "No statutory amendment request won.");
      assert(await prisma.hrPayrollStatutoryAmendment.count({ where: { organizationId: source.organizationId, idempotencyKey: amendmentInput.idempotencyKey } }) === 1, "Statutory amendment duplicated its logical version.");
      const firstAmendment = await prisma.hrPayrollStatutoryAmendment.findFirstOrThrow({ where: { organizationId: source.organizationId, idempotencyKey: amendmentInput.idempotencyKey } });
      const secondAmendment = await createUnit9RemittanceAmendmentSimulation(prisma, checker, remittance.id, { idempotencyKey: `${marker}:amendment-v2`, reason: "Second governed synthetic correction", deltaManifest: { payeRefundDelta: "100.00", realFiling: false } });
      assert(secondAmendment.amendment.version === 2 && secondAmendment.amendment.supersedesAmendmentId === firstAmendment.id, "Legitimate later amendment did not append to lineage.");

      const evidence = { duplicateRunWinners: 1, completedAttempts: 1, selectedResults: 1, decisionRaceWinners: 1, priorYtdWinners: 1, priorYtdVersions: 2, ytdRaceWinners, retroTriggerCount: 1, acknowledgementStatus: acknowledged.status, conflictingAcknowledgementRejected, amendmentVersions: 2 };
      await prisma.hrAuditEvent.create({ data: { organizationId: source.organizationId, actorUserId: maker.userId, actorRole: maker.role, entityType: "Unit9Concurrency", entityId: run.value.id, action: "unit9.concurrency.validated", newValues: evidence, correlationId: marker } });
      console.log(JSON.stringify({ result: "PASS", marker, runId: run.value.id, ...evidence, approvals: 1 }));
    } finally {
      await prisma.$disconnect();
    }
}

await main();
