"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { payrollComponentInput, payrollPeriodInput, salaryInput } from "@/lib/hr/payroll/engine";
import { requirePermission } from "@/lib/hr/permissions/authorize";

export async function createSalaryRecordAction(formData: FormData) {
  const auth = await requirePermission("payroll.read_salary");
  const input = salaryInput.parse(Object.fromEntries(formData));
  const employee = await prisma.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: auth.user.organizationId, employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] } } });
  const latest = await prisma.hrSalaryRecord.findFirst({ where: { employeeId: employee.id }, orderBy: { effectiveFrom: "desc" } });
  if (latest && latest.effectiveFrom >= input.effectiveFrom) throw new Error("A salary change must start after the latest salary record.");
  await prisma.$transaction(async (tx) => {
    const record = await tx.hrSalaryRecord.create({ data: { ...input, organizationId: auth.user.organizationId, createdById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrSalaryRecord", entityId: record.id, action: "hr.payroll.salary_change.created", newValues: { employeeId: employee.id, effectiveFrom: input.effectiveFrom, currency: input.currency, salaryAmount: input.amount }, reason: input.reason });
  });
  revalidatePath("/hr/admin/payroll/setup");
}

export async function approveSalaryRecordAction(formData: FormData) {
  const auth = await requirePermission("payroll.approve");
  const id = z.string().cuid().parse(formData.get("id"));
  const reason = z.string().trim().min(3).max(500).parse(formData.get("reason"));
  await prisma.$transaction(async (tx) => {
    const record = await tx.hrSalaryRecord.findFirstOrThrow({ where: { id, organizationId: auth.user.organizationId, approvedAt: null } });
    if (await tx.hrSalaryRecord.findFirst({ where: { employeeId: record.employeeId, approvedAt: { not: null }, effectiveFrom: { gte: record.effectiveFrom } }, select: { id: true } })) throw new Error("Approve salary changes in effective-date order.");
    const current = await tx.hrSalaryRecord.findFirst({ where: { employeeId: record.employeeId, approvedAt: { not: null }, effectiveFrom: { lt: record.effectiveFrom }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: record.effectiveFrom } }] }, orderBy: { effectiveFrom: "desc" } });
    if (current) await tx.hrSalaryRecord.update({ where: { id: current.id }, data: { effectiveTo: record.effectiveFrom } });
    await tx.hrSalaryRecord.update({ where: { id: record.id }, data: { approvedById: auth.user.id, approvedAt: new Date() } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrSalaryRecord", entityId: record.id, action: "hr.payroll.salary_change.approved", previousValues: { approved: false }, newValues: { approved: true, effectiveFrom: record.effectiveFrom }, reason });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/payroll/setup");
}

export async function createPayrollComponentAction(formData: FormData) {
  const auth = await requirePermission("payroll.create");
  const input = payrollComponentInput.parse({ ...Object.fromEntries(formData), taxable: formData.has("taxable"), pensionable: formData.has("pensionable") });
  await prisma.$transaction(async (tx) => {
    const component = await tx.hrPayrollComponent.create({ data: { ...input, organizationId: auth.user.organizationId } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrPayrollComponent", entityId: component.id, action: "hr.payroll.component.created", newValues: input });
  });
  revalidatePath("/hr/admin/payroll/setup");
}

const assignmentInput = z.object({
  employeeId: z.string().cuid(),
  componentId: z.string().cuid(),
  amount: z.string().regex(/^\d+(\.\d{1,4})?$/),
  effectiveFrom: z.coerce.date(),
  reason: z.string().trim().min(3).max(500),
});
export async function assignPayrollComponentAction(formData: FormData) {
  const auth = await requirePermission("payroll.create");
  const input = assignmentInput.parse(Object.fromEntries(formData));
  const [employee, component] = await Promise.all([
    prisma.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: auth.user.organizationId, employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] } } }),
    prisma.hrPayrollComponent.findFirstOrThrow({ where: { id: input.componentId, organizationId: auth.user.organizationId, status: "ACTIVE" } }),
  ]);
  if (component.calculationType !== "FIXED" && new Prisma.Decimal(input.amount).greaterThan(100)) throw new Error("Percentage payroll components cannot exceed 100.");
  await prisma.$transaction(async (tx) => {
    const existing = await tx.hrEmployeePayrollComponent.findFirst({ where: { employeeId: employee.id, componentId: component.id, status: "ACTIVE" }, orderBy: { effectiveFrom: "desc" } });
    if (existing && existing.effectiveFrom >= input.effectiveFrom) throw new Error("Component assignment must start after its current assignment.");
    if (existing) await tx.hrEmployeePayrollComponent.update({ where: { id: existing.id }, data: { status: "ENDED", effectiveTo: input.effectiveFrom } });
    const assignment = await tx.hrEmployeePayrollComponent.create({ data: { ...input, createdById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployeePayrollComponent", entityId: assignment.id, action: "hr.payroll.component.assigned", newValues: { employeeId: employee.id, componentId: component.id, effectiveFrom: input.effectiveFrom, componentAmount: input.amount }, reason: input.reason });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/payroll/setup");
}

export async function createPayrollPeriodAction(formData: FormData) {
  const auth = await requirePermission("payroll.create");
  const input = payrollPeriodInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => {
    const period = await tx.hrPayrollPeriod.create({ data: { ...input, organizationId: auth.user.organizationId } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrPayrollPeriod", entityId: period.id, action: "hr.payroll.period.created", newValues: input });
  });
  revalidatePath("/hr/admin/payroll/setup");
}
