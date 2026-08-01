"use server";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { assertIndependentPayrollActor, assertPayrollTransition, calculatePayrollSnapshot } from "@/lib/hr/payroll/engine";
import { requirePermission } from "@/lib/hr/permissions/authorize";

const runIdInput = z.string().cuid();
const reasonInput = z.string().trim().min(3).max(500);

async function notifyPermissionHolders(tx: Prisma.TransactionClient, input: { organizationId: string; permission: string; runId: string; template: string; subject: string }) {
  const recipients = await tx.hrUser.findMany({ where: { organizationId: input.organizationId, status: "ACTIVE", roles: { some: { revokedAt: null, role: { permissions: { some: { permission: { key: input.permission } } } } } } }, select: { id: true, email: true } });
  for (const recipient of recipients) await enqueueHrEmail(tx, { organizationId: input.organizationId, recipient: recipient.email, template: input.template, subject: input.subject, payload: { payrollRunId: input.runId }, idempotencyKey: `${input.template}:${input.runId}:${recipient.id}` });
}

export async function createPayrollRunAction(formData: FormData) {
  const auth = await requirePermission("payroll.create");
  const periodId = z.string().cuid().parse(formData.get("periodId"));
  const period = await prisma.hrPayrollPeriod.findFirstOrThrow({ where: { id: periodId, organizationId: auth.user.organizationId } });
  await prisma.$transaction(async (tx) => {
    const latest = await tx.hrPayrollRun.findFirst({ where: { periodId }, orderBy: { version: "desc" } });
    if (latest && latest.status !== "CANCELLED") throw new Error("This payroll period already has an active run.");
    const version = (latest?.version ?? 0) + 1;
    const run = await tx.hrPayrollRun.create({ data: { organizationId: auth.user.organizationId, periodId, version, calculationKey: `payroll:${periodId}:v${version}`, createdById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrPayrollRun", entityId: run.id, action: "hr.payroll.run.created", newValues: { periodId, version, currency: period.currency } });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/payroll");
}

const adjustmentInput = z.object({
  runId: z.string().cuid(),
  employeeId: z.string().cuid(),
  componentType: z.enum(["EARNING", "DEDUCTION", "TAX", "BENEFIT"]),
  name: z.string().trim().min(2).max(120),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  reason: reasonInput,
});
export async function addPayrollAdjustmentAction(formData: FormData) {
  const auth = await requirePermission("payroll.calculate");
  const input = adjustmentInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => {
    const run = await tx.hrPayrollRun.findFirstOrThrow({ where: { id: input.runId, organizationId: auth.user.organizationId, status: "DRAFT" } });
    await tx.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: auth.user.organizationId } });
    const adjustment = await tx.hrPayrollAdjustment.create({ data: { ...input, createdById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrPayrollAdjustment", entityId: adjustment.id, action: "hr.payroll.adjustment.created", newValues: { runId: run.id, employeeId: input.employeeId, type: input.componentType, adjustmentAmount: input.amount }, reason: input.reason });
  });
  revalidatePath("/hr/admin/payroll");
}

export async function calculatePayrollRunAction(formData: FormData) {
  const auth = await requirePermission("payroll.calculate");
  const runId = runIdInput.parse(formData.get("runId"));
  await prisma.$transaction(async (tx) => {
    const run = await tx.hrPayrollRun.findFirstOrThrow({ where: { id: runId, organizationId: auth.user.organizationId }, include: { period: true, adjustments: true, items: { select: { id: true } } } });
    if (run.status !== "DRAFT" || run.items.length) throw new Error("Only an empty draft payroll run can be calculated.");
    const employees = await tx.hrEmployee.findMany({
      where: { organizationId: auth.user.organizationId, employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] }, hireDate: { lte: run.period.endsAt }, OR: [{ terminationDate: null }, { terminationDate: { gte: run.period.startsAt } }] },
      orderBy: { employeeNumber: "asc" },
    });
    if (!employees.length) throw new Error("No eligible employees were found for this payroll period.");
    for (const employee of employees) {
      const salary = await tx.hrSalaryRecord.findFirst({
        where: { employeeId: employee.id, approvedAt: { not: null }, effectiveFrom: { lte: run.period.endsAt }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: run.period.endsAt } }] },
        orderBy: { effectiveFrom: "desc" },
      });
      if (!salary) throw new Error(`Employee ${employee.employeeNumber} has no approved salary for this payroll period.`);
      if (salary.currency !== run.period.currency) throw new Error(`Employee ${employee.employeeNumber} salary currency does not match the payroll period.`);
      if (salary.payFrequency !== run.period.payFrequency) throw new Error(`Employee ${employee.employeeNumber} salary frequency does not match the payroll period.`);
      const assignments = await tx.hrEmployeePayrollComponent.findMany({
        where: { employeeId: employee.id, status: "ACTIVE", effectiveFrom: { lte: run.period.endsAt }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: run.period.endsAt } }], component: { status: "ACTIVE" } },
        include: { component: true },
      });
      const adjustmentLines = run.adjustments.filter(({ employeeId }) => employeeId === employee.id).map((adjustment) => ({ code: `ADJ-${adjustment.id}`, name: adjustment.name, type: adjustment.componentType, calculationType: "FIXED" as const, amount: adjustment.amount }));
      const sources = [
        ...assignments.map(({ component, amount }) => ({ componentId: component.id, code: component.code, name: component.name, type: component.type, calculationType: component.calculationType, amount, taxable: component.taxable, pensionable: component.pensionable })),
        ...adjustmentLines,
      ];
      const result = calculatePayrollSnapshot(salary.amount, sources);
      const item = await tx.hrPayrollItem.create({
        data: {
          organizationId: auth.user.organizationId, runId: run.id, employeeId: employee.id, salaryRecordId: salary.id,
          employeeNumber: employee.employeeNumber, employeeName: `${employee.legalFirstName} ${employee.lastName}`, currency: salary.currency,
          baseSalary: result.baseSalary, grossEarnings: result.grossEarnings, totalDeductions: result.totalDeductions,
          employerBenefits: result.employerBenefits, netPay: result.netPay,
          snapshot: { salaryRecordId: salary.id, salaryEffectiveFrom: salary.effectiveFrom.toISOString(), payFrequency: salary.payFrequency, componentSources: sources.map((source) => ({ code: source.code, type: source.type, calculationType: source.calculationType, sourceAmount: source.amount.toString(), taxable: "taxable" in source ? source.taxable : false, pensionable: "pensionable" in source ? source.pensionable : false })) },
        },
      });
      if (result.lines.length) await tx.hrPayrollItemComponent.createMany({ data: result.lines.map((line) => ({ payrollItemId: item.id, componentId: line.componentId, code: line.code, name: line.name, type: line.type, amount: line.amount, sourceAmount: line.sourceAmount })) });
    }
    assertPayrollTransition(run.status, "CALCULATED");
    await tx.hrPayrollRun.update({ where: { id: run.id }, data: { status: "CALCULATED", calculatedAt: new Date() } });
    await tx.hrPayrollApproval.create({ data: { runId: run.id, actorUserId: auth.user.id, actorRole: auth.roles[0] ?? "UNKNOWN", fromStatus: run.status, toStatus: "CALCULATED", comment: "Payroll snapshot calculated", correlationId: crypto.randomUUID() } });
    await notifyPermissionHolders(tx, { organizationId: auth.user.organizationId, permission: "payroll.review", runId: run.id, template: "hr-payroll-review-ready", subject: "Payroll run awaiting review" });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrPayrollRun", entityId: run.id, action: "hr.payroll.run.calculated", newValues: { status: "CALCULATED", employeeCount: employees.length } });
  }, { isolationLevel: "Serializable", timeout: 30_000 });
  revalidatePath("/hr/admin/payroll");
}

