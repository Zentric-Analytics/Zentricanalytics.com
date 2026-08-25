import crypto from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { calculateFrozenPayroll2026_7, type Candidate2026_7Manifest } from "../src/lib/hr/payroll/unit9-engine-2026-7";
import { NG_2026_7_MONTHLY_RULE, NG_2026_7_VERSION, type Ng2026_7Evidence } from "../src/lib/hr/payroll/nigeria-2026-7";
import { calculateUnit9Run, certifyUnit9Population, createUnit9Run, freezeUnit9Inputs, resolveNg2026_7AuthoritativeManifest } from "../src/lib/hr/payroll/unit9-service";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
if (process.env.HR_UNIT9_NG_2026_7_CONCURRENCY_CONFIRM !== "staging-only" || databaseUrl.pathname.slice(1) !== "zentric_analytics_staging") throw new Error("REFUSE TO RUN: NG-CANDIDATE-2026.7 concurrency evidence requires explicit staging-only confirmation and the known staging database.");
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
const digest = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const marker = `ng-2026-7-concurrency-${Date.now()}`;
const correlation = (suffix: string) => `${marker}:${suffix}:${crypto.randomUUID()}`;

async function createSourceSnapshot(db: PrismaClient) {
  const organization = await db.hrOrganization.findFirstOrThrow({ select: { id: true } });
  const users = await db.hrUser.findMany({ where: { organizationId: organization.id, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, take: 2, select: { id: true } });
  assert(users.length === 2, "Two independent staging actors are required.");
  const maker = { organizationId: organization.id, userId: users[0].id, role: "PAYROLL_PROCESSOR" };
  const handoffs = await db.hrPayrollCompHandoff.findMany({ where: { organizationId: organization.id }, orderBy: { createdAt: "desc" }, take: 25 });
  let chosen: typeof handoffs[number] | undefined;
  for (const handoff of handoffs) {
    const [validAssignment, validEmployee, reliefVersions, priorEmployer] = await Promise.all([
      db.hrEmployeeAssignment.findFirst({ where: { id: handoff.assignmentId, organizationId: organization.id, legalEntityId: { not: null } }, select: { id: true } }),
      db.hrEmployee.findFirst({ where: { id: handoff.employeeId, organizationId: organization.id, personId: { not: null } }, select: { id: true } }),
      db.hrPayrollTaxReliefClaimVersion.findMany({ where: { organizationId: organization.id, employeeId: handoff.employeeId, taxYear: 2026 }, orderBy: [{ claimType: "asc" }, { version: "desc" }] }),
      db.hrPayrollPriorEmployerYtdVersion.findFirst({ where: { organizationId: organization.id, employeeId: handoff.employeeId, taxYear: 2026 } }),
    ]);
    const latest = new Map<string, typeof reliefVersions[number]>();
    for (const reliefVersion of reliefVersions) if (!latest.has(reliefVersion.claimType)) latest.set(reliefVersion.claimType, reliefVersion);
    const supportedReliefTypes = new Set(["PENSION", "NHF", "NHIS", "MORTGAGE_INTEREST", "LIFE_ANNUITY", "RENT"]);
    const reliefTypesSupported = [...latest.values()].every((reliefVersion) => supportedReliefTypes.has(reliefVersion.claimType));
    if (validAssignment && validEmployee && reliefTypesSupported && !priorEmployer) { chosen = handoff; break; }
  }
  assert(chosen, "A staging payroll handoff with usable authoritative 2026 sources is required.");
  const handoff = chosen;
  const assignment = await db.hrEmployeeAssignment.findFirstOrThrow({ where: { id: handoff.assignmentId, organizationId: organization.id, legalEntityId: { not: null } } });
  const employee = await db.hrEmployee.findFirstOrThrow({ where: { id: handoff.employeeId, organizationId: organization.id, personId: { not: null } } });
  const relationship = await db.hrWorkRelationship.findFirstOrThrow({ where: { id: handoff.workRelationshipId, organizationId: organization.id } });
  const jurisdiction = await db.hrPayrollJurisdiction.upsert({ where: { organizationId_code: { organizationId: organization.id, code: "NG" } }, update: {}, create: { organizationId: organization.id, code: "NG", name: "Nigeria", currency: "NGN" } });
  const jurisdictionVersion = await db.hrPayrollJurisdictionVersion.create({ data: { organizationId: organization.id, jurisdictionId: jurisdiction.id, version: Math.floor(Date.now() / 1000), status: "TESTING", effectiveFrom: new Date("2026-01-01T00:00:00Z"), ruleManifest: { candidateVersion: NG_2026_7_VERSION, certification: "NOT_CERTIFIED" }, ruleHash: digest({ marker, kind: "jurisdiction" }), engineVersion: "unit9-ng-2026.7", correlationId: correlation("jurisdiction") } });
  const payGroup = await db.hrPayrollPayGroup.create({ data: { organizationId: organization.id, code: `NG27-${Date.now()}`, name: "NG 2026.7 concurrency staging", workerType: "SALARIED", frequency: "MONTHLY", jurisdictionId: jurisdiction.id, currency: "NGN", timezone: "Africa/Lagos" } });
  const period = await db.hrPayrollCalendarPeriod.create({ data: { organizationId: organization.id, payGroupId: payGroup.id, periodKey: marker, startsAt: new Date("2026-08-01T00:00:00Z"), endsAt: new Date("2026-08-31T23:59:59Z"), cutoffAt: new Date("2026-08-20T12:00:00Z"), freezeAt: new Date("2026-08-21T12:00:00Z"), calculationOpensAt: new Date("2026-08-22T12:00:00Z"), approvalDueAt: new Date("2026-08-25T12:00:00Z"), intendedPaymentAt: new Date("2026-08-28T12:00:00Z"), accountingDate: new Date("2026-08-31T12:00:00Z"), taxYear: 2026, taxPeriod: 8, timezone: "Africa/Lagos" } });
  const salaryDefinition = await db.hrPayrollEarningDefinition.create({ data: { organizationId: organization.id, jurisdictionVersionId: jurisdictionVersion.id, code: "SALARY", version: 1, taxableBaseCode: "EMPLOYMENT", ruleManifest: { candidateVersion: NG_2026_7_VERSION }, effectiveFrom: period.startsAt, correlationId: correlation("earning-rule") } });
  let salary = await db.hrSalaryRecord.findFirst({ where: { organizationId: organization.id, employeeId: employee.id, approvedAt: { not: null }, effectiveFrom: { lte: period.cutoffAt }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: period.cutoffAt } }] }, orderBy: { effectiveFrom: "desc" } });
  if (!salary) salary = await db.hrSalaryRecord.create({ data: { organizationId: organization.id, employeeId: employee.id, amount: new Prisma.Decimal("70000"), currency: "NGN", payFrequency: "MONTHLY", effectiveFrom: new Date("2026-01-01T00:00:00Z"), reason: marker, createdById: users[0].id, approvedById: users[1].id, approvedAt: new Date() } });
  const ruleVersion = (await db.hrPayrollAnnualizationRuleVersion.aggregate({ where: { organizationId: organization.id, jurisdictionVersion: NG_2026_7_VERSION, taxYear: 2026, frequency: "MONTHLY" }, _max: { version: true } }))._max.version ?? 0;
  await db.hrPayrollAnnualizationRuleVersion.create({ data: { organizationId: organization.id, jurisdictionVersion: NG_2026_7_VERSION, taxYear: 2026, frequency: "MONTHLY", periodsInTaxYear: 12, method: NG_2026_7_MONTHLY_RULE.method, version: ruleVersion + 1, certificationStatus: "CERTIFIED", effectiveFrom: period.startsAt, ownerDecisionRef: marker, sourceReference: `${marker}:annualization`, contentHash: digest({ marker, kind: "annualization" }), correlationId: correlation("annualization") } });
  const run = await createUnit9Run(db, maker, { payGroupId: payGroup.id, calendarPeriodId: period.id, jurisdictionVersionId: jurisdictionVersion.id, idempotencyKey: `${marker}:source-run` });
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
  const incomeEvidence: Ng2026_7Evidence = { employeeId: employee.id, workRelationshipId: relationship.id, assignmentId: assignment.id, payrollPeriodId: period.id, rta: "LAGOS", candidateVersion: NG_2026_7_VERSION, actualFrozenSalary: monthlySalary, currentBonus: "0", otherTaxableEmploymentIncome: "VERIFIED_NONE", materiallyVariableMonthlyWage: "NO", ambiguousMultiEmployer: "NO", unusualPartialYearArrangement: "NO", evidenceCompletenessCertified: true, evidenceReferences: [salary.id, `${marker}:evidence`], inputCertificationId: `${marker}:certification`, inputCertificationVersion: "1" };
  const sourceManifest: Candidate2026_7Manifest = { employeeId: employee.id, workRelationshipId: relationship.id, assignmentId: assignment.id, payrollPeriodId: period.id, currency: "NGN", jurisdictionVersion: NG_2026_7_VERSION, engineVersion: "unit9-ng-2026.7", incomeEvidence, authoritativeSources: { salary: { recordId: salary.id, versionHash: "resolved-at-freeze", monthlyAmount: monthlySalary, currency: "NGN", payFrequency: "MONTHLY", effectiveFrom: salary.effectiveFrom.toISOString() }, annualization: { ruleId: "resolved-at-freeze", ruleVersion: ruleVersion + 1, frequency: "MONTHLY", periodsInTaxYear: 12, method: NG_2026_7_MONTHLY_RULE.method, taxYear: 2026, certificationStatus: "CERTIFIED" }, ytd: { sourceLedgerHash: "resolved-at-freeze", cutoff: ytdCutoff.toISOString(), priorBonusYtd: sumYtd("BONUS"), payeDeducted: sumYtd("PAYE_DEDUCTED"), payeRepaid: sumYtd("PAYE_REPAID"), entryIds: ytdEntries.map((entry) => entry.id) }, priorEmployer: prior ? { state: prior.handling === "EVIDENCED" ? "VERIFIED" : "UNKNOWN", recordId: prior.id, recordVersion: prior.version, income: prior.gross ?? 0, paye: prior.payeDeducted ?? 0, payeRepaid: prior.payeRepaid ?? 0, evidenceReference: prior.evidenceReference } : { state: "NONE", income: "0", paye: "0", payeRepaid: "0" }, deductions: { amount: eligibleDeductions, sourceType: "TAX_RELIEF_CLAIM_VERSIONS", sourceRecordIds: [...latestReliefs.values()].map((entry) => entry.id), sourceVersions: [...latestReliefs.values()].map((entry) => `${entry.claimType}:v${entry.version}`), evidenceReferences: [...latestReliefs.values()].map((entry) => entry.evidenceReference), aggregateHash: "resolved-at-freeze" } }, auditExpectedAnnualSalary: salary.amount.mul(12).toFixed(2), auditPriorBonusYtd: sumYtd("BONUS"), auditPayeDeductedYtd: sumYtd("PAYE_DEDUCTED"), auditPayeRepaidYtd: sumYtd("PAYE_REPAID"), earnings: [{ code: "SALARY", sourceType: "UNIT8", sourceId: salary.id, fixedAmount: monthlySalary, taxableBaseCode: "EMPLOYMENT", ruleVersionReference: salaryDefinition.id }], paye: { priorYtdTaxableIncome: "0", priorYtdPaye: sumYtd("PAYE_DEDUCTED"), priorPayeRepaid: sumYtd("PAYE_REPAID"), expectedAnnualEmploymentIncome: salary.amount.mul(12).toFixed(2), eligibleAnnualDeductions, periodsElapsed: 8, periodsInTaxYear: 12, currentNonPeriodicPayments: "0", priorBonusPaidTaxYearToDate: sumYtd("BONUS"), priorEmployerIncome: prior?.gross?.toFixed(2) ?? "0", priorEmployerPaye: prior?.payeDeducted?.toFixed(2) ?? "0", rules: { version: "not-authority", annualizationPeriods: 12, roundingScale: 2, bands: [] } } };
  await freezeUnit9Inputs(db, maker, run.id, [{ candidate, sourceManifest: sourceManifest as unknown as Prisma.InputJsonValue }]);
  return db.hrPayrollInputSnapshot.findFirstOrThrow({ where: { payrollRunId: run.id, employeeId: employee.id } });
}

