"use server";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { availableLeaveBalance, countWorkingDays, leaveRequestInput, validateLeaveEligibility, workingDayNumbers } from "@/lib/hr/leave/engine";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { hrObjectStorage } from "@/lib/hr/storage";
import { activeSupervisorForEmployee } from "@/lib/hr/supervisors/scope";
import { validateHrDocumentFile } from "@/lib/hr/documents/validation";

export async function createLeaveRequestAction(formData: FormData) {
  const auth = await requirePermission("leave.request");
  if (!auth.user.employee) throw new Error("An employee profile is required.");
  const input = leaveRequestInput.parse(Object.fromEntries(formData));
  if (input.startDate.getUTCFullYear() !== input.endDate.getUTCFullYear()) {
    throw new Error("A leave request cannot cross a calendar-year balance boundary; submit one request per year.");
  }
  const now = new Date();
  const assignment = await prisma.hrEmployeeLeavePolicy.findFirst({
    where: { employeeId: auth.user.employee.id, status: "ACTIVE", effectiveFrom: { lte: input.startDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.startDate } }], leavePolicy: { leaveTypeId: input.leaveTypeId, status: "ACTIVE", effectiveFrom: { lte: input.startDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.startDate } }] } },
    include: { leavePolicy: { include: { leaveType: true } } },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!assignment) throw new Error("No active leave policy covers this request.");
  const policy = assignment.leavePolicy;
  if (policy.leaveType.unit === "HOURS" && !input.hours) throw new Error("Enter the number of leave hours requested.");
  const attachment = formData.get("attachment");
  const file = attachment instanceof File && attachment.size > 0 ? attachment : null;
  if (policy.leaveType.requiresAttachment && !file) throw new Error("This leave type requires an attachment.");
  if (file && file.size > 10 * 1024 * 1024) throw new Error("Attachments must be no larger than 10 MB.");
  const [workingDaysSetting, holidays, supervisor] = await Promise.all([
    prisma.hrOrganizationSetting.findUnique({ where: { organizationId_key: { organizationId: auth.user.organizationId, key: "workingDays" } } }),
    prisma.hrPublicHoliday.findMany({ where: { organizationId: auth.user.organizationId, date: { gte: input.startDate, lte: input.endDate } }, select: { date: true } }),
    activeSupervisorForEmployee(prisma, { organizationId: auth.user.organizationId, employeeId: auth.user.employee.id, now }),
  ]);
  const amount = policy.leaveType.unit === "HOURS" ? input.hours! : countWorkingDays(input.startDate, input.endDate, workingDayNumbers(workingDaysSetting?.value), holidays.map(({ date }) => date));
  const periodYear = input.startDate.getUTCFullYear();
  const reviewer = supervisor?.supervisorEmployee.user ?? null;
  const bytes = file ? new Uint8Array(await file.arrayBuffer()) : null;
  const validatedFile = file && bytes ? validateHrDocumentFile(file, bytes, 10 * 1024 * 1024) : null;
  const checksum = bytes ? crypto.createHash("sha256").update(bytes).digest("hex") : null;
  const storageKey = bytes ? `leave/${auth.user.organizationId}/${auth.user.employee.id}/${crypto.randomUUID()}` : null;
  const storage = bytes ? hrObjectStorage() : null;
  if (bytes && storageKey) await storage!.put(storageKey, bytes, file!.type);
  try {
    await prisma.$transaction(async (tx) => {
    const overlap = await tx.hrLeaveRequest.findFirst({ where: { employeeId: auth.user.employee!.id, status: { in: ["PENDING", "APPROVED"] }, startDate: { lte: input.endDate }, endDate: { gte: input.startDate } }, select: { id: true } });
    if (overlap) throw new Error("This request overlaps an existing pending or approved leave request.");
    const balance = await tx.hrLeaveBalance.upsert({ where: { employeeId_leaveTypeId_periodYear: { employeeId: auth.user.employee!.id, leaveTypeId: policy.leaveTypeId, periodYear } }, update: { leavePolicyId: policy.id }, create: { organizationId: auth.user.organizationId, employeeId: auth.user.employee!.id, leaveTypeId: policy.leaveTypeId, leavePolicyId: policy.id, periodYear, opening: policy.accrualFrequency === "ANNUALLY" ? policy.entitlement : 0 } });
    const openingKey = `leave-opening:${balance.id}:${periodYear}`;
    if (policy.accrualFrequency === "ANNUALLY" && Number(policy.entitlement) > 0 && !await tx.hrLeaveLedger.findUnique({ where: { idempotencyKey: openingKey } })) await tx.hrLeaveLedger.create({ data: { balanceId: balance.id, type: "OPENING", amount: policy.entitlement, effectiveAt: new Date(Date.UTC(periodYear, 0, 1)), reason: `Opening entitlement for ${periodYear}`, actorUserId: auth.user.id, idempotencyKey: openingKey } });
    const issues = validateLeaveEligibility({ amount, available: availableLeaveBalance({ opening: Number(balance.opening), accrued: Number(balance.accrued), carriedOver: Number(balance.carriedOver), adjusted: Number(balance.adjusted), reserved: Number(balance.reserved), used: Number(balance.used), expired: Number(balance.expired) }), allowNegativeBalance: policy.allowNegativeBalance, maximumConsecutive: policy.maximumConsecutive ? Number(policy.maximumConsecutive) : null, minimumNoticeDays: policy.minimumNoticeDays, startDate: input.startDate, now, hireDate: auth.user.employee!.hireDate, probationMonths: policy.probationMonths });
    if (issues.length) throw new Error(issues.join(" "));
    const autoApprove = !policy.requiresApproval;
    const request = await tx.hrLeaveRequest.create({ data: { organizationId: auth.user.organizationId, employeeId: auth.user.employee!.id, leaveTypeId: policy.leaveTypeId, leavePolicyId: policy.id, balanceId: balance.id, startDate: input.startDate, endDate: input.endDate, amount, reason: input.reason, status: autoApprove ? "APPROVED" : "PENDING", submittedAt: now, decidedAt: autoApprove ? now : null, requestedById: auth.user.id, currentReviewerId: autoApprove ? null : reviewer?.id } });
    if (file && validatedFile && storageKey && checksum) await tx.hrLeaveAttachment.create({ data: { requestId: request.id, storageKey, fileName: validatedFile.displayFileName, contentType: validatedFile.contentType, sizeBytes: validatedFile.sizeBytes, checksum, uploadedById: auth.user.id } });
    if (autoApprove) {
      await tx.hrLeaveBalance.update({ where: { id: balance.id }, data: { used: { increment: amount } } });
      await tx.hrLeaveLedger.create({ data: { balanceId: balance.id, requestId: request.id, type: "LEAVE_TAKEN", amount, effectiveAt: input.startDate, reason: "Automatically approved under leave policy", actorUserId: auth.user.id, idempotencyKey: `leave-approved:${request.id}` } });
    } else {
      await tx.hrLeaveBalance.update({ where: { id: balance.id }, data: { reserved: { increment: amount } } });
      await tx.hrLeaveLedger.create({ data: { balanceId: balance.id, requestId: request.id, type: "REQUEST_RESERVED", amount, effectiveAt: now, reason: "Balance reserved for pending leave request", actorUserId: auth.user.id, idempotencyKey: `leave-reserved:${request.id}` } });
      if (reviewer) await enqueueHrEmail(tx, { organizationId: auth.user.organizationId, recipient: reviewer.email, template: "hr-leave-review-requested", subject: "Leave request awaiting review", payload: { leaveRequestId: request.id }, idempotencyKey: `hr-leave-review:${request.id}` });
    }
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLeaveRequest", entityId: request.id, action: autoApprove ? "hr.leave.request.auto_approved" : "hr.leave.request.submitted", newValues: { leaveTypeId: input.leaveTypeId, startDate: input.startDate, endDate: input.endDate, amount, status: request.status }, reason: input.reason });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (storage && storageKey) await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
  revalidatePath("/hr/employee/leave");
  revalidatePath("/hr/supervisor/leave");
  revalidatePath("/hr/admin/leave");
}

export async function withdrawLeaveRequestAction(formData: FormData) {
  const auth = await requirePermission("leave.request");
  if (!auth.user.employee) throw new Error("An employee profile is required.");
  const requestId = z.string().cuid().parse(formData.get("requestId"));
  await prisma.$transaction(async (tx) => {
    const request = await tx.hrLeaveRequest.findFirstOrThrow({ where: { id: requestId, employeeId: auth.user.employee!.id, status: "PENDING" } });
    await tx.hrLeaveRequest.update({ where: { id: request.id }, data: { status: "WITHDRAWN", cancelledAt: new Date(), currentReviewerId: null } });
    await tx.hrLeaveBalance.update({ where: { id: request.balanceId }, data: { reserved: { decrement: request.amount } } });
    await tx.hrLeaveLedger.create({ data: { balanceId: request.balanceId, requestId: request.id, type: "REQUEST_RELEASED", amount: request.amount, effectiveAt: new Date(), reason: "Employee withdrew pending request", actorUserId: auth.user.id, idempotencyKey: `leave-withdrawn:${request.id}` } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLeaveRequest", entityId: request.id, action: "hr.leave.request.withdrawn", previousValues: { status: request.status }, newValues: { status: "WITHDRAWN" } });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/employee/leave");
  revalidatePath("/hr/supervisor/leave");
  revalidatePath("/hr/admin/leave");
}
