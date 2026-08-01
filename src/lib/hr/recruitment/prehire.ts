import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { appendHrAudit } from "../audit";
import { createOpaqueToken, hashOpaqueToken, normalizeHrEmail, sealHrCredential } from "../auth/crypto";
import { dueDate } from "../lifecycle/definitions";
import { enqueueHrEmail } from "../notifications/outbox";
import { reconcilePositionOccupancy } from "../organization/position-commands";
import { evaluateActivationReadiness } from "./states";
import { evaluateHandoverEligibility } from "./handover";

type Client = Prisma.TransactionClient;

export async function convertApprovedHandoverToPreHire(
  tx: Client,
  input: {
    organizationId: string;
    handoverId: string;
    actorUserId: string;
    actorRole?: string;
    idempotencyKey: string;
  },
) {
  const previous = await tx.hrPreHireConversion.findFirst({
    where: { handoverId: input.handoverId, organizationId: input.organizationId },
  });
  if (previous) return previous;
  const eligibility = await evaluateHandoverEligibility(tx, input.organizationId, input.handoverId);
  if (!eligibility.eligible) throw new Error(`Pre-hire conversion is blocked: ${eligibility.blockers.join(", ")}.`);

  const handover = await tx.hrRecruitmentHandover.findFirstOrThrow({
    where: { id: input.handoverId, organizationId: input.organizationId, status: "APPROVED" },
    include: {
      offerAcceptance: { include: { offer: { include: { acceptedVersion: true } } } },
    },
  });
  const application = await tx.jobApplication.findFirstOrThrow({
    where: { id: handover.applicationId, organizationId: input.organizationId },
    include: { applicant: true },
  });
  const offerVersion = handover.offerAcceptance.offer.acceptedVersion;
  if (!offerVersion?.positionId) throw new Error("The accepted offer must identify an approved position.");
  const [position, template] = await Promise.all([
    tx.hrPosition.findFirstOrThrow({
      where: {
        id: offerVersion.positionId,
        organizationId: input.organizationId,
        departmentId: offerVersion.departmentId,
        status: "ACTIVE",
        lifecycleStatus: { in: ["OPEN", "PARTIALLY_FILLED"] },
      },
    }),
    tx.hrLifecycleTemplate.findFirst({
      where: { organizationId: input.organizationId, type: "ONBOARDING", active: true },
      include: { tasks: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    }),
  ]);
  if (!template) throw new Error("No active onboarding template matches this organization.");
  const startDate = offerVersion.startDate;
  const year = startDate.getUTCFullYear();
  const sequence = await tx.hrEmployeeNumberSequence.upsert({
    where: { organizationId_year: { organizationId: input.organizationId, year } },
    update: { lastValue: { increment: 1 } },
    create: { organizationId: input.organizationId, year, lastValue: 1 },
  });
  const employeeNumber = `EMP-${year}-${String(sequence.lastValue).padStart(6, "0")}`;
  const employee = await tx.hrEmployee.create({
    data: {
      organizationId: input.organizationId,
      recruitmentApplicationId: application.id,
      employeeNumber,
      legalFirstName: application.applicant.firstName ?? application.applicant.fullName.split(" ")[0],
      middleName: application.applicant.middleInitial,
      lastName: application.applicant.lastName ?? application.applicant.fullName.split(" ").slice(1).join(" "),
      personalEmail: application.applicant.email,
      phone: application.applicant.phone,
      employmentStatus: "PRE_HIRE",
      hireDate: startDate,
      startDate,
      workMode: offerVersion.workMode as "ONSITE" | "HYBRID" | "REMOTE",
    },
  });
  await tx.hrEmployeeStatusHistory.create({
    data: {
      organizationId: input.organizationId,
      employeeId: employee.id,
      newStatus: "PRE_HIRE",
      effectiveAt: new Date(),
      reason: "Approved recruitment handover converted to pre-hire",
      changedById: input.actorUserId,
    },
  });
  await tx.hrEmployeeAssignment.create({
    data: {
      organizationId: input.organizationId,
      employeeId: employee.id,
      departmentId: offerVersion.departmentId,
      teamId: position.teamId,
      positionId: position.id,
      employmentType: offerVersion.employmentType as "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN" | "TEMPORARY",
      location: offerVersion.location,
      effectiveFrom: startDate,
      status: "ACTIVE",
      reason: "Accepted recruitment offer",
      createdById: input.actorUserId,
      legalEntityId: offerVersion.legalEntityId,
      fte: 1,
    },
  });
  await reconcilePositionOccupancy(tx, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
  }, position.id);
  const lifecycle = await tx.hrLifecycleInstance.create({
    data: {
      organizationId: input.organizationId,
      templateId: template.id,
      employeeId: employee.id,
      type: "ONBOARDING",
      status: "ACTIVE",
      effectiveDate: startDate,
      startedAt: new Date(),
      reason: "Recruitment pre-hire onboarding",
      createdById: input.actorUserId,
      tasks: {
        create: template.tasks.map((task) => ({
          organizationId: input.organizationId,
          templateTaskKey: task.key,
          title: task.title,
          description: task.description,
          ownerType: task.ownerType,
          dueAt: dueDate(startDate, task.dueOffsetDays),
          required: task.required,
          instructions: task.instructions,
          predecessorKeys: task.predecessorKeys,
          status: task.predecessorKeys.length ? "BLOCKED" : "PENDING",
        })),
      },
    },
  });
  await enqueueHrEmail(tx, {
    organizationId: input.organizationId,
    recipient: application.applicant.email,
    template: "hr-lifecycle-started",
    subject: "Your onboarding has started",
    payload: { lifecycleInstanceId: lifecycle.id, recipientName: application.applicant.fullName, href: `/track?applicationId=${encodeURIComponent(application.applicationId)}&email=${encodeURIComponent(application.applicant.email)}` },
    idempotencyKey: `recruitment-onboarding-started:${lifecycle.id}`,
  });
  await tx.hrCandidateEmployeeLink.create({
    data: {
      organizationId: input.organizationId,
      applicantId: application.applicantId,
      applicationId: application.id,
      employeeId: employee.id,
    },
  });
  const conversion = await tx.hrPreHireConversion.create({
    data: {
      organizationId: input.organizationId,
      handoverId: handover.id,
      applicantId: application.applicantId,
      applicationId: application.id,
      employeeId: employee.id,
      lifecycleInstanceId: lifecycle.id,
      idempotencyKey: input.idempotencyKey,
      convertedById: input.actorUserId,
    },
  });
  await tx.hrRecruitmentHandover.update({ where: { id: handover.id }, data: { status: "CONVERTED_TO_PRE_HIRE", version: { increment: 1 } } });
  await tx.jobApplication.update({ where: { id: application.id }, data: { recruitmentStatus: "TRANSFERRED_TO_HR", version: { increment: 1 } } });
  await appendHrAudit(tx, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    entityType: "HrPreHireConversion",
    entityId: conversion.id,
    action: "hr.recruitment.prehire.converted",
    newValues: { employeeId: employee.id, lifecycleInstanceId: lifecycle.id, employeeNumber },
    reason: "Approved handover converted atomically",
    correlationId: crypto.randomUUID(),
  });
  return conversion;
}

