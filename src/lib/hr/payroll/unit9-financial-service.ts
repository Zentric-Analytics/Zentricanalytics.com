import crypto from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { appendHrAudit } from "@/lib/hr/audit";
import { sealHrCredential } from "@/lib/hr/auth/crypto";
import { payrollDigest, paymentInstructionKey } from "./unit9-domain";
import { assertPaymentTransition, reconcileJournal, type PaymentState } from "./unit9-engine";
import { assertOfficialPayrollCandidateCertified } from "./unit9-candidate-certification";

type Actor = { organizationId: string; userId: string; role: string };

async function assertRemittanceCandidateCertified(tx: Prisma.TransactionClient, organizationId: string, remittanceBatchId: string) {
  const liabilityIds = (await tx.hrPayrollRemittanceLine.findMany({ where: { organizationId, remittanceBatchId }, select: { liabilityId: true } })).map((line) => line.liabilityId);
  const runIds = [...new Set((await tx.hrPayrollStatutoryLiability.findMany({ where: { organizationId, id: { in: liabilityIds } }, select: { payrollRunId: true } })).map((liability) => liability.payrollRunId))];
  if (!runIds.length) throw new Error("PAYROLL_CANDIDATE_VERSION_MISMATCH");
  for (const runId of runIds) await assertOfficialPayrollCandidateCertified(tx, organizationId, runId);
}

