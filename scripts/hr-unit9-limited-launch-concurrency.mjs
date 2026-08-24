import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const url = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
if (process.env.HR_UNIT9_LIMITED_LAUNCH_CONFIRM !== "staging-only" || url.pathname.slice(1) !== "zentric_analytics_staging") throw new Error("Refusing limited-launch concurrency validation outside confirmed staging.");
const prisma = new PrismaClient();
const marker = `limited-launch-${Date.now()}`;
try {
  const run = await prisma.hrPayrollAuthoritativeRun.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
  const latestAttempt = await prisma.hrPayrollCalculationAttempt.findFirstOrThrow({ where: { payrollRunId: run.id }, orderBy: { attemptNumber: "desc" } });
  const attempt = await prisma.hrPayrollCalculationAttempt.create({ data: { organizationId: run.organizationId, payrollRunId: run.id, attemptNumber: latestAttempt.attemptNumber + 1, inputSetHash: `${marker}:input`, ruleSetHash: `${marker}:rules`, engineVersion: "unit9-ng-2026.4-validation", outputHash: `${marker}:output`, manifest: { candidateVersion: "NG-CANDIDATE-2026.4", purpose: "STAGING_CONCURRENCY_EVIDENCE" }, status: "COMPLETED", completedAt: new Date(), correlationId: `${marker}:attempt` } });
  const snapshot = await prisma.hrPayrollInputSnapshot.findFirstOrThrow({ where: { payrollRunId: run.id } });
  const data = { id: crypto.randomUUID(), organizationId: run.organizationId, employeeId: snapshot.employeeId, payGroupId: run.payGroupId, payrollPeriodId: run.calendarPeriodId, payrollRunId: run.id, calculationAttemptId: attempt.id, jurisdictionCode: "NG", rtaCode: "LAGOS", blockerCode: "RTA_REFUND_PROCEDURE_REQUIRED", blockerCategory: "TAX", affectedInput: "PAYE_REFUND_CREDIT", candidateVersion: "NG-CANDIDATE-2026.4", sourceRequirement: "Approved RTA refund or offset execution procedure", logicalKey: marker, correlationId: crypto.randomUUID() };
  const created = await Promise.allSettled([0, 1].map(() => prisma.hrPayrollComplianceException.create({ data: { ...data, id: crypto.randomUUID(), correlationId: crypto.randomUUID() } })));
  const winners = created.filter((x) => x.status === "fulfilled").length;
  if (winners !== 1) throw new Error(`Expected one exception winner, received ${winners}.`);
  const exception = await prisma.hrPayrollComplianceException.findUniqueOrThrow({ where: { organizationId_logicalKey: { organizationId: run.organizationId, logicalKey: marker } } });
  const claims = await Promise.all(["authority-a", "authority-b"].map((authorityEvidenceId) => prisma.hrPayrollComplianceException.updateMany({ where: { id: exception.id, status: "OPEN" }, data: { status: "RESOLVED", authorityEvidenceId, approvedRuleVersion: "staging-rule", recalculationAttemptId: attempt.id, resolutionType: "RULE_BACKED_RECALCULATION", resolvedAt: new Date() } })));
  if (claims.reduce((sum, x) => sum + x.count, 0) !== 1) throw new Error("Exception resolution was not exactly once.");
  const partitionHash = crypto.createHash("sha256").update(marker).digest("hex");
  const partition = { organizationId: run.organizationId, payrollRunId: run.id, calculationAttemptId: attempt.id, originalPopulationCount: 1, readyCount: 0, heldCount: 1, readyEmployeeIds: [], heldPopulation: [{ employeeId: snapshot.employeeId, reasons: ["RTA_REFUND_PROCEDURE_REQUIRED"] }], partitionHash, preparedById: run.createdById, correlationId: crypto.randomUUID() };
  const partitionRace = await Promise.allSettled([0, 1].map(() => prisma.hrPayrollPopulationPartition.create({ data: { ...partition, id: crypto.randomUUID(), correlationId: crypto.randomUUID() } })));
  if (partitionRace.filter((x) => x.status === "fulfilled").length !== 1) throw new Error("Population partition was not exactly once.");
  console.log(JSON.stringify({ result: "PASS", database: url.pathname.slice(1), marker, exceptionWinners: winners, resolutionWinners: 1, partitionWinners: 1 }));
} finally { await prisma.$disconnect(); }
