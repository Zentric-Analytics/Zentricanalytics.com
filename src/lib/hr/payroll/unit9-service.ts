import crypto from "node:crypto";
import { Prisma, type HrRoleKey, type PrismaClient } from "@prisma/client";
import { appendHrAudit } from "@/lib/hr/audit";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { assertCertifiedJurisdictionPackage, payrollDigest } from "./unit9-domain";
import { assertFinalizationReady, calculateFrozenPayroll, certifyPayrollInput, type FrozenPayrollManifest, type PayrollInputCandidate } from "./unit9-engine";

type Db = PrismaClient | Prisma.TransactionClient;
type Actor = { organizationId: string; userId: string; role: string };

async function notifyPayrollRoles(tx: Prisma.TransactionClient, input: { organizationId: string; roleKeys: HrRoleKey[]; template: "hr-payroll-review-ready" | "hr-payroll-approval-ready" | "hr-payroll-approved"; subject: string; runId: string; idempotencyStage: string }) {
  const recipients = await tx.hrUser.findMany({ where: { organizationId: input.organizationId, status: "ACTIVE", deletedAt: null, roles: { some: { revokedAt: null, role: { key: { in: input.roleKeys } } } } }, select: { id: true, email: true } });
  for (const recipient of recipients) await enqueueHrEmail(tx, { organizationId: input.organizationId, recipient: recipient.email, template: input.template, subject: input.subject, payload: { href: `/hr/admin/payroll/unit9/${input.runId}`, payrollRunId: input.runId }, idempotencyKey: `unit9:${input.idempotencyStage}:${input.runId}:${recipient.id}` });
  return recipients.length;
}

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
    await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollAuthoritativeRun", entityId: run.id, action: "unit9.inputs.frozen", newValues: { snapshotCount: count, frozenAt: frozenAt.toISOString() }, correlationId: run.correlationId });
    return { runId: run.id, frozenAt, snapshotCount: count };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function calculateUnit9Run(db: PrismaClient, actor: Actor, runId: string, input: { reason?: string; idempotencyKey: string }) {
  const attempt = await db.$transaction(async (tx) => {
    const run = await tx.hrPayrollAuthoritativeRun.findFirst({ where: { id: runId, organizationId: actor.organizationId } });
    if (!run || !["FROZEN", "CALCULATED", "RECONCILED"].includes(run.status)) throw new Error("Payroll run is not eligible for calculation.");
    const previousAttempts = await tx.hrPayrollCalculationAttempt.count({ where: { organizationId: actor.organizationId, payrollRunId: run.id } });
    if (previousAttempts > 0 && !input.reason?.trim()) throw new Error("Recalculation requires an explicit reason.");
    const existing = await tx.hrPayrollCalculationAttempt.findFirst({ where: { organizationId: actor.organizationId, payrollRunId: run.id, claimTokenHash: payrollDigest(input.idempotencyKey) } });
    if (existing) return existing;
    const snapshots = await tx.hrPayrollInputSnapshot.findMany({ where: { organizationId: actor.organizationId, payrollRunId: run.id, certificationStatus: "CERTIFIED" }, orderBy: { employeeId: "asc" } });
    if (!snapshots.length) throw new Error("Calculation requires frozen certified snapshots.");
    const created = await tx.hrPayrollCalculationAttempt.create({ data: { organizationId: actor.organizationId, payrollRunId: run.id, attemptNumber: previousAttempts + 1, inputSetHash: payrollDigest(snapshots.map((snapshot) => snapshot.inputHash)), ruleSetHash: payrollDigest([run.jurisdictionVersionId]), engineVersion: "unit9-1", manifest: { reason: input.reason ?? "INITIAL_CALCULATION", snapshotIds: snapshots.map((snapshot) => snapshot.id) }, status: "RUNNING", claimTokenHash: payrollDigest(input.idempotencyKey), correlationId: crypto.randomUUID() } });
    await tx.hrPayrollAuthoritativeRun.update({ where: { id: run.id }, data: { status: "CALCULATING", calculatedById: actor.userId } });
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (attempt.status === "COMPLETED") return { attemptId: attempt.id, idempotent: true };
  try {
    return await db.$transaction(async (tx) => {
      const run = await tx.hrPayrollAuthoritativeRun.findFirst({ where: { id: runId, organizationId: actor.organizationId } });
      if (!run || run.status !== "CALCULATING") throw new Error("Calculation claim is no longer active.");
      const snapshots = await tx.hrPayrollInputSnapshot.findMany({ where: { organizationId: actor.organizationId, payrollRunId: run.id, certificationStatus: "CERTIFIED" }, orderBy: { employeeId: "asc" } });
      const computed: Array<{ snapshot: typeof snapshots[number]; value: ReturnType<typeof calculateFrozenPayroll> }> = [];
      for (const snapshot of snapshots) {
        const manifest = snapshot.sourceManifest as unknown as FrozenPayrollManifest;
        const earningDefinitions = manifest.earnings.map((line) => line.ruleVersionReference);
        const deductionDefinitions = (manifest.deductions ?? []).map((line) => line.definitionVersion);
        const contributionDefinitions = (manifest.employerContributions ?? []).map((line) => line.definitionVersion);
        const [earningCount, deductionCount, contributionCount] = await Promise.all([
          tx.hrPayrollEarningDefinition.count({ where: { organizationId: actor.organizationId, jurisdictionVersionId: run.jurisdictionVersionId, id: { in: earningDefinitions } } }),
          tx.hrPayrollDeductionDefinition.count({ where: { organizationId: actor.organizationId, jurisdictionVersionId: run.jurisdictionVersionId, id: { in: deductionDefinitions } } }),
          tx.hrPayrollEmployerContributionDefinition.count({ where: { organizationId: actor.organizationId, jurisdictionVersionId: run.jurisdictionVersionId, id: { in: contributionDefinitions } } }),
        ]);
        if (earningCount !== new Set(earningDefinitions).size || deductionCount !== new Set(deductionDefinitions).size || contributionCount !== new Set(contributionDefinitions).size) throw new Error("Frozen payroll references an unknown or cross-tenant rule definition.");
        for (const adjustment of manifest.adjustments ?? []) {
          const approved = await tx.hrPayrollManualAdjustment.findFirst({ where: { id: adjustment.sourceId, organizationId: actor.organizationId, payrollRunId: run.id, employeeId: snapshot.employeeId, status: "APPROVED", createdById: adjustment.createdById, approvedById: adjustment.approvedById, amount: adjustment.amount } });
          if (!approved) throw new Error("Frozen payroll references an unapproved or cross-tenant manual adjustment.");
        }
        computed.push({ snapshot, value: calculateFrozenPayroll(manifest, snapshot.inputHash) });
      }
      await tx.hrPayrollAuthoritativeResult.updateMany({ where: { organizationId: actor.organizationId, payrollRunId: run.id, authoritativeAt: { not: null } }, data: { authoritativeAt: null } });
      for (const { snapshot, value } of computed) {
        const result = await tx.hrPayrollAuthoritativeResult.create({ data: { organizationId: actor.organizationId, payrollRunId: run.id, calculationAttemptId: attempt.id, inputSnapshotId: snapshot.id, employeeId: snapshot.employeeId, currency: (snapshot.sourceManifest as { currency?: string }).currency ?? "NGN", grossEarnings: value.gross, taxableIncome: value.taxableIncome, paye: value.paye.currentPaye, employeeDeductions: value.employeeDeductions, employerContributions: value.employerContributions, adjustments: value.adjustments, netPay: value.output.net, outputHash: value.hash, authoritativeAt: new Date(), correlationId: crypto.randomUUID() } });
        const details = new Map<string, { source?: string; rule: string; explanation: Prisma.InputJsonValue }>();
        value.earnings.forEach((line) => details.set(`EARNING:${line.code}`, { source: `${line.sourceType}:${line.sourceId}`, rule: line.ruleVersionReference, explanation: line.explanation }));
        value.deductions.forEach((line) => details.set(`EMPLOYEE_DEDUCTION:${line.code}`, { source: line.sourceId, rule: line.definitionVersion, explanation: line.explanation }));
        value.contributions.forEach((line) => details.set(`EMPLOYER_CONTRIBUTION:${line.code}`, { source: line.sourceId, rule: line.definitionVersion, explanation: line.explanation }));
        await tx.hrPayrollResultLine.createMany({ data: value.manifest.lines.map((line, sequence) => { const detail = details.get(`${line.category}:${line.code}`); return { organizationId: actor.organizationId, payrollResultId: result.id, code: line.code, category: line.category, amount: line.amount, taxableBaseCode: line.category === "TAXABLE_BASE" ? line.code : undefined, sourceReference: detail?.source, ruleVersionReference: detail?.rule ?? value.paye.ruleVersion, explanation: detail?.explanation ?? ({ calculationHash: value.hash, payeTrace: line.category === "PAYE" ? value.paye.trace : undefined } as Prisma.InputJsonValue), sequence }; }) });
        await tx.hrPayrollReconciliation.create({ data: { organizationId: actor.organizationId, payrollRunId: run.id, payrollResultId: result.id, scope: "EMPLOYEE", gross: value.gross, taxableIncome: value.taxableIncome, paye: value.paye.currentPaye, employeeDeductions: value.employeeDeductions, employerContributions: value.employerContributions, adjustments: value.adjustments, netPay: value.output.net, balanced: true, evidenceHash: payrollDigest(value.output), correlationId: crypto.randomUUID() } });
        for (const risk of value.risks) await tx.hrPayrollRiskFinding.create({ data: { organizationId: actor.organizationId, payrollRunId: run.id, payrollResultId: result.id, ruleCode: risk.code, ruleVersion: "unit9-risk-1", severity: risk.severity, explanation: risk.explanation, context: { outputHash: value.hash }, correlationId: crypto.randomUUID() } });
      }
      const totals = computed.reduce((sum, item) => ({ gross: sum.gross.plus(item.value.gross), taxable: sum.taxable.plus(item.value.taxableIncome), paye: sum.paye.plus(item.value.paye.currentPaye), deductions: sum.deductions.plus(item.value.employeeDeductions), contributions: sum.contributions.plus(item.value.employerContributions), adjustments: sum.adjustments.plus(item.value.adjustments), net: sum.net.plus(item.value.output.net) }), { gross: new Prisma.Decimal(0), taxable: new Prisma.Decimal(0), paye: new Prisma.Decimal(0), deductions: new Prisma.Decimal(0), contributions: new Prisma.Decimal(0), adjustments: new Prisma.Decimal(0), net: new Prisma.Decimal(0) });
      const priorRunReconciliation = await tx.hrPayrollReconciliation.findFirst({ where: { organizationId: actor.organizationId, payrollRunId: run.id, scope: "RUN", payrollResultId: null } });
      const runEvidence = { population: computed.length, ...Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value.toFixed(4)])) };
      const reconciliationData = { populationCount: computed.length, gross: totals.gross, taxableIncome: totals.taxable, paye: totals.paye, employeeDeductions: totals.deductions, employerContributions: totals.contributions, adjustments: totals.adjustments, netPay: totals.net, balanced: true, evidenceHash: payrollDigest(runEvidence) };
      if (priorRunReconciliation) await tx.hrPayrollReconciliation.update({ where: { id: priorRunReconciliation.id }, data: reconciliationData });
      else await tx.hrPayrollReconciliation.create({ data: { organizationId: actor.organizationId, payrollRunId: run.id, scope: "RUN", ...reconciliationData, correlationId: crypto.randomUUID() } });
      const outputHash = payrollDigest(computed.map(({ snapshot, value }) => ({ employeeId: snapshot.employeeId, outputHash: value.hash })));
      await tx.hrPayrollCalculationAttempt.update({ where: { id: attempt.id }, data: { status: "COMPLETED", completedAt: new Date(), outputHash } });
      await tx.hrPayrollAuthoritativeRun.update({ where: { id: run.id }, data: { status: "RECONCILED", reconciledById: actor.userId } });
      await notifyPayrollRoles(tx, { organizationId: actor.organizationId, roleKeys: ["PAYROLL_ADMIN", "PAYROLL_PROCESSOR"], template: "hr-payroll-review-ready", subject: "Payroll ready for review", runId: run.id, idempotencyStage: `review-ready:${attempt.id}` });
      await notifyPayrollRoles(tx, { organizationId: actor.organizationId, roleKeys: ["PAYROLL_APPROVER"], template: "hr-payroll-approval-ready", subject: "Payroll ready for approval", runId: run.id, idempotencyStage: `approval-ready:${attempt.id}` });
      await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollCalculationAttempt", entityId: attempt.id, action: "unit9.calculation.completed", reason: input.reason, newValues: { population: computed.length, outputHash }, correlationId: attempt.correlationId });
      return { attemptId: attempt.id, population: computed.length, outputHash, idempotent: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    await db.hrPayrollCalculationAttempt.update({ where: { id: attempt.id }, data: { status: "FAILED", completedAt: new Date(), safeError: error instanceof Error ? error.message.slice(0, 500) : "Calculation failed." } });
    await db.hrPayrollAuthoritativeRun.updateMany({ where: { id: runId, organizationId: actor.organizationId, status: "CALCULATING" }, data: { status: "FROZEN" } });
    throw error;
  }
}

export async function decideUnit9Run(db: PrismaClient, actor: Actor, runId: string, input: { decision: "APPROVED" | "REJECTED"; reason: string }) {
  return db.$transaction(async (tx) => {
    const run = await tx.hrPayrollAuthoritativeRun.findFirst({ where: { id: runId, organizationId: actor.organizationId, status: "RECONCILED" } });
    if (!run) throw new Error("Only a reconciled tenant payroll run may be decided.");
    if (run.createdById === actor.userId || run.calculatedById === actor.userId || run.reconciledById === actor.userId) throw new Error("Payroll maker/checker separation prohibits self-approval.");
    const blockers = await tx.hrPayrollRiskFinding.count({ where: { organizationId: actor.organizationId, payrollRunId: run.id, severity: "BLOCKER", status: "OPEN" } });
    if (input.decision === "APPROVED" && blockers) throw new Error("Open blocker risks prohibit payroll approval.");
    const inputHash = payrollDigest(await tx.hrPayrollAuthoritativeResult.findMany({ where: { organizationId: actor.organizationId, payrollRunId: run.id, authoritativeAt: { not: null } }, select: { employeeId: true, outputHash: true }, orderBy: { employeeId: "asc" } }));
    const approval = await tx.hrPayrollRunApproval.create({ data: { organizationId: actor.organizationId, payrollRunId: run.id, actorUserId: actor.userId, actorRole: actor.role, decision: input.decision, reason: input.reason, inputHash, correlationId: crypto.randomUUID() } });
    await tx.hrPayrollAuthoritativeRun.update({ where: { id: run.id }, data: input.decision === "APPROVED" ? { status: "APPROVED", approvedAt: new Date(), approvedById: actor.userId } : { status: "BLOCKED" } });
    if (input.decision === "APPROVED") await notifyPayrollRoles(tx, { organizationId: actor.organizationId, roleKeys: ["PAYROLL_ADMIN", "PAYROLL_PROCESSOR"], template: "hr-payroll-approved", subject: "Payroll run approved", runId: run.id, idempotencyStage: `approved:${approval.id}` });
    await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollRunApproval", entityId: approval.id, action: `unit9.payroll_run.${input.decision.toLowerCase()}`, reason: input.reason, correlationId: approval.correlationId });
    return approval;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function reviewUnit9Risk(db: PrismaClient, actor: Actor, runId: string, input: { riskId: string; disposition: "ACKNOWLEDGED" | "RESOLVED" | "ACCEPTED" | "WAIVED" | "BLOCKED"; reason: string }) {
  return db.$transaction(async (tx) => {
    const risk = await tx.hrPayrollRiskFinding.findFirst({ where: { id: input.riskId, organizationId: actor.organizationId, payrollRunId: runId, status: "OPEN" } });
    if (!risk) throw new Error("Open payroll risk is outside the tenant or no longer reviewable.");
    if (risk.severity === "BLOCKER" && ["ACCEPTED", "WAIVED"].includes(input.disposition)) throw new Error("Blocker payroll risks cannot be waived.");
    const reviewed = await tx.hrPayrollRiskFinding.update({ where: { id: risk.id }, data: { status: input.disposition, reviewedById: actor.userId, resolutionReason: input.reason, resolvedAt: new Date() } });
    await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollRiskFinding", entityId: risk.id, action: `unit9.risk.${input.disposition.toLowerCase()}`, reason: input.reason, correlationId: risk.correlationId });
    return reviewed;
  });
}

export async function createUnit9RetroTrigger(db: PrismaClient, actor: Actor, input: { sourceType: "UNIT4" | "UNIT5" | "UNIT6" | "UNIT8" | "PAYROLL"; sourceId: string; sourceVersion: string; previousVersion?: string; affectedFrom: Date; affectedTo?: Date }) {
  return db.$transaction(async (tx) => {
    if (input.previousVersion === input.sourceVersion) throw new Error("A retro trigger requires an actual source-version change.");
    const existing = await tx.hrPayrollRetroTrigger.findUnique({ where: { organizationId_sourceType_sourceId_sourceVersion: { organizationId: actor.organizationId, sourceType: input.sourceType, sourceId: input.sourceId, sourceVersion: input.sourceVersion } } });
    if (existing) return { trigger: existing, idempotent: true };
    const trigger = await tx.hrPayrollRetroTrigger.create({ data: { organizationId: actor.organizationId, ...input, treatment: "OFF_CYCLE_CORRECTION", correlationId: crypto.randomUUID() } });
    await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollRetroTrigger", entityId: trigger.id, action: "unit9.retro_trigger.created", newValues: { sourceType: input.sourceType, sourceId: input.sourceId, sourceVersion: input.sourceVersion, previousVersion: input.previousVersion, affectedFrom: input.affectedFrom, affectedTo: input.affectedTo }, correlationId: trigger.correlationId });
    return { trigger, idempotent: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createUnit9ManualAdjustment(db: PrismaClient, actor: Actor, runId: string, input: { employeeId: string; category: string; amount: string; reason: string; evidence: Prisma.InputJsonValue }) {
  return db.$transaction(async (tx) => {
    const run = await tx.hrPayrollAuthoritativeRun.findFirst({ where: { id: runId, organizationId: actor.organizationId, status: { in: ["DRAFT", "CERTIFIED", "FROZEN"] } } });
    if (!run) throw new Error("Manual adjustment is not allowed for this tenant payroll state.");
    const amount = new Prisma.Decimal(input.amount); if (amount.isZero()) throw new Error("Manual adjustment cannot be zero.");
    const adjustment = await tx.hrPayrollManualAdjustment.create({ data: { organizationId: actor.organizationId, payrollRunId: run.id, employeeId: input.employeeId, category: input.category, amount, reason: input.reason, evidence: input.evidence, createdById: actor.userId, correlationId: crypto.randomUUID() } });
    await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollManualAdjustment", entityId: adjustment.id, action: "unit9.manual_adjustment.created", reason: input.reason, newValues: { employeeId: input.employeeId, category: input.category, amount: amount.toFixed(4) }, correlationId: adjustment.correlationId });
    return adjustment;
  });
}

export async function approveUnit9ManualAdjustment(db: PrismaClient, actor: Actor, adjustmentId: string, reason: string) {
  return db.$transaction(async (tx) => {
    const adjustment = await tx.hrPayrollManualAdjustment.findFirst({ where: { id: adjustmentId, organizationId: actor.organizationId, status: "PENDING" } });
    if (!adjustment) throw new Error("Pending manual adjustment is outside the tenant.");
    if (adjustment.createdById === actor.userId) throw new Error("Manual adjustment maker/checker separation prohibits self-approval.");
    const approved = await tx.hrPayrollManualAdjustment.update({ where: { id: adjustment.id }, data: { status: "APPROVED", approvedById: actor.userId, approvedAt: new Date() } });
    await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollManualAdjustment", entityId: adjustment.id, action: "unit9.manual_adjustment.approved", reason, correlationId: adjustment.correlationId });
    return approved;
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
      tx.hrPayrollAuthoritativeResult.count({ where: { organizationId: actor.organizationId, payrollRunId: run.id, authoritativeAt: { not: null } } }),
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
    await tx.hrPayrollAuthoritativeResult.updateMany({ where: { organizationId: actor.organizationId, payrollRunId: run.id, authoritativeAt: { not: null } }, data: { finalizedAt: new Date() } });
    const [period, finalizedResults] = await Promise.all([
      tx.hrPayrollCalendarPeriod.findFirstOrThrow({ where: { id: run.calendarPeriodId, organizationId: actor.organizationId } }),
      tx.hrPayrollAuthoritativeResult.findMany({ where: { organizationId: actor.organizationId, payrollRunId: run.id, authoritativeAt: { not: null } } }),
    ]);
    for (const result of finalizedResults) for (const entry of [
      { code: "GROSS", amount: result.grossEarnings }, { code: "TAXABLE", amount: result.taxableIncome }, { code: "PAYE", amount: result.paye },
      { code: "EMPLOYEE_DEDUCTION", amount: result.employeeDeductions }, { code: "EMPLOYER_CONTRIBUTION", amount: result.employerContributions },
    ]) await tx.hrPayrollYtdLedgerEntry.upsert({ where: { organizationId_employeeId_accumulatorCode_payrollResultId_entryType: { organizationId: actor.organizationId, employeeId: result.employeeId, accumulatorCode: entry.code, payrollResultId: result.id, entryType: "PERIOD_RESULT" } }, create: { organizationId: actor.organizationId, employeeId: result.employeeId, taxYear: period.taxYear, accumulatorCode: entry.code, entryType: "PERIOD_RESULT", amount: entry.amount, payrollResultId: result.id, effectiveAt: period.endsAt, correlationId: crypto.randomUUID() }, update: {} });
    await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollAuthoritativeRun", entityId: run.id, action: "unit9.payroll_run.finalized", newValues: { finalizationHash }, correlationId: run.correlationId });
    return { runId: run.id, finalizationHash };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