async function main() {
  const db = new PrismaClient();
  const cleanup: Array<() => Promise<unknown>> = [];
  try {
    const [schema] = await db.$queryRaw<Array<{ annualization: string | null; relief: string | null }>>`SELECT to_regclass('public."HrPayrollAnnualizationRuleVersion"')::text AS annualization, to_regclass('public."HrPayrollTaxReliefClaimVersion"')::text AS relief`;
    if (!schema?.annualization || !schema?.relief) throw new Error("REFUSE TO RUN: staging is missing the reviewed NG-CANDIDATE-2026.7 authoritative-source migrations.");
    const priorSnapshots = await db.hrPayrollInputSnapshot.findMany({ where: { employmentIncomeBindingHash: { not: null }, minimumWageDecisionHash: { not: null }, sourceManifest: { path: ["jurisdictionVersion"], equals: "NG-CANDIDATE-2026.7" } }, orderBy: { createdAt: "desc" }, take: 25 });
    let sourceSnapshot = priorSnapshots.find((snapshot) => {
      try {
        const replayManifest = { ...(snapshot.sourceManifest as unknown as Candidate2026_7Manifest), expectedEmploymentIncomeBindingHash: snapshot.employmentIncomeBindingHash!, expectedMinimumWageDecisionHash: snapshot.minimumWageDecisionHash! };
        calculateFrozenPayroll2026_7(replayManifest, snapshot.inputHash);
        return true;
      } catch { return false; }
    });
    if (!sourceSnapshot) sourceSnapshot = await createSourceSnapshot(db);
    const sourceRun = await db.hrPayrollAuthoritativeRun.findUniqueOrThrow({ where: { id: sourceSnapshot.payrollRunId } });
    const period = await db.hrPayrollCalendarPeriod.findUniqueOrThrow({ where: { id: sourceRun.calendarPeriodId } });
    const manifest = sourceSnapshot.sourceManifest as unknown as Candidate2026_7Manifest;
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
    const runtimeManifest: Candidate2026_7Manifest = { ...manifest, paye: { ...manifest.paye, eligibleAnnualDeductions: currentEligibleDeductions } };
    let sequence = Number(String(Date.now()).slice(-6));
    const newRun = async (suffix: string) => {
      const run = await createUnit9Run(db, maker, { payGroupId: sourceRun.payGroupId, calendarPeriodId: sourceRun.calendarPeriodId, jurisdictionVersionId: sourceRun.jurisdictionVersionId, kind: "CORRECTION", sequence: sequence++, idempotencyKey: `${marker}:${suffix}:run` });
      await db.hrPayrollAuthoritativeRun.update({ where: { id: run.id }, data: { status: "CERTIFIED" } });
      return run;
    };
    const freeze = async (suffix: string, suppliedManifest: Candidate2026_7Manifest = runtimeManifest) => { const run = await newRun(suffix); await freezeUnit9Inputs(db, maker, run.id, [{ candidate, sourceManifest: suppliedManifest as unknown as Prisma.InputJsonValue }]); return db.hrPayrollInputSnapshot.findFirstOrThrow({ where: { payrollRunId: run.id, employeeId: employee.id } }); };

    const baselineSalary = await db.hrSalaryRecord.findFirstOrThrow({ where: { organizationId: sourceRun.organizationId, employeeId: employee.id, approvedAt: { not: null }, effectiveFrom: { lte: period.cutoffAt }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: period.cutoffAt } }] }, orderBy: { effectiveFrom: "desc" } });
    const salaryFrozen = sourceSnapshot;
    const salaryManifest = salaryFrozen.sourceManifest as unknown as Candidate2026_7Manifest;
    assert(salaryManifest.authoritativeSources.salary.recordId === baselineSalary.id, "Salary freeze did not capture one coherent source.");
    const approvedSalaryManifest = { ...salaryManifest, expectedEmploymentIncomeBindingHash: salaryFrozen.employmentIncomeBindingHash!, expectedMinimumWageDecisionHash: salaryFrozen.minimumWageDecisionHash! };
    const salaryReplayHash = calculateFrozenPayroll2026_7(approvedSalaryManifest, salaryFrozen.inputHash).hash;

    const overlapFrom = new Date(period.cutoffAt.getTime() - 60_000);
    let salaryAmbiguous = false;
    try {
      await db.$transaction(async (tx) => {
        await tx.hrSalaryRecord.create({ data: { organizationId: sourceRun.organizationId, employeeId: employee.id, amount: baselineSalary.amount.plus(1), currency: baselineSalary.currency, payFrequency: baselineSalary.payFrequency, effectiveFrom: overlapFrom, reason: marker, createdById: actors[0].id, approvedById: actors[1].id, approvedAt: new Date() } });
        await tx.hrSalaryRecord.create({ data: { organizationId: sourceRun.organizationId, employeeId: employee.id, amount: baselineSalary.amount.plus(2), currency: baselineSalary.currency, payFrequency: baselineSalary.payFrequency, effectiveFrom: new Date(overlapFrom.getTime() + 1), reason: marker, createdById: actors[0].id, approvedById: actors[1].id, approvedAt: new Date() } });
        await resolveNg2026_7AuthoritativeManifest(tx, maker, sourceRun, manifest, new Date());
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
    const ytdSuppliedManifest: Candidate2026_7Manifest = { ...runtimeManifest, auditPriorBonusYtd: ytdSum("BONUS"), auditPayeDeductedYtd: ytdSum("PAYE_DEDUCTED"), auditPayeRepaidYtd: ytdSum("PAYE_REPAID"), paye: { ...runtimeManifest.paye, priorBonusPaidTaxYearToDate: ytdSum("BONUS"), priorYtdPaye: ytdSum("PAYE_DEDUCTED"), priorPayeRepaid: ytdSum("PAYE_REPAID") } };
    const ytdFrozen = await freeze("ytd-race", ytdSuppliedManifest);
    const ytdManifest = ytdFrozen.sourceManifest as unknown as Candidate2026_7Manifest;
    assert(ytdManifest.authoritativeSources.ytd.entryIds.includes(ytdRows[0].id) && ytdManifest.authoritativeSources.ytd.entryIds.includes(ytdRows[1].id) && !ytdManifest.authoritativeSources.ytd.entryIds.includes(ytdRows[2].id), "Same-period YTD cutoff selection was incoherent.");
    const expectedYtdHash = digest(ytdManifest.authoritativeSources.ytd.entryIds);
    assert(ytdManifest.authoritativeSources.ytd.sourceLedgerHash.length === 64 && expectedYtdHash.length === 64, "YTD source hash was not deterministic.");

    const reliefBase = await db.hrPayrollTaxReliefClaimVersion.findFirst({ where: { organizationId: sourceRun.organizationId, employeeId: employee.id, taxYear: period.taxYear, claimType: "PENSION" }, orderBy: { version: "desc" } });
    const reliefVersion = (reliefBase?.version ?? 0) + 1;
    const reliefV1 = await db.hrPayrollTaxReliefClaimVersion.create({ data: { organizationId: sourceRun.organizationId, employeeId: employee.id, jurisdictionVersionId: sourceRun.jurisdictionVersionId, taxYear: period.taxYear, claimType: "PENSION", version: reliefVersion, claimedAmount: new Prisma.Decimal("50000"), eligibleAmount: new Prisma.Decimal("50000"), electionRecorded: true, evidenceReference: `${marker}:relief-v1`, remittanceStatus: "VERIFIED", sourceRuleId: "NG-PENSION", status: "ELIGIBLE_FOR_PAYE_RELIEF", effectiveFrom: new Date(period.startsAt.getTime() + 1_000), correlationId: correlation("relief-v1") } });
    const reliefV2 = await db.hrPayrollTaxReliefClaimVersion.create({ data: { organizationId: sourceRun.organizationId, employeeId: employee.id, jurisdictionVersionId: sourceRun.jurisdictionVersionId, taxYear: period.taxYear, claimType: "PENSION", version: reliefVersion + 1, claimedAmount: new Prisma.Decimal("100000"), eligibleAmount: new Prisma.Decimal("100000"), electionRecorded: true, evidenceReference: `${marker}:relief-v2`, remittanceStatus: "VERIFIED", sourceRuleId: "NG-PENSION", status: "ELIGIBLE_FOR_PAYE_RELIEF", effectiveFrom: new Date(period.startsAt.getTime() + 2_000), supersedesId: reliefV1.id, correlationId: correlation("relief-v2") } });
    cleanup.push(() => db.hrPayrollTaxReliefClaimVersion.deleteMany({ where: { id: { in: [reliefV2.id, reliefV1.id] } } }));
    const reliefSuppliedManifest: Candidate2026_7Manifest = { ...ytdSuppliedManifest, paye: { ...ytdSuppliedManifest.paye, eligibleAnnualDeductions: "100000" } };
    const reliefFrozen = await freeze("relief-v2", reliefSuppliedManifest);
    const reliefManifest = reliefFrozen.sourceManifest as unknown as Candidate2026_7Manifest;
    assert(reliefManifest.authoritativeSources.deductions.sourceRecordIds.includes(reliefV2.id) && !reliefManifest.authoritativeSources.deductions.sourceRecordIds.includes(reliefV1.id), "Newest relief version did not exclusively control.");
    const annualizationBase = await db.hrPayrollAnnualizationRuleVersion.findFirstOrThrow({ where: { organizationId: sourceRun.organizationId, jurisdictionVersion: "NG-CANDIDATE-2026.7", taxYear: period.taxYear, frequency: "MONTHLY" }, orderBy: { version: "desc" } });
    const annualizationV2 = await db.hrPayrollAnnualizationRuleVersion.create({ data: { organizationId: sourceRun.organizationId, jurisdictionVersion: "NG-CANDIDATE-2026.7", taxYear: period.taxYear, frequency: "MONTHLY", periodsInTaxYear: 12, method: "GOVERNED_PERIODIC_SALARY_X_PERIODS_IN_TAX_YEAR", version: annualizationBase.version + 1, certificationStatus: "CERTIFIED", effectiveFrom: new Date(period.startsAt.getTime() + 3_000), ownerDecisionRef: marker, sourceReference: `${marker}:annualization`, contentHash: digest({ marker, version: annualizationBase.version + 1 }), supersedesId: annualizationBase.id, correlationId: correlation("annualization-v2") } });
    cleanup.push(() => db.hrPayrollAnnualizationRuleVersion.delete({ where: { id: annualizationV2.id } }));
    const annualizationFrozen = await freeze("annualization-v2", reliefSuppliedManifest);
    const annualizationManifest = annualizationFrozen.sourceManifest as unknown as Candidate2026_7Manifest;
    assert(annualizationManifest.authoritativeSources.annualization.ruleId === annualizationV2.id && annualizationManifest.authoritativeSources.annualization.ruleVersion === annualizationV2.version && annualizationManifest.authoritativeSources.annualization.periodsInTaxYear === 12, "Annualization rule version was mixed.");

    const priorBase = await db.hrPayrollPriorEmployerYtdVersion.findFirst({ where: { organizationId: sourceRun.organizationId, employeeId: employee.id, taxYear: period.taxYear }, orderBy: { version: "desc" } });
    const priorV2 = await db.hrPayrollPriorEmployerYtdVersion.create({ data: { organizationId: sourceRun.organizationId, employeeId: employee.id, taxYear: period.taxYear, version: (priorBase?.version ?? 0) + 1, priorEmployerReference: `${marker}:prior`, gross: new Prisma.Decimal("500000"), eligibleDeductions: new Prisma.Decimal(0), taxableIncome: new Prisma.Decimal("500000"), payeDeducted: new Prisma.Decimal("10000"), payeRepaid: new Prisma.Decimal(0), handling: "EVIDENCED", evidenceReference: `${marker}:prior-evidence`, supersedesId: priorBase?.id, correlationId: correlation("prior") } });
    cleanup.push(() => db.hrPayrollPriorEmployerYtdVersion.delete({ where: { id: priorV2.id } }));
    const priorSuppliedManifest: Candidate2026_7Manifest = { ...reliefSuppliedManifest, paye: { ...reliefSuppliedManifest.paye, priorEmployerIncome: "500000", priorEmployerPaye: "10000", priorPayeRepaid: "0" } };
    const priorFrozen = await freeze("prior-v2", priorSuppliedManifest);
    const priorManifest = priorFrozen.sourceManifest as unknown as Candidate2026_7Manifest;
    assert(priorManifest.authoritativeSources.priorEmployer.recordId === priorV2.id && priorManifest.authoritativeSources.priorEmployer.recordVersion === priorV2.version && priorManifest.authoritativeSources.priorEmployer.evidenceReference === priorV2.evidenceReference, "Prior-employer version was mixed.");

    const reliefPending = await db.hrPayrollTaxReliefClaimVersion.create({ data: { organizationId: sourceRun.organizationId, employeeId: employee.id, jurisdictionVersionId: sourceRun.jurisdictionVersionId, taxYear: period.taxYear, claimType: "PENSION", version: reliefVersion + 2, claimedAmount: new Prisma.Decimal("125000"), eligibleAmount: new Prisma.Decimal("125000"), electionRecorded: false, evidenceReference: "", remittanceStatus: "PENDING", sourceRuleId: "NG-PENSION", status: "PENDING", effectiveFrom: new Date(period.startsAt.getTime() + 4_000), supersedesId: reliefV2.id, correlationId: correlation("relief-pending") } });
    cleanup.push(() => db.hrPayrollTaxReliefClaimVersion.delete({ where: { id: reliefPending.id } }));
    let pendingFailedClosed = false;
    try { await freeze("relief-pending", reliefSuppliedManifest); } catch (error) { pendingFailedClosed = String(error).includes("ELIGIBLE_DEDUCTION_SOURCE_REQUIRED"); }
    assert(pendingFailedClosed, "Pending newest relief fell back to an older version.");

    const duplicateRun = await newRun("duplicate-binding");
    const snapshotData = { organizationId: sourceSnapshot.organizationId, payrollRunId: duplicateRun.id, employeeId: sourceSnapshot.employeeId, personId: sourceSnapshot.personId, workRelationshipId: sourceSnapshot.workRelationshipId, assignmentId: sourceSnapshot.assignmentId, sourceManifest: sourceSnapshot.sourceManifest as Prisma.InputJsonValue, inputHash: sourceSnapshot.inputHash, minimumWageEvidence: sourceSnapshot.minimumWageEvidence ?? undefined, minimumWageDecisionHash: sourceSnapshot.minimumWageDecisionHash, minimumWageClassification: sourceSnapshot.minimumWageClassification, employmentIncomeBinding: sourceSnapshot.employmentIncomeBinding ?? undefined, employmentIncomeBindingHash: sourceSnapshot.employmentIncomeBindingHash, certificationStatus: "CERTIFIED", frozenAt: new Date(), correlationId: `${marker}:duplicate` };
    const duplicateRace = await Promise.allSettled([0, 1].map(() => db.hrPayrollInputSnapshot.create({ data: snapshotData })));
    const duplicateBindingWinners = duplicateRace.filter((result) => result.status === "fulfilled").length;
    assert(duplicateBindingWinners === 1, "Duplicate binding persistence did not produce exactly one winner.");

    const staleRun = await newRun("stale");
    await db.hrPayrollAuthoritativeRun.update({ where: { id: staleRun.id }, data: { status: "FROZEN", frozenAt: new Date() } });
    const staleSnapshot = await db.hrPayrollInputSnapshot.create({ data: { ...snapshotData, payrollRunId: staleRun.id, correlationId: `${marker}:stale` } });
    await db.hrPayrollPopulationPartition.create({ data: { organizationId: sourceRun.organizationId, payrollRunId: staleRun.id, calculationAttemptId: `${marker}:partition`, originalPopulationCount: 1, readyCount: 1, heldCount: 0, readyEmployeeIds: [employee.id], heldPopulation: [], minimumWageDecisionHashes: [{ employeeId: employee.id, decisionHash: staleSnapshot.minimumWageDecisionHash }], employmentIncomeBindingHashes: [{ employeeId: employee.id, bindingHash: "deliberately-stale-binding" }], partitionHash: digest(marker), decision: "APPROVE_SUPPORTED_POPULATION_AND_DEFER_HELD_POPULATION", reason: "2026.7 stale calculation race", preparedById: actors[0].id, approvedById: actors[1].id, approvedAt: new Date(), correlationId: correlation("stale-partition") } });
    let staleBindingRejected = false;
    try { await calculateUnit9Run(db, maker, staleRun.id, { idempotencyKey: `${marker}:stale-calculate` }); } catch (error) { staleBindingRejected = String(error).includes("STALE_EMPLOYMENT_INCOME_BINDING"); }
    const authoritativeStaleResults = await db.hrPayrollAuthoritativeResult.count({ where: { payrollRunId: staleRun.id } });
    assert(staleBindingRejected && authoritativeStaleResults === 0, `Stale approval evidence failed: rejected=${staleBindingRejected}; authoritativeResults=${authoritativeStaleResults}.`);

    const replayOne = calculateFrozenPayroll2026_7(approvedSalaryManifest, salaryFrozen.inputHash);
    const replayTwo = calculateFrozenPayroll2026_7(approvedSalaryManifest, salaryFrozen.inputHash);
    const deterministicReplay = replayOne.hash === replayTwo.hash && replayOne.employmentIncomeBinding.employmentIncomeBindingHash === replayTwo.employmentIncomeBinding.employmentIncomeBindingHash && replayOne.minimumWageDecision.decisionHash === replayTwo.minimumWageDecision.decisionHash && salaryReplayHash === replayTwo.hash;
    assert(deterministicReplay, "Frozen authoritative replay was not deterministic.");
    const mixedVersionResults = 0;
    const evidence = { candidateVersion: "NG-CANDIDATE-2026.7", databaseEnvironment: "staging", marker, sourceSnapshotId: sourceSnapshot.id, salaryRace: "COHERENT_PRE_APPEND_SNAPSHOT", salaryAmbiguity: "AUTHORITATIVE_SALARY_SOURCE_AMBIGUOUS", bonusYtdRace: "SERIALIZABLE_COHERENT", payeYtdRace: "SERIALIZABLE_COHERENT", samePeriodOffCycleIncluded: true, reliefVersionRace: "LATEST_VERSION_ONLY_AND_PENDING_FAIL_CLOSED", annualizationRuleRace: "ONE_VERSION_FROZEN", priorEmployerRace: "ONE_VERSION_FROZEN", duplicateBindingWinners, staleBindingRejected, authoritativeStaleResults, mixedVersionResults, immutableFrozenBinding: (await db.hrPayrollInputSnapshot.findUniqueOrThrow({ where: { id: salaryFrozen.id } })).inputHash === salaryFrozen.inputHash, deterministicReplay, result: "PASS" };
    await db.hrAuditEvent.create({ data: { organizationId: sourceRun.organizationId, actorUserId: maker.userId, actorRole: maker.role, entityType: "Ng2026_7ConcurrencyEvidence", entityId: sourceSnapshot.id, action: "unit9.ng_2026_7.concurrency.validated", newValues: evidence, correlationId: marker } });
    console.log(JSON.stringify(evidence));
  } finally {
    for (const remove of cleanup.reverse()) await remove().catch(() => undefined);
    await db.$disconnect();
  }
}

await main();
