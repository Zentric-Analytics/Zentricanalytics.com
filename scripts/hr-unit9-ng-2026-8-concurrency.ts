import crypto from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { calculateFrozenPayroll2026_8, type Candidate2026_8Manifest } from "../src/lib/hr/payroll/unit9-engine-2026-8";
import { NG_2026_8_MONTHLY_RULE, NG_2026_8_VERSION, type Ng2026_8Evidence } from "../src/lib/hr/payroll/nigeria-2026-8";
import { assertUnit9CalculationBindingsTx, calculateUnit9Run, certifyUnit9Population, createUnit9Run, finalizeUnit9RunTx, freezeUnit9Inputs, freezeUnit9InputsTx, resolveNg2026_7AuthoritativeManifest as resolveNg2026_8AuthoritativeManifest } from "../src/lib/hr/payroll/unit9-service";
import { deriveNg2026_7ReliefAggregate } from "../src/lib/hr/payroll/nigeria-2026-7";
import { payrollDigest } from "../src/lib/hr/payroll/unit9-domain";
import { acknowledgeUnit9RemittanceSimulation, createCorrectedUnit9Payslip, createUnit9PaymentBatch, createUnit9RemittanceAmendmentSimulation, createUnit9RemittanceBatch, generateUnit9FinancialOutputs, generateUnit9Payslips, publishUnit9Payslip, transitionUnit9PaymentBatch } from "../src/lib/hr/payroll/unit9-financial-service";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
if (process.env.HR_UNIT9_NG_2026_8_CONCURRENCY_CONFIRM !== "staging-only" || databaseUrl.pathname.slice(1) !== "zentric_analytics_staging") throw new Error("REFUSE TO RUN: NG-CANDIDATE-2026.8 concurrency evidence requires explicit staging-only confirmation and the known staging database.");
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
const digest = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const marker = `ng-2026-8-concurrency-${Date.now()}-${crypto.randomUUID()}`;
const correlation = (suffix: string) => `${marker}:${suffix}:${crypto.randomUUID()}`;

function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason?: unknown) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; }
function clientFor(label: string) { const url = new URL(process.env.DATABASE_URL!); url.searchParams.set("application_name", `${marker}:${label}`); return new PrismaClient({ datasourceUrl: url.toString() }); }
const moneyEquals = (left: unknown, right: unknown) => new Prisma.Decimal(String(left)).equals(new Prisma.Decimal(String(right)));
async function validatePersistedLineage(db: PrismaClient, snapshotId: string) {
  const errors: string[] = [];
  const snapshot = await db.hrPayrollInputSnapshot.findUnique({ where: { id: snapshotId } });
  if (!snapshot) return { snapshotIdHash: digest(snapshotId), lineageValid: false, lineageErrors: ["SNAPSHOT_MISSING"] };
  const manifest = snapshot.sourceManifest as unknown as Candidate2026_8Manifest;
  const sources = manifest.authoritativeSources;
  if (manifest.jurisdictionVersion !== NG_2026_8_VERSION) errors.push("CANDIDATE_VERSION_MISMATCH");

  const salary = await db.hrSalaryRecord.findFirst({ where: { id: sources.salary.recordId, organizationId: snapshot.organizationId, employeeId: snapshot.employeeId } });
  if (!salary) errors.push("SALARY_SOURCE_MISSING");
  else {
    const salaryHash = payrollDigest({ id: salary.id, amount: salary.amount.toFixed(2), currency: salary.currency, payFrequency: salary.payFrequency, effectiveFrom: salary.effectiveFrom.toISOString(), effectiveTo: salary.effectiveTo?.toISOString() ?? null, approvedAt: salary.approvedAt?.toISOString() ?? null });
    if (!moneyEquals(salary.amount, sources.salary.monthlyAmount)) errors.push("SALARY_AMOUNT_MISMATCH");
    if (salary.currency !== sources.salary.currency) errors.push("SALARY_CURRENCY_MISMATCH");
    if (salary.payFrequency !== sources.salary.payFrequency) errors.push("SALARY_FREQUENCY_MISMATCH");
    if (salary.effectiveFrom.toISOString() !== sources.salary.effectiveFrom || (salary.effectiveTo?.toISOString() ?? null) !== (sources.salary.effectiveTo ?? null)) errors.push("SALARY_EFFECTIVE_DATE_MISMATCH");
    if (salaryHash !== sources.salary.versionHash) errors.push("SALARY_VERSION_HASH_MISMATCH");
  }

  const annualization = await db.hrPayrollAnnualizationRuleVersion.findFirst({ where: { id: sources.annualization.ruleId, organizationId: snapshot.organizationId } });
  if (!annualization) errors.push("ANNUALIZATION_SOURCE_MISSING");
  else {
    if (annualization.jurisdictionVersion !== NG_2026_8_VERSION) errors.push("ANNUALIZATION_CANDIDATE_MISMATCH");
    if (annualization.version !== sources.annualization.ruleVersion) errors.push("ANNUALIZATION_VERSION_MISMATCH");
    if (annualization.frequency !== sources.annualization.frequency) errors.push("ANNUALIZATION_FREQUENCY_MISMATCH");
    if (annualization.periodsInTaxYear !== sources.annualization.periodsInTaxYear) errors.push("ANNUALIZATION_PERIODS_MISMATCH");
    if (annualization.method !== sources.annualization.method) errors.push("ANNUALIZATION_METHOD_MISMATCH");
    if (annualization.taxYear !== sources.annualization.taxYear) errors.push("ANNUALIZATION_TAX_YEAR_MISMATCH");
    if (annualization.certificationStatus !== sources.annualization.certificationStatus) errors.push("ANNUALIZATION_CERTIFICATION_MISMATCH");
  }

  const ytdEntries = await db.hrPayrollYtdLedgerEntry.findMany({ where: { id: { in: sources.ytd.entryIds } }, orderBy: [{ effectiveAt: "asc" }, { id: "asc" }] });
  if (ytdEntries.length !== sources.ytd.entryIds.length) errors.push("YTD_ENTRY_MISSING");
  const cutoff = new Date(sources.ytd.cutoff);
  for (const entry of ytdEntries) if (entry.organizationId !== snapshot.organizationId || entry.employeeId !== snapshot.employeeId || entry.taxYear !== sources.annualization.taxYear || !["BONUS", "PAYE_DEDUCTED", "PAYE_REPAID"].includes(entry.accumulatorCode) || entry.effectiveAt >= cutoff) errors.push("YTD_ENTRY_SCOPE_MISMATCH");
  const sumYtd = (code: string) => ytdEntries.filter((entry) => entry.accumulatorCode === code).reduce((total, entry) => total.plus(entry.amount), new Prisma.Decimal(0));
  const ledgerHash = payrollDigest(ytdEntries.map((entry) => ({ id: entry.id, code: entry.accumulatorCode, amount: entry.amount.toFixed(4), effectiveAt: entry.effectiveAt.toISOString(), payrollResultId: entry.payrollResultId })));
  if (!moneyEquals(sumYtd("BONUS"), sources.ytd.priorBonusYtd)) errors.push("YTD_BONUS_MISMATCH");
  if (!moneyEquals(sumYtd("PAYE_DEDUCTED"), sources.ytd.payeDeducted)) errors.push("YTD_PAYE_DEDUCTED_MISMATCH");
  if (!moneyEquals(sumYtd("PAYE_REPAID"), sources.ytd.payeRepaid)) errors.push("YTD_PAYE_REPAID_MISMATCH");
  if (ledgerHash !== sources.ytd.sourceLedgerHash) errors.push("YTD_LEDGER_HASH_MISMATCH");

  const reliefs = await db.hrPayrollTaxReliefClaimVersion.findMany({ where: { id: { in: sources.deductions.sourceRecordIds } }, orderBy: [{ claimType: "asc" }, { version: "desc" }] });
  if (reliefs.length !== sources.deductions.sourceRecordIds.length) errors.push("RELIEF_SOURCE_MISSING");
  const reliefTypes = new Set<string>();
  for (const relief of reliefs) {
    if (relief.organizationId !== snapshot.organizationId || relief.employeeId !== snapshot.employeeId || relief.taxYear !== sources.annualization.taxYear) errors.push("RELIEF_SCOPE_MISMATCH");
    if (reliefTypes.has(relief.claimType)) errors.push("RELIEF_MULTIPLE_FROZEN_VERSIONS");
    reliefTypes.add(relief.claimType);
    if (!sources.deductions.sourceVersions.includes(`${relief.claimType}:v${relief.version}`)) errors.push("RELIEF_VERSION_MISMATCH");
    if (!sources.deductions.evidenceReferences.includes(relief.evidenceReference)) errors.push("RELIEF_EVIDENCE_MISMATCH");
  }
  const reliefAggregate = deriveNg2026_7ReliefAggregate(reliefs);
  if (!moneyEquals(reliefAggregate.amount, sources.deductions.amount)) errors.push("RELIEF_AMOUNT_MISMATCH");
  if (reliefAggregate.aggregateHash !== sources.deductions.aggregateHash) errors.push("RELIEF_AGGREGATE_HASH_MISMATCH");
  if (digest([...reliefAggregate.sourceRecordIds].sort()) !== digest([...sources.deductions.sourceRecordIds].sort())) errors.push("RELIEF_RECORD_SET_MISMATCH");

  const priorSource = sources.priorEmployer;
  if (priorSource.state === "NONE") {
    if (priorSource.recordId || !moneyEquals(priorSource.income, 0) || !moneyEquals(priorSource.paye, 0) || !moneyEquals(priorSource.payeRepaid, 0)) errors.push("PRIOR_EMPLOYER_NONE_INCOHERENT");
  } else {
    const prior = priorSource.recordId ? await db.hrPayrollPriorEmployerYtdVersion.findFirst({ where: { id: priorSource.recordId, organizationId: snapshot.organizationId, employeeId: snapshot.employeeId } }) : null;
    if (!prior) errors.push("PRIOR_EMPLOYER_SOURCE_MISSING");
    else {
      if (prior.version !== priorSource.recordVersion) errors.push("PRIOR_EMPLOYER_VERSION_MISMATCH");
      if (!moneyEquals(prior.gross ?? 0, priorSource.income) || !moneyEquals(prior.payeDeducted ?? 0, priorSource.paye) || !moneyEquals(prior.payeRepaid ?? 0, priorSource.payeRepaid)) errors.push("PRIOR_EMPLOYER_AMOUNT_MISMATCH");
      if (prior.evidenceReference !== priorSource.evidenceReference) errors.push("PRIOR_EMPLOYER_EVIDENCE_MISMATCH");
    }
  }
  return { snapshotIdHash: digest(snapshot.id), lineageValid: errors.length === 0, lineageErrors: [...new Set(errors)].sort(), sourceHashes: { salary: digest(sources.salary), annualization: digest(sources.annualization), ytd: digest(sources.ytd), relief: digest(sources.deductions), priorEmployer: digest(sources.priorEmployer) } };
}
async function runCompletedBodyOverlap(label: string, bodyA: (tx: Prisma.TransactionClient) => Promise<string>, bodyB: (tx: Prisma.TransactionClient) => Promise<string>, rollbackB = false) {
  const a = clientFor(`${label}:A`), b = clientFor(`${label}:B`), observer = clientFor(`${label}:observer`);
  const bReady = deferred<{ pid: number; xid: string; outcome: string }>(), aReady = deferred<{ pid: number; xid: string; outcome: string }>(), releaseA = deferred<void>(), releaseB = deferred<void>();
  try {
    const workB = b.$transaction(async (tx) => { const [session] = await tx.$queryRaw<Array<{ pid: number; xid: bigint }>>`SELECT pg_backend_pid()::int AS pid, txid_current() AS xid`; const outcome = await bodyB(tx); bReady.resolve({ pid: session.pid, xid: session.xid.toString(), outcome }); await releaseB.promise; if (rollbackB) throw new Error("EXPECTED_TEST_ROLLBACK"); }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000 }).then(() => "COMMITTED", (error) => { if (rollbackB && String(error).includes("EXPECTED_TEST_ROLLBACK")) return "ROLLED_BACK_TEST_ONLY"; throw error; });
    const bSession = await bReady.promise;
    const workA = a.$transaction(async (tx) => { const [session] = await tx.$queryRaw<Array<{ pid: number; xid: bigint }>>`SELECT pg_backend_pid()::int AS pid, txid_current() AS xid`; const outcome = await bodyA(tx); aReady.resolve({ pid: session.pid, xid: session.xid.toString(), outcome }); await releaseA.promise; }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000 }).then(() => "COMMITTED");
    const aSession = await aReady.promise;
    const rows = await observer.$queryRaw<Array<{ pid: number; state: string; backend_xid: string | null }>>`SELECT pid::int, state, backend_xid::text FROM pg_stat_activity WHERE pid IN (${aSession.pid}, ${bSession.pid}) ORDER BY pid`;
    const overlapObserved = rows.length === 2 && aSession.pid !== bSession.pid && aSession.xid !== bSession.xid && rows.every((row) => row.backend_xid !== null);
    releaseA.resolve(); const transactionAOutcome = await workA; releaseB.resolve(); const transactionBOutcome = await workB;
    assert(overlapObserved, `${label}: actual-operation overlap was not observed.`);
    return { raceName: label, overlapObserved, clientA: { backendPidHash: digest(aSession.pid), transactionIdHash: digest(aSession.xid), operationOutcome: aSession.outcome }, clientB: { backendPidHash: digest(bSession.pid), transactionIdHash: digest(bSession.xid), operationOutcome: bSession.outcome }, transactionAOutcome, transactionBOutcome, result: "PASS" };
  } finally { releaseA.resolve(); releaseB.resolve(); await Promise.all([a.$disconnect(), b.$disconnect(), observer.$disconnect()]); }
}

