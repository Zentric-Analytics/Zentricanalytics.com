"use server";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { availableLeaveBalance, capAccrual, leavePolicyInput, leaveTypeInput, scheduledAccrualAmount } from "@/lib/hr/leave/engine";
import { requirePermission } from "@/lib/hr/permissions/authorize";

export async function createLeaveTypeAction(formData: FormData) {
  const auth = await requirePermission("leave.policy.manage");
  const input = leaveTypeInput.parse({ ...Object.fromEntries(formData), paid: formData.has("paid"), requiresAttachment: formData.has("requiresAttachment") });
  await prisma.$transaction(async (tx) => {
    const leaveType = await tx.hrLeaveType.create({ data: { ...input, organizationId: auth.user.organizationId } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLeaveType", entityId: leaveType.id, action: "hr.leave.type.created", newValues: input });
  });
  revalidatePath("/hr/admin/leave");
}

export async function createLeavePolicyAction(formData: FormData) {
  const auth = await requirePermission("leave.policy.manage");
  const input = leavePolicyInput.parse({ ...Object.fromEntries(formData), allowNegativeBalance: formData.has("allowNegativeBalance"), requiresApproval: formData.has("requiresApproval") });
  const leaveType = await prisma.hrLeaveType.findFirstOrThrow({ where: { id: input.leaveTypeId, organizationId: auth.user.organizationId, status: "ACTIVE" } });
  const latest = await prisma.hrLeavePolicy.findFirst({ where: { organizationId: auth.user.organizationId, leaveTypeId: leaveType.id }, orderBy: { version: "desc" } });
  if (latest && latest.effectiveFrom >= input.effectiveFrom) throw new Error("A new policy version must start after the latest version.");
  await prisma.$transaction(async (tx) => {
    if (latest?.status === "ACTIVE") await tx.hrLeavePolicy.update({ where: { id: latest.id }, data: { effectiveTo: input.effectiveFrom } });
    const policy = await tx.hrLeavePolicy.create({ data: { ...input, organizationId: auth.user.organizationId, version: (latest?.version ?? 0) + 1 } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLeavePolicy", entityId: policy.id, action: "hr.leave.policy.version.created", previousValues: latest ? { policyId: latest.id, version: latest.version } : undefined, newValues: { ...input, version: policy.version } });
  });
  revalidatePath("/hr/admin/leave");
}

const assignmentInput = z.object({ employeeId: z.string().cuid(), leavePolicyId: z.string().cuid(), effectiveFrom: z.coerce.date(), reason: z.string().trim().min(3).max(500) });
export async function assignLeavePolicyAction(formData: FormData) {
  const auth = await requirePermission("leave.policy.manage");
  const input = assignmentInput.parse(Object.fromEntries(formData));
  const [employee, policy] = await Promise.all([
    prisma.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: auth.user.organizationId, employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] } } }),
    prisma.hrLeavePolicy.findFirstOrThrow({ where: { id: input.leavePolicyId, organizationId: auth.user.organizationId, status: "ACTIVE" }, include: { leaveType: true } }),
  ]);
  if (input.effectiveFrom < policy.effectiveFrom || (policy.effectiveTo && input.effectiveFrom >= policy.effectiveTo)) {
    throw new Error("Policy assignment must begin within the policy's effective dates.");
  }
  const existing = await prisma.hrEmployeeLeavePolicy.findFirst({ where: { employeeId: employee.id, status: "ACTIVE", leavePolicy: { leaveTypeId: policy.leaveTypeId } }, orderBy: { effectiveFrom: "desc" } });
  if (existing && existing.effectiveFrom >= input.effectiveFrom) throw new Error("Policy assignment must begin after the existing assignment.");
  const periodYear = input.effectiveFrom.getUTCFullYear();
  const opening = policy.accrualFrequency === "ANNUALLY" ? policy.entitlement : 0;
  await prisma.$transaction(async (tx) => {
    if (existing) await tx.hrEmployeeLeavePolicy.update({ where: { id: existing.id }, data: { status: "ENDED", effectiveTo: input.effectiveFrom, endedById: auth.user.id } });
    const assignment = await tx.hrEmployeeLeavePolicy.create({ data: { ...input, assignedById: auth.user.id } });
    const balance = await tx.hrLeaveBalance.upsert({ where: { employeeId_leaveTypeId_periodYear: { employeeId: employee.id, leaveTypeId: policy.leaveTypeId, periodYear } }, update: { leavePolicyId: policy.id }, create: { organizationId: auth.user.organizationId, employeeId: employee.id, leaveTypeId: policy.leaveTypeId, leavePolicyId: policy.id, periodYear, opening } });
    const openingKey = `leave-opening:${balance.id}:${periodYear}`;
    if (Number(opening) > 0 && !await tx.hrLeaveLedger.findUnique({ where: { idempotencyKey: openingKey } })) await tx.hrLeaveLedger.create({ data: { balanceId: balance.id, type: "OPENING", amount: opening, effectiveAt: input.effectiveFrom, reason: `Opening entitlement for ${periodYear}`, actorUserId: auth.user.id, idempotencyKey: openingKey } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployeeLeavePolicy", entityId: assignment.id, action: "hr.leave.policy.assigned", newValues: input, reason: input.reason });
  });
  revalidatePath("/hr/admin/leave");
  revalidatePath("/hr/employee/leave");
}

const adjustmentInput = z.object({ balanceId: z.string().cuid(), amount: z.coerce.number().min(-10000).max(10000).refine((value) => value !== 0), reason: z.string().trim().min(3).max(500) });
export async function adjustLeaveBalanceAction(formData: FormData) {
  const auth = await requirePermission("leave.override");
  const input = adjustmentInput.parse(Object.fromEntries(formData));
  const balance = await prisma.hrLeaveBalance.findFirstOrThrow({ where: { id: input.balanceId, organizationId: auth.user.organizationId } });
  await prisma.$transaction(async (tx) => {
    await tx.hrLeaveBalance.update({ where: { id: balance.id }, data: { adjusted: { increment: input.amount } } });
    await tx.hrLeaveLedger.create({ data: { balanceId: balance.id, type: "ADJUSTMENT", amount: input.amount, effectiveAt: new Date(), reason: input.reason, actorUserId: auth.user.id, idempotencyKey: `leave-adjustment:${crypto.randomUUID()}` } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLeaveBalance", entityId: balance.id, action: "hr.leave.balance.adjusted", previousValues: { adjusted: balance.adjusted.toString() }, newValues: { adjustment: input.amount }, reason: input.reason });
  });
  revalidatePath("/hr/admin/leave");
}

const holidayInput = z.object({ name: z.string().trim().min(2).max(120), date: z.coerce.date(), country: z.string().trim().max(100).optional().transform((value) => value || undefined), region: z.string().trim().max(100).optional().transform((value) => value || undefined) });
export async function createPublicHolidayAction(formData: FormData) {
  const auth = await requirePermission("settings.manage");
  const input = holidayInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => {
    const holiday = await tx.hrPublicHoliday.create({ data: { ...input, organizationId: auth.user.organizationId } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrPublicHoliday", entityId: holiday.id, action: "hr.leave.holiday.created", newValues: input });
  });
  revalidatePath("/hr/admin/leave");
}

export async function runLeaveAccrualAction(formData: FormData) {
  const auth = await requirePermission("leave.override");
  const effectiveAt = z.coerce.date().parse(formData.get("effectiveAt"));
  const assignments = await prisma.hrEmployeeLeavePolicy.findMany({ where: { status: "ACTIVE", effectiveFrom: { lte: effectiveAt }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveAt } }], employee: { organizationId: auth.user.organizationId, employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] } }, leavePolicy: { status: "ACTIVE", accrualFrequency: { in: ["MONTHLY", "QUARTERLY"] } } }, include: { employee: true, leavePolicy: true } });
  for (const assignment of assignments) {
    const policy = assignment.leavePolicy;
    const quarter = Math.floor(effectiveAt.getUTCMonth() / 3) + 1;
    const periodKey = policy.accrualFrequency === "MONTHLY" ? `${effectiveAt.getUTCFullYear()}-${String(effectiveAt.getUTCMonth() + 1).padStart(2, "0")}` : `${effectiveAt.getUTCFullYear()}-Q${quarter}`;
    await prisma.$transaction(async (tx) => {
      const balance = await tx.hrLeaveBalance.upsert({ where: { employeeId_leaveTypeId_periodYear: { employeeId: assignment.employeeId, leaveTypeId: policy.leaveTypeId, periodYear: effectiveAt.getUTCFullYear() } }, update: { leavePolicyId: policy.id }, create: { organizationId: auth.user.organizationId, employeeId: assignment.employeeId, leaveTypeId: policy.leaveTypeId, leavePolicyId: policy.id, periodYear: effectiveAt.getUTCFullYear() } });
      const idempotencyKey = `leave-accrual:${balance.id}:${periodKey}`;
      if (await tx.hrLeaveLedger.findUnique({ where: { idempotencyKey } })) return;
      const available = availableLeaveBalance({ opening: Number(balance.opening), accrued: Number(balance.accrued), carriedOver: Number(balance.carriedOver), adjusted: Number(balance.adjusted), reserved: Number(balance.reserved), used: Number(balance.used), expired: Number(balance.expired) });
      const amount = Math.round(capAccrual(scheduledAccrualAmount({ entitlement: Number(policy.entitlement), accrualFrequency: policy.accrualFrequency, accrualAmount: policy.accrualAmount ? Number(policy.accrualAmount) : null }), available, policy.maximumBalance ? Number(policy.maximumBalance) : null) * 100) / 100;
      if (amount <= 0) return;
      await tx.hrLeaveBalance.update({ where: { id: balance.id }, data: { accrued: { increment: amount } } });
      await tx.hrLeaveLedger.create({ data: { balanceId: balance.id, type: "ACCRUAL", amount, effectiveAt, reason: `${policy.accrualFrequency.toLowerCase()} policy accrual`, actorUserId: auth.user.id, idempotencyKey } });
      await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLeaveBalance", entityId: balance.id, action: "hr.leave.balance.accrued", newValues: { amount, periodKey, policyId: policy.id } });
    }, { isolationLevel: "Serializable" });
  }
  revalidatePath("/hr/admin/leave");
  revalidatePath("/hr/employee/leave");
}

