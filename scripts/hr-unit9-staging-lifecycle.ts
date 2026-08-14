import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createPaymentDestinationVersion, verifyPaymentDestinationVersion } from "../src/lib/hr/payroll/unit9-financial-service";
import { calculateUnit9Run, certifyUnit9Population, createUnit9Run, decideUnit9Run, finalizeUnit9Run, freezeUnit9Inputs } from "../src/lib/hr/payroll/unit9-service";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
if (process.env.HR_UNIT9_STAGING_LIFECYCLE_CONFIRM !== "staging-only" || databaseUrl.pathname.slice(1) !== "zentric_analytics_staging") throw new Error("Refusing Unit 9 lifecycle validation outside the explicitly confirmed staging database.");
const equal = (actual: unknown, expected: unknown, label: string) => { if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`); };

async function run() {
    const prisma = new PrismaClient();
    const marker = `unit9-staging-${Date.now()}`;
    const id = (suffix: string) => `${marker}:${suffix}:${crypto.randomUUID()}`;
    try {
      const organization = await prisma.hrOrganization.findFirstOrThrow({ select: { id: true } });
      const users = await prisma.hrUser.findMany({ where: { organizationId: organization.id, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, take: 2, select: { id: true } });
      equal(users.length, 2, "maker/checker population");
      const [maker, checker] = users;
      const handoff = await prisma.hrPayrollCompHandoff.findFirstOrThrow({ where: { organizationId: organization.id }, orderBy: { createdAt: "desc" } });
      const assignment = await prisma.hrEmployeeAssignment.findFirstOrThrow({ where: { id: handoff.assignmentId, organizationId: organization.id, status: "ACTIVE", legalEntityId: { not: null } } });
      const employee = await prisma.hrEmployee.findFirstOrThrow({ where: { id: handoff.employeeId, organizationId: organization.id, personId: { not: null }, employmentStatus: { in: ["ACTIVE", "ON_LEAVE", "NOTICE_PERIOD"] } } });
      const relationship = await prisma.hrWorkRelationship.findFirstOrThrow({ where: { id: handoff.workRelationshipId, organizationId: organization.id, status: "ACTIVE" } });
      const makerActor = { organizationId: organization.id, userId: maker.id, role: "PAYROLL_PROCESSOR" };
      const checkerActor = { organizationId: organization.id, userId: checker.id, role: "PAYROLL_APPROVER" };

      const jurisdiction = await prisma.hrPayrollJurisdiction.upsert({ where: { organizationId_code: { organizationId: organization.id, code: "NG" } }, update: {}, create: { organizationId: organization.id, code: "NG", name: "Nigeria", currency: "NGN" } });
      const jurisdictionVersion = await prisma.hrPayrollJurisdictionVersion.create({ data: { organizationId: organization.id, jurisdictionId: jurisdiction.id, version: Math.floor(Date.now() / 1000), status: "TESTING", effectiveFrom: new Date("2026-01-01T00:00:00.000Z"), ruleManifest: { certification: "NOT_CERTIFIED", purpose: "staging simulation only" }, ruleHash: crypto.createHash("sha256").update(marker).digest("hex"), engineVersion: "unit9-1", correlationId: id("jurisdiction") } });
      const payrollCurrency = handoff.currency;
      const payGroup = await prisma.hrPayrollPayGroup.create({ data: { organizationId: organization.id, code: `U9-${Date.now()}`, name: "Unit 9 staging salaried simulation", workerType: "SALARIED", frequency: "MONTHLY", jurisdictionId: jurisdiction.id, currency: payrollCurrency, timezone: "Africa/Lagos" } });
      const period = await prisma.hrPayrollCalendarPeriod.create({ data: { organizationId: organization.id, payGroupId: payGroup.id, periodKey: `2026-${Date.now()}`, startsAt: new Date("2026-08-01T00:00:00.000Z"), endsAt: new Date("2026-08-31T23:59:59.000Z"), cutoffAt: new Date("2026-08-20T12:00:00.000Z"), freezeAt: new Date("2026-08-21T12:00:00.000Z"), calculationOpensAt: new Date("2026-08-22T12:00:00.000Z"), approvalDueAt: new Date("2026-08-25T12:00:00.000Z"), intendedPaymentAt: new Date("2026-08-28T12:00:00.000Z"), accountingDate: new Date("2026-08-31T12:00:00.000Z"), taxYear: 2026, taxPeriod: 8, timezone: "Africa/Lagos" } });
      const earning = await prisma.hrPayrollEarningDefinition.create({ data: { organizationId: organization.id, jurisdictionVersionId: jurisdictionVersion.id, code: "BASE", version: 1, taxableBaseCode: "PAYE", ruleManifest: { method: "FIXED" }, effectiveFrom: period.startsAt, correlationId: id("earning") } });
      const deduction = await prisma.hrPayrollDeductionDefinition.create({ data: { organizationId: organization.id, jurisdictionVersionId: jurisdictionVersion.id, code: "VOLUNTARY", version: 1, category: "VOLUNTARY", method: "FIXED", ruleManifest: { amount: "5000" }, effectiveFrom: period.startsAt, correlationId: id("deduction") } });
      const contribution = await prisma.hrPayrollEmployerContributionDefinition.create({ data: { organizationId: organization.id, jurisdictionVersionId: jurisdictionVersion.id, code: "EMPLOYER_TEST", version: 1, liabilityCategory: "EMPLOYER_ONLY", ruleManifest: { amount: "10000" }, effectiveFrom: period.startsAt, correlationId: id("contribution") } });
      const destination = await createPaymentDestinationVersion(prisma, makerActor, { employeeId: employee.id, bankName: "Staging Validation Bank", accountName: "Unit Nine Validation", accountNumber: "0000000000", currency: payrollCurrency, effectiveFrom: new Date() });
      const verifiedDestination = await verifyPaymentDestinationVersion(prisma, checkerActor, destination.id, "Independent staging verification");
      equal(verifiedDestination.verificationStatus, "VERIFIED", "payment destination verification");

      const run = await createUnit9Run(prisma, makerActor, { payGroupId: payGroup.id, calendarPeriodId: period.id, jurisdictionVersionId: jurisdictionVersion.id, idempotencyKey: `${marker}:run` });
      const candidate = { employeeId: employee.id, personId: employee.personId!, workRelationshipId: relationship.id, assignmentId: assignment.id, employmentStatus: employee.employmentStatus, legalEntityId: assignment.legalEntityId!, jurisdictionCode: "NG", payGroupId: payGroup.id, workerType: "SALARIED" as const, compensationHandoffId: handoff.id, compensationCurrency: handoff.currency, payrollCurrency, taxProfileVersionId: `staging-tax-${employee.id}`, paymentDestinationVersionId: verifiedDestination.id };
      const certification = await certifyUnit9Population(prisma, makerActor, run.id, [candidate]);
      equal(certification.runBlocked, false, "input certification run blocker");
      equal(certification.employeeBlocked.length, 0, "input certification employee blockers");
      const manifest = { currency: payrollCurrency, jurisdictionVersion: jurisdictionVersion.id, engineVersion: "unit9-1", earnings: [{ code: "BASE", sourceType: "UNIT8" as const, sourceId: handoff.id, fixedAmount: "100000", taxableBaseCode: "PAYE", ruleVersionReference: earning.id }], deductions: [{ code: "VOLUNTARY", sourceId: `election:${employee.id}`, definitionVersion: deduction.id, basis: "100000", method: "FIXED" as const, value: "5000" }], employerContributions: [{ code: "EMPLOYER_TEST", sourceId: `employer:${organization.id}`, definitionVersion: contribution.id, basis: "100000", method: "FIXED" as const, value: "10000", liabilityCategory: "EMPLOYER_ONLY" }], paye: { priorYtdTaxableIncome: "0", priorYtdPaye: "0", rules: { version: "STAGING-NOT-CERTIFIED", annualizationPeriods: 12, bands: [{ lowerExclusive: "0", upperInclusive: null, ratePercent: "10" }], roundingScale: 2 } } };
      equal((await freezeUnit9Inputs(prisma, makerActor, run.id, [{ candidate, sourceManifest: manifest }])).snapshotCount, 1, "frozen snapshot count");
      const calculation = await calculateUnit9Run(prisma, makerActor, run.id, { idempotencyKey: `${marker}:calculate` });
      equal("population" in calculation ? calculation.population : 0, 1, "calculated population");
      equal((await calculateUnit9Run(prisma, makerActor, run.id, { reason: "Replay validation", idempotencyKey: `${marker}:calculate` })).idempotent, true, "calculation replay");
      await decideUnit9Run(prisma, checkerActor, run.id, { decision: "APPROVED", reason: "Independent staging simulation review" });
      let finalizationRejected = false;
      try { await finalizeUnit9Run(prisma, checkerActor, run.id); } catch (error) { finalizationRejected = /jurisdictionCertified|missing prerequisites|no certified .* jurisdiction package/i.test(error instanceof Error ? error.message : String(error)); }
      equal(finalizationRejected, true, "NOT CERTIFIED finalization boundary");
      const result = await prisma.hrPayrollAuthoritativeResult.findFirstOrThrow({ where: { payrollRunId: run.id, authoritativeAt: { not: null } } });
      equal(result.netPay.toFixed(2), "85000.00", "net pay");
      equal(result.employerContributions.toFixed(2), "10000.00", "employer contribution");
      equal(result.finalizedAt, null, "finalized timestamp");
      console.log(JSON.stringify({ result: "PASS", marker, runId: run.id, resultId: result.id, jurisdictionStatus: jurisdictionVersion.status, currency: payrollCurrency, finalization: "REJECTED_NOT_CERTIFIED", netPay: result.netPay.toFixed(2), employerContributionOutsideNet: true }));
    } finally {
      await prisma.$disconnect();
    }
}

await run();