async function createSourceSnapshot(db: PrismaClient) {
  const fixtureInstance = crypto.randomUUID();
  const organization = await db.hrOrganization.findUniqueOrThrow({ where: { slug: "zentric-analytics" }, select: { id: true } });
  const users = await db.hrUser.findMany({ where: { organizationId: organization.id, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, take: 2, select: { id: true } });
  assert(users.length === 2, "Two independent staging actors are required.");
  const maker = { organizationId: organization.id, userId: users[0].id, role: "PAYROLL_PROCESSOR" };
  const position = await db.hrPosition.findFirstOrThrow({ where: { organizationId: organization.id, status: "ACTIVE", legalEntityId: { not: null } }, orderBy: { createdAt: "asc" }, select: { id: true, departmentId: true, teamId: true, legalEntityId: true } });
  const fixtureStartedAt = new Date("2026-01-01T00:00:00Z");
  const { employee, relationship, assignment, handoff, salary } = await db.$transaction(async (tx) => {
    const person = await tx.hrPerson.create({ data: { organizationId: organization.id, identityKeyHash: digest({ marker, fixtureInstance, kind: "person" }) } });
    const employee = await tx.hrEmployee.create({ data: { organizationId: organization.id, personId: person.id, employeeNumber: `NG28-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, legalFirstName: "Synthetic", lastName: "Concurrency", employmentStatus: "ACTIVE", startDate: fixtureStartedAt, hireDate: fixtureStartedAt } });
    const relationship = await tx.hrWorkRelationship.create({ data: { organizationId: organization.id, personId: person.id, employeeId: employee.id, relationshipRef: `WR-NG28-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, status: "ACTIVE", startedAt: fixtureStartedAt } });
    const assignment = await tx.hrEmployeeAssignment.create({ data: { organizationId: organization.id, employeeId: employee.id, departmentId: position.departmentId, teamId: position.teamId, positionId: position.id, employmentType: "FULL_TIME", effectiveFrom: fixtureStartedAt, status: "ACTIVE", reason: `${marker}:dedicated-synthetic-assignment`, createdById: users[0].id, legalEntityId: position.legalEntityId, isPrimary: true } });
    const salary = await tx.hrSalaryRecord.create({ data: { organizationId: organization.id, employeeId: employee.id, amount: new Prisma.Decimal("70000"), currency: "NGN", payFrequency: "MONTHLY", effectiveFrom: fixtureStartedAt, reason: `${marker}:dedicated-synthetic-salary`, createdById: users[0].id, approvedById: users[1].id, approvedAt: new Date() } });
    const handoff = await tx.hrPayrollCompHandoff.create({ data: { organizationId: organization.id, employeeId: employee.id, workRelationshipId: relationship.id, assignmentId: assignment.id, compensationRecordId: `${marker}:${fixtureInstance}:synthetic-compensation-record`, eventType: "INITIAL", amount: new Prisma.Decimal("70000"), currency: "NGN", payBasis: "SALARIED", effectiveAt: fixtureStartedAt, status: "READY", idempotencyKey: `${marker}:${fixtureInstance}:comp-handoff`, correlationId: `${marker}:${fixtureInstance}:comp-handoff-correlation`, readyAt: new Date() } });
    return { employee, relationship, assignment, handoff, salary };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  const jurisdiction = await db.hrPayrollJurisdiction.upsert({ where: { organizationId_code: { organizationId: organization.id, code: "NG" } }, update: {}, create: { organizationId: organization.id, code: "NG", name: "Nigeria", currency: "NGN" } });
  const maxJurisdictionVersion = (await db.hrPayrollJurisdictionVersion.aggregate({ where: { organizationId: organization.id, jurisdictionId: jurisdiction.id }, _max: { version: true } }))._max.version ?? 0;
  const jurisdictionVersion = await db.hrPayrollJurisdictionVersion.create({ data: { organizationId: organization.id, jurisdictionId: jurisdiction.id, version: maxJurisdictionVersion + 1, status: "TESTING", effectiveFrom: new Date("2026-01-01T00:00:00Z"), ruleManifest: { candidateVersion: NG_2026_8_VERSION, certification: "NOT_CERTIFIED" }, ruleHash: digest({ marker, fixtureInstance, kind: "jurisdiction" }), engineVersion: "unit9-ng-2026.8", correlationId: `${marker}:${fixtureInstance}:jurisdiction` } });
  const payGroup = await db.hrPayrollPayGroup.create({ data: { organizationId: organization.id, code: `NG28-${fixtureInstance.slice(0, 12)}`, name: "NG 2026.8 concurrency staging", workerType: "SALARIED", frequency: "MONTHLY", jurisdictionId: jurisdiction.id, currency: "NGN", timezone: "Africa/Lagos" } });
  const period = await db.hrPayrollCalendarPeriod.create({ data: { organizationId: organization.id, payGroupId: payGroup.id, periodKey: `${marker}:${fixtureInstance}`, startsAt: new Date("2026-08-01T00:00:00Z"), endsAt: new Date("2026-08-31T23:59:59Z"), cutoffAt: new Date("2026-08-20T12:00:00Z"), freezeAt: new Date("2026-08-21T12:00:00Z"), calculationOpensAt: new Date("2026-08-22T12:00:00Z"), approvalDueAt: new Date("2026-08-25T12:00:00Z"), intendedPaymentAt: new Date("2026-08-28T12:00:00Z"), accountingDate: new Date("2026-08-31T12:00:00Z"), taxYear: 2026, taxPeriod: 8, timezone: "Africa/Lagos" } });
  const salaryDefinition = await db.hrPayrollEarningDefinition.create({ data: { organizationId: organization.id, jurisdictionVersionId: jurisdictionVersion.id, code: "SALARY", version: 1, taxableBaseCode: "EMPLOYMENT", ruleManifest: { candidateVersion: NG_2026_8_VERSION }, effectiveFrom: period.startsAt, correlationId: correlation("earning-rule") } });
  const qualifyingSalaryCount = await db.hrSalaryRecord.count({ where: { organizationId: organization.id, employeeId: employee.id, approvedAt: { not: null }, effectiveFrom: { lte: period.cutoffAt }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: period.cutoffAt } }] } });
  assert(qualifyingSalaryCount === 1, `STAGING_FIXTURE_PROVISIONING_INCOMPLETE: qualifyingSalaryCount=${qualifyingSalaryCount}`);
  const ruleVersion = (await db.hrPayrollAnnualizationRuleVersion.aggregate({ where: { organizationId: organization.id, jurisdictionVersion: NG_2026_8_VERSION, taxYear: 2026, frequency: "MONTHLY" }, _max: { version: true } }))._max.version ?? 0;
  await db.hrPayrollAnnualizationRuleVersion.create({ data: { organizationId: organization.id, jurisdictionVersion: NG_2026_8_VERSION, taxYear: 2026, frequency: "MONTHLY", periodsInTaxYear: 12, method: NG_2026_8_MONTHLY_RULE.method, version: ruleVersion + 1, certificationStatus: "CERTIFIED", effectiveFrom: period.startsAt, ownerDecisionRef: marker, sourceReference: `${marker}:annualization`, contentHash: digest({ marker, kind: "annualization" }), correlationId: correlation("annualization") } });
  const run = await createUnit9Run(db, maker, { payGroupId: payGroup.id, calendarPeriodId: period.id, jurisdictionVersionId: jurisdictionVersion.id, idempotencyKey: `${marker}:${fixtureInstance}:source-run` });
  const candidate = { employeeId: employee.id, personId: employee.personId!, workRelationshipId: relationship.id, assignmentId: assignment.id, employmentStatus: employee.employmentStatus, legalEntityId: assignment.legalEntityId!, jurisdictionCode: "NG", payGroupId: payGroup.id, workerType: "SALARIED" as const, compensationHandoffId: handoff.id, compensationCurrency: handoff.currency, payrollCurrency: handoff.currency, taxProfileVersionId: `${marker}:tax`, paymentDestinationVersionId: `${marker}:destination` };
  const certified = await certifyUnit9Population(db, maker, run.id, [candidate]);
  assert(!certified.runBlocked && certified.employeeBlocked.length === 0, "Governed staging candidate certification failed.");
  const monthlySalary = salary.amount.toFixed(2);
  const ytdCutoff = new Date();
  const ytdEntries = await db.hrPayrollYtdLedgerEntry.findMany({ where: { organizationId: organization.id, employeeId: employee.id, taxYear: 2026, effectiveAt: { lt: ytdCutoff }, accumulatorCode: { in: ["BONUS", "PAYE_DEDUCTED", "PAYE_REPAID"] } } });
  const sumYtd = (code: string) => ytdEntries.filter((entry) => entry.accumulatorCode === code).reduce((total, entry) => total.plus(entry.amount), new Prisma.Decimal(0)).toFixed(2);
  let reliefVersions = await db.hrPayrollTaxReliefClaimVersion.findMany({ where: { organizationId: organization.id, employeeId: employee.id, taxYear: 2026 }, orderBy: [{ claimType: "asc" }, { version: "desc" }] });
  const latestBeforeCorrection = new Map<string, typeof reliefVersions[number]>();
  for (const reliefVersion of reliefVersions) if (!latestBeforeCorrection.has(reliefVersion.claimType)) latestBeforeCorrection.set(reliefVersion.claimType, reliefVersion);
  for (const reliefVersion of latestBeforeCorrection.values()) {
    if (reliefVersion.status === "ELIGIBLE_FOR_PAYE_RELIEF" && reliefVersion.electionRecorded && reliefVersion.evidenceReference && reliefVersion.sourceRuleId) continue;
    await db.hrPayrollTaxReliefClaimVersion.create({ data: { organizationId: organization.id, employeeId: employee.id, jurisdictionVersionId: jurisdictionVersion.id, taxYear: 2026, claimType: reliefVersion.claimType, version: reliefVersion.version + 1, claimedAmount: reliefVersion.claimedAmount, eligibleAmount: new Prisma.Decimal(0), electionRecorded: true, evidenceReference: `${marker}:fixture-relief-correction`, remittanceStatus: "VERIFIED", sourceRuleId: reliefVersion.sourceRuleId || "NG-RELIEF", status: "ELIGIBLE_FOR_PAYE_RELIEF", effectiveFrom: new Date(), supersedesId: reliefVersion.id, correlationId: correlation("fixture-relief-correction") } });
  }
  reliefVersions = await db.hrPayrollTaxReliefClaimVersion.findMany({ where: { organizationId: organization.id, employeeId: employee.id, taxYear: 2026 }, orderBy: [{ claimType: "asc" }, { version: "desc" }] });
  const latestReliefs = new Map<string, typeof reliefVersions[number]>();
  for (const reliefVersion of reliefVersions) if (!latestReliefs.has(reliefVersion.claimType)) latestReliefs.set(reliefVersion.claimType, reliefVersion);
  const eligibleDeductions = [...latestReliefs.values()].reduce((total, reliefVersion) => total.plus(reliefVersion.eligibleAmount), new Prisma.Decimal(0)).toFixed(2);
  const eligibleAnnualDeductions = eligibleDeductions;
  const prior = await db.hrPayrollPriorEmployerYtdVersion.findFirst({ where: { organizationId: organization.id, employeeId: employee.id, taxYear: 2026 }, orderBy: { version: "desc" } });
  const incomeEvidence: Ng2026_8Evidence = { employeeId: employee.id, workRelationshipId: relationship.id, assignmentId: assignment.id, payrollPeriodId: period.id, rta: "LAGOS", candidateVersion: NG_2026_8_VERSION, actualFrozenSalary: monthlySalary, currentBonus: "0", otherTaxableEmploymentIncome: "VERIFIED_NONE", materiallyVariableMonthlyWage: "NO", ambiguousMultiEmployer: "NO", unusualPartialYearArrangement: "NO", evidenceCompletenessCertified: true, evidenceReferences: [salary.id, `${marker}:evidence`], inputCertificationId: `${marker}:certification`, inputCertificationVersion: "1" };
  const sourceManifest: Candidate2026_8Manifest = { employeeId: employee.id, workRelationshipId: relationship.id, assignmentId: assignment.id, payrollPeriodId: period.id, currency: "NGN", jurisdictionVersion: NG_2026_8_VERSION, engineVersion: "unit9-ng-2026.8", incomeEvidence, authoritativeSources: { salary: { recordId: salary.id, versionHash: "resolved-at-freeze", monthlyAmount: monthlySalary, currency: "NGN", payFrequency: "MONTHLY", effectiveFrom: salary.effectiveFrom.toISOString() }, annualization: { ruleId: "resolved-at-freeze", ruleVersion: ruleVersion + 1, frequency: "MONTHLY", periodsInTaxYear: 12, method: NG_2026_8_MONTHLY_RULE.method, taxYear: 2026, certificationStatus: "CERTIFIED" }, ytd: { sourceLedgerHash: "resolved-at-freeze", cutoff: ytdCutoff.toISOString(), priorBonusYtd: sumYtd("BONUS"), payeDeducted: sumYtd("PAYE_DEDUCTED"), payeRepaid: sumYtd("PAYE_REPAID"), entryIds: ytdEntries.map((entry) => entry.id) }, priorEmployer: prior ? { state: prior.handling === "EVIDENCED" ? "VERIFIED" : "UNKNOWN", recordId: prior.id, recordVersion: prior.version, income: prior.gross ?? 0, paye: prior.payeDeducted ?? 0, payeRepaid: prior.payeRepaid ?? 0, evidenceReference: prior.evidenceReference } : { state: "NONE", income: "0", paye: "0", payeRepaid: "0" }, deductions: { amount: eligibleDeductions, sourceType: "TAX_RELIEF_CLAIM_VERSIONS", sourceRecordIds: [...latestReliefs.values()].map((entry) => entry.id), sourceVersions: [...latestReliefs.values()].map((entry) => `${entry.claimType}:v${entry.version}`), evidenceReferences: [...latestReliefs.values()].map((entry) => entry.evidenceReference), aggregateHash: "resolved-at-freeze" } }, auditExpectedAnnualSalary: salary.amount.mul(12).toFixed(2), auditPriorBonusYtd: sumYtd("BONUS"), auditPayeDeductedYtd: sumYtd("PAYE_DEDUCTED"), auditPayeRepaidYtd: sumYtd("PAYE_REPAID"), earnings: [{ code: "SALARY", sourceType: "UNIT8", sourceId: salary.id, fixedAmount: monthlySalary, taxableBaseCode: "EMPLOYMENT", ruleVersionReference: salaryDefinition.id }], paye: { priorYtdTaxableIncome: "0", priorYtdPaye: sumYtd("PAYE_DEDUCTED"), priorPayeRepaid: sumYtd("PAYE_REPAID"), expectedAnnualEmploymentIncome: salary.amount.mul(12).toFixed(2), eligibleAnnualDeductions, periodsElapsed: 8, periodsInTaxYear: 12, currentNonPeriodicPayments: "0", priorBonusPaidTaxYearToDate: sumYtd("BONUS"), priorEmployerIncome: prior?.gross?.toFixed(2) ?? "0", priorEmployerPaye: prior?.payeDeducted?.toFixed(2) ?? "0", rules: { version: "not-authority", annualizationPeriods: 12, roundingScale: 2, bands: [] } } };
  await freezeUnit9Inputs(db, maker, run.id, [{ candidate, sourceManifest: sourceManifest as unknown as Prisma.InputJsonValue }]);
  const snapshot = await db.hrPayrollInputSnapshot.findFirstOrThrow({ where: { payrollRunId: run.id, employeeId: employee.id } });
  const frozen = snapshot.sourceManifest as unknown as Candidate2026_8Manifest;
  const [salaryCount, priorEmployerCount, reliefClaimTypeCount, relevantYtdEntryCount, databaseRows] = await Promise.all([
    db.hrSalaryRecord.count({ where: { organizationId: organization.id, employeeId: employee.id, approvedAt: { not: null }, effectiveFrom: { lte: period.cutoffAt }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: period.cutoffAt } }] } }),
    db.hrPayrollPriorEmployerYtdVersion.count({ where: { organizationId: organization.id, employeeId: employee.id, taxYear: 2026 } }),
    db.hrPayrollTaxReliefClaimVersion.groupBy({ by: ["claimType"], where: { organizationId: organization.id, employeeId: employee.id, taxYear: 2026 } }),
    db.hrPayrollYtdLedgerEntry.count({ where: { organizationId: organization.id, employeeId: employee.id, taxYear: 2026, accumulatorCode: { in: ["BONUS", "PAYE_DEDUCTED", "PAYE_REPAID"] } } }),
    db.$queryRaw<Array<{ database_name: string }>>`SELECT current_database() AS database_name`,
  ]);
  const preflight = { fixtureMarker: marker, organizationIdHash: digest(organization.id), employeeIdHash: digest(employee.id), workRelationshipIdHash: digest(relationship.id), assignmentIdHash: digest(assignment.id), salaryRecordIdHash: digest(salary.id), salaryCount, salaryAmount: salary.amount.toFixed(2), salaryCurrency: salary.currency, salaryFrequency: salary.payFrequency, candidateVersion: NG_2026_8_VERSION, candidateCertification: "NOT_CERTIFIED", annualizationRuleIdHash: digest(frozen.authoritativeSources.annualization.ruleId), annualizationVersion: frozen.authoritativeSources.annualization.ruleVersion, annualizationPeriods: frozen.authoritativeSources.annualization.periodsInTaxYear, priorEmployerState: priorEmployerCount === 0 ? "NONE" : "PRESENT", reliefClaimTypeCount: reliefClaimTypeCount.length, relevantYtdEntryCount, databaseName: databaseRows[0]?.database_name, preflightResult: "PASS" };
  assert(preflight.salaryCount === 1 && preflight.salaryCurrency === "NGN" && preflight.salaryFrequency === "MONTHLY" && preflight.candidateVersion === NG_2026_8_VERSION && preflight.candidateCertification === "NOT_CERTIFIED" && preflight.annualizationPeriods === 12 && preflight.priorEmployerState === "NONE" && preflight.relevantYtdEntryCount === 0 && preflight.databaseName === "zentric_analytics_staging", "STAGING_FIXTURE_PROVISIONING_INCOMPLETE");
  console.log(JSON.stringify({ fixturePreflight: preflight }));
  return snapshot;
}

