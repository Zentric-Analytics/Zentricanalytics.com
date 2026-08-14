import crypto from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { appendHrAudit } from "@/lib/hr/audit";
import { assertCertifiedJurisdictionPackage, payrollDigest } from "./unit9-domain";
import { assertFinalizationReady, certifyPayrollInput, type PayrollInputCandidate } from "./unit9-engine";

type Db = PrismaClient | Prisma.TransactionClient;
type Actor = { organizationId: string; userId: string; role: string };

export async function listUnit9Runs(db: Db, actor: Actor) {
  return db.hrPayrollAuthoritativeRun.findMany({ where: { organizationId: actor.organizationId }, orderBy: { createdAt: "desc" }, take: 100 });
}

export async function createUnit9Run(db: PrismaClient, actor: Actor, input: { payGroupId: string; calendarPeriodId: string; jurisdictionVersionId: string; kind?: "REGULAR" | "OFF_CYCLE" | "EMERGENCY" | "CORRECTION"; sequence?: number; idempotencyKey: string }) {
  return db.$transaction(async (tx) => {
    const [payGroup, period, jurisdiction] = await Promise.all([
      tx.hrPayrollPayGroup.findFirst({ where: { id: input.payGroupId, organizationId: actor.organizationId, status: "ACTIVE" } }),
      tx.hrPayrollCalendarPeriod.findFirst({ where: { id: input.calendarPeriodId, organizationId: actor.organizationId, payGroupId: input.payGroupId } }),
      tx.hrPayrollJurisdictionVersion.findFirst({ where: { id: input.jurisdictionVersionId, organizationId: actor.organizationId } }),
    ]);
    if (!payGroup || !period || !jurisdiction) throw new Error("Payroll run references are invalid or outside the tenant.");
    const correlationId = crypto.randomUUID();
    const run = await tx.hrPayrollAuthoritativeRun.create({ data: { organizationId: actor.organizationId, payGroupId: payGroup.id, calendarPeriodId: period.id, jurisdictionVersionId: jurisdiction.id, kind: input.kind ?? "REGULAR", sequence: input.sequence ?? 1, idempotencyKey: input.idempotencyKey, correlationId, createdById: actor.userId } });
    await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollAuthoritativeRun", entityId: run.id, action: "unit9.payroll_run.created", correlationId });
    return run;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function certifyUnit9Population(db: PrismaClient, actor: Actor, runId: string, candidates: PayrollInputCandidate[]) {
  return db.$transaction(async (tx) => {
    const run = await tx.hrPayrollAuthoritativeRun.findFirst({ where: { id: runId, organizationId: actor.organizationId } });
    if (!run || !["DRAFT", "CERTIFYING", "BLOCKED"].includes(run.status)) throw new Error("Payroll run is not eligible for certification.");
    const results = candidates.map((candidate) => ({ candidate, result: certifyPayrollInput(candidate) }));
    for (const { candidate, result } of results) for (const issue of result.findings) {
      await tx.hrPayrollCertificationIssue.upsert({
        where: { payrollRunId_employeeId_code_sourceId: { payrollRunId: run.id, employeeId: candidate.employeeId, code: issue.code, sourceId: "CERTIFICATION" } },
        create: { organizationId: actor.organizationId, payrollRunId: run.id, employeeId: candidate.employeeId, code: issue.code, severity: issue.severity, sourceType: "CERTIFICATION", sourceId: "CERTIFICATION", message: issue.message, correlationId: crypto.randomUUID() },
        update: { severity: issue.severity, message: issue.message },
      });
    }
    const runBlocked = results.some(({ result }) => result.runBlocked);
    await tx.hrPayrollAuthoritativeRun.update({ where: { id: run.id }, data: { status: runBlocked ? "BLOCKED" : "CERTIFIED" } });
    await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollAuthoritativeRun", entityId: run.id, action: "unit9.certification.completed", newValues: { population: candidates.length, runBlocked }, correlationId: run.correlationId });
    return { runBlocked, employeeBlocked: results.filter(({ result }) => result.employeeBlocked).map(({ candidate }) => candidate.employeeId), results };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function freezeUnit9Inputs(db: PrismaClient, actor: Actor, runId: string, snapshots: Array<{ candidate: PayrollInputCandidate; sourceManifest: Prisma.InputJsonValue }>) {
  return db.$transaction(async (tx) => {
    const run = await tx.hrPayrollAuthoritativeRun.findFirst({ where: { id: runId, organizationId: actor.organizationId, status: "CERTIFIED" } });
    if (!run) throw new Error("Only a certified tenant payroll run may freeze inputs.");
    const frozenAt = new Date();
    for (const snapshot of snapshots) {
      const certification = certifyPayrollInput(snapshot.candidate);
      if (certification.runBlocked || certification.employeeBlocked) continue;
      await tx.hrPayrollInputSnapshot.create({ data: { organizationId: actor.organizationId, payrollRunId: run.id, employeeId: snapshot.candidate.employeeId, personId: snapshot.candidate.personId!, workRelationshipId: snapshot.candidate.workRelationshipId!, assignmentId: snapshot.candidate.assignmentId!, sourceManifest: snapshot.sourceManifest, inputHash: payrollDigest(snapshot.sourceManifest), certificationStatus: "CERTIFIED", frozenAt, correlationId: crypto.randomUUID() } });
    }
    const count = await tx.hrPayrollInputSnapshot.count({ where: { organizationId: actor.organizationId, payrollRunId: run.id } });
    if (!count) throw new Error("Payroll cannot freeze without at least one certified employee snapshot.");
    await tx.hrPayrollAuthoritativeRun.update({ where: { id: run.id }, data: { status: "FROZEN", frozenAt } });
    return { runId: run.id, frozenAt, snapshotCount: count };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function finalizeUnit9Run(db: PrismaClient, actor: Actor, runId: string) {
  return db.$transaction(async (tx) => {
    const run = await tx.hrPayrollAuthoritativeRun.findFirst({ where: { id: runId, organizationId: actor.organizationId } });
    if (!run || run.status !== "APPROVED") throw new Error("Only an approved tenant payroll run may finalize.");
    const [jurisdiction, evidenceCount, snapshots, results, employeeBalanced, runBalanced, blockers, approvals] = await Promise.all([
      tx.hrPayrollJurisdictionVersion.findFirst({ where: { id: run.jurisdictionVersionId, organizationId: actor.organizationId } }),
      tx.hrPayrollRegulatoryEvidence.count({ where: { organizationId: actor.organizationId, jurisdictionVersionId: run.jurisdictionVersionId } }),
      tx.hrPayrollInputSnapshot.count({ where: { organizationId: actor.organizationId, payrollRunId: run.id } }),
      tx.hrPayrollAuthoritativeResult.count({ where: { organizationId: actor.organizationId, payrollRunId: run.id } }),
      tx.hrPayrollReconciliation.count({ where: { organizationId: actor.organizationId, payrollRunId: run.id, scope: "EMPLOYEE", balanced: true } }),
      tx.hrPayrollReconciliation.count({ where: { organizationId: actor.organizationId, payrollRunId: run.id, scope: "RUN", balanced: true } }),
      tx.hrPayrollRiskFinding.count({ where: { organizationId: actor.organizationId, payrollRunId: run.id, severity: "BLOCKER", status: "OPEN" } }),
      tx.hrPayrollRunApproval.count({ where: { organizationId: actor.organizationId, payrollRunId: run.id, decision: "APPROVED" } }),
    ]);
    if (!jurisdiction) throw new Error("Payroll jurisdiction version is missing.");
    assertCertifiedJurisdictionPackage([{ jurisdictionCode: "NG", status: jurisdiction.status, effectiveFrom: jurisdiction.effectiveFrom, effectiveTo: jurisdiction.effectiveTo, certifiedAt: jurisdiction.certifiedAt, sourceEvidenceCount: evidenceCount }], "NG", new Date());
    const finalizationHash = assertFinalizationReady({ jurisdictionCertified: true, certificationComplete: true, inputsFrozen: snapshots > 0, authoritativeCalculation: results > 0, employeeReconciliation: employeeBalanced === results, runReconciliation: runBalanced === 1, unresolvedBlockers: blockers, independentApproval: approvals > 0 });
    const finalized = await tx.hrPayrollAuthoritativeRun.updateMany({ where: { id: run.id, organizationId: actor.organizationId, status: "APPROVED", finalizedAt: null }, data: { status: "FINALIZED", finalizedAt: new Date(), finalizedById: actor.userId } });
    if (finalized.count !== 1) throw new Error("Payroll finalization lost a concurrent race.");
    await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollAuthoritativeRun", entityId: run.id, action: "unit9.payroll_run.finalized", newValues: { finalizationHash }, correlationId: run.correlationId });
    return { runId: run.id, finalizationHash };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
