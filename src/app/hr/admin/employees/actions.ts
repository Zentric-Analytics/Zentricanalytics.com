"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { sealHrCredential } from "@/lib/hr/auth/crypto";
import { employeeInput, lastFour } from "@/lib/hr/core/invariants";
import { requirePermission } from "@/lib/hr/permissions/authorize";

export async function createEmployeeAction(formData: FormData) {
  const auth = await requirePermission("employee.create");
  const input = employeeInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => {
    const employee = await tx.hrEmployee.create({ data: { ...input, organizationId: auth.user.organizationId } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployee", entityId: employee.id, action: "hr.employee.created", newValues: input });
  });
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