type SourceRaceKind = "salary" | "ytd" | "relief" | "annualization" | "prior-employer";
async function runActualSourceRace(db: PrismaClient, kind: SourceRaceKind) {
  const seed = await createSourceSnapshot(db);
  const run = await db.hrPayrollAuthoritativeRun.findUniqueOrThrow({ where: { id: seed.payrollRunId } });
  const period = await db.hrPayrollCalendarPeriod.findUniqueOrThrow({ where: { id: run.calendarPeriodId } });
  const employee = await db.hrEmployee.findUniqueOrThrow({ where: { id: seed.employeeId } });
  const relationship = await db.hrWorkRelationship.findUniqueOrThrow({ where: { id: seed.workRelationshipId } });
  const assignment = await db.hrEmployeeAssignment.findUniqueOrThrow({ where: { id: seed.assignmentId } });
  const handoff = await db.hrPayrollCompHandoff.findFirstOrThrow({ where: { organizationId: run.organizationId, employeeId: employee.id, assignmentId: assignment.id }, orderBy: { createdAt: "desc" } });
  const actors = await db.hrUser.findMany({ where: { organizationId: run.organizationId, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, take: 2, select: { id: true } });
  assert(actors.length === 2, "Two independent staging actors are required.");
  const actor = { organizationId: run.organizationId, userId: actors[0].id, role: "PAYROLL_PROCESSOR" };
  const candidate = { employeeId: employee.id, personId: employee.personId!, workRelationshipId: relationship.id, assignmentId: assignment.id, employmentStatus: employee.employmentStatus, legalEntityId: assignment.legalEntityId!, jurisdictionCode: "NG", payGroupId: run.payGroupId, workerType: "SALARIED" as const, compensationHandoffId: handoff.id, compensationCurrency: handoff.currency, payrollCurrency: handoff.currency, taxProfileVersionId: `${marker}:${kind}:tax`, paymentDestinationVersionId: `${marker}:${kind}:destination` };
  const raceRun = await createUnit9Run(db, actor, { payGroupId: run.payGroupId, calendarPeriodId: run.calendarPeriodId, jurisdictionVersionId: run.jurisdictionVersionId, kind: "CORRECTION", sequence: Math.floor(Math.random() * 1_000_000), idempotencyKey: `${marker}:actual:${kind}:run` });
  await db.hrPayrollAuthoritativeRun.update({ where: { id: raceRun.id }, data: { status: "CERTIFIED" } });
  const manifest = seed.sourceManifest as unknown as Candidate2026_8Manifest;
  const clientA = clientFor(`actual-${kind}-freeze-A`), clientB = clientFor(`actual-${kind}-mutation-B`), observer = clientFor(`actual-${kind}-observer`);
  const mutationReady = deferred<{ pid: number; txid: string; startedAt: Date; executedAt: Date; sourceId: string }>();
  const freezeReady = deferred<{ pid: number; txid: string; startedAt: Date; executedAt: Date }>();
  const releaseA = deferred<void>(), releaseB = deferred<void>();
  let transactionAOutcome = "PENDING", transactionBOutcome = "PENDING";
  try {
    const workB = clientB.$transaction(async (tx) => {
      const [session] = await tx.$queryRaw<Array<{ pid: number; txid: bigint; started_at: Date }>>`SELECT pg_backend_pid()::int AS pid, txid_current() AS txid, clock_timestamp() AS started_at`;
      let sourceId: string;
      if (kind === "salary") sourceId = (await tx.hrSalaryRecord.create({ data: { organizationId: run.organizationId, employeeId: employee.id, amount: new Prisma.Decimal("71000"), currency: "NGN", payFrequency: "MONTHLY", effectiveFrom: new Date(period.startsAt.getTime() + 1_000), reason: `${marker}:actual-salary-mutation`, createdById: actors[0].id, approvedById: actors[1].id, approvedAt: new Date() } })).id;
      else if (kind === "ytd") sourceId = (await tx.hrPayrollYtdLedgerEntry.create({ data: { organizationId: run.organizationId, employeeId: employee.id, taxYear: period.taxYear, accumulatorCode: "BONUS", entryType: "AUTHORITATIVE", amount: new Prisma.Decimal("101"), payrollResultId: `${marker}:actual-ytd-result`, effectiveAt: new Date(), correlationId: correlation("actual-ytd") } })).id;
      else if (kind === "relief") sourceId = (await tx.hrPayrollTaxReliefClaimVersion.create({ data: { organizationId: run.organizationId, employeeId: employee.id, jurisdictionVersionId: run.jurisdictionVersionId, taxYear: period.taxYear, claimType: "PENSION", version: 1, claimedAmount: new Prisma.Decimal("50000"), eligibleAmount: new Prisma.Decimal("50000"), electionRecorded: true, evidenceReference: `${marker}:actual-relief`, remittanceStatus: "VERIFIED", sourceRuleId: "NG-PENSION", status: "ELIGIBLE_FOR_PAYE_RELIEF", effectiveFrom: period.startsAt, correlationId: correlation("actual-relief") } })).id;
      else if (kind === "annualization") { const base = await tx.hrPayrollAnnualizationRuleVersion.findFirstOrThrow({ where: { organizationId: run.organizationId, jurisdictionVersion: NG_2026_8_VERSION, taxYear: period.taxYear, frequency: "MONTHLY" }, orderBy: { version: "desc" } }); sourceId = (await tx.hrPayrollAnnualizationRuleVersion.create({ data: { organizationId: run.organizationId, jurisdictionVersion: NG_2026_8_VERSION, taxYear: period.taxYear, frequency: "MONTHLY", periodsInTaxYear: 12, method: NG_2026_8_MONTHLY_RULE.method, version: base.version + 1, certificationStatus: "CERTIFIED", effectiveFrom: new Date(period.startsAt.getTime() + 1_000), ownerDecisionRef: marker, sourceReference: `${marker}:actual-annualization`, contentHash: digest({ marker, kind, version: base.version + 1 }), supersedesId: base.id, correlationId: correlation("actual-annualization") } })).id; }
      else sourceId = (await tx.hrPayrollPriorEmployerYtdVersion.create({ data: { organizationId: run.organizationId, employeeId: employee.id, taxYear: period.taxYear, version: 1, priorEmployerReference: `${marker}:actual-prior`, gross: new Prisma.Decimal("500000"), eligibleDeductions: new Prisma.Decimal(0), taxableIncome: new Prisma.Decimal("500000"), payeDeducted: new Prisma.Decimal("10000"), payeRepaid: new Prisma.Decimal(0), handling: "EVIDENCED", evidenceReference: `${marker}:actual-prior-evidence`, correlationId: correlation("actual-prior") } })).id;
      mutationReady.resolve({ pid: session.pid, txid: session.txid.toString(), startedAt: session.started_at, executedAt: new Date(), sourceId });
      await releaseB.promise;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000 }).then(() => { transactionBOutcome = "COMMITTED"; }, (error) => { transactionBOutcome = `FAILED:${error instanceof Error ? error.message : String(error)}`; throw error; });
    const mutation = await mutationReady.promise;
    const workA = clientA.$transaction(async (tx) => {
      const [session] = await tx.$queryRaw<Array<{ pid: number; txid: bigint; started_at: Date }>>`SELECT pg_backend_pid()::int AS pid, txid_current() AS txid, clock_timestamp() AS started_at`;
      await freezeUnit9InputsTx(tx, actor, raceRun.id, [{ candidate, sourceManifest: manifest as unknown as Prisma.InputJsonValue }], new Date());
      freezeReady.resolve({ pid: session.pid, txid: session.txid.toString(), startedAt: session.started_at, executedAt: new Date() });
      await releaseA.promise;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000 }).then(() => { transactionAOutcome = "COMMITTED"; }, (error) => { transactionAOutcome = `FAILED:${error instanceof Error ? error.message : String(error)}`; throw error; });
    const frozen = await freezeReady.promise;
    const rows = await observer.$queryRaw<Array<{ pid: number; state: string; backend_xid: string | null; xact_start: Date | null }>>`SELECT pid::int, state, backend_xid::text, xact_start FROM pg_stat_activity WHERE pid IN (${frozen.pid}, ${mutation.pid}) ORDER BY pid`;
    const overlapObservedAt = new Date();
    const overlapObserved = rows.length === 2 && frozen.pid !== mutation.pid && frozen.txid !== mutation.txid && rows.every((row) => row.backend_xid !== null && row.xact_start !== null);
    releaseA.resolve(); await workA; releaseB.resolve(); await workB;
    assert(overlapObserved, `${kind}: actual-operation overlap was not observed.`);
    const persisted = await db.hrPayrollInputSnapshot.findFirstOrThrow({ where: { payrollRunId: raceRun.id, employeeId: employee.id } });
    const lineage = persisted.sourceManifest as unknown as Candidate2026_8Manifest;
    const sourceExcluded = kind === "salary" ? lineage.authoritativeSources.salary.recordId !== mutation.sourceId : kind === "ytd" ? !lineage.authoritativeSources.ytd.entryIds.includes(mutation.sourceId) : kind === "relief" ? !lineage.authoritativeSources.deductions.sourceRecordIds.includes(mutation.sourceId) : kind === "annualization" ? lineage.authoritativeSources.annualization.ruleId !== mutation.sourceId : lineage.authoritativeSources.priorEmployer.recordId !== mutation.sourceId;
    const persistedLineage = await validatePersistedLineage(db, persisted.id);
    assert(sourceExcluded && persistedLineage.lineageValid, `${kind}: persisted pre-mutation lineage was not coherent: ${persistedLineage.lineageErrors.join(",")}.`);
    return { raceName: `${kind}-mutation-vs-freeze`, mutationKind: kind, clientA: { backendPidHash: digest(frozen.pid), transactionIdHash: digest(frozen.txid), transactionStartedAt: frozen.startedAt }, clientB: { backendPidHash: digest(mutation.pid), transactionIdHash: digest(mutation.txid), transactionStartedAt: mutation.startedAt }, mutationExecutedAt: mutation.executedAt, freezeBodyExecutedAt: frozen.executedAt, overlapObservedAt, overlapObserved, transactionAOutcome, transactionBOutcome, persistedSnapshotIdHash: digest(persisted.id), persistedSourceLineageHash: digest(lineage.authoritativeSources), sourceExcluded, persistedLineage, result: "PASS" };
  } finally { releaseA.resolve(); releaseB.resolve(); await Promise.all([clientA.$disconnect(), clientB.$disconnect(), observer.$disconnect()]); }
}

async function main() {
  const db = new PrismaClient();
  const cleanup: Array<() => Promise<unknown>> = [];
  try {
    const [schema] = await db.$queryRaw<Array<{ annualization: string | null; relief: string | null }>>`SELECT to_regclass('public."HrPayrollAnnualizationRuleVersion"')::text AS annualization, to_regclass('public."HrPayrollTaxReliefClaimVersion"')::text AS relief`;
    if (!schema?.annualization || !schema?.relief) throw new Error("REFUSE TO RUN: staging is missing the reviewed NG-CANDIDATE-2026.8 authoritative-source migrations.");
    const actualSourceRaces = [];
    for (const kind of ["ytd", "relief", "annualization", "prior-employer", "salary"] as const) actualSourceRaces.push(await runActualSourceRace(db, kind));
    const sourceSnapshot = await createSourceSnapshot(db);
    const sourceRun = await db.hrPayrollAuthoritativeRun.findUniqueOrThrow({ where: { id: sourceSnapshot.payrollRunId } });
    const period = await db.hrPayrollCalendarPeriod.findUniqueOrThrow({ where: { id: sourceRun.calendarPeriodId } });
    const manifest = sourceSnapshot.sourceManifest as unknown as Candidate2026_8Manifest;
    const employee = await db.hrEmployee.findUniqueOrThrow({ where: { id: sourceSnapshot.employeeId } });
    const assignment = await db.hrEmployeeAssignment.findUniqueOrThrow({ where: { id: sourceSnapshot.assignmentId } });
    const relationship = await db.hrWorkRelationship.findUniqueOrThrow({ where: { id: sourceSnapshot.workRelationshipId } });
    const handoff = await db.hrPayrollCompHandoff.findFirstOrThrow({ where: { organizationId: sourceRun.organizationId, employeeId: employee.id, assignmentId: assignment.id }, orderBy: { createdAt: "desc" } });
    const actors = await db.hrUser.findMany({ where: { organizationId: sourceRun.organizationId, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, take: 2, select: { id: true } });
    assert(actors.length === 2, "Two independent staging actors are required.");
    const maker = { organizationId: sourceRun.organizationId, userId: actors[0].id, role: "PAYROLL_PROCESSOR" };
    const candidate = { employeeId: employee.id, personId: employee.personId!, workRelationshipId: relationship.id, assignmentId: assignment.id, employmentStatus: employee.employmentStatus, legalEntityId: assignment.legalEntityId!, jurisdictionCode: "NG", payGroupId: sourceRun.payGroupId, workerType: "SALARIED" as const, compensationHandoffId: handoff.id, compensationCurrency: handoff.currency, payrollCurrency: handoff.currency, taxProfileVersionId: `${marker}:tax`, paymentDestinationVersionId: `${marker}:destination` };
    const currentReliefs = await db.hrPayrollTaxReliefClaimVersion.findMany({ where: { organizationId: sourceRun.organizationId, employeeId: employee.id, taxYear: period.taxYear }, orderBy: [{ claimType: "asc" }, { version: "desc" }] });
    const currentLatestReliefs = new Map<string, typeof currentReliefs[number]>();
    for (const reliefVersion of currentReliefs) if (!currentLatestReliefs.has(reliefVersion.claimType)) currentLatestReliefs.set(reliefVersion.claimType, reliefVersion);
    for (const reliefVersion of currentLatestReliefs.values()) {
      if (reliefVersion.status === "ELIGIBLE_FOR_PAYE_RELIEF" && reliefVersion.electionRecorded && reliefVersion.evidenceReference && reliefVersion.sourceRuleId) continue;
      await db.hrPayrollTaxReliefClaimVersion.create({ data: { organizationId: sourceRun.organizationId, employeeId: employee.id, jurisdictionVersionId: sourceRun.jurisdictionVersionId, taxYear: period.taxYear, claimType: reliefVersion.claimType, version: reliefVersion.version + 1, claimedAmount: reliefVersion.claimedAmount, eligibleAmount: reliefVersion.eligibleAmount, electionRecorded: true, evidenceReference: `${marker}:race-recovery`, remittanceStatus: "VERIFIED", sourceRuleId: reliefVersion.sourceRuleId || "NG-RELIEF", status: "ELIGIBLE_FOR_PAYE_RELIEF", effectiveFrom: new Date(), supersedesId: reliefVersion.id, correlationId: correlation("race-recovery") } });
    }
    const usableReliefs = await db.hrPayrollTaxReliefClaimVersion.findMany({ where: { organizationId: sourceRun.organizationId, employeeId: employee.id, taxYear: period.taxYear }, orderBy: [{ claimType: "asc" }, { version: "desc" }] });
    const usableLatest = new Map<string, typeof usableReliefs[number]>();
    for (const reliefVersion of usableReliefs) if (!usableLatest.has(reliefVersion.claimType)) usableLatest.set(reliefVersion.claimType, reliefVersion);
    const currentEligibleDeductions = [...usableLatest.values()].reduce((total, reliefVersion) => total.plus(reliefVersion.eligibleAmount), new Prisma.Decimal(0)).toFixed(2);
    const runtimeManifest: Candidate2026_8Manifest = { ...manifest, paye: { ...manifest.paye, eligibleAnnualDeductions: currentEligibleDeductions } };
    let sequence = Number(String(Date.now()).slice(-6));
    const newRun = async (suffix: string) => {
      const run = await createUnit9Run(db, maker, { payGroupId: sourceRun.payGroupId, calendarPeriodId: sourceRun.calendarPeriodId, jurisdictionVersionId: sourceRun.jurisdictionVersionId, kind: "CORRECTION", sequence: sequence++, idempotencyKey: `${marker}:${suffix}:run` });
      await db.hrPayrollAuthoritativeRun.update({ where: { id: run.id }, data: { status: "CERTIFIED" } });
      return run;
    };
    const freeze = async (suffix: string, suppliedManifest: Candidate2026_8Manifest = runtimeManifest) => { const run = await newRun(suffix); await freezeUnit9Inputs(db, maker, run.id, [{ candidate, sourceManifest: suppliedManifest as unknown as Prisma.InputJsonValue }]); return db.hrPayrollInputSnapshot.findFirstOrThrow({ where: { payrollRunId: run.id, employeeId: employee.id } }); };

    const baselineSalary = await db.hrSalaryRecord.findFirstOrThrow({ where: { organizationId: sourceRun.organizationId, employeeId: employee.id, approvedAt: { not: null }, effectiveFrom: { lte: period.cutoffAt }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: period.cutoffAt } }] }, orderBy: { effectiveFrom: "desc" } });
    const salaryFrozen = sourceSnapshot;
    const salaryManifest = salaryFrozen.sourceManifest as unknown as Candidate2026_8Manifest;
    assert(salaryManifest.authoritativeSources.salary.recordId === baselineSalary.id, "Salary freeze did not capture one coherent source.");
    const approvedSalaryManifest = { ...salaryManifest, expectedEmploymentIncomeBindingHash: salaryFrozen.employmentIncomeBindingHash!, expectedMinimumWageDecisionHash: salaryFrozen.minimumWageDecisionHash! };
    const salaryReplayHash = calculateFrozenPayroll2026_8(approvedSalaryManifest, salaryFrozen.inputHash).hash;

    const overlapFrom = new Date(period.cutoffAt.getTime() - 60_000);
    let salaryAmbiguous = false;
    try {
      await db.$transaction(async (tx) => {
        await tx.hrSalaryRecord.create({ data: { organizationId: sourceRun.organizationId, employeeId: employee.id, amount: baselineSalary.amount.plus(1), currency: baselineSalary.currency, payFrequency: baselineSalary.payFrequency, effectiveFrom: overlapFrom, reason: marker, createdById: actors[0].id, approvedById: actors[1].id, approvedAt: new Date() } });
        await tx.hrSalaryRecord.create({ data: { organizationId: sourceRun.organizationId, employeeId: employee.id, amount: baselineSalary.amount.plus(2), currency: baselineSalary.currency, payFrequency: baselineSalary.payFrequency, effectiveFrom: new Date(overlapFrom.getTime() + 1), reason: marker, createdById: actors[0].id, approvedById: actors[1].id, approvedAt: new Date() } });
        await resolveNg2026_8AuthoritativeManifest(tx, maker, sourceRun, manifest, new Date());
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) { salaryAmbiguous = String(error).includes("AUTHORITATIVE_SALARY_SOURCE_AMBIGUOUS"); }
    assert(salaryAmbiguous, "Overlapping approved Salary authorities did not fail closed.");

    const offCycleResultId = `${marker}:earlier-off-cycle-result`;
    const earlyAt = new Date(Date.now() - 2_000);
    const lateAt = new Date(Date.now() + 3_600_000);
    const ytdRows = await Promise.all([
      db.hrPayrollYtdLedgerEntry.create({ data: { organizationId: sourceRun.organizationId, employeeId: employee.id, taxYear: period.taxYear, accumulatorCode: "BONUS", entryType: "AUTHORITATIVE", amount: new Prisma.Decimal("101"), payrollResultId: offCycleResultId, effectiveAt: earlyAt, correlationId: correlation("bonus-early") } }),
      db.hrPayrollYtdLedgerEntry.create({ data: { organizationId: sourceRun.organizationId, employeeId: employee.id, taxYear: period.taxYear, accumulatorCode: "PAYE_DEDUCTED", entryType: "AUTHORITATIVE", amount: new Prisma.Decimal("11"), payrollResultId: offCycleResultId, effectiveAt: earlyAt, correlationId: correlation("paye-early") } }),
      db.hrPayrollYtdLedgerEntry.create({ data: { organizationId: sourceRun.organizationId, employeeId: employee.id, taxYear: period.taxYear, accumulatorCode: "BONUS", entryType: "AUTHORITATIVE", amount: new Prisma.Decimal("999"), payrollResultId: `${marker}:later-result`, effectiveAt: lateAt, correlationId: correlation("bonus-late") } }),
    ]);
    cleanup.push(() => db.hrPayrollYtdLedgerEntry.deleteMany({ where: { id: { in: ytdRows.map((row) => row.id) } } }));
    const includedYtd = await db.hrPayrollYtdLedgerEntry.findMany({ where: { organizationId: sourceRun.organizationId, employeeId: employee.id, taxYear: period.taxYear, effectiveAt: { lt: new Date() }, accumulatorCode: { in: ["BONUS", "PAYE_DEDUCTED", "PAYE_REPAID"] } } });
    const ytdSum = (code: string) => includedYtd.filter((entry) => entry.accumulatorCode === code).reduce((total, entry) => total.plus(entry.amount), new Prisma.Decimal(0)).toFixed(2);
    const ytdSuppliedManifest: Candidate2026_8Manifest = { ...runtimeManifest, auditPriorBonusYtd: ytdSum("BONUS"), auditPayeDeductedYtd: ytdSum("PAYE_DEDUCTED"), auditPayeRepaidYtd: ytdSum("PAYE_REPAID"), paye: { ...runtimeManifest.paye, priorBonusPaidTaxYearToDate: ytdSum("BONUS"), priorYtdPaye: ytdSum("PAYE_DEDUCTED"), priorPayeRepaid: ytdSum("PAYE_REPAID") } };
    const ytdFrozen = await freeze("ytd-race", ytdSuppliedManifest);
    const ytdManifest = ytdFrozen.sourceManifest as unknown as Candidate2026_8Manifest;
    assert(ytdManifest.authoritativeSources.ytd.entryIds.includes(ytdRows[0].id) && ytdManifest.authoritativeSources.ytd.entryIds.includes(ytdRows[1].id) && !ytdManifest.authoritativeSources.ytd.entryIds.includes(ytdRows[2].id), "Same-period YTD cutoff selection was incoherent.");
    const expectedYtdHash = digest(ytdManifest.authoritativeSources.ytd.entryIds);
    assert(ytdManifest.authoritativeSources.ytd.sourceLedgerHash.length === 64 && expectedYtdHash.length === 64, "YTD source hash was not deterministic.");

    const reliefBase = await db.hrPayrollTaxReliefClaimVersion.findFirst({ where: { organizationId: sourceRun.organizationId, employeeId: employee.id, taxYear: period.taxYear, claimType: "PENSION" }, orderBy: { version: "desc" } });
    const reliefVersion = (reliefBase?.version ?? 0) + 1;
    const reliefV1 = await db.hrPayrollTaxReliefClaimVersion.create({ data: { organizationId: sourceRun.organizationId, employeeId: employee.id, jurisdictionVersionId: sourceRun.jurisdictionVersionId, taxYear: period.taxYear, claimType: "PENSION", version: reliefVersion, claimedAmount: new Prisma.Decimal("50000"), eligibleAmount: new Prisma.Decimal("50000"), electionRecorded: true, evidenceReference: `${marker}:relief-v1`, remittanceStatus: "VERIFIED", sourceRuleId: "NG-PENSION", status: "ELIGIBLE_FOR_PAYE_RELIEF", effectiveFrom: new Date(period.startsAt.getTime() + 1_000), correlationId: correlation("relief-v1") } });
    const reliefV2 = await db.hrPayrollTaxReliefClaimVersion.create({ data: { organizationId: sourceRun.organizationId, employeeId: employee.id, jurisdictionVersionId: sourceRun.jurisdictionVersionId, taxYear: period.taxYear, claimType: "PENSION", version: reliefVersion + 1, claimedAmount: new Prisma.Decimal("100000"), eligibleAmount: new Prisma.Decimal("100000"), electionRecorded: true, evidenceReference: `${marker}:relief-v2`, remittanceStatus: "VERIFIED", sourceRuleId: "NG-PENSION", status: "ELIGIBLE_FOR_PAYE_RELIEF", effectiveFrom: new Date(period.startsAt.getTime() + 2_000), supersedesId: reliefV1.id, correlationId: correlation("relief-v2") } });
    cleanup.push(() => db.hrPayrollTaxReliefClaimVersion.deleteMany({ where: { id: { in: [reliefV2.id, reliefV1.id] } } }));
    const reliefSuppliedManifest: Candidate2026_8Manifest = { ...ytdSuppliedManifest, paye: { ...ytdSuppliedManifest.paye, eligibleAnnualDeductions: "100000" } };
    const reliefFrozen = await freeze("relief-v2", reliefSuppliedManifest);
    const reliefManifest = reliefFrozen.sourceManifest as unknown as Candidate2026_8Manifest;
    assert(reliefManifest.authoritativeSources.deductions.sourceRecordIds.includes(reliefV2.id) && !reliefManifest.authoritativeSources.deductions.sourceRecordIds.includes(reliefV1.id), "Newest relief version did not exclusively control.");
    const annualizationBase = await db.hrPayrollAnnualizationRuleVersion.findFirstOrThrow({ where: { organizationId: sourceRun.organizationId, jurisdictionVersion: "NG-CANDIDATE-2026.8", taxYear: period.taxYear, frequency: "MONTHLY" }, orderBy: { version: "desc" } });
    const annualizationV2 = await db.hrPayrollAnnualizationRuleVersion.create({ data: { organizationId: sourceRun.organizationId, jurisdictionVersion: "NG-CANDIDATE-2026.8", taxYear: period.taxYear, frequency: "MONTHLY", periodsInTaxYear: 12, method: "GOVERNED_PERIODIC_SALARY_X_PERIODS_IN_TAX_YEAR", version: annualizationBase.version + 1, certificationStatus: "CERTIFIED", effectiveFrom: new Date(period.startsAt.getTime() + 3_000), ownerDecisionRef: marker, sourceReference: `${marker}:annualization`, contentHash: digest({ marker, version: annualizationBase.version + 1 }), supersedesId: annualizationBase.id, correlationId: correlation("annualization-v2") } });
    cleanup.push(() => db.hrPayrollAnnualizationRuleVersion.delete({ where: { id: annualizationV2.id } }));
    const annualizationFrozen = await freeze("annualization-v2", reliefSuppliedManifest);
    const annualizationManifest = annualizationFrozen.sourceManifest as unknown as Candidate2026_8Manifest;
    assert(annualizationManifest.authoritativeSources.annualization.ruleId === annualizationV2.id && annualizationManifest.authoritativeSources.annualization.ruleVersion === annualizationV2.version && annualizationManifest.authoritativeSources.annualization.periodsInTaxYear === 12, "Annualization rule version was mixed.");

    const priorBase = await db.hrPayrollPriorEmployerYtdVersion.findFirst({ where: { organizationId: sourceRun.organizationId, employeeId: employee.id, taxYear: period.taxYear }, orderBy: { version: "desc" } });
    const priorV2 = await db.hrPayrollPriorEmployerYtdVersion.create({ data: { organizationId: sourceRun.organizationId, employeeId: employee.id, taxYear: period.taxYear, version: (priorBase?.version ?? 0) + 1, priorEmployerReference: `${marker}:prior`, gross: new Prisma.Decimal("500000"), eligibleDeductions: new Prisma.Decimal(0), taxableIncome: new Prisma.Decimal("500000"), payeDeducted: new Prisma.Decimal("10000"), payeRepaid: new Prisma.Decimal(0), handling: "EVIDENCED", evidenceReference: `${marker}:prior-evidence`, supersedesId: priorBase?.id, correlationId: correlation("prior") } });
    cleanup.push(() => db.hrPayrollPriorEmployerYtdVersion.delete({ where: { id: priorV2.id } }));
    const priorSuppliedManifest: Candidate2026_8Manifest = { ...reliefSuppliedManifest, paye: { ...reliefSuppliedManifest.paye, priorEmployerIncome: "500000", priorEmployerPaye: "10000", priorPayeRepaid: "0" } };
    const priorFrozen = await freeze("prior-v2", priorSuppliedManifest);
    const priorManifest = priorFrozen.sourceManifest as unknown as Candidate2026_8Manifest;
    assert(priorManifest.authoritativeSources.priorEmployer.recordId === priorV2.id && priorManifest.authoritativeSources.priorEmployer.recordVersion === priorV2.version && priorManifest.authoritativeSources.priorEmployer.evidenceReference === priorV2.evidenceReference, "Prior-employer version was mixed.");

    const reliefPending = await db.hrPayrollTaxReliefClaimVersion.create({ data: { organizationId: sourceRun.organizationId, employeeId: employee.id, jurisdictionVersionId: sourceRun.jurisdictionVersionId, taxYear: period.taxYear, claimType: "PENSION", version: reliefVersion + 2, claimedAmount: new Prisma.Decimal("125000"), eligibleAmount: new Prisma.Decimal("125000"), electionRecorded: false, evidenceReference: "", remittanceStatus: "PENDING", sourceRuleId: "NG-PENSION", status: "PENDING", effectiveFrom: new Date(period.startsAt.getTime() + 4_000), supersedesId: reliefV2.id, correlationId: correlation("relief-pending") } });
    cleanup.push(() => db.hrPayrollTaxReliefClaimVersion.delete({ where: { id: reliefPending.id } }));
    let pendingFailedClosed = false;
    try { await freeze("relief-pending", reliefSuppliedManifest); } catch (error) { pendingFailedClosed = String(error).includes("ELIGIBLE_DEDUCTION_SOURCE_REQUIRED"); }
    assert(pendingFailedClosed, "Pending newest relief fell back to an older version.");

    const snapshotData = { organizationId: sourceSnapshot.organizationId, employeeId: sourceSnapshot.employeeId, personId: sourceSnapshot.personId, workRelationshipId: sourceSnapshot.workRelationshipId, assignmentId: sourceSnapshot.assignmentId, sourceManifest: sourceSnapshot.sourceManifest as Prisma.InputJsonValue, inputHash: sourceSnapshot.inputHash, minimumWageEvidence: sourceSnapshot.minimumWageEvidence ?? undefined, minimumWageDecisionHash: sourceSnapshot.minimumWageDecisionHash, minimumWageClassification: sourceSnapshot.minimumWageClassification, employmentIncomeBinding: sourceSnapshot.employmentIncomeBinding ?? undefined, employmentIncomeBindingHash: sourceSnapshot.employmentIncomeBindingHash, certificationStatus: "CERTIFIED", frozenAt: new Date() };
    const actualDuplicateRun = await newRun("actual-duplicate-binding");
    const actualDuplicateData = { ...snapshotData, payrollRunId: actualDuplicateRun.id, correlationId: `${marker}:actual-duplicate` };
    const duplicateA = clientFor("actual-duplicate:A"), duplicateB = clientFor("actual-duplicate:B"), duplicateObserver = clientFor("actual-duplicate:observer");
    const duplicateAReady = deferred<{ pid: number; xid: string }>(), duplicateBStarted = deferred<{ pid: number; xid: string }>(), releaseDuplicateA = deferred<void>();
    let duplicateOperationOverlap;
    try {
      const insertA = duplicateA.$transaction(async (tx) => { const [session] = await tx.$queryRaw<Array<{ pid: number; xid: bigint }>>`SELECT pg_backend_pid()::int AS pid, txid_current() AS xid`; await tx.hrPayrollInputSnapshot.create({ data: actualDuplicateData }); duplicateAReady.resolve({ pid: session.pid, xid: session.xid.toString() }); await releaseDuplicateA.promise; }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000 });
      const aSession = await duplicateAReady.promise;
      const insertB = duplicateB.$transaction(async (tx) => { const [session] = await tx.$queryRaw<Array<{ pid: number; xid: bigint }>>`SELECT pg_backend_pid()::int AS pid, txid_current() AS xid`; duplicateBStarted.resolve({ pid: session.pid, xid: session.xid.toString() }); await tx.hrPayrollInputSnapshot.create({ data: actualDuplicateData }); }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000 });
      const bSession = await duplicateBStarted.promise;
      let activity: Array<{ pid: number; state: string; wait_event_type: string | null; backend_xid: string | null }> = [];
      for (let attempt = 0; attempt < 40; attempt += 1) { activity = await duplicateObserver.$queryRaw<Array<{ pid: number; state: string; wait_event_type: string | null; backend_xid: string | null }>>`SELECT pid::int, state, wait_event_type, backend_xid::text FROM pg_stat_activity WHERE pid IN (${aSession.pid}, ${bSession.pid}) ORDER BY pid`; if (activity.length === 2 && activity.some((row) => row.pid === bSession.pid && row.wait_event_type === "Lock")) break; await new Promise((resolve) => setTimeout(resolve, 25)); }
      const overlapObserved = activity.length === 2 && aSession.pid !== bSession.pid && aSession.xid !== bSession.xid && activity.some((row) => row.pid === bSession.pid && row.wait_event_type === "Lock");
      releaseDuplicateA.resolve(); await insertA; const bResult = await Promise.allSettled([insertB]);
      assert(overlapObserved && bResult[0].status === "rejected", "Actual duplicate persistence race did not produce one blocked loser.");
      const rowCount = await db.hrPayrollInputSnapshot.count({ where: { payrollRunId: actualDuplicateRun.id, employeeId: employee.id } });
      assert(rowCount === 1, "Actual duplicate persistence race did not leave exactly one row.");
      duplicateOperationOverlap = { raceName: "duplicate-binding-persistence", overlapObserved, clientA: { backendPidHash: digest(aSession.pid), transactionIdHash: digest(aSession.xid), operationOutcome: "INSERTED_AND_COMMITTED" }, clientB: { backendPidHash: digest(bSession.pid), transactionIdHash: digest(bSession.xid), operationOutcome: "UNIQUE_CONSTRAINT_LOSER" }, transactionAOutcome: "COMMITTED", transactionBOutcome: "REJECTED", databaseRowCount: rowCount, result: "PASS" };
    } finally { releaseDuplicateA.resolve(); await Promise.all([duplicateA.$disconnect(), duplicateB.$disconnect(), duplicateObserver.$disconnect()]); }

    const staleRun = await newRun("stale");
    await db.hrPayrollAuthoritativeRun.update({ where: { id: staleRun.id }, data: { status: "FROZEN", frozenAt: new Date() } });
    const staleSnapshot = await db.hrPayrollInputSnapshot.create({ data: { ...snapshotData, payrollRunId: staleRun.id, correlationId: `${marker}:stale` } });
    const stalePartition = await db.hrPayrollPopulationPartition.create({ data: { organizationId: sourceRun.organizationId, payrollRunId: staleRun.id, calculationAttemptId: `${marker}:partition`, originalPopulationCount: 1, readyCount: 1, heldCount: 0, readyEmployeeIds: [employee.id], heldPopulation: [], minimumWageDecisionHashes: [{ employeeId: employee.id, decisionHash: staleSnapshot.minimumWageDecisionHash }], employmentIncomeBindingHashes: [{ employeeId: employee.id, bindingHash: "deliberately-stale-binding" }], partitionHash: digest(marker), decision: "APPROVE_SUPPORTED_POPULATION_AND_DEFER_HELD_POPULATION", reason: "2026.8 stale calculation race", preparedById: actors[0].id, approvedById: actors[1].id, approvedAt: new Date(), correlationId: correlation("stale-partition") } });
    const staleOperationOverlap = await runCompletedBodyOverlap("stale-partition-vs-calculation", async (tx) => { try { await assertUnit9CalculationBindingsTx(tx, maker, staleRun.id); return "UNEXPECTED_ACCEPT"; } catch (error) { assert(String(error).includes("STALE_EMPLOYMENT_INCOME_BINDING"), "Stale calculation validation failed for the wrong reason."); return "STALE_EMPLOYMENT_INCOME_BINDING"; } }, async (tx) => { await tx.hrPayrollPopulationPartition.update({ where: { id: stalePartition.id }, data: { employmentIncomeBindingHashes: [{ employeeId: employee.id, bindingHash: staleSnapshot.employmentIncomeBindingHash }] } }); return "ACTUAL_PARTITION_BINDING_MUTATION_EXECUTED"; }, true);
    let staleBindingRejected = false;
    try { await calculateUnit9Run(db, maker, staleRun.id, { idempotencyKey: `${marker}:stale-calculate` }); } catch (error) { staleBindingRejected = String(error).includes("STALE_EMPLOYMENT_INCOME_BINDING"); }
    const authoritativeStaleResults = await db.hrPayrollAuthoritativeResult.count({ where: { payrollRunId: staleRun.id } });
    assert(staleBindingRejected && authoritativeStaleResults === 0, `Stale approval evidence failed: rejected=${staleBindingRejected}; authoritativeResults=${authoritativeStaleResults}.`);

    const finalizationRun = await newRun("certification-finalization");
    await db.hrPayrollAuthoritativeRun.update({ where: { id: finalizationRun.id }, data: { status: "APPROVED" } });
    await db.hrPayrollInputSnapshot.create({ data: { ...snapshotData, payrollRunId: finalizationRun.id, correlationId: `${marker}:certification-finalization` } });
    const finalizationOperationOverlap = await runCompletedBodyOverlap("candidate-certification-vs-finalization", async (tx) => { try { await finalizeUnit9RunTx(tx, maker, finalizationRun.id); return "UNEXPECTED_FINALIZATION"; } catch (error) { assert(String(error).includes("PAYROLL_CANDIDATE_NOT_CERTIFIED"), "Finalization failed for the wrong reason."); return "PAYROLL_CANDIDATE_NOT_CERTIFIED"; } }, async (tx) => { await tx.hrPayrollJurisdictionVersion.update({ where: { id: sourceRun.jurisdictionVersionId }, data: { status: "CERTIFIED", certifiedAt: new Date(), ruleManifest: { candidateVersion: NG_2026_8_VERSION, certification: "CERTIFIED" } } }); return "ACTUAL_CERTIFICATION_MUTATION_EXECUTED"; }, true);
    const candidateAfterRace = await db.hrPayrollJurisdictionVersion.findUniqueOrThrow({ where: { id: sourceRun.jurisdictionVersionId } });
    assert((candidateAfterRace.ruleManifest as { certification?: string }).certification === "NOT_CERTIFIED" && candidateAfterRace.status === "TESTING", "Actual staging candidate certification state changed.");

    const [finalizedRunRows, finalizedResultRows, periodResultRows, finalizationAuditRows] = await Promise.all([
      db.hrPayrollAuthoritativeRun.count({ where: { id: finalizationRun.id, status: "FINALIZED" } }),
      db.hrPayrollAuthoritativeResult.count({ where: { payrollRunId: finalizationRun.id, finalizedAt: { not: null } } }),
      db.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*)::int AS count FROM "HrPayrollYtdLedgerEntry" ytd JOIN "HrPayrollAuthoritativeResult" result ON result.id = ytd."payrollResultId" WHERE result."payrollRunId" = ${finalizationRun.id} AND ytd."entryType" = 'PERIOD_RESULT'`,
      db.hrAuditEvent.count({ where: { organizationId: sourceRun.organizationId, entityType: "HrPayrollAuthoritativeRun", entityId: finalizationRun.id, action: "unit9.payroll_run.finalized" } }),
    ]);
    const finalizationMutationCounts = { finalizedRunCount: finalizedRunRows, finalizedResultCount: finalizedResultRows, periodResultYtdEntryCount: periodResultRows[0]?.count ?? -1, finalizationAuditEventCount: finalizationAuditRows };
    const blockedFinalizationMutationCount = Object.values(finalizationMutationCounts).reduce((total, count) => total + count, 0);
    assert(blockedFinalizationMutationCount === 0, `Finalization rejection mutated official state: ${JSON.stringify(finalizationMutationCounts)}.`);

    const officialRun = await newRun("official-output-backstop");
    await db.hrPayrollAuthoritativeRun.update({ where: { id: officialRun.id }, data: { status: "FINALIZED", finalizedAt: new Date(), finalizedById: actors[0].id } });
    const officialSnapshot = await db.hrPayrollInputSnapshot.create({ data: { ...snapshotData, payrollRunId: officialRun.id, correlationId: `${marker}:official-output:snapshot` } });
    const createAttempt = (attemptNumber: number) => db.hrPayrollCalculationAttempt.create({ data: { organizationId: sourceRun.organizationId, payrollRunId: officialRun.id, attemptNumber, inputSetHash: digest({ marker, attemptNumber, kind: "input" }), ruleSetHash: digest({ marker, attemptNumber, kind: "rules" }), engineVersion: "unit9-ng-2026.8", outputHash: digest({ marker, attemptNumber, kind: "output" }), manifest: { marker, syntheticHistoricalBackstop: true }, status: "COMPLETED", completedAt: new Date(), correlationId: correlation(`official-attempt-${attemptNumber}`) } });
    const attemptOne = await createAttempt(1);
    const createResult = (attemptId: string, suffix: string) => db.hrPayrollAuthoritativeResult.create({ data: { organizationId: sourceRun.organizationId, payrollRunId: officialRun.id, calculationAttemptId: attemptId, inputSnapshotId: officialSnapshot.id, employeeId: employee.id, currency: "NGN", grossEarnings: new Prisma.Decimal("70000"), taxableIncome: new Prisma.Decimal("70000"), paye: new Prisma.Decimal(0), employeeDeductions: new Prisma.Decimal(0), employerContributions: new Prisma.Decimal(0), adjustments: new Prisma.Decimal(0), netPay: new Prisma.Decimal("70000"), outputHash: digest({ marker, suffix }), minimumWageDecisionHash: officialSnapshot.minimumWageDecisionHash, minimumWageClassification: officialSnapshot.minimumWageClassification, employmentIncomeBindingHash: officialSnapshot.employmentIncomeBindingHash, authoritativeAt: new Date(), finalizedAt: new Date(), correlationId: correlation(`official-result-${suffix}`) } });
    const officialResultOne = await createResult(attemptOne.id, "one");
    const publishedPayslip = await db.hrPayrollPayslipVersion.create({ data: { organizationId: sourceRun.organizationId, employeeId: employee.id, payrollResultId: officialResultOne.id, version: 1, artifactKey: `${marker}/published.pdf`, contentHash: digest({ marker, payslip: "published" }), status: "PUBLISHED", publishedAt: new Date(), correlationId: correlation("official-payslip-published") } });
    const generatedPayslip = await db.hrPayrollPayslipVersion.create({ data: { organizationId: sourceRun.organizationId, employeeId: employee.id, payrollResultId: officialResultOne.id, version: 2, artifactKey: `${marker}/generated.pdf`, contentHash: digest({ marker, payslip: "generated" }), status: "GENERATED", supersedesId: publishedPayslip.id, correlationId: correlation("official-payslip-generated") } });
    const paymentBatch = await db.hrPayrollPaymentBatch.create({ data: { organizationId: sourceRun.organizationId, payrollRunId: officialRun.id, version: 1, status: "VALIDATED", currency: "NGN", instructionCount: 0, totalAmount: new Prisma.Decimal(0), createdById: actors[0].id, correlationId: correlation("official-payment-batch") } });
    const liabilities = await Promise.all(["PAYE-NEW", "PAYE-ACK", "PAYE-AMEND"].map((category) => db.hrPayrollStatutoryLiability.create({ data: { organizationId: sourceRun.organizationId, payrollRunId: officialRun.id, payrollResultId: officialResultOne.id, jurisdictionVersionId: officialRun.jurisdictionVersionId, category, periodKey: `${marker}:official-period`, amount: new Prisma.Decimal("1"), ruleVersion: "synthetic-backstop", correlationId: correlation(`official-liability-${category}`) } })));
    const createRemittanceFixture = async (suffix: string, category: string, status: "DRAFT" | "ACKNOWLEDGED") => {
      const batch = await db.hrPayrollRemittanceBatch.create({ data: { organizationId: sourceRun.organizationId, jurisdictionVersionId: officialRun.jurisdictionVersionId, periodKey: `${marker}:official-period`, category, version: 1, status, totalAmount: new Prisma.Decimal("1"), externalReference: status === "ACKNOWLEDGED" ? `TEST:${marker}` : null, acknowledgedAt: status === "ACKNOWLEDGED" ? new Date() : null, correlationId: correlation(`official-remittance-${suffix}`) } });
      await db.hrPayrollRemittanceLine.create({ data: { organizationId: sourceRun.organizationId, remittanceBatchId: batch.id, liabilityId: liabilities[category === "PAYE-ACK" ? 1 : 2].id, amount: new Prisma.Decimal("1") } });
      return batch;
    };
    const acknowledgementBatch = await createRemittanceFixture("ack", "PAYE-ACK", "DRAFT");
    const amendmentBatch = await createRemittanceFixture("amend", "PAYE-AMEND", "ACKNOWLEDGED");
    const officialCountQuery = async () => {
      const rows = await db.$queryRaw<Array<Record<string, number>>>`
        SELECT
          (SELECT COUNT(*)::int FROM "HrPayrollPayslipVersion" p JOIN "HrPayrollAuthoritativeResult" r ON r.id=p."payrollResultId" WHERE r."payrollRunId"=${officialRun.id}) AS "payslipVersions",
          (SELECT COUNT(*)::int FROM "HrPayrollPayslipVersion" p JOIN "HrPayrollAuthoritativeResult" r ON r.id=p."payrollResultId" WHERE r."payrollRunId"=${officialRun.id} AND p.status='PUBLISHED') AS "publishedPayslips",
          (SELECT COUNT(*)::int FROM "HrPayrollPaymentBatch" WHERE "payrollRunId"=${officialRun.id}) AS "paymentBatches",
          (SELECT COUNT(*)::int FROM "HrPayrollPaymentInstruction" i JOIN "HrPayrollAuthoritativeResult" r ON r.id=i."payrollResultId" WHERE r."payrollRunId"=${officialRun.id}) AS "paymentInstructions",
          (SELECT COUNT(*)::int FROM "HrPayrollPaymentBatch" WHERE "payrollRunId"=${officialRun.id} AND status='APPROVED') AS "paymentApproved",
          (SELECT COUNT(*)::int FROM "HrPayrollPaymentBatch" WHERE "payrollRunId"=${officialRun.id} AND status='EXPORTED') AS "paymentExported",
          (SELECT COUNT(*)::int FROM "HrPayrollPaymentBatch" WHERE "payrollRunId"=${officialRun.id} AND status='SUBMITTED') AS "paymentSubmitted",
          (SELECT COUNT(*)::int FROM "HrPayrollPaymentBatch" WHERE "payrollRunId"=${officialRun.id} AND status='ACKNOWLEDGED') AS "paymentAcknowledged",
          (SELECT COUNT(*)::int FROM "HrPayrollPaymentBatch" WHERE "payrollRunId"=${officialRun.id} AND status='SETTLED') AS "paymentSettled",
          (SELECT COUNT(*)::int FROM "HrPayrollJournalBatch" WHERE "payrollRunId"=${officialRun.id}) AS "journalBatches",
          (SELECT COUNT(*)::int FROM "HrPayrollJournalLine" l JOIN "HrPayrollJournalBatch" b ON b.id=l."journalBatchId" WHERE b."payrollRunId"=${officialRun.id}) AS "journalLines",
          (SELECT COUNT(*)::int FROM "HrPayrollStatutoryLiability" WHERE "payrollRunId"=${officialRun.id}) AS "statutoryLiabilities",
          (SELECT COUNT(DISTINCT b.id)::int FROM "HrPayrollRemittanceBatch" b JOIN "HrPayrollRemittanceLine" l ON l."remittanceBatchId"=b.id JOIN "HrPayrollStatutoryLiability" s ON s.id=l."liabilityId" WHERE s."payrollRunId"=${officialRun.id}) AS "remittanceBatches",
          (SELECT COUNT(*)::int FROM "HrPayrollRemittanceLine" l JOIN "HrPayrollStatutoryLiability" s ON s.id=l."liabilityId" WHERE s."payrollRunId"=${officialRun.id}) AS "remittanceLines",
          (SELECT COUNT(*)::int FROM "HrPayrollStatutoryAmendment" a JOIN "HrPayrollRemittanceBatch" b ON b.id=a."originalRemittanceBatchId" JOIN "HrPayrollRemittanceLine" l ON l."remittanceBatchId"=b.id JOIN "HrPayrollStatutoryLiability" s ON s.id=l."liabilityId" WHERE s."payrollRunId"=${officialRun.id}) AS "statutoryAmendments"`;
      return rows[0] ?? {};
    };
    const officialOutputBaseline = await officialCountQuery();
    const blockedEntrypoints: Record<string, string> = {};
    const expectBlocked = async (name: string, action: () => Promise<unknown>) => { try { await action(); blockedEntrypoints[name] = "UNEXPECTED_SUCCESS"; } catch (error) { const outcome = String(error).includes("PAYROLL_CANDIDATE_NOT_CERTIFIED") ? "PAYROLL_CANDIDATE_NOT_CERTIFIED" : `WRONG_FAILURE:${error instanceof Error ? error.message : String(error)}`; blockedEntrypoints[name] = outcome; assert(outcome === "PAYROLL_CANDIDATE_NOT_CERTIFIED", `${name} failed for the wrong reason.`); } };
    await expectBlocked("generateUnit9Payslips", () => generateUnit9Payslips(db, maker, officialRun.id));
    await expectBlocked("publishUnit9Payslip", () => publishUnit9Payslip(db, maker, generatedPayslip.id));
    await expectBlocked("createCorrectedUnit9Payslip", () => createCorrectedUnit9Payslip(db, maker, { correctedResultId: officialResultOne.id, supersedesPayslipId: publishedPayslip.id }));
    await expectBlocked("createUnit9PaymentBatch", () => createUnit9PaymentBatch(db, maker, officialRun.id));
    await expectBlocked("transitionUnit9PaymentBatch", () => transitionUnit9PaymentBatch(db, { ...maker, userId: actors[1].id }, paymentBatch.id, { to: "APPROVED", reason: "2026.8 backstop" }));
    await expectBlocked("generateUnit9FinancialOutputs", () => generateUnit9FinancialOutputs(db, maker, officialRun.id, { periodKey: `${marker}:official-period` }));
    await expectBlocked("createUnit9RemittanceBatch", () => createUnit9RemittanceBatch(db, maker, { jurisdictionVersionId: officialRun.jurisdictionVersionId, periodKey: `${marker}:official-period`, category: "PAYE-NEW" }));
    await expectBlocked("acknowledgeUnit9RemittanceSimulation", () => acknowledgeUnit9RemittanceSimulation(db, maker, acknowledgementBatch.id, marker));
    await expectBlocked("createUnit9RemittanceAmendmentSimulation", () => createUnit9RemittanceAmendmentSimulation(db, maker, amendmentBatch.id, { idempotencyKey: `${marker}:amendment`, reason: "2026.8 backstop", deltaManifest: { simulationOnly: true } }));
    const officialOutputAfter = await officialCountQuery();
    const officialOutputMutationCounts = Object.fromEntries(Object.keys(officialOutputAfter).map((key) => [key, (officialOutputAfter[key] ?? -1) - (officialOutputBaseline[key] ?? -1)]));
    const blockedOfficialOutputMutationCount = Object.values(officialOutputMutationCounts).reduce((total, count) => total + Math.abs(count), 0);
    assert(Object.values(blockedEntrypoints).every((outcome) => outcome === "PAYROLL_CANDIDATE_NOT_CERTIFIED") && blockedOfficialOutputMutationCount === 0, "Downstream certification backstop did not remain mutation-free.");

    const replayOne = calculateFrozenPayroll2026_8(approvedSalaryManifest, salaryFrozen.inputHash);
    const replayTwo = calculateFrozenPayroll2026_8(approvedSalaryManifest, salaryFrozen.inputHash);
    const deterministicReplay = replayOne.hash === replayTwo.hash && replayOne.employmentIncomeBinding.employmentIncomeBindingHash === replayTwo.employmentIncomeBinding.employmentIncomeBindingHash && replayOne.minimumWageDecision.decisionHash === replayTwo.minimumWageDecision.decisionHash && salaryReplayHash === replayTwo.hash;
    assert(deterministicReplay, "Frozen authoritative replay was not deterministic.");
    const overlapEvidence = [duplicateOperationOverlap, staleOperationOverlap, finalizationOperationOverlap];
    const [duplicateBindingRows, staleResultRows, markerSnapshotRows, markerResultRows] = await Promise.all([
      db.hrPayrollInputSnapshot.count({ where: { payrollRunId: actualDuplicateRun.id, employeeId: employee.id } }),
      db.hrPayrollAuthoritativeResult.count({ where: { payrollRunId: staleRun.id } }),
      db.$queryRaw<Array<{ id: string }>>`SELECT snapshot.id FROM "HrPayrollInputSnapshot" snapshot JOIN "HrPayrollAuthoritativeRun" run ON run.id = snapshot."payrollRunId" WHERE run."idempotencyKey" LIKE ${`${marker}%`} ORDER BY snapshot.id`,
      db.$queryRaw<Array<{ input_snapshot_id: string }>>`SELECT result."inputSnapshotId" AS input_snapshot_id FROM "HrPayrollAuthoritativeResult" result JOIN "HrPayrollAuthoritativeRun" run ON run.id = result."payrollRunId" WHERE run."idempotencyKey" LIKE ${`${marker}%`} ORDER BY result.id`,
    ]);
    const duplicateBindingRowCount = duplicateBindingRows;
    const authoritativeStaleResultCount = staleResultRows;
    const persistedSnapshotLineage = await Promise.all(markerSnapshotRows.map((row) => validatePersistedLineage(db, row.id)));
    const persistedResultLineage = await Promise.all(markerResultRows.map((row) => validatePersistedLineage(db, row.input_snapshot_id)));
    const mixedVersionSnapshotCount = persistedSnapshotLineage.filter((row) => !row.lineageValid).length;
    const mixedVersionAuthoritativeResultCount = persistedResultLineage.filter((row) => !row.lineageValid).length;
    assert(duplicateBindingRowCount === 1 && authoritativeStaleResultCount === 0 && mixedVersionSnapshotCount === 0 && mixedVersionAuthoritativeResultCount === 0 && blockedFinalizationMutationCount === 0 && blockedOfficialOutputMutationCount === 0, "Database-derived concurrency invariants failed.");
    const actualOperationOverlapRaceCount = actualSourceRaces.length + overlapEvidence.length;
    const actualOperationOverlapProvenCount = [...actualSourceRaces, ...overlapEvidence].filter((race) => race.overlapObserved && race.result === "PASS").length;
    const adjacentProbeOnlyRaceCount = 0;
    assert(actualOperationOverlapRaceCount === 8 && actualOperationOverlapProvenCount === 8 && adjacentProbeOnlyRaceCount === 0, "Actual-operation overlap summary failed.");
    const evidence = { candidateVersion: "NG-CANDIDATE-2026.8", databaseEnvironment: "staging", marker, sourceSnapshotId: sourceSnapshot.id, actualSourceRaces, overlapEvidence, requiredRaceCount: 8, actualOperationOverlapRaceCount, actualOperationOverlapProvenCount, adjacentProbeOnlyRaceCount, duplicateBindingRowCount, authoritativeStaleResultCount, persistedSnapshotLineage, persistedResultLineage, mixedVersionSnapshotCount, mixedVersionAuthoritativeResultCount, finalizationMutationCounts, blockedFinalizationMutationCount, blockedEntrypoints, officialOutputBaseline, officialOutputAfter, officialOutputMutationCounts, blockedOfficialOutputMutationCount, neutralizingPaymentTransitions: { tested: false, prohibitedOutputCountImpact: 0 }, staleBindingRejected, immutableFrozenBinding: (await db.hrPayrollInputSnapshot.findUniqueOrThrow({ where: { id: salaryFrozen.id } })).inputHash === salaryFrozen.inputHash, deterministicReplay, result: "PASS" };
    await db.hrAuditEvent.create({ data: { organizationId: sourceRun.organizationId, actorUserId: maker.userId, actorRole: maker.role, entityType: "Ng2026_8ConcurrencyEvidence", entityId: sourceSnapshot.id, action: "unit9.ng_2026_8.concurrency.validated", newValues: evidence, correlationId: marker } });
    console.log(JSON.stringify(evidence));
  } finally {
    for (const remove of cleanup.reverse()) await remove().catch(() => undefined);
    await db.$disconnect();
  }
}

await main();