export async function runLeaveCarryOverAction(formData: FormData) {
  const auth = await requirePermission("leave.override");
  const effectiveAt = z.coerce.date().parse(formData.get("effectiveAt"));
  const targetYear = effectiveAt.getUTCFullYear();
  const priorBalances = await prisma.hrLeaveBalance.findMany({ where: { organizationId: auth.user.organizationId, periodYear: targetYear - 1 }, include: { leavePolicy: true } });
  for (const prior of priorBalances) {
    const available = availableLeaveBalance({ opening: Number(prior.opening), accrued: Number(prior.accrued), carriedOver: Number(prior.carriedOver), adjusted: Number(prior.adjusted), reserved: Number(prior.reserved), used: Number(prior.used), expired: Number(prior.expired) });
    const amount = Math.max(0, Math.min(available, prior.leavePolicy.carryOverLimit ? Number(prior.leavePolicy.carryOverLimit) : 0));
    if (!amount) continue;
    await prisma.$transaction(async (tx) => {
      const opening = prior.leavePolicy.accrualFrequency === "ANNUALLY" ? prior.leavePolicy.entitlement : 0;
      const target = await tx.hrLeaveBalance.upsert({ where: { employeeId_leaveTypeId_periodYear: { employeeId: prior.employeeId, leaveTypeId: prior.leaveTypeId, periodYear: targetYear } }, update: { leavePolicyId: prior.leavePolicyId }, create: { organizationId: auth.user.organizationId, employeeId: prior.employeeId, leaveTypeId: prior.leaveTypeId, leavePolicyId: prior.leavePolicyId, periodYear: targetYear, opening } });
      const openingKey = `leave-opening:${target.id}:${targetYear}`;
      if (Number(opening) > 0 && !await tx.hrLeaveLedger.findUnique({ where: { idempotencyKey: openingKey } })) {
        await tx.hrLeaveLedger.create({ data: { balanceId: target.id, type: "OPENING", amount: opening, effectiveAt: new Date(Date.UTC(targetYear, 0, 1)), reason: `Opening entitlement for ${targetYear}`, actorUserId: auth.user.id, idempotencyKey: openingKey } });
      }
      const idempotencyKey = `leave-carry-over:${prior.id}:${targetYear}`;
      if (await tx.hrLeaveLedger.findUnique({ where: { idempotencyKey } })) return;
      await tx.hrLeaveBalance.update({ where: { id: target.id }, data: { carriedOver: { increment: amount } } });
      await tx.hrLeaveLedger.create({ data: { balanceId: target.id, type: "CARRY_OVER", amount, effectiveAt, reason: `Carry-over from ${targetYear - 1}`, actorUserId: auth.user.id, idempotencyKey } });
      await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLeaveBalance", entityId: target.id, action: "hr.leave.balance.carried_over", newValues: { amount, fromYear: targetYear - 1, toYear: targetYear } });
    }, { isolationLevel: "Serializable" });
  }
  const expiring = await prisma.hrLeaveBalance.findMany({ where: { organizationId: auth.user.organizationId, periodYear: targetYear, carriedOver: { gt: 0 }, leavePolicy: { carryOverExpiryMonth: { lte: effectiveAt.getUTCMonth() + 1 } } }, include: { leavePolicy: true } });
  for (const balance of expiring) {
    await prisma.$transaction(async (tx) => {
      const idempotencyKey = `leave-carry-over-expiry:${balance.id}:${targetYear}`;
      if (await tx.hrLeaveLedger.findUnique({ where: { idempotencyKey } })) return;
      const available = availableLeaveBalance({ opening: Number(balance.opening), accrued: Number(balance.accrued), carriedOver: Number(balance.carriedOver), adjusted: Number(balance.adjusted), reserved: Number(balance.reserved), used: Number(balance.used), expired: Number(balance.expired) });
      const amount = Math.max(0, Math.min(Number(balance.carriedOver), available));
      if (!amount) return;
      await tx.hrLeaveBalance.update({ where: { id: balance.id }, data: { expired: { increment: amount } } });
      await tx.hrLeaveLedger.create({ data: { balanceId: balance.id, type: "EXPIRY", amount, effectiveAt, reason: `Carry-over expired under policy version ${balance.leavePolicy.version}`, actorUserId: auth.user.id, idempotencyKey } });
      await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLeaveBalance", entityId: balance.id, action: "hr.leave.balance.carry_over_expired", newValues: { amount, year: targetYear } });
    }, { isolationLevel: "Serializable" });
  }
  revalidatePath("/hr/admin/leave");
  revalidatePath("/hr/employee/leave");
}
