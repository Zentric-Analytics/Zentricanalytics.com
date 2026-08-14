import crypto from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculateUnit9Run, createUnit9Run, decideUnit9Run } from "../src/lib/hr/payroll/unit9-service";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
const enabled = process.env.HR_UNIT9_STAGING_CONCURRENCY_CONFIRM === "staging-only" && databaseUrl.pathname.slice(1) === "zentric_analytics_staging";
const testIf = enabled ? it : it.skip;

describe("Unit 9 real PostgreSQL concurrency", () => {
  testIf("enforces exactly-once run, calculation, authoritative result and approval claims", async () => {
    const prisma = new PrismaClient();
    const marker = `unit9-concurrency-${Date.now()}`;
    try {
      const source = await prisma.hrPayrollAuthoritativeRun.findFirstOrThrow({ where: { status: "APPROVED", idempotencyKey: { startsWith: "unit9-staging-" } }, orderBy: { createdAt: "desc" } });
      const sourceSnapshot = await prisma.hrPayrollInputSnapshot.findFirstOrThrow({ where: { payrollRunId: source.id } });
      const users = await prisma.hrUser.findMany({ where: { organizationId: source.organizationId, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, take: 2, select: { id: true } });
      expect(users).toHaveLength(2);
      const maker = { organizationId: source.organizationId, userId: users[0].id, role: "PAYROLL_PROCESSOR" };
      const checker = { organizationId: source.organizationId, userId: users[1].id, role: "PAYROLL_APPROVER" };
      const duplicateRunKey = `${marker}:duplicate-run`;
      const duplicateRuns = await Promise.allSettled([0, 1].map(() => createUnit9Run(prisma, maker, { payGroupId: source.payGroupId, calendarPeriodId: source.calendarPeriodId, jurisdictionVersionId: source.jurisdictionVersionId, kind: "CORRECTION", sequence: Number(String(Date.now()).slice(-7)), idempotencyKey: duplicateRunKey })));
      expect(duplicateRuns.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(await prisma.hrPayrollAuthoritativeRun.count({ where: { organizationId: source.organizationId, idempotencyKey: duplicateRunKey } })).toBe(1);
      const run = duplicateRuns.find(({ status }) => status === "fulfilled");
      if (!run || run.status !== "fulfilled") throw new Error("Exactly one run creation must win.");
      await prisma.hrPayrollAuthoritativeRun.update({ where: { id: run.value.id }, data: { status: "FROZEN", frozenAt: new Date() } });
      await prisma.hrPayrollInputSnapshot.create({ data: { organizationId: sourceSnapshot.organizationId, payrollRunId: run.value.id, employeeId: sourceSnapshot.employeeId, personId: sourceSnapshot.personId, workRelationshipId: sourceSnapshot.workRelationshipId, assignmentId: sourceSnapshot.assignmentId, sourceManifest: sourceSnapshot.sourceManifest as Prisma.InputJsonValue, inputHash: sourceSnapshot.inputHash, certificationStatus: "CERTIFIED", frozenAt: new Date(), correlationId: crypto.randomUUID() } });

      const calculationKey = `${marker}:calculation`;
      const calculations = await Promise.allSettled([0, 1].map(() => calculateUnit9Run(prisma, maker, run.value.id, { idempotencyKey: calculationKey })));
      expect(calculations.filter(({ status }) => status === "fulfilled").length).toBeGreaterThanOrEqual(1);
      expect(await prisma.hrPayrollCalculationAttempt.count({ where: { payrollRunId: run.value.id, status: "COMPLETED" } })).toBe(1);
      expect(await prisma.hrPayrollAuthoritativeResult.count({ where: { payrollRunId: run.value.id, authoritativeAt: { not: null } } })).toBe(1);

      const decisionRace = await Promise.allSettled([
        decideUnit9Run(prisma, checker, run.value.id, { decision: "APPROVED", reason: "Concurrency approval path" }),
        calculateUnit9Run(prisma, maker, run.value.id, { reason: "Concurrent recalculation path", idempotencyKey: `${marker}:recalculate` }),
      ]);
      expect(decisionRace.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      const current = await prisma.hrPayrollAuthoritativeRun.findUniqueOrThrow({ where: { id: run.value.id } });
      if (current.status === "RECONCILED") await decideUnit9Run(prisma, checker, current.id, { decision: "APPROVED", reason: "Approve winning recalculation" });
      expect(await prisma.hrPayrollRunApproval.count({ where: { payrollRunId: run.value.id, decision: "APPROVED" } })).toBe(1);
      expect(await prisma.hrPayrollAuthoritativeResult.count({ where: { payrollRunId: run.value.id, authoritativeAt: { not: null } } })).toBe(1);
      await prisma.hrAuditEvent.create({ data: { organizationId: source.organizationId, actorUserId: maker.userId, actorRole: maker.role, entityType: "Unit9Concurrency", entityId: run.value.id, action: "unit9.concurrency.validated", newValues: { duplicateRunWinners: 1, completedAttempts: 1, selectedResults: 1, decisionRaceWinners: 1 }, correlationId: marker } });
      console.log(JSON.stringify({ result: "PASS", marker, runId: run.value.id, duplicateRunWinners: 1, completedAttempts: 1, selectedResults: 1, decisionRaceWinners: 1, approvals: 1 }));
    } finally {
      await prisma.$disconnect();
    }
  }, 60_000);
});
