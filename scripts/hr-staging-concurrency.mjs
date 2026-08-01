import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
if (process.env.HR_STAGING_CONCURRENCY_CONFIRM !== "staging-only" || databaseUrl.pathname.slice(1) !== "zentric_analytics_staging") {
  throw new Error("Refusing concurrency validation: explicit staging confirmation and zentric_analytics_staging are required.");
}

const prisma = new PrismaClient();
const run = `unit3-concurrency-${Date.now()}`;
const id = (label) => `${label}-${crypto.randomUUID()}`;
const outcomes = {};

async function race(name, operation) {
  const settled = await Promise.allSettled([operation("A"), operation("B")]);
  const fulfilled = settled.filter((item) => item.status === "fulfilled");
  const rejected = settled.filter((item) => item.status === "rejected");
  outcomes[name] = {
    winners: fulfilled.length,
    losers: rejected.length,
    losingCodes: rejected.map((item) => item.reason?.code ?? item.reason?.message ?? "unknown"),
  };
  if (fulfilled.length !== 1 || rejected.length !== 1) throw new Error(`${name}: expected one winner and one losing request.`);
}

function audit(tx, organizationId, actorUserId, entityType, entityId, action) {
  return tx.hrAuditEvent.create({ data: {
    organizationId, actorUserId, entityType, entityId, action,
    reason: `Isolated Unit 3 staging concurrency evidence ${run}`,
    correlationId: run,
    newValues: { validationRun: run },
  } });
}

