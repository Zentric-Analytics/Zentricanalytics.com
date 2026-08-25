import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { decideNg2026_5MinimumWage, NG_2026_5_VERSION, type Ng2026_5MinimumWageEvidence } from "../src/lib/hr/payroll/nigeria-2026-5";
import { complianceEligibility } from "../src/lib/hr/payroll/unit9-limited-launch";
import { approvePopulationPartition, calculateUnit9Run, certifyUnit9Population, createUnit9Run, decideUnit9Run, finalizeUnit9Run, freezeUnit9Inputs, persistPopulationPartition } from "../src/lib/hr/payroll/unit9-service";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
if (process.env.HR_UNIT9_NG_2026_5_STAGING_CONFIRM !== "staging-only" || databaseUrl.pathname.slice(1) !== "zentric_analytics_staging") throw new Error("Refusing NG-CANDIDATE-2026.5 validation outside confirmed staging.");
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

async function main() {
  const db = new PrismaClient();
  const marker = `ng-2026-5-${Date.now()}`;
  const correlation = (suffix: string) => `${marker}:${suffix}:${crypto.randomUUID()}`;
  try {
    const organization = await db.hrOrganization.findFirstOrThrow({ select: { id: true } });
    const users = await db.hrUser.findMany({ where: { organizationId: organization.id, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, take: 2, select: { id: true } });
    assert(users.length === 2, "Two independent staging actors are required.");
    const maker = { organizationId: organization.id, userId: users[0].id, role: "PAYROLL_PROCESSOR" };
    const checker = { organizationId: organization.id, userId: users[1].id, role: "PAYROLL_APPROVER" };
    const handoff = await db.hrPayrollCompHandoff.findFirstOrThrow({ where: { organizationId: organization.id }, orderBy: { createdAt: "desc" } });
    const assignment = await db.hrEmployeeAssignment.findFirstOrThrow({ where: { id: handoff.assignmentId, organizationId: organization.id, legalEntityId: { not: null } } });
    const employee = await db.hrEmployee.findFirstOrThrow({ where: { id: handoff.employeeId, organizationId: organization.id, personId: { not: null } } });
    const relationship = await db.hrWorkRelationship.findFirstOrThrow({ where: { id: handoff.workRelationshipId, organizationId: organization.id } });
    const jurisdiction = await db.hrPayrollJurisdiction.upsert({ where: { organizationId_code: { organizationId: organization.id, code: "NG" } }, update: {}, create: { organizationId: organization.id, code: "NG", name: "Nigeria", currency: "NGN" } });
    const jurisdictionVersion = await db.hrPayrollJurisdictionVersion.create({ data: { organizationId: organization.id, jurisdictionId: jurisdiction.id, version: Math.floor(Date.now() / 1000), status: "TESTING", effectiveFrom: new Date("2026-01-01T00:00:00.000Z"), ruleManifest: { candidateVersion: NG_2026_5_VERSION, certification: "NOT_CERTIFIED" }, ruleHash: crypto.createHash("sha256").update(marker).digest("hex"), engineVersion: "unit9-ng-2026.5", correlationId: correlation("jurisdiction") } });
    const payGroup = await db.hrPayrollPayGroup.create({ data: { organizationId: organization.id, code: `NG25-${Date.now()}`, name: "NG 2026.5 governed staging", workerType: "SALARIED", frequency: "MONTHLY", jurisdictionId: jurisdiction.id, currency: "NGN", timezone: "Africa/Lagos" } });
    const period = await db.hrPayrollCalendarPeriod.create({ data: { organizationId: organization.id, payGroupId: payGroup.id, periodKey: marker, startsAt: new Date("2026-08-01T00:00:00Z"), endsAt: new Date("2026-08-31T23:59:59Z"), cutoffAt: new Date("2026-08-20T12:00:00Z"), freezeAt: new Date("2026-08-21T12:00:00Z"), calculationOpensAt: new Date("2026-08-22T12:00:00Z"), approvalDueAt: new Date("2026-08-25T12:00:00Z"), intendedPaymentAt: new Date("2026-08-28T12:00:00Z"), accountingDate: new Date("2026-08-31T12:00:00Z"), taxYear: 2026, taxPeriod: 8, timezone: "Africa/Lagos" } });
    const salaryDefinition = await db.hrPayrollEarningDefinition.create({ data: { organizationId: organization.id, jurisdictionVersionId: jurisdictionVersion.id, code: "SALARY", version: 1, taxableBaseCode: "EMPLOYMENT", ruleManifest: { candidateVersion: NG_2026_5_VERSION }, effectiveFrom: period.startsAt, correlationId: correlation("salary") } });
    const run = await createUnit9Run(db, maker, { payGroupId: payGroup.id, calendarPeriodId: period.id, jurisdictionVersionId: jurisdictionVersion.id, idempotencyKey: `${marker}:run` });
    const candidate = { employeeId: employee.id, personId: employee.personId!, workRelationshipId: relationship.id, assignmentId: assignment.id, employmentStatus: employee.employmentStatus, legalEntityId: assignment.legalEntityId!, jurisdictionCode: "NG", payGroupId: payGroup.id, workerType: "SALARIED" as const, compensationHandoffId: handoff.id, compensationCurrency: handoff.currency, payrollCurrency: handoff.currency, taxProfileVersionId: `${marker}:tax-profile`, paymentDestinationVersionId: `${marker}:verified-destination` };
    const certification = await certifyUnit9Population(db, maker, run.id, [candidate]);
    assert(!certification.runBlocked && certification.employeeBlocked.length === 0, "Candidate certification failed.");
    const minimumWageEvidence: Ng2026_5MinimumWageEvidence = { employeeId: employee.id, workRelationshipId: relationship.id, payrollPeriodId: period.id, rta: "LAGOS", candidateVersion: NG_2026_5_VERSION, monthlySalary: "70000", currentPeriodBonus: "0", materiallyVariableMonthlyWage: "NO", ambiguousMultiEmployer: "NO", unusualPartialYearArrangement: "NO", otherTaxableEmploymentIncome: "VERIFIED_NONE", evidenceCompletenessCertified: true, evidenceReferences: [`${marker}:certified-gross-income`], inputCertificationId: `${marker}:certification`, inputCertificationVersion: "1" };
    const supportedDecision = decideNg2026_5MinimumWage(minimumWageEvidence);
    const heldDecision = decideNg2026_5MinimumWage({ ...minimumWageEvidence, employeeId: `${employee.id}:held`, otherTaxableEmploymentIncome: "PRESENT", evidenceReferences: [`${marker}:bik-present`] });
    const supportedEligibility = complianceEligibility({ rta: "LAGOS", earnings: [{ type: "SALARY", amount: "70000" }], pensionOperationalState: "CONFIGURED", candidateVersion: NG_2026_5_VERSION, minimumWageDecision: supportedDecision });
    const heldEligibility = complianceEligibility({ rta: "LAGOS", earnings: [{ type: "SALARY", amount: "70000" }], pensionOperationalState: "CONFIGURED", candidateVersion: NG_2026_5_VERSION, minimumWageDecision: heldDecision });
    assert(supportedEligibility.status === "READY", "Standard case was not READY.");
    assert(heldEligibility.status === "COMPLIANCE_HOLD" && heldEligibility.findings.some((finding) => finding.code === "OTHER_TAXABLE_EMPLOYMENT_INCOME_UNSUPPORTED"), "Other-income case did not fail closed.");
    const partition = await persistPopulationPartition(db, maker, { payrollRunId: run.id, calculationAttemptId: `${marker}:precalculation`, members: [{ employeeId: employee.id, eligibility: supportedEligibility, minimumWageDecisionHash: supportedDecision.decisionHash }, { employeeId: `${employee.id}:held`, eligibility: heldEligibility, minimumWageDecisionHash: heldDecision.decisionHash }] });
    await approvePopulationPartition(db, checker, partition.id, { decision: "APPROVE_SUPPORTED_POPULATION_AND_DEFER_HELD_POPULATION", reason: "Independent governed staging validation", expectedPartitionHash: partition.partitionHash, expectedResolutionPath: "Resolve supported-taxonomy evidence before a new frozen partition." });
    const sourceManifest = { employeeId: employee.id, workRelationshipId: relationship.id, payrollPeriodId: period.id, currency: "NGN", jurisdictionVersion: NG_2026_5_VERSION, engineVersion: "unit9-ng-2026.5", minimumWageEvidence, expectedMinimumWageDecisionHash: supportedDecision.decisionHash, earnings: [{ code: "SALARY", sourceType: "UNIT8" as const, sourceId: handoff.id, fixedAmount: "70000", taxableBaseCode: "EMPLOYMENT", ruleVersionReference: salaryDefinition.id }], paye: { priorYtdTaxableIncome: "0", priorYtdPaye: "0", expectedAnnualEmploymentIncome: "840000", eligibleAnnualDeductions: "0", periodsElapsed: 8, periodsInTaxYear: 12, currentNonPeriodicPayments: "0", bonusPaidTaxYearToDate: "0", rules: { version: "must-not-run", annualizationPeriods: 12, roundingScale: 2, bands: [] } } };
    assert((await freezeUnit9Inputs(db, maker, run.id, [{ candidate, sourceManifest }])).snapshotCount === 1, "Snapshot was not frozen.");
    const calculated = await calculateUnit9Run(db, maker, run.id, { idempotencyKey: `${marker}:calculate` });
    assert("population" in calculated && calculated.population === 1, "Governed calculation did not complete.");
    assert((await calculateUnit9Run(db, maker, run.id, { reason: "Idempotent replay", idempotencyKey: `${marker}:calculate` })).idempotent, "Calculation replay duplicated work.");
    const result = await db.hrPayrollAuthoritativeResult.findFirstOrThrow({ where: { payrollRunId: run.id, employeeId: employee.id, authoritativeAt: { not: null } } });
    assert(result.paye.isZero() && result.minimumWageClassification === "MINIMUM_WAGE_EXEMPT" && result.minimumWageDecisionHash === supportedDecision.decisionHash, "Persisted exempt result is incorrect.");
    await decideUnit9Run(db, checker, run.id, { decision: "APPROVED", reason: "Staging simulation review" });
    let finalizationRejected = false;
    try { await finalizeUnit9Run(db, checker, run.id); } catch { finalizationRejected = true; }
    assert(finalizationRejected, "NOT_CERTIFIED candidate reached finalization.");
    const snapshot = await db.hrPayrollInputSnapshot.findFirstOrThrow({ where: { payrollRunId: run.id, employeeId: employee.id } });
    assert(snapshot.minimumWageDecisionHash === supportedDecision.decisionHash && snapshot.minimumWageClassification === "MINIMUM_WAGE_EXEMPT", "Frozen snapshot decision lineage is missing.");
    console.log(JSON.stringify({ result: "PASS", candidateVersion: NG_2026_5_VERSION, marker, runId: run.id, resultId: result.id, standardCase: { salary: "70000.00", classification: result.minimumWageClassification, paye: result.paye.toFixed(2), decisionHash: result.minimumWageDecisionHash }, heldCase: { salary: "70000.00", otherTaxableIncome: "PRESENT", status: heldEligibility.status, blockers: heldEligibility.findings.map((finding) => finding.code) }, partitionHash: partition.partitionHash, finalization: "REJECTED_NOT_CERTIFIED" }));
  } finally { await db.$disconnect(); }
}

await main();
