import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { appendHrAudit } from "@/lib/hr/audit";
import { createOpaqueToken, hashOpaqueToken, normalizeHrEmail, sealHrCredential } from "@/lib/hr/auth/crypto";
import { lastFour } from "@/lib/hr/core/invariants";
import { dueDate } from "@/lib/hr/lifecycle/definitions";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { provisioningPayloadSchema, provisioningReadiness } from "./provisioning";
import { reconcilePositionOccupancy } from "@/lib/hr/organization/position-commands";

export async function finalizeEmployeeProvisioning(
  tx: Prisma.TransactionClient,
  input: { draftId: string; organizationId: string; actorUserId: string; actorRole?: string },
) {
  const draft = await tx.hrEmployeeProvisioningDraft.findFirstOrThrow({
    where: { id: input.draftId, organizationId: input.organizationId, status: "PENDING_APPROVAL" },
  });
  if (draft.createdById === input.actorUserId) throw new Error("Employee creator cannot perform final activation.");
  const payload = provisioningPayloadSchema.parse(draft.payload);
  const readiness = provisioningReadiness(payload);
  if (readiness.blocking.length) throw new Error(`Provisioning is not ready: ${readiness.blocking.map(({ label }) => label).join(", ")}.`);
  if (payload.compensation?.baseSalary && (!payload.compensation.currency || !payload.compensation.effectiveFrom || !payload.compensation.reason)) {
    throw new Error("Compensation requires currency, effective date, and approval reason.");
  }
  if (payload.payroll?.accountNumber && (!payload.payroll.bankName || !payload.payroll.accountName)) {
    throw new Error("Bank account details require the bank and account names.");
  }
  if (payload.access?.createUser && (!payload.access.email || payload.access.role !== "EMPLOYEE")) {
    throw new Error("Employee account creation requires an email and the EMPLOYEE role.");
  }
  if (payload.onboarding?.start && !payload.onboarding.templateId) {
    throw new Error("Onboarding requires an active onboarding template.");
  }
  if (payload.access?.role && payload.access.role !== "EMPLOYEE") throw new Error("Privileged initial roles require the separate privileged-access approval workflow.");

  const [department, position, manager] = await Promise.all([
    tx.hrDepartment.findFirstOrThrow({ where: { id: payload.assignment!.departmentId!, organizationId: input.organizationId, status: "ACTIVE" } }),
    tx.hrPosition.findFirstOrThrow({ where: { id: payload.assignment!.positionId!, organizationId: input.organizationId, status: "ACTIVE", lifecycleStatus: { in: ["OPEN", "PARTIALLY_FILLED"] } } }),
    tx.hrEmployee.findFirstOrThrow({ where: { id: payload.assignment!.primaryManagerId!, organizationId: input.organizationId, employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] } }, include: { user: true } }),
  ]);
  if (position.departmentId !== department.id) throw new Error("The selected position does not belong to the selected department.");
  if (payload.assignment?.teamId && position.teamId !== payload.assignment.teamId) throw new Error("The selected position does not belong to the selected team.");

  const hireDate = new Date(payload.employment!.hireDate!);
  const startDate = new Date(payload.employment!.startDate!);
  const year = startDate.getUTCFullYear();
  const sequence = payload.employment?.employeeNumber ? null : await tx.hrEmployeeNumberSequence.upsert({
    where: { organizationId_year: { organizationId: input.organizationId, year } },
    update: { lastValue: { increment: 1 } },
    create: { organizationId: input.organizationId, year, lastValue: 1 },
  });
  const employeeNumber = payload.employment?.employeeNumber ?? `ZA-EMP-${year}-${String(sequence!.lastValue).padStart(4, "0")}`;
  const employee = await tx.hrEmployee.create({ data: {
    organizationId: input.organizationId, employeeNumber,
    legalFirstName: payload.personal!.legalFirstName!, middleName: payload.personal?.middleName,
    lastName: payload.personal!.lastName!, preferredName: payload.personal?.preferredName,
    personalEmail: payload.personal?.personalEmail, phone: payload.personal?.phone,
    dateOfBirth: payload.personal?.dateOfBirth ? new Date(payload.personal.dateOfBirth) : null,
    hireDate, startDate, workMode: payload.employment?.workMode, probationEndDate: payload.employment?.probationEndDate ? new Date(payload.employment.probationEndDate) : null,
    notes: payload.employment?.notes, employmentStatus: "ACTIVE",
  } });
  await tx.hrEmployeeStatusHistory.create({ data: { organizationId: input.organizationId, employeeId: employee.id, newStatus: "ACTIVE", effectiveAt: startDate, reason: "Approved employee provisioning", changedById: input.actorUserId } });
  await tx.hrEmployeeAssignment.create({ data: {
    organizationId: input.organizationId, employeeId: employee.id, departmentId: department.id,
    teamId: payload.assignment?.teamId, positionId: position.id, employmentType: payload.employment!.employmentType!,
    location: payload.employment?.location, effectiveFrom: new Date(payload.assignment!.effectiveFrom!),
    reason: payload.assignment!.reason!, createdById: input.actorUserId,
  } });
  await reconcilePositionOccupancy(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, actorRole: input.actorRole }, position.id);
  await tx.hrSupervisorAssignment.create({ data: {
    organizationId: input.organizationId, supervisorEmployeeId: manager.id, assignedEmployeeId: employee.id,
    assignmentType: "DIRECT_REPORT", effectiveFrom: new Date(payload.assignment!.effectiveFrom!), reason: payload.assignment!.reason!,
    capabilities: ["supervisor.read_team", "supervisor.review_assigned"], assignedByUserId: input.actorUserId,
  } });
  if (payload.personal?.addressLine1 && payload.personal.city && payload.personal.country) await tx.hrEmployeeAddress.create({ data: { employeeId: employee.id, type: "HOME", line1: payload.personal.addressLine1, city: payload.personal.city, country: payload.personal.country, isPrimary: true } });
  if (payload.personal?.emergencyName && payload.personal.emergencyRelationship && payload.personal.emergencyPhone) await tx.hrEmergencyContact.create({ data: { employeeId: employee.id, fullName: payload.personal.emergencyName, relationship: payload.personal.emergencyRelationship, phone: payload.personal.emergencyPhone, isPrimary: true } });
  if (payload.compensation?.baseSalary) await tx.hrSalaryRecord.create({ data: {
    organizationId: input.organizationId, employeeId: employee.id, amount: payload.compensation.baseSalary,
    currency: payload.compensation.currency!.toUpperCase(), payFrequency: payload.compensation.payFrequency ?? "MONTHLY",
    effectiveFrom: new Date(payload.compensation.effectiveFrom!), reason: payload.compensation.reason!, createdById: draft.createdById,
  } });
  if (payload.payroll?.accountNumber) await tx.hrEmployeeBankAccount.create({ data: {
    employeeId: employee.id, bankName: payload.payroll.bankName!, accountName: payload.payroll.accountName!,
    accountNumberEncrypted: sealHrCredential(payload.payroll.accountNumber), accountNumberLastFour: lastFour(payload.payroll.accountNumber),
    currency: payload.compensation?.currency?.toUpperCase() ?? "NGN",
  } });
  if (payload.payroll?.taxCountry) await tx.hrEmployeeTaxProfile.create({ data: {
    employeeId: employee.id, taxCountry: payload.payroll.taxCountry,
    taxIdentifierEncrypted: payload.payroll.taxId ? sealHrCredential(payload.payroll.taxId) : null,
    taxIdentifierLastFour: payload.payroll.taxId ? lastFour(payload.payroll.taxId) : null,
    pensionProvider: payload.payroll.pensionProvider,
    pensionIdentifierEncrypted: payload.payroll.pensionId ? sealHrCredential(payload.payroll.pensionId) : null,
  } });

  if (payload.access?.createUser) {
    const email = normalizeHrEmail(payload.access.email!);
    const role = await tx.hrRole.findUniqueOrThrow({ where: { organizationId_key: { organizationId: input.organizationId, key: "EMPLOYEE" } } });
    const user = await tx.hrUser.create({ data: { organizationId: input.organizationId, email, status: "INVITED" } });
    await tx.hrEmployee.update({ where: { id: employee.id }, data: { userId: user.id, companyEmail: email, companyEmailStatus: "PENDING" } });
    await tx.hrUserRole.create({ data: { userId: user.id, roleId: role.id, assignedById: input.actorUserId } });
    if (payload.access.sendInvitation) {
      const rawToken = createOpaqueToken();
      const invitation = await tx.hrAccountInvitation.create({ data: { organizationId: input.organizationId, userId: user.id, createdById: input.actorUserId, tokenHash: hashOpaqueToken(rawToken), expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) } });
      await enqueueHrEmail(tx, { organizationId: input.organizationId, recipient: email, template: "hr-account-invitation", subject: "Set up your Zentric HR account", payload: { invitationId: invitation.id, credentialEnvelope: sealHrCredential(rawToken) }, idempotencyKey: `hr-invitation:${invitation.id}` });
    }
  }

  if (payload.onboarding?.start) {
    const template = await tx.hrLifecycleTemplate.findFirstOrThrow({ where: { id: payload.onboarding.templateId!, organizationId: input.organizationId, type: "ONBOARDING", active: true }, include: { tasks: { orderBy: { sortOrder: "asc" } } } });
    await tx.hrLifecycleInstance.create({ data: {
      organizationId: input.organizationId, templateId: template.id, employeeId: employee.id, type: "ONBOARDING",
      status: "ACTIVE", effectiveDate: startDate, startedAt: new Date(), createdById: input.actorUserId,
      tasks: { create: template.tasks.map((task) => ({
        organizationId: input.organizationId, templateTaskKey: task.key, title: task.title, description: task.description,
        ownerType: task.ownerType, dueAt: dueDate(startDate, task.dueOffsetDays), required: task.required,
        instructions: task.instructions, predecessorKeys: task.predecessorKeys, status: task.predecessorKeys.length ? "BLOCKED" : "PENDING",
        assignedUserId: task.ownerType === "SUPERVISOR" ? manager.userId : null,
      })) },
    } });
  }
  await tx.hrEmployeeProvisioningDraft.update({ where: { id: draft.id }, data: { status: "FINALIZED", finalizedAt: new Date(), finalizedById: input.actorUserId, finalizedEmployeeId: employee.id, readinessScore: readiness.score } });
  await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, actorRole: input.actorRole, entityType: "HrEmployee", entityId: employee.id, action: "hr.employee.provisioned", newValues: { draftId: draft.id, assignmentCreated: true, userCreated: Boolean(payload.access?.createUser), onboardingStarted: Boolean(payload.onboarding?.start), correlationId: crypto.randomUUID() }, reason: "Approved transactional employee provisioning" });
  return employee;
}