export async function activateReadyEmployee(
  tx: Client,
  input: { organizationId: string; employeeId: string; actorUserId?: string; source: "USER" | "SCHEDULED_JOB"; now?: Date },
) {
  const existing = await tx.hrRecruitmentActivation.findFirst({ where: { employeeId: input.employeeId, organizationId: input.organizationId } });
  if (existing?.employeeActivatedAt) return existing;
  const now = input.now ?? new Date();
  const employee = await tx.hrEmployee.findFirstOrThrow({
    where: { id: input.employeeId, organizationId: input.organizationId },
    include: {
      employmentAssignments: { where: { status: "ACTIVE" } },
      lifecycleInstances: { where: { type: "ONBOARDING", status: { in: ["ACTIVE", "COMPLETED"] } }, include: { tasks: true } },
      user: true,
    },
  });
  const onboarding = employee.lifecycleInstances[0];
  const requiredTasksComplete = Boolean(onboarding) && onboarding.tasks.filter((task) => task.required).every((task) => task.status === "COMPLETED");
  const readiness = evaluateActivationReadiness({
    finalHrApprovalComplete: Boolean(await tx.hrPreHireConversion.findUnique({ where: { employeeId: employee.id } })),
    blockingRequirementsComplete: requiredTasksComplete,
    startDate: employee.startDate ?? new Date(8640000000000000),
    now,
    securitySetupComplete: !employee.user || employee.user.mfaEnabled,
    activeAssignmentExists: employee.employmentAssignments.length > 0,
    cancelledOrOnHold: ["CANCELLED", "ON_HOLD"].includes(employee.employmentStatus),
  });
  if (!readiness.ready) throw new Error(`Employee activation is blocked: ${readiness.blockers.join(", ")}.`);
  let provisionedUser = employee.user;
  if (!provisionedUser) {
    if (!employee.personalEmail) throw new Error("Employee account provisioning requires a personal email address.");
    const email = normalizeHrEmail(employee.personalEmail);
    const existingUser = await tx.hrUser.findUnique({ where: { organizationId_email: { organizationId: input.organizationId, email } }, include: { employee: true } });
    if (existingUser?.employee && existingUser.employee.id !== employee.id) throw new Error("The employee email is already linked to another employee account.");
    const role = await tx.hrRole.findUniqueOrThrow({ where: { organizationId_key: { organizationId: input.organizationId, key: "EMPLOYEE" } } });
    const createdById = input.actorUserId ?? (await tx.hrUser.findFirstOrThrow({ where: { organizationId: input.organizationId, isPrimaryAdmin: true, status: "ACTIVE" }, select: { id: true } })).id;
    provisionedUser = existingUser ?? await tx.hrUser.create({ data: { organizationId: input.organizationId, email, status: "INVITED" } });
    await tx.hrUserRole.upsert({ where: { userId_roleId: { userId: provisionedUser.id, roleId: role.id } }, update: { revokedAt: null, assignedById: createdById }, create: { userId: provisionedUser.id, roleId: role.id, assignedById: createdById } });
    await tx.hrEmployee.update({ where: { id: employee.id }, data: { userId: provisionedUser.id, companyEmail: email, companyEmailStatus: "PENDING" } });
    if (!provisionedUser.passwordHash) {
      await tx.hrAccountInvitation.updateMany({ where: { userId: provisionedUser.id, status: "ACTIVE" }, data: { status: "REVOKED" } });
      const rawToken = createOpaqueToken();
      const invitation = await tx.hrAccountInvitation.create({ data: { organizationId: input.organizationId, userId: provisionedUser.id, createdById, tokenHash: hashOpaqueToken(rawToken), expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000) } });
      const recipientName = `${employee.preferredName ?? employee.legalFirstName} ${employee.lastName}`;
      await enqueueHrEmail(tx, { organizationId: input.organizationId, recipient: email, template: "hr-account-invitation", subject: "Set up your Zentric HR account", payload: { invitationId: invitation.id, credentialEnvelope: sealHrCredential(rawToken), recipientName }, idempotencyKey: `hr-activation-invitation:${employee.id}` });
    }
    await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, entityType: "HrUser", entityId: provisionedUser.id, action: "hr.recruitment.employee_account.provisioned", newValues: { employeeId: employee.id, status: provisionedUser.status, role: "EMPLOYEE" }, reason: `Employee activation policy via ${input.source}` });
  }
  await tx.hrEmployee.update({ where: { id: employee.id }, data: { employmentStatus: "ACTIVE" } });
  if (provisionedUser.passwordHash && provisionedUser.mfaEnabled && provisionedUser.status !== "ACTIVE") await tx.hrUser.update({ where: { id: provisionedUser.id }, data: { status: "ACTIVE" } });
  const userActivated = Boolean(provisionedUser.passwordHash && provisionedUser.mfaEnabled);
  await enqueueHrEmail(tx, {
    organizationId: input.organizationId,
    recipient: employee.personalEmail!,
    template: "hr-employee-activated",
    subject: "Your employee record is active",
    payload: { employeeId: employee.id, recipientName: `${employee.preferredName ?? employee.legalFirstName} ${employee.lastName}`, href: userActivated ? "/hr/employee" : "/hr/invitation" },
    idempotencyKey: `employee-activated:${employee.id}`,
  });
  const activation = await tx.hrRecruitmentActivation.upsert({
    where: { employeeId: employee.id },
    update: { employeeActivatedAt: now, userActivatedAt: userActivated ? now : null, activatedById: input.actorUserId, source: input.source },
    create: {
      organizationId: input.organizationId,
      employeeId: employee.id,
      employeeActivatedAt: now,
      userActivatedAt: userActivated ? now : null,
      activatedById: input.actorUserId,
      source: input.source,
      idempotencyKey: `employee-activation:${employee.id}`,
    },
  });
  await appendHrAudit(tx, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    entityType: "HrEmployee",
    entityId: employee.id,
    action: "hr.recruitment.employee.activated",
    previousValues: { employmentStatus: employee.employmentStatus },
    newValues: { employmentStatus: "ACTIVE", userProvisioned: true, userActivated },
    reason: `Activation readiness passed via ${input.source}`,
  });
  return activation;
}