const transitionInput = z.object({ runId: z.string().cuid(), comment: reasonInput });
async function transitionRun(formData: FormData, permission: "payroll.review" | "payroll.approve", from: "CALCULATED" | "REVIEWED" | "APPROVED", to: "REVIEWED" | "APPROVED" | "LOCKED") {
  const auth = await requirePermission(permission);
  const input = transitionInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => {
    const run = await tx.hrPayrollRun.findFirstOrThrow({ where: { id: input.runId, organizationId: auth.user.organizationId, status: from } });
    const reviewedBy = from === "REVIEWED" || from === "APPROVED"
      ? await tx.hrPayrollApproval.findFirst({ where: { runId: run.id, toStatus: "REVIEWED" }, orderBy: { createdAt: "desc" }, select: { actorUserId: true } })
      : null;
    if (to === "REVIEWED") assertIndependentPayrollActor(auth.user.id, [run.createdById], "Payroll review");
    if (to === "APPROVED") assertIndependentPayrollActor(auth.user.id, [run.createdById, reviewedBy?.actorUserId], "Payroll approval");
    assertPayrollTransition(run.status, to);
    const now = new Date();
    const timestamp = to === "REVIEWED" ? { reviewedAt: now } : to === "APPROVED" ? { approvedAt: now } : { lockedAt: now };
    await tx.hrPayrollRun.update({ where: { id: run.id }, data: { status: to, ...timestamp } });
    await tx.hrPayrollApproval.create({ data: { runId: run.id, actorUserId: auth.user.id, actorRole: auth.roles[0] ?? "UNKNOWN", fromStatus: run.status, toStatus: to, comment: input.comment, correlationId: crypto.randomUUID() } });
    if (to === "REVIEWED") await notifyPermissionHolders(tx, { organizationId: auth.user.organizationId, permission: "payroll.approve", runId: run.id, template: "hr-payroll-approval-ready", subject: "Payroll run awaiting approval" });
    if (to === "APPROVED") {
      const creator = await tx.hrUser.findUnique({ where: { id: run.createdById }, select: { id: true, email: true } });
      if (creator) await enqueueHrEmail(tx, { organizationId: auth.user.organizationId, recipient: creator.email, template: "hr-payroll-approved", subject: "Payroll run approved", payload: { payrollRunId: run.id }, idempotencyKey: `hr-payroll-approved:${run.id}:${creator.id}` });
    }
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrPayrollRun", entityId: run.id, action: `hr.payroll.run.${to.toLowerCase()}`, previousValues: { status: run.status }, newValues: { status: to }, reason: input.comment });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/payroll");
}

