"use server";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { createPayslipPdf } from "@/lib/hr/payroll/payslip";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { hrObjectStorage } from "@/lib/hr/storage";

export async function generatePayslipAction(formData: FormData) {
  const auth = await requirePermission("payroll.approve");
  const itemId = z.string().cuid().parse(formData.get("itemId"));
  const item = await prisma.hrPayrollItem.findFirstOrThrow({
    where: { id: itemId, organizationId: auth.user.organizationId, run: { status: { in: ["LOCKED", "PAID"] } } },
    include: { payslip: true, components: true, employee: { include: { user: true } }, run: { include: { period: true } }, organization: true },
  });
  if (item.payslip) return;
  const bytes = await createPayslipPdf({
    organizationName: item.organization.name, periodName: item.run.period.name, payDate: item.run.period.payDate,
    employeeNumber: item.employeeNumber, employeeName: item.employeeName, currency: item.currency,
    baseSalary: item.baseSalary.toFixed(2), grossEarnings: item.grossEarnings.toFixed(2), totalDeductions: item.totalDeductions.toFixed(2),
    employerBenefits: item.employerBenefits.toFixed(2), netPay: item.netPay.toFixed(2),
    components: item.components.map((component) => ({ name: component.name, type: component.type, amount: component.amount.toFixed(2) })),
  });
  const checksum = crypto.createHash("sha256").update(bytes).digest("hex");
  const storageKey = `payroll/${auth.user.organizationId}/${item.runId}/${item.id}-v1-${crypto.randomUUID()}.pdf`;
  const fileName = `payslip-${item.employeeNumber}-${item.run.period.name.replace(/[^a-zA-Z0-9_-]+/g, "-")}.pdf`;
  const storage = hrObjectStorage();
  await storage.put(storageKey, bytes, "application/pdf");
  try {
    await prisma.$transaction(async (tx) => {
      const payslip = await tx.hrPayslip.create({ data: { payrollItemId: item.id, storageKey, fileName, sizeBytes: bytes.length, checksum } });
      if (item.employee.user) await enqueueHrEmail(tx, { organizationId: auth.user.organizationId, recipient: item.employee.user.email, template: "hr-payslip-ready", subject: "Your payslip is ready", payload: { payrollItemId: item.id }, idempotencyKey: `hr-payslip-ready:${item.id}` });
      await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrPayslip", entityId: payslip.id, action: "hr.payroll.payslip.generated", newValues: { payrollItemId: item.id, version: 1, checksum } });
    });
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
  revalidatePath("/hr/admin/payroll");
  revalidatePath("/hr/employee/payslips");
}
