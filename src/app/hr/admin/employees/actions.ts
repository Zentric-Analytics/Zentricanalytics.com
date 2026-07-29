"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { sealHrCredential } from "@/lib/hr/auth/crypto";
import { employeeCreateInput, employeeInput, lastFour } from "@/lib/hr/core/invariants";
import { requirePermission } from "@/lib/hr/permissions/authorize";

export async function createEmployeeAction(formData: FormData) {
  const auth = await requirePermission("employee.create");
  const input = employeeCreateInput.parse(Object.fromEntries(formData));
  if (input.employmentStatus === "TERMINATED") throw new Error("Create the employee first, then use the audited termination workflow.");
  await prisma.$transaction(async (tx) => {
    const year = (input.startDate ?? input.hireDate).getUTCFullYear();
    const sequence = input.employeeNumber ? null : await tx.hrEmployeeNumberSequence.upsert({ where: { organizationId_year: { organizationId: auth.user.organizationId, year } }, update: { lastValue: { increment: 1 } }, create: { organizationId: auth.user.organizationId, year, lastValue: 1 } });
    const employeeNumber = input.employeeNumber ?? `ZA-EMP-${year}-${String(sequence!.lastValue).padStart(4, "0")}`;
    const employee = await tx.hrEmployee.create({ data: { ...input, employeeNumber, organizationId: auth.user.organizationId } });
    await tx.hrEmployeeStatusHistory.create({ data: { organizationId: auth.user.organizationId, employeeId: employee.id, newStatus: employee.employmentStatus, effectiveAt: employee.startDate ?? employee.hireDate ?? new Date(), reason: "Initial employee record creation", changedById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployee", entityId: employee.id, action: "hr.employee.created", newValues: { ...input, employeeNumber } });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/employees");
}

const bankInput = z.object({
  employeeId: z.string().cuid(),
  bankName: z.string().trim().min(2).max(120),
  accountName: z.string().trim().min(2).max(160),
  accountNumber: z.string().trim().min(5).max(40),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
});

export async function saveEmployeeBankAccountAction(formData: FormData) {
  const auth = await requirePermission("payroll.read_bank_details");
  const input = bankInput.parse(Object.fromEntries(formData));
  const employee = await prisma.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: auth.user.organizationId } });
  await prisma.$transaction(async (tx) => {
    await tx.hrEmployeeBankAccount.updateMany({ where: { employeeId: employee.id, isPrimary: true }, data: { isPrimary: false } });
    const account = await tx.hrEmployeeBankAccount.create({ data: { employeeId: employee.id, bankName: input.bankName, accountName: input.accountName, accountNumberEncrypted: sealHrCredential(input.accountNumber), accountNumberLastFour: lastFour(input.accountNumber), currency: input.currency, isPrimary: true } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployeeBankAccount", entityId: account.id, action: "hr.employee.bank_account.updated", newValues: { employeeId: employee.id, bankName: input.bankName, accountNumber: input.accountNumber }, reason: "Authorized payroll banking update" });
  });
  revalidatePath(`/hr/admin/employees/${employee.id}`);
}

const profileInput = employeeInput.extend({ employeeId: z.string().cuid(), reason: z.string().trim().min(3).max(500) });
export async function updateEmployeeProfileAction(formData: FormData) {
  const auth = await requirePermission("employee.update");
  const { employeeId, reason, ...input } = profileInput.parse(Object.fromEntries(formData));
  if (input.employmentStatus === "TERMINATED") throw new Error("Use the audited termination workflow.");
  const employee = await prisma.hrEmployee.findFirstOrThrow({ where: { id: employeeId, organizationId: auth.user.organizationId } });
  await prisma.$transaction(async (tx) => {
    await tx.hrEmployee.update({ where: { id: employee.id }, data: input });
    if (employee.employmentStatus !== input.employmentStatus) await tx.hrEmployeeStatusHistory.create({ data: { organizationId: auth.user.organizationId, employeeId: employee.id, previousStatus: employee.employmentStatus, newStatus: input.employmentStatus, effectiveAt: new Date(), reason, changedById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployee", entityId: employee.id, action: "hr.employee.profile.updated", previousValues: { legalFirstName: employee.legalFirstName, middleName: employee.middleName, lastName: employee.lastName, preferredName: employee.preferredName, companyEmail: employee.companyEmail, personalEmail: employee.personalEmail, phone: employee.phone, hireDate: employee.hireDate, employmentStatus: employee.employmentStatus }, newValues: input, reason });
  });
  revalidatePath(`/hr/admin/employees/${employee.id}`);
  revalidatePath("/hr/admin/employees");
}

const addressInput = z.object({ employeeId: z.string().cuid(), type: z.enum(["HOME", "MAILING", "EMERGENCY"]), line1: z.string().trim().min(2).max(180), line2: z.string().trim().max(180).optional().transform((value) => value || undefined), city: z.string().trim().min(2).max(100), state: z.string().trim().max(100).optional().transform((value) => value || undefined), postalCode: z.string().trim().max(30).optional().transform((value) => value || undefined), country: z.string().trim().min(2).max(100) });
export async function addEmployeeAddressAction(formData: FormData) {
  const auth = await requirePermission("employee.update");
  const input = addressInput.parse(Object.fromEntries(formData));
  await prisma.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: auth.user.organizationId } });
  await prisma.$transaction(async (tx) => {
    const address = await tx.hrEmployeeAddress.create({ data: { ...input, isPrimary: true } });
    await tx.hrEmployeeAddress.updateMany({ where: { employeeId: input.employeeId, type: input.type, id: { not: address.id } }, data: { isPrimary: false } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployeeAddress", entityId: address.id, action: "hr.employee.address.added", newValues: input });
  });
  revalidatePath(`/hr/admin/employees/${input.employeeId}`);
}

const emergencyInput = z.object({ employeeId: z.string().cuid(), fullName: z.string().trim().min(2).max(160), relationship: z.string().trim().min(2).max(80), phone: z.string().trim().min(5).max(40), email: z.string().trim().email().optional().or(z.literal("")).transform((value) => value || undefined) });
export async function addEmergencyContactAction(formData: FormData) {
  const auth = await requirePermission("employee.update");
  const input = emergencyInput.parse(Object.fromEntries(formData));
  await prisma.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: auth.user.organizationId } });
  await prisma.$transaction(async (tx) => {
    const contact = await tx.hrEmergencyContact.create({ data: { ...input, isPrimary: true } });
    await tx.hrEmergencyContact.updateMany({ where: { employeeId: input.employeeId, id: { not: contact.id } }, data: { isPrimary: false } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmergencyContact", entityId: contact.id, action: "hr.employee.emergency_contact.added", newValues: input });
  });
  revalidatePath(`/hr/admin/employees/${input.employeeId}`);
}

const identifierInput = z.object({ employeeId: z.string().cuid(), type: z.enum(["NATIONAL_ID", "PASSPORT", "TAX_ID", "PENSION_ID", "WORK_PERMIT", "OTHER"]), value: z.string().trim().min(3).max(180), issuingCountry: z.string().trim().max(100).optional().transform((value) => value || undefined), expiresAt: z.coerce.date().optional().or(z.literal("")).transform((value) => value === "" ? undefined : value) });
export async function saveEmployeeIdentifierAction(formData: FormData) {
  const auth = await requirePermission("document.read_sensitive");
  const input = identifierInput.parse(Object.fromEntries(formData));
  await prisma.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: auth.user.organizationId } });
  const encrypted = sealHrCredential(input.value);
  await prisma.$transaction(async (tx) => {
    const identifier = await tx.hrEmployeeIdentifier.upsert({ where: { employeeId_type: { employeeId: input.employeeId, type: input.type } }, update: { valueEncrypted: encrypted, valueLastFour: lastFour(input.value), issuingCountry: input.issuingCountry, expiresAt: input.expiresAt }, create: { employeeId: input.employeeId, type: input.type, valueEncrypted: encrypted, valueLastFour: lastFour(input.value), issuingCountry: input.issuingCountry, expiresAt: input.expiresAt } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployeeIdentifier", entityId: identifier.id, action: "hr.employee.identifier.updated", newValues: { employeeId: input.employeeId, type: input.type, value: input.value, issuingCountry: input.issuingCountry, expiresAt: input.expiresAt } });
  });
  revalidatePath(`/hr/admin/employees/${input.employeeId}`);
}

const taxInput = z.object({ employeeId: z.string().cuid(), taxCountry: z.string().trim().min(2).max(100), taxIdentifier: z.string().trim().max(180).optional().transform((value) => value || undefined), pensionProvider: z.string().trim().max(160).optional().transform((value) => value || undefined), pensionIdentifier: z.string().trim().max(180).optional().transform((value) => value || undefined) });
export async function saveEmployeeTaxProfileAction(formData: FormData) {
  const auth = await requirePermission("payroll.read_salary");
  const input = taxInput.parse(Object.fromEntries(formData));
  await prisma.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: auth.user.organizationId } });
  const data = { taxCountry: input.taxCountry, taxIdentifierEncrypted: input.taxIdentifier ? sealHrCredential(input.taxIdentifier) : null, taxIdentifierLastFour: input.taxIdentifier ? lastFour(input.taxIdentifier) : null, pensionProvider: input.pensionProvider, pensionIdentifierEncrypted: input.pensionIdentifier ? sealHrCredential(input.pensionIdentifier) : null };
  await prisma.$transaction(async (tx) => {
    const profile = await tx.hrEmployeeTaxProfile.upsert({ where: { employeeId: input.employeeId }, update: data, create: { employeeId: input.employeeId, ...data } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployeeTaxProfile", entityId: profile.id, action: "hr.employee.tax_profile.updated", newValues: input });
  });
  revalidatePath(`/hr/admin/employees/${input.employeeId}`);
}

const lifecycleInput = z.object({ employeeId: z.string().cuid(), reason: z.string().trim().min(3).max(500), effectiveDate: z.coerce.date() });
export async function terminateEmployeeAction(formData: FormData) {
  const auth = await requirePermission("employee.update");
  const input = lifecycleInput.parse(Object.fromEntries(formData));
  const employee = await prisma.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: auth.user.organizationId, employmentStatus: { notIn: ["TERMINATED", "ARCHIVED"] } } });
  await prisma.$transaction(async (tx) => {
    await tx.hrEmployee.update({ where: { id: employee.id }, data: { employmentStatus: "TERMINATED", terminationDate: input.effectiveDate, terminationReason: input.reason } });
    await tx.hrEmployeeStatusHistory.create({ data: { organizationId: auth.user.organizationId, employeeId: employee.id, previousStatus: employee.employmentStatus, newStatus: "TERMINATED", effectiveAt: input.effectiveDate, reason: input.reason, changedById: auth.user.id } });
    const employmentAssignments = await tx.hrEmployeeAssignment.findMany({ where: { employeeId: employee.id, status: "ACTIVE" } });
    for (const assignment of employmentAssignments) await tx.hrEmployeeAssignment.update({ where: { id: assignment.id }, data: assignment.effectiveFrom < input.effectiveDate ? { status: "ENDED", effectiveTo: input.effectiveDate, endedAt: new Date(), endedById: auth.user.id } : { status: "REVOKED", endedAt: new Date(), endedById: auth.user.id } });
    const supervisorAssignments = await tx.hrSupervisorAssignment.findMany({ where: { status: "ACTIVE", OR: [{ supervisorEmployeeId: employee.id }, { assignedEmployeeId: employee.id }] } });
    for (const assignment of supervisorAssignments) await tx.hrSupervisorAssignment.update({ where: { id: assignment.id }, data: assignment.effectiveFrom < input.effectiveDate ? { status: "ENDED", effectiveTo: input.effectiveDate, endedAt: new Date(), endedByUserId: auth.user.id, endReason: `Employment ended: ${input.reason}` } : { status: "REVOKED", endedAt: new Date(), endedByUserId: auth.user.id, endReason: `Future assignment revoked: ${input.reason}` } });
    await tx.hrSystemAccessAssignment.updateMany({ where: { employeeId: employee.id, status: { in: ["REQUESTED", "ACTIVE", "SUSPENDED"] } }, data: { status: "REVOKED", endedAt: input.effectiveDate, endedById: auth.user.id, endReason: `Employment ended: ${input.reason}` } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployee", entityId: employee.id, action: "hr.employee.terminated", previousValues: { employmentStatus: employee.employmentStatus }, newValues: { employmentStatus: "TERMINATED", terminationDate: input.effectiveDate }, reason: input.reason });
  });
  revalidatePath(`/hr/admin/employees/${employee.id}`);
  revalidatePath("/hr/admin/employees");
}

export async function archiveEmployeeAction(formData: FormData) {
  const auth = await requirePermission("employee.update");
  const employeeId = z.string().cuid().parse(formData.get("employeeId"));
  const reason = z.string().trim().min(3).max(500).parse(formData.get("reason"));
  const employee = await prisma.hrEmployee.findFirstOrThrow({ where: { id: employeeId, organizationId: auth.user.organizationId, employmentStatus: "TERMINATED" } });
  await prisma.$transaction(async (tx) => {
    await tx.hrEmployee.update({ where: { id: employee.id }, data: { employmentStatus: "ARCHIVED", archivedAt: new Date() } });
    await tx.hrEmployeeStatusHistory.create({ data: { organizationId: auth.user.organizationId, employeeId: employee.id, previousStatus: employee.employmentStatus, newStatus: "ARCHIVED", effectiveAt: new Date(), reason, changedById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployee", entityId: employee.id, action: "hr.employee.archived", previousValues: { employmentStatus: employee.employmentStatus }, newValues: { employmentStatus: "ARCHIVED" }, reason });
  });
  revalidatePath(`/hr/admin/employees/${employee.id}`);
  revalidatePath("/hr/admin/employees");
}

const systemAccessInput = z.object({
  employeeId: z.string().cuid(),
  systemKey: z.string().trim().min(2).max(80).regex(/^[a-z0-9._-]+$/i).transform((value) => value.toLowerCase()),
  displayName: z.string().trim().min(2).max(120),
  accountRef: z.string().trim().max(180).optional().transform((value) => value || undefined),
  status: z.enum(["REQUESTED", "ACTIVE"]),
  expectedEndAt: z.coerce.date().optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  reason: z.string().trim().min(3).max(500),
});

export async function createSystemAccessAssignmentAction(formData: FormData) {
  const auth = await requirePermission("assignment.create");
  const input = systemAccessInput.parse(Object.fromEntries(formData));
  await prisma.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: auth.user.organizationId, employmentStatus: { notIn: ["TERMINATED", "ARCHIVED"] } } });
  const duplicate = await prisma.hrSystemAccessAssignment.findFirst({ where: { employeeId: input.employeeId, systemKey: input.systemKey, status: { in: ["REQUESTED", "ACTIVE", "SUSPENDED"] } } });
  if (duplicate) throw new Error("This employee already has an open assignment for that system.");
  await prisma.$transaction(async (tx) => {
    const assignment = await tx.hrSystemAccessAssignment.create({ data: { ...input, organizationId: auth.user.organizationId, assignedAt: input.status === "ACTIVE" ? new Date() : null, createdById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrSystemAccessAssignment", entityId: assignment.id, action: "hr.system_access.assigned", newValues: input, reason: input.reason });
  });
  revalidatePath(`/hr/admin/employees/${input.employeeId}`);
}

export async function revokeSystemAccessAssignmentAction(formData: FormData) {
  const auth = await requirePermission("assignment.end");
  const id = z.string().cuid().parse(formData.get("id"));
  const reason = z.string().trim().min(3).max(500).parse(formData.get("reason"));
  const assignment = await prisma.hrSystemAccessAssignment.findFirstOrThrow({ where: { id, organizationId: auth.user.organizationId, status: { in: ["REQUESTED", "ACTIVE", "SUSPENDED"] } } });
  await prisma.$transaction(async (tx) => {
    await tx.hrSystemAccessAssignment.update({ where: { id }, data: { status: "REVOKED", endedAt: new Date(), endedById: auth.user.id, endReason: reason } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrSystemAccessAssignment", entityId: id, action: "hr.system_access.revoked", previousValues: { status: assignment.status }, newValues: { status: "REVOKED" }, reason });
  });
  revalidatePath(`/hr/admin/employees/${assignment.employeeId}`);
}