export async function reviewPayrollRunAction(formData: FormData) { return transitionRun(formData, "payroll.review", "CALCULATED", "REVIEWED"); }
export async function approvePayrollRunAction(formData: FormData) { return transitionRun(formData, "payroll.approve", "REVIEWED", "APPROVED"); }
export async function lockPayrollRunAction(formData: FormData) { return transitionRun(formData, "payroll.approve", "APPROVED", "LOCKED"); }

export async function cancelPayrollRunAction(formData: FormData) {
  const auth = await requirePermission("payroll.approve");
  const input = transitionInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => {
    const run = await tx.hrPayrollRun.findFirstOrThrow({ where: { id: input.runId, organizationId: auth.user.organizationId, status: { in: ["DRAFT", "CALCULATED", "REVIEWED"] } } });
    assertPayrollTransition(run.status, "CANCELLED");
    await tx.hrPayrollRun.update({ where: { id: run.id }, data: { status: "CANCELLED" } });
    await tx.hrPayrollApproval.create({ data: { runId: run.id, actorUserId: auth.user.id, actorRole: auth.roles[0] ?? "UNKNOWN", fromStatus: run.status, toStatus: "CANCELLED", comment: input.comment, correlationId: crypto.randomUUID() } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrPayrollRun", entityId: run.id, action: "hr.payroll.run.cancelled", previousValues: { status: run.status }, newValues: { status: "CANCELLED" }, reason: input.comment });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/payroll");
}

const paymentInput = z.object({ itemId: z.string().cuid(), paymentReference: z.string().trim().min(3).max(120) });
export async function markPayrollItemPaidAction(formData: FormData) {
  const auth = await requirePermission("payroll.mark_paid");
  const input = paymentInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => {
    const item = await tx.hrPayrollItem.findFirstOrThrow({ where: { id: input.itemId, organizationId: auth.user.organizationId, paymentStatus: { not: "PAID" }, run: { status: "LOCKED" } }, include: { run: true } });
    await tx.hrPayrollItem.update({ where: { id: item.id }, data: { paymentStatus: "PAID", paymentReference: input.paymentReference, paymentMarkedAt: new Date(), paymentMarkedById: auth.user.id } });
    const outstanding = await tx.hrPayrollItem.count({ where: { runId: item.runId, id: { not: item.id }, paymentStatus: { not: "PAID" } } });
    if (!outstanding) {
      assertPayrollTransition(item.run.status, "PAID");
      await tx.hrPayrollRun.update({ where: { id: item.runId }, data: { status: "PAID", paidAt: new Date() } });
    }
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrPayrollItem", entityId: item.id, action: "hr.payroll.payment.marked_paid", previousValues: { paymentStatus: item.paymentStatus }, newValues: { paymentStatus: "PAID" }, reason: "Payment confirmation recorded" });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/payroll");
}