try {
  const organization = await prisma.hrOrganization.findFirstOrThrow({ select: { id: true } });
  const actor = await prisma.hrUser.findFirstOrThrow({ where: { organizationId: organization.id, status: "ACTIVE" }, select: { id: true } });
  const template = await prisma.hrLifecycleTemplate.findFirstOrThrow({ where: { organizationId: organization.id, type: "ONBOARDING", active: true }, include: { tasks: true } });
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 86_400_000);

  const offer = await prisma.hrRecruitmentOffer.create({ data: {
    organizationId: organization.id, applicationId: id("application"), status: "ISSUED",
    createdById: actor.id, updatedById: actor.id,
  } });
  const version = await prisma.hrRecruitmentOfferVersion.create({ data: {
    offerId: offer.id, version: 1, positionTitle: "Unit 3 Concurrency Analyst", departmentId: id("department"),
    legalEntityId: id("legal"), employmentType: "FULL_TIME", salary: 1, currency: "USD", payFrequency: "MONTHLY",
    allowances: {}, benefits: {}, workMode: "REMOTE", startDate: now, contractType: "PERMANENT", expiresAt, terms: {}, createdById: actor.id,
  } });
  await prisma.hrRecruitmentOffer.update({ where: { id: offer.id }, data: { activeVersionId: version.id } });

  await race("offerAcceptance", (label) => prisma.$transaction(async (tx) => {
    const acceptance = await tx.hrRecruitmentOfferAcceptance.create({ data: { offerId: offer.id, offerVersionId: version.id, applicantId: id(`applicant-${label}`), method: "STAGING_CONCURRENCY" } });
    await tx.hrRecruitmentOffer.update({ where: { id: offer.id }, data: { status: "ACCEPTED", acceptedVersionId: version.id } });
    await audit(tx, organization.id, actor.id, "HrRecruitmentOffer", offer.id, "hr.validation.offer.accepted");
    return acceptance.id;
  }, { isolationLevel: "Serializable" }));
  const acceptance = await prisma.hrRecruitmentOfferAcceptance.findUniqueOrThrow({ where: { offerId: offer.id } });
  outcomes.offerAcceptance.records = await prisma.hrRecruitmentOfferAcceptance.count({ where: { offerId: offer.id } });
  outcomes.offerAcceptance.audits = await prisma.hrAuditEvent.count({ where: { correlationId: run, action: "hr.validation.offer.accepted" } });

  await race("handoverCreation", () => prisma.$transaction(async (tx) => {
    const handover = await tx.hrRecruitmentHandover.create({ data: { organizationId: organization.id, applicationId: offer.applicationId, offerAcceptanceId: acceptance.id, assignedHrTeamId: id("team") } });
    await audit(tx, organization.id, actor.id, "HrRecruitmentHandover", handover.id, "hr.validation.handover.created");
    return handover.id;
  }, { isolationLevel: "Serializable" }));
  const handover = await prisma.hrRecruitmentHandover.findUniqueOrThrow({ where: { offerAcceptanceId: acceptance.id } });
  outcomes.handoverCreation.records = await prisma.hrRecruitmentHandover.count({ where: { offerAcceptanceId: acceptance.id } });
  outcomes.handoverCreation.audits = await prisma.hrAuditEvent.count({ where: { correlationId: run, action: "hr.validation.handover.created" } });

  await race("preHireConversion", (label) => prisma.$transaction(async (tx) => {
    const conversion = await tx.hrPreHireConversion.create({ data: {
      organizationId: organization.id, handoverId: handover.id, applicantId: id(`conversion-applicant-${label}`), applicationId: id(`conversion-application-${label}`),
      employeeId: id(`conversion-employee-${label}`), lifecycleInstanceId: id(`conversion-lifecycle-${label}`), idempotencyKey: id(`conversion-key-${label}`), convertedById: actor.id,
    } });
    await audit(tx, organization.id, actor.id, "HrPreHireConversion", conversion.id, "hr.validation.prehire.converted");
    return conversion.id;
  }, { isolationLevel: "Serializable" }));
  outcomes.preHireConversion.records = await prisma.hrPreHireConversion.count({ where: { handoverId: handover.id } });
  outcomes.preHireConversion.audits = await prisma.hrAuditEvent.count({ where: { correlationId: run, action: "hr.validation.prehire.converted" } });

  const offer2 = await prisma.hrRecruitmentOffer.create({ data: { organizationId: organization.id, applicationId: id("onboarding-application"), status: "ACCEPTED", createdById: actor.id, updatedById: actor.id } });
  const version2 = await prisma.hrRecruitmentOfferVersion.create({ data: { offerId: offer2.id, version: 1, positionTitle: "Onboarding Concurrency", departmentId: id("department"), legalEntityId: id("legal"), employmentType: "FULL_TIME", salary: 1, currency: "USD", payFrequency: "MONTHLY", allowances: {}, benefits: {}, workMode: "REMOTE", startDate: now, contractType: "PERMANENT", expiresAt, terms: {}, createdById: actor.id } });
  const acceptance2 = await prisma.hrRecruitmentOfferAcceptance.create({ data: { offerId: offer2.id, offerVersionId: version2.id, applicantId: id("onboarding-applicant"), method: "STAGING_CONCURRENCY" } });
  await prisma.hrRecruitmentOffer.update({ where: { id: offer2.id }, data: { activeVersionId: version2.id, acceptedVersionId: version2.id } });
  const handover2 = await prisma.hrRecruitmentHandover.create({ data: { organizationId: organization.id, applicationId: offer2.applicationId, offerAcceptanceId: acceptance2.id, assignedHrTeamId: id("team"), status: "APPROVED" } });
  const employee = await prisma.hrEmployee.create({ data: { organizationId: organization.id, employeeNumber: `VALIDATION-PENDING-${Date.now()}`, legalFirstName: "Unit", lastName: "Concurrency", personalEmail: `unit3-${Date.now()}@example.invalid`, employmentStatus: "PRE_HIRE", startDate: now } });
  const year = now.getUTCFullYear();
  const sequenceBefore = (await prisma.hrEmployeeNumberSequence.findUnique({ where: { organizationId_year: { organizationId: organization.id, year } } }))?.lastValue ?? 0;
  await race("employeeNumberAndOnboarding", (label) => prisma.$transaction(async (tx) => {
    const sequence = await tx.hrEmployeeNumberSequence.upsert({ where: { organizationId_year: { organizationId: organization.id, year } }, update: { lastValue: { increment: 1 } }, create: { organizationId: organization.id, year, lastValue: 1 } });
    await tx.hrEmployee.update({ where: { id: employee.id }, data: { employeeNumber: `EMP-${year}-${String(sequence.lastValue).padStart(6, "0")}` } });
    const lifecycle = await tx.hrLifecycleInstance.create({ data: { organizationId: organization.id, templateId: template.id, employeeId: employee.id, type: "ONBOARDING", status: "ACTIVE", effectiveDate: now, startedAt: now, reason: run, createdById: actor.id, tasks: { create: template.tasks.map((task) => ({ organizationId: organization.id, templateTaskKey: task.key, title: task.title, description: task.description, ownerType: task.ownerType, dueAt: now, required: task.required, instructions: task.instructions, predecessorKeys: task.predecessorKeys })) } } });
    const conversion = await tx.hrPreHireConversion.create({ data: { organizationId: organization.id, handoverId: handover2.id, applicantId: id(`onboarding-applicant-${label}`), applicationId: id(`onboarding-application-${label}`), employeeId: employee.id, lifecycleInstanceId: lifecycle.id, idempotencyKey: id(`onboarding-key-${label}`), convertedById: actor.id } });
    await audit(tx, organization.id, actor.id, "HrLifecycleInstance", lifecycle.id, "hr.validation.onboarding.generated");
    return conversion.id;
  }, { isolationLevel: "Serializable" }));
  const sequenceAfter = (await prisma.hrEmployeeNumberSequence.findUniqueOrThrow({ where: { organizationId_year: { organizationId: organization.id, year } } })).lastValue;
  outcomes.employeeNumberAndOnboarding.sequenceIncrement = sequenceAfter - sequenceBefore;
  outcomes.employeeNumberAndOnboarding.lifecycleRecords = await prisma.hrLifecycleInstance.count({ where: { employeeId: employee.id, reason: run } });
  outcomes.employeeNumberAndOnboarding.taskRecords = await prisma.hrLifecycleTask.count({ where: { instance: { employeeId: employee.id, reason: run } } });
  outcomes.employeeNumberAndOnboarding.expectedTasks = template.tasks.length;
  outcomes.employeeNumberAndOnboarding.audits = await prisma.hrAuditEvent.count({ where: { correlationId: run, action: "hr.validation.onboarding.generated" } });

  const activationEmployee = await prisma.hrEmployee.create({ data: { organizationId: organization.id, employeeNumber: `VALIDATION-ACT-${Date.now()}`, legalFirstName: "Activation", lastName: "Race", employmentStatus: "READY_FOR_START", startDate: now } });
  await race("manualVsScheduledActivation", (source) => prisma.$transaction(async (tx) => {
    const activation = await tx.hrRecruitmentActivation.create({ data: { organizationId: organization.id, employeeId: activationEmployee.id, employeeActivatedAt: now, source: source === "A" ? "USER" : "SCHEDULED_JOB", idempotencyKey: `employee-activation:${activationEmployee.id}` } });
    await tx.hrEmployee.update({ where: { id: activationEmployee.id }, data: { employmentStatus: "ACTIVE" } });
    await audit(tx, organization.id, actor.id, "HrEmployee", activationEmployee.id, "hr.validation.employee.activated");
    return activation.id;
  }, { isolationLevel: "Serializable" }));
  outcomes.manualVsScheduledActivation.records = await prisma.hrRecruitmentActivation.count({ where: { employeeId: activationEmployee.id } });
  outcomes.manualVsScheduledActivation.audits = await prisma.hrAuditEvent.count({ where: { correlationId: run, action: "hr.validation.employee.activated" } });
  outcomes.manualVsScheduledActivation.employeeStatus = (await prisma.hrEmployee.findUniqueOrThrow({ where: { id: activationEmployee.id } })).employmentStatus;

  for (const [name, result] of Object.entries(outcomes)) {
    if (result.records !== undefined && result.records !== 1) throw new Error(`${name}: duplicate or missing durable record.`);
    if (result.audits !== undefined && result.audits !== 1) throw new Error(`${name}: audit evidence count is not exactly one.`);
  }
  if (outcomes.employeeNumberAndOnboarding.sequenceIncrement !== 1 || outcomes.employeeNumberAndOnboarding.lifecycleRecords !== 1 || outcomes.employeeNumberAndOnboarding.taskRecords !== outcomes.employeeNumberAndOnboarding.expectedTasks) throw new Error("Employee number or onboarding transaction left duplicates/orphans.");
  if (outcomes.manualVsScheduledActivation.employeeStatus !== "ACTIVE") throw new Error("Activation winner did not leave the employee ACTIVE.");
  console.log(JSON.stringify({ run, database: databaseUrl.pathname.slice(1), outcomes }, null, 2));
} finally {
  await prisma.$disconnect();
}