export async function createPaymentDestinationVersion(db: PrismaClient, actor: Actor, input: { employeeId: string; bankName: string; accountName: string; accountNumber: string; currency: string; effectiveFrom: Date }) {
  if (!/^\d{6,34}$/.test(input.accountNumber)) throw new Error("Payment destination account number is invalid.");
  return db.$transaction(async (tx) => {
    const employee = await tx.hrEmployee.findFirst({ where: { id: input.employeeId, organizationId: actor.organizationId } });
    if (!employee) throw new Error("Employee is outside the tenant.");
    const latest = await tx.hrPayrollPaymentDestinationVersion.findFirst({ where: { organizationId: actor.organizationId, employeeId: employee.id }, orderBy: { version: "desc" } });
    if (latest && input.effectiveFrom <= latest.effectiveFrom) throw new Error("Payment destination versions must be effective-dated in order.");
    if (latest) await tx.hrPayrollPaymentDestinationVersion.update({ where: { id: latest.id }, data: { effectiveTo: input.effectiveFrom } });
    const destination = await tx.hrPayrollPaymentDestinationVersion.create({ data: { organizationId: actor.organizationId, employeeId: employee.id, version: (latest?.version ?? 0) + 1, bankName: input.bankName.trim(), accountNameEncrypted: sealHrCredential(input.accountName), accountNumberEncrypted: sealHrCredential(input.accountNumber), accountNumberLastFour: input.accountNumber.slice(-4), currency: input.currency, effectiveFrom: input.effectiveFrom, supersedesId: latest?.id, changedById: actor.userId, correlationId: crypto.randomUUID() } });
    await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollPaymentDestinationVersion", entityId: destination.id, action: "unit9.payment_destination.versioned", newValues: { employeeId: employee.id, version: destination.version, bankName: destination.bankName, accountNumberLastFour: destination.accountNumberLastFour, currency: destination.currency, effectiveFrom: destination.effectiveFrom }, correlationId: destination.correlationId });
    return { ...destination, accountNameEncrypted: undefined, accountNumberEncrypted: undefined };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function verifyPaymentDestinationVersion(db: PrismaClient, actor: Actor, destinationId: string, reason: string) {
  return db.$transaction(async (tx) => {
    const destination = await tx.hrPayrollPaymentDestinationVersion.findFirst({ where: { id: destinationId, organizationId: actor.organizationId } });
    if (!destination) throw new Error("Payment destination is outside the tenant.");
    if (destination.verificationStatus === "VERIFIED") return destination;
    if (destination.changedById === actor.userId) throw new Error("Payment destination maker/checker separation prohibits self-verification.");
    const verified = await tx.hrPayrollPaymentDestinationVersion.update({ where: { id: destination.id }, data: { verificationStatus: "VERIFIED", verifiedById: actor.userId, verifiedAt: new Date() } });
    await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollPaymentDestinationVersion", entityId: destination.id, action: "unit9.payment_destination.verified", reason, newValues: { employeeId: destination.employeeId, version: destination.version, accountNumberLastFour: destination.accountNumberLastFour }, correlationId: destination.correlationId });
    return { ...verified, accountNameEncrypted: undefined, accountNumberEncrypted: undefined };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function generateUnit9Payslips(db: PrismaClient, actor: Actor, runId: string) {
  return db.$transaction(async (tx) => {
    const run = await tx.hrPayrollAuthoritativeRun.findFirst({ where: { id: runId, organizationId: actor.organizationId, status: "FINALIZED" } });
    if (!run) throw new Error("Official payslips require finalized authoritative payroll.");
    await assertOfficialPayrollCandidateCertified(tx, actor.organizationId, run.id);
    const results = await tx.hrPayrollAuthoritativeResult.findMany({ where: { organizationId: actor.organizationId, payrollRunId: run.id, authoritativeAt: { not: null }, finalizedAt: { not: null } }, orderBy: { employeeId: "asc" } });
    for (const result of results) {
      const contentHash = payrollDigest({ resultId: result.id, outputHash: result.outputHash, jurisdictionVersionId: run.jurisdictionVersionId, generationVersion: "unit9-payslip-1" });
      await tx.hrPayrollPayslipVersion.upsert({ where: { payrollResultId_version: { payrollResultId: result.id, version: 1 } }, create: { organizationId: actor.organizationId, employeeId: result.employeeId, payrollResultId: result.id, version: 1, artifactKey: `payroll/${actor.organizationId}/${result.employeeId}/${result.id}/v1-${contentHash}.pdf`, contentHash, correlationId: crypto.randomUUID() }, update: {} });
    }
    await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollAuthoritativeRun", entityId: run.id, action: "unit9.payslips.generated", newValues: { count: results.length, generationVersion: "unit9-payslip-1" }, correlationId: run.correlationId });
    return { runId: run.id, generated: results.length };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function publishUnit9Payslip(db: PrismaClient, actor: Actor, payslipId: string) {
  return db.$transaction(async (tx) => {
    const payslip = await tx.hrPayrollPayslipVersion.findFirst({ where: { id: payslipId, organizationId: actor.organizationId, status: "GENERATED" } });
    if (!payslip) throw new Error("Generated tenant payslip was not found.");
    const result = await tx.hrPayrollAuthoritativeResult.findFirst({ where: { id: payslip.payrollResultId, organizationId: actor.organizationId, finalizedAt: { not: null } } });
    if (!result) throw new Error("Payslip publication requires a finalized result.");
    await assertOfficialPayrollCandidateCertified(tx, actor.organizationId, result.payrollRunId);
    const published = await tx.hrPayrollPayslipVersion.update({ where: { id: payslip.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollPayslipVersion", entityId: payslip.id, action: "unit9.payslip.published", newValues: { employeeId: payslip.employeeId, contentHash: payslip.contentHash }, correlationId: payslip.correlationId });
    return published;
  });
}

export async function createCorrectedUnit9Payslip(db: PrismaClient, actor: Actor, input: { correctedResultId: string; supersedesPayslipId: string }) {
  return db.$transaction(async (tx) => {
    const [result, original] = await Promise.all([
      tx.hrPayrollAuthoritativeResult.findFirst({ where: { id: input.correctedResultId, organizationId: actor.organizationId, finalizedAt: { not: null } } }),
      tx.hrPayrollPayslipVersion.findFirst({ where: { id: input.supersedesPayslipId, organizationId: actor.organizationId, status: "PUBLISHED" } }),
    ]);
    if (!result || !original || result.employeeId !== original.employeeId) throw new Error("Corrected payslip lineage is invalid or outside the tenant.");
    await assertOfficialPayrollCandidateCertified(tx, actor.organizationId, result.payrollRunId);
    const version = original.version + 1;
    const contentHash = payrollDigest({ resultId: result.id, outputHash: result.outputHash, supersedesId: original.id, generationVersion: "unit9-payslip-1" });
    const corrected = await tx.hrPayrollPayslipVersion.create({ data: { organizationId: actor.organizationId, employeeId: result.employeeId, payrollResultId: result.id, version, artifactKey: `payroll/${actor.organizationId}/${result.employeeId}/${result.id}/v${version}-${contentHash}.pdf`, contentHash, supersedesId: original.id, correlationId: crypto.randomUUID() } });
    await tx.hrPayrollPayslipVersion.update({ where: { id: original.id }, data: { status: "SUPERSEDED" } });
    await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollPayslipVersion", entityId: corrected.id, action: "unit9.payslip.corrected", newValues: { supersedesId: original.id, version }, correlationId: corrected.correlationId });
    return corrected;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createUnit9PaymentBatch(db: PrismaClient, actor: Actor, runId: string) {
  return db.$transaction(async (tx) => {
    const run = await tx.hrPayrollAuthoritativeRun.findFirst({ where: { id: runId, organizationId: actor.organizationId, status: "FINALIZED" } });
    if (!run) throw new Error("Payment batches require finalized tenant payroll.");
    await assertOfficialPayrollCandidateCertified(tx, actor.organizationId, run.id);
    const existing = await tx.hrPayrollPaymentBatch.findFirst({ where: { organizationId: actor.organizationId, payrollRunId: run.id, version: 1 } });
    if (existing) return { batch: existing, idempotent: true };
    const results = await tx.hrPayrollAuthoritativeResult.findMany({ where: { organizationId: actor.organizationId, payrollRunId: run.id, authoritativeAt: { not: null }, finalizedAt: { not: null } } });
    let total = new Prisma.Decimal(0);
    let currency = "NGN";
    const instructions: Array<{ resultId: string; destinationId: string; currency: string; amount: Prisma.Decimal }> = [];
    for (const result of results) {
      const snapshot = await tx.hrPayrollInputSnapshot.findFirstOrThrow({ where: { id: result.inputSnapshotId, organizationId: actor.organizationId } });
      const destinationId = (snapshot.sourceManifest as { paymentDestinationVersionId?: string }).paymentDestinationVersionId;
      const destination = destinationId ? await tx.hrPayrollPaymentDestinationVersion.findFirst({ where: { id: destinationId, organizationId: actor.organizationId, employeeId: result.employeeId, verificationStatus: "VERIFIED" } }) : null;
      if (!destination) throw new Error(`Verified frozen payment destination is missing for employee ${result.employeeId}.`);
      if (destination.currency !== result.currency) throw new Error("Payment destination currency does not match finalized result.");
      total = total.plus(result.netPay); currency = result.currency;
      instructions.push({ resultId: result.id, destinationId: destination.id, currency: result.currency, amount: result.netPay });
    }
    const batch = await tx.hrPayrollPaymentBatch.create({ data: { organizationId: actor.organizationId, payrollRunId: run.id, version: 1, status: "VALIDATED", currency, instructionCount: instructions.length, totalAmount: total, createdById: actor.userId, correlationId: crypto.randomUUID() } });
    for (const instruction of instructions) await tx.hrPayrollPaymentInstruction.create({ data: { organizationId: actor.organizationId, payrollResultId: instruction.resultId, destinationVersionId: instruction.destinationId, currency: instruction.currency, amount: instruction.amount, logicalKey: paymentInstructionKey({ organizationId: actor.organizationId, finalizedResultId: instruction.resultId, destinationVersionId: instruction.destinationId, amount: instruction.amount, currency: instruction.currency }), correlationId: crypto.randomUUID() } });
    await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollPaymentBatch", entityId: batch.id, action: "unit9.payment_batch.created", newValues: { instructionCount: batch.instructionCount, totalAmount: batch.totalAmount.toFixed(4), currency }, correlationId: batch.correlationId });
    return { batch, idempotent: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function transitionUnit9PaymentBatch(db: PrismaClient, actor: Actor, batchId: string, input: { to: "APPROVED" | "EXPORTED" | "SUBMITTED" | "ACKNOWLEDGED" | "SETTLED" | "REJECTED" | "RETURNED"; reason: string; providerReference?: string }) {
  return db.$transaction(async (tx) => {
    const batch = await tx.hrPayrollPaymentBatch.findFirst({ where: { id: batchId, organizationId: actor.organizationId } });
    if (!batch) throw new Error("Payment batch is outside the tenant.");
    if (!['REJECTED', 'RETURNED'].includes(input.to)) await assertOfficialPayrollCandidateCertified(tx, actor.organizationId, batch.payrollRunId);
    if (batch.status === input.to) return batch;
    if (input.to === "APPROVED" && batch.createdById === actor.userId) throw new Error("Payment maker/checker separation prohibits self-approval.");
    assertPaymentTransition(batch.status as PaymentState, input.to);
    const now = new Date();
    const exportHash = input.to === "EXPORTED" ? payrollDigest({ batchId: batch.id, version: batch.version, count: batch.instructionCount, total: batch.totalAmount.toFixed(4) }) : batch.exportHash;
    const data = { status: input.to, exportHash, approvedById: input.to === "APPROVED" ? actor.userId : batch.approvedById, approvedAt: input.to === "APPROVED" ? now : batch.approvedAt, exportedAt: input.to === "EXPORTED" ? now : batch.exportedAt, submittedAt: input.to === "SUBMITTED" ? now : batch.submittedAt, acknowledgedAt: input.to === "ACKNOWLEDGED" ? now : batch.acknowledgedAt, settledAt: input.to === "SETTLED" ? now : batch.settledAt, providerReference: input.providerReference ?? batch.providerReference };
    const changed = await tx.hrPayrollPaymentBatch.updateMany({ where: { id: batch.id, organizationId: actor.organizationId, status: batch.status }, data });
    if (changed.count !== 1) throw new Error("Payment transition lost a concurrent race.");
    if (["SUBMITTED", "SETTLED", "REJECTED", "RETURNED"].includes(input.to)) await tx.hrPayrollPaymentInstruction.updateMany({ where: { organizationId: actor.organizationId, payrollResultId: { in: (await tx.hrPayrollAuthoritativeResult.findMany({ where: { organizationId: actor.organizationId, payrollRunId: batch.payrollRunId, authoritativeAt: { not: null } }, select: { id: true } })).map((result) => result.id) } }, data: { status: input.to, providerReference: input.providerReference, submittedAt: input.to === "SUBMITTED" ? now : undefined, settledAt: input.to === "SETTLED" ? now : undefined } });
    await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollPaymentBatch", entityId: batch.id, action: `unit9.payment_batch.${input.to.toLowerCase()}`, reason: input.reason, newValues: { providerReference: input.providerReference ? "[RECORDED]" : undefined, exportHash }, correlationId: batch.correlationId });
    return tx.hrPayrollPaymentBatch.findUniqueOrThrow({ where: { id: batch.id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function generateUnit9FinancialOutputs(db: PrismaClient, actor: Actor, runId: string, input: { periodKey: string }) {
  return db.$transaction(async (tx) => {
    const run = await tx.hrPayrollAuthoritativeRun.findFirst({ where: { id: runId, organizationId: actor.organizationId, status: "FINALIZED" } });
    if (!run) throw new Error("Accounting and statutory outputs require finalized tenant payroll.");
    await assertOfficialPayrollCandidateCertified(tx, actor.organizationId, run.id);
    const existing = await tx.hrPayrollJournalBatch.findFirst({ where: { organizationId: actor.organizationId, payrollRunId: run.id, version: 1 } });
    if (existing) return { journalBatchId: existing.id, idempotent: true };
    const results = await tx.hrPayrollAuthoritativeResult.findMany({ where: { organizationId: actor.organizationId, payrollRunId: run.id, authoritativeAt: { not: null }, finalizedAt: { not: null } } });
    const total = (field: "grossEarnings" | "paye" | "employeeDeductions" | "employerContributions" | "netPay") => results.reduce((sum, result) => sum.plus(result[field]), new Prisma.Decimal(0));
    const payeTotal = total("paye");
    const lines = [
      { accountCode: "PAYROLL_EXPENSE", debit: total("grossEarnings").plus(total("employerContributions")), sourceReference: run.id },
      { accountCode: "NET_PAY_PAYABLE", credit: total("netPay"), sourceReference: run.id },
      ...(payeTotal.isNegative()
        ? [{ accountCode: "PAYE_REFUND_RECEIVABLE", debit: payeTotal.abs(), sourceReference: run.id }]
        : [{ accountCode: "PAYE_PAYABLE", credit: payeTotal, sourceReference: run.id }]),
      { accountCode: "DEDUCTION_PAYABLE", credit: total("employeeDeductions"), sourceReference: run.id },
      { accountCode: "EMPLOYER_CONTRIBUTION_PAYABLE", credit: total("employerContributions"), sourceReference: run.id },
    ];
    const balanced = reconcileJournal(lines);
    const journal = await tx.hrPayrollJournalBatch.create({ data: { organizationId: actor.organizationId, payrollRunId: run.id, version: 1, status: "GENERATED", totalDebit: balanced.debit, totalCredit: balanced.credit, contentHash: balanced.hash, correlationId: crypto.randomUUID() } });
    await tx.hrPayrollJournalLine.createMany({ data: lines.map((line, sequence) => ({ organizationId: actor.organizationId, journalBatchId: journal.id, accountCode: line.accountCode, category: line.accountCode, debit: line.debit ?? new Prisma.Decimal(0), credit: line.credit ?? new Prisma.Decimal(0), sourceReference: line.sourceReference, sequence })) });
    for (const result of results) for (const liability of [{ category: result.paye.isNegative() ? "PAYE_REFUND_CREDIT" : "PAYE", amount: result.paye.abs() }, { category: "EMPLOYEE_DEDUCTION", amount: result.employeeDeductions }, { category: "EMPLOYER_CONTRIBUTION", amount: result.employerContributions }]) if (!liability.amount.isZero()) await tx.hrPayrollStatutoryLiability.create({ data: { organizationId: actor.organizationId, payrollRunId: run.id, payrollResultId: result.id, jurisdictionVersionId: run.jurisdictionVersionId, category: liability.category, periodKey: input.periodKey, amount: liability.amount, ruleVersion: "frozen-result", correlationId: crypto.randomUUID() } });
    await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollJournalBatch", entityId: journal.id, action: "unit9.financial_outputs.generated", newValues: { balanced: true, statutoryLiabilityCount: await tx.hrPayrollStatutoryLiability.count({ where: { organizationId: actor.organizationId, payrollRunId: run.id } }) }, correlationId: journal.correlationId });
    return { journalBatchId: journal.id, contentHash: journal.contentHash, idempotent: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createUnit9RemittanceBatch(db: PrismaClient, actor: Actor, input: { jurisdictionVersionId: string; periodKey: string; category: string }) {
  return db.$transaction(async (tx) => {
    const existing = await tx.hrPayrollRemittanceBatch.findFirst({ where: { organizationId: actor.organizationId, jurisdictionVersionId: input.jurisdictionVersionId, periodKey: input.periodKey, category: input.category, version: 1 } });
    if (existing) { await assertRemittanceCandidateCertified(tx, actor.organizationId, existing.id); return { batch: existing, idempotent: true }; }
    const liabilities = await tx.hrPayrollStatutoryLiability.findMany({ where: { organizationId: actor.organizationId, jurisdictionVersionId: input.jurisdictionVersionId, periodKey: input.periodKey, category: input.category, status: "OPEN" } });
    if (!liabilities.length) throw new Error("No open statutory liabilities match the remittance scope.");
    const sourceRunIds = [...new Set(liabilities.map((liability) => liability.payrollRunId))];
    for (const sourceRunId of sourceRunIds) await assertOfficialPayrollCandidateCertified(tx, actor.organizationId, sourceRunId);
    const total = liabilities.reduce((sum, liability) => sum.plus(liability.amount), new Prisma.Decimal(0));
    const batch = await tx.hrPayrollRemittanceBatch.create({ data: { organizationId: actor.organizationId, jurisdictionVersionId: input.jurisdictionVersionId, periodKey: input.periodKey, category: input.category, version: 1, totalAmount: total, correlationId: crypto.randomUUID() } });
    await tx.hrPayrollRemittanceLine.createMany({ data: liabilities.map((liability) => ({ organizationId: actor.organizationId, remittanceBatchId: batch.id, liabilityId: liability.id, amount: liability.amount })) });
    await tx.hrPayrollStatutoryLiability.updateMany({ where: { id: { in: liabilities.map((liability) => liability.id) }, organizationId: actor.organizationId }, data: { status: "BATCHED" } });
    await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollRemittanceBatch", entityId: batch.id, action: "unit9.remittance_batch.created", newValues: { category: batch.category, liabilityCount: liabilities.length, totalAmount: total.toFixed(4), simulationOnly: true }, correlationId: batch.correlationId });
    return { batch, idempotent: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function acknowledgeUnit9RemittanceSimulation(db: PrismaClient, actor: Actor, batchId: string, testReference: string) {
  return db.$transaction(async (tx) => {
    const batch = await tx.hrPayrollRemittanceBatch.findFirst({ where: { id: batchId, organizationId: actor.organizationId } });
    if (!batch) throw new Error("Remittance batch is outside the tenant.");
    await assertRemittanceCandidateCertified(tx, actor.organizationId, batch.id);
    const externalReference = `TEST:${testReference}`;
    if (batch.status === "ACKNOWLEDGED") {
      if (batch.externalReference !== externalReference) throw new Error("Conflicting simulated acknowledgement reference was rejected.");
      return batch;
    }
    if (batch.status !== "DRAFT") throw new Error("Only a draft remittance simulation may be acknowledged.");
    const claimed = await tx.hrPayrollRemittanceBatch.updateMany({ where: { id: batch.id, organizationId: actor.organizationId, status: "DRAFT", externalReference: null }, data: { status: "ACKNOWLEDGED", externalReference, acknowledgedAt: new Date() } });
    if (claimed.count !== 1) {
      const winner = await tx.hrPayrollRemittanceBatch.findFirst({ where: { id: batch.id, organizationId: actor.organizationId } });
      if (winner?.status === "ACKNOWLEDGED" && winner.externalReference === externalReference) return winner;
      throw new Error("Conflicting simulated acknowledgement won the concurrent claim.");
    }
    const updated = await tx.hrPayrollRemittanceBatch.findUniqueOrThrow({ where: { id: batch.id } });
    const liabilityIds = (await tx.hrPayrollRemittanceLine.findMany({ where: { organizationId: actor.organizationId, remittanceBatchId: batch.id }, select: { liabilityId: true } })).map((line) => line.liabilityId);
    await tx.hrPayrollStatutoryLiability.updateMany({ where: { organizationId: actor.organizationId, id: { in: liabilityIds } }, data: { status: "REMITTED_SIMULATION" } });
    await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollRemittanceBatch", entityId: batch.id, action: "unit9.remittance_simulation.acknowledged", newValues: { testReference: "[RECORDED]", realFiling: false }, correlationId: batch.correlationId });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createUnit9RemittanceAmendmentSimulation(db: PrismaClient, actor: Actor, batchId: string, input: { idempotencyKey: string; reason: string; deltaManifest: Prisma.InputJsonValue }) {
  const contentHash = payrollDigest({ batchId, reason: input.reason.trim(), deltaManifest: input.deltaManifest, simulationOnly: true });
  return db.$transaction(async (tx) => {
    const batch = await tx.hrPayrollRemittanceBatch.findFirst({ where: { id: batchId, organizationId: actor.organizationId, status: "ACKNOWLEDGED" } });
    if (!batch) throw new Error("Only an acknowledged tenant remittance simulation may be amended.");
    await assertRemittanceCandidateCertified(tx, actor.organizationId, batch.id);
    const existing = await tx.hrPayrollStatutoryAmendment.findUnique({ where: { organizationId_idempotencyKey: { organizationId: actor.organizationId, idempotencyKey: input.idempotencyKey } } });
    if (existing) {
      if (existing.originalRemittanceBatchId !== batch.id || existing.contentHash !== contentHash) throw new Error("Statutory amendment idempotency key was reused with conflicting content.");
      return { amendment: existing, idempotent: true };
    }
    const latest = await tx.hrPayrollStatutoryAmendment.findFirst({ where: { organizationId: actor.organizationId, originalRemittanceBatchId: batch.id }, orderBy: { version: "desc" } });
    const amendment = await tx.hrPayrollStatutoryAmendment.create({ data: { organizationId: actor.organizationId, originalRemittanceBatchId: batch.id, supersedesAmendmentId: latest?.id, version: (latest?.version ?? 0) + 1, idempotencyKey: input.idempotencyKey, reason: input.reason.trim(), deltaManifest: input.deltaManifest, contentHash, simulationOnly: true, correlationId: crypto.randomUUID() } });
    await appendHrAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, entityType: "HrPayrollStatutoryAmendment", entityId: amendment.id, action: "unit9.remittance_simulation.amended", reason: amendment.reason, newValues: { originalRemittanceBatchId: batch.id, version: amendment.version, supersedesAmendmentId: amendment.supersedesAmendmentId, simulationOnly: true }, correlationId: amendment.correlationId });
    return { amendment, idempotent: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
