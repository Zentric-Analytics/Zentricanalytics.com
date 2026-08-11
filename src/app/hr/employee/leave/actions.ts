"use server";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { availableLeaveBalance, leaveRequestInput, validateLeaveEligibility } from "@/lib/hr/leave/engine";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { hrObjectStorage, hrStorageProvider } from "@/lib/hr/storage";
import { activeSupervisorForEmployee } from "@/lib/hr/supervisors/scope";
import { validateHrDocumentFile } from "@/lib/hr/documents/validation";
import { calculateUnit5Segments } from "@/lib/hr/leave/unit5";
import { transitionUnit5Request } from "@/lib/hr/leave/unit5-accounting";
import { startConfiguredLeaveWorkflow } from "@/lib/hr/leave/unit5-workflow";

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
  if (policy.entitlementModel === "LONG_TERM") {
    const primaryAssignment = await prisma.hrEmployeeAssignment.findFirst({
      where: { organizationId: auth.user.organizationId, employeeId: auth.user.employee.id, status: "ACTIVE", isPrimary: true, effectiveFrom: { lte: input.startDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.startDate } }] },
      select: { id: true },
    });
    if (!primaryAssignment) throw new Error("Long-term absence requires an active primary employment assignment covering the requested start date.");
  }
  if (policy.leaveType.unit === "HOURS" && !input.hours) throw new Error("Enter the number of leave hours requested.");
  const attachment = formData.get("attachment");
  const file = attachment instanceof File && attachment.size > 0 ? attachment : null;
  if (policy.leaveType.requiresAttachment && !file) throw new Error("This leave type requires an attachment.");
  if (file && file.size > 10 * 1024 * 1024) throw new Error("Attachments must be no larger than 10 MB.");
  const [scheduleAssignment, calendarAssignment, supervisor] = await Promise.all([
    prisma.hrWorkScheduleAssignment.findFirst({ where: { organizationId: auth.user.organizationId, employeeId: auth.user.employee.id, effectiveFrom: { lte: input.startDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.startDate } }] }, include: { workScheduleVersion: true }, orderBy: { effectiveFrom: "desc" } }),
    prisma.hrHolidayCalendarAssignment.findFirst({ where: { organizationId: auth.user.organizationId, employeeId: auth.user.employee.id, effectiveFrom: { lte: input.startDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.startDate } }] }, include: { holidayCalendarVersion: { include: { occurrences: { where: { localDate: { gte: input.startDate, lte: input.endDate } } } } } }, orderBy: { effectiveFrom: "desc" } }),
    activeSupervisorForEmployee(prisma, { organizationId: auth.user.organizationId, employeeId: auth.user.employee.id, now }),
  ]);
  if (!scheduleAssignment) throw new Error("No effective work schedule covers this request.");
  if (!calendarAssignment) throw new Error("No effective holiday calendar covers this request.");
  if (!supervisor?.supervisorEmployee.user) throw new Error("No authorized manager is configured for this leave request.");
  const segments = calculateUnit5Segments({ startDate: input.startDate, endDate: input.endDate, unit: policy.leaveType.unit, requestedHours: input.hours, weeklyPattern: scheduleAssignment.workScheduleVersion.weeklyPattern, holidays: calendarAssignment.holidayCalendarVersion.occurrences });
  const amount = segments.reduce((total, segment) => total + segment.chargeableAmount, 0);
  if (amount <= 0) throw new Error("The selected period contains no chargeable working time.");
  if (policy.minimumRequest && amount < Number(policy.minimumRequest)) throw new Error(`This policy requires a minimum request of ${policy.minimumRequest.toString()} ${policy.leaveType.unit.toLowerCase()}.`);
  const periodYear = input.startDate.getUTCFullYear();
  const reviewer = supervisor?.supervisorEmployee.user ?? null;
  const bytes = file ? new Uint8Array(await file.arrayBuffer()) : null;
  const validatedFile = file && bytes ? validateHrDocumentFile(file, bytes, 10 * 1024 * 1024) : null;
  const checksum = bytes ? crypto.createHash("sha256").update(bytes).digest("hex") : null;
  const evidenceDocumentId = bytes ? crypto.randomUUID() : null;
  const storageKey = bytes && evidenceDocumentId ? `quarantine/documents/${auth.user.organizationId}/${evidenceDocumentId}/v1-${crypto.randomUUID()}` : null;
  const storage = bytes ? hrObjectStorage() : null;
  const storedLocation = bytes && storageKey && checksum ? await storage!.quarantineUpload(storageKey, bytes, file!.type, checksum) : null;
  const storedMetadata = storedLocation ? await storage!.headVersion(storedLocation) : null;
  if (storedMetadata && (storedMetadata.sizeBytes !== bytes!.byteLength || storedMetadata.checksum !== checksum)) { await storage!.deleteVersion(storedLocation!).catch(() => undefined); throw new Error("Stored leave evidence failed immutable size or checksum verification."); }
  try {
    await prisma.$transaction(async (tx) => {
    const overlap = await tx.hrLeaveRequest.findFirst({ where: { employeeId: auth.user.employee!.id, status: { in: ["PENDING", "APPROVED"] }, startDate: { lte: input.endDate }, endDate: { gte: input.startDate } }, select: { id: true } });
    if (overlap) throw new Error("This request overlaps an existing pending or approved leave request.");
    const balance = await tx.hrLeaveBalance.upsert({ where: { employeeId_leaveTypeId_periodYear: { employeeId: auth.user.employee!.id, leaveTypeId: policy.leaveTypeId, periodYear } }, update: { leavePolicyId: policy.id }, create: { organizationId: auth.user.organizationId, employeeId: auth.user.employee!.id, leaveTypeId: policy.leaveTypeId, leavePolicyId: policy.id, periodYear, opening: policy.accrualFrequency === "ANNUALLY" ? policy.entitlement : 0 } });
    const openingKey = `leave-opening:${balance.id}:${periodYear}`;
    if (policy.accrualFrequency === "ANNUALLY" && Number(policy.entitlement) > 0 && !await tx.hrLeaveLedger.findUnique({ where: { idempotencyKey: openingKey } })) await tx.hrLeaveLedger.create({ data: { balanceId: balance.id, type: "OPENING", amount: policy.entitlement, effectiveAt: new Date(Date.UTC(periodYear, 0, 1)), reason: `Opening entitlement for ${periodYear}`, actorUserId: auth.user.id, idempotencyKey: openingKey } });
    const nonNumericEntitlement = ["UNLIMITED", "UNPAID", "STATUTORY", "LONG_TERM"].includes(policy.entitlementModel);
    const issues = validateLeaveEligibility({ amount, available: availableLeaveBalance({ opening: Number(balance.opening), accrued: Number(balance.accrued), carriedOver: Number(balance.carriedOver), adjusted: Number(balance.adjusted), reserved: Number(balance.reserved), used: Number(balance.used), expired: Number(balance.expired) }), allowNegativeBalance: policy.allowNegativeBalance || nonNumericEntitlement, maximumConsecutive: policy.maximumConsecutive ? Number(policy.maximumConsecutive) : null, minimumNoticeDays: policy.minimumNoticeDays, startDate: input.startDate, now, hireDate: auth.user.employee!.hireDate, probationMonths: policy.probationMonths });
    if (issues.length) throw new Error(issues.join(" "));
    const autoApprove = false;
    const request = await tx.hrLeaveRequest.create({ data: { organizationId: auth.user.organizationId, employeeId: auth.user.employee!.id, leaveTypeId: policy.leaveTypeId, leavePolicyId: policy.id, balanceId: balance.id, startDate: input.startDate, endDate: input.endDate, amount, reason: input.reason, status: autoApprove ? "APPROVED" : "PENDING", submittedAt: now, decidedAt: autoApprove ? now : null, requestedById: auth.user.id, currentReviewerId: autoApprove ? null : reviewer?.id } });
    const account = await tx.hrLeaveAccount.upsert({ where: { organizationId_employeeId_leaveTypeId_unit: { organizationId: auth.user.organizationId, employeeId: auth.user.employee!.id, leaveTypeId: policy.leaveTypeId, unit: policy.leaveType.unit } }, update: {}, create: { organizationId: auth.user.organizationId, employeeId: auth.user.employee!.id, leaveTypeId: policy.leaveTypeId, unit: policy.leaveType.unit } });
    const periodStart = new Date(Date.UTC(periodYear, 0, 1)); const periodEnd = new Date(Date.UTC(periodYear + 1, 0, 1));
    const accountPeriod = await tx.hrLeaveAccountPeriod.upsert({ where: { accountId_periodStart_periodEnd: { accountId: account.id, periodStart, periodEnd } }, update: {}, create: { accountId: account.id, leavePolicyId: policy.id, periodStart, periodEnd } });
    const grant = policy.accrualFrequency === "ANNUALLY" ? Number(policy.entitlement) : 0;
    const grantKey = `unit5-grant:${accountPeriod.id}`;
    if (grant > 0 && !await tx.hrLeaveLedgerEntry.findUnique({ where: { organizationId_idempotencyKey: { organizationId: auth.user.organizationId, idempotencyKey: grantKey } } })) { await tx.hrLeaveAccountPeriod.update({ where: { id: accountPeriod.id }, data: { granted: { increment: grant }, version: { increment: 1 } } }); await tx.hrLeaveLedgerEntry.create({ data: { organizationId: auth.user.organizationId, accountPeriodId: accountPeriod.id, leavePolicyId: policy.id, kind: "GRANT", amount: grant, unit: policy.leaveType.unit, effectiveAt: periodStart, sourceType: "POLICY_PERIOD", sourceId: accountPeriod.id, actorUserId: auth.user.id, reason: "Unit 5 opening entitlement grant", correlationId: request.id, idempotencyKey: grantKey } }); }
    const requestVersion = await tx.hrLeaveRequestVersion.create({ data: { organizationId: auth.user.organizationId, requestId: request.id, version: 1, employeeId: auth.user.employee!.id, leavePolicyId: policy.id, workScheduleVersionId: scheduleAssignment.workScheduleVersionId, holidayCalendarVersionId: calendarAssignment.holidayCalendarVersionId, lifecycleStatus: "SUBMITTED", unit: policy.leaveType.unit, requestedAmount: amount, operationalReason: input.reason, calculationSnapshot: { calendarDays: Math.floor((input.endDate.getTime()-input.startDate.getTime())/86_400_000)+1, chargeableAmount: amount, scheduleVersionId: scheduleAssignment.workScheduleVersionId, calendarVersionId: calendarAssignment.holidayCalendarVersionId }, correlationId: crypto.randomUUID(), createdById: auth.user.id } });
    const workflow = await startConfiguredLeaveWorkflow(tx, { organizationId: auth.user.organizationId, workflowKey: policy.workflowDefinitionKey, requestVersionId: requestVersion.id, employeeId: auth.user.employee!.id, requesterUserId: auth.user.id, correlationId: requestVersion.correlationId, effectiveAt: input.startDate, context: { entitlementModel: policy.entitlementModel, leaveTypeCode: policy.leaveType.code, requiresEvidence: Boolean(policy.leaveType.requiresAttachment || policy.evidenceClass), requestedAmount: amount } });
    if (workflow) {
      await tx.hrLeaveRequestVersion.update({ where: { id: requestVersion.id }, data: { workflowInstanceId: workflow.instanceId } });
      await tx.hrLeaveRequest.update({ where: { id: request.id }, data: { currentReviewerId: workflow.firstApproverId } });
    }
    if (file && validatedFile && storedLocation && checksum && evidenceDocumentId && storageKey) {
      const document = await tx.hrEmployeeDocument.create({ data: { id: evidenceDocumentId, organizationId: auth.user.organizationId, employeeId: auth.user.employee!.id, category: "LEAVE_SUPPORT", title: `${policy.leaveType.name} evidence`, restricted: true, createdById: auth.user.id } });
      const documentVersion = await tx.hrEmployeeDocumentVersion.create({ data: { organizationId: auth.user.organizationId, documentId: document.id, version: 1, originalFileName: file.name.slice(0, 500), displayFileName: validatedFile.displayFileName, contentType: validatedFile.contentType, sizeBytes: validatedFile.sizeBytes, storageProvider: hrStorageProvider(), storageBucket: storedLocation.bucket, storageKey, storageVersionId: storedLocation.versionId, storageEtag: storedLocation.eTag, checksum, uploadedById: auth.user.id } });
      const retentionUntil = policy.evidenceRetentionDays ? new Date(now.getTime() + policy.evidenceRetentionDays * 86_400_000) : null;
      await tx.hrLeaveEvidence.create({ data: { requestVersionId: requestVersion.id, documentVersionId: documentVersion.id, classification: policy.evidenceClass ?? "CONFIDENTIAL_LEAVE_EVIDENCE", status: "PENDING_SCAN", retentionUntil } });
    }
    await tx.hrLeaveRequestSegment.createMany({ data: segments.map((segment, sequence) => ({ requestVersionId: requestVersion.id, accountPeriodId: accountPeriod.id, sequence, ...segment })) });
    await tx.hrLeaveTransition.create({ data: { requestVersionId: requestVersion.id, fromStatus: null, toStatus: "SUBMITTED", actorUserId: auth.user.id, idempotencyKey: `unit5-submitted:${requestVersion.id}`, correlationId: requestVersion.correlationId } });
    if (!autoApprove) await tx.hrLeaveTransition.create({ data: { requestVersionId: requestVersion.id, fromStatus: "SUBMITTED", toStatus: "UNDER_REVIEW", actorUserId: auth.user.id, idempotencyKey: `unit5-review:${requestVersion.id}`, correlationId: requestVersion.correlationId } });
    if (!workflow && reviewer) await enqueueHrEmail(tx, { organizationId: auth.user.organizationId, recipient: reviewer.email, template: "hr-leave-review-requested", subject: "Leave request awaiting review", payload: { leaveRequestId: request.id, requestVersionId: requestVersion.id }, idempotencyKey: `hr-leave-review:${request.id}` });
    await enqueueHrEmail(tx, { organizationId: auth.user.organizationId, recipient: auth.user.email, template: "hr-leave-submitted", subject: "Leave request submitted", payload: { leaveRequestId: request.id, requestVersionId: requestVersion.id }, idempotencyKey: `hr-leave-submitted:${request.id}:${requestVersion.version}` });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLeaveRequest", entityId: request.id, action: autoApprove ? "hr.leave.request.auto_approved" : "hr.leave.request.submitted", newValues: { leaveTypeId: input.leaveTypeId, startDate: input.startDate, endDate: input.endDate, amount, status: request.status }, reason: input.reason });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (storage && storedLocation) await storage.deleteVersion(storedLocation).catch(() => undefined);
    throw error;
  }
  revalidatePath("/hr/employee/leave");
  revalidatePath("/hr/supervisor/leave");
  revalidatePath("/hr/admin/leave");
}

const returnedRequestInput = z.intersection(leaveRequestInput, z.object({ requestId: z.string().cuid(), expectedVersion: z.coerce.number().int().positive() }));
export async function resubmitReturnedLeaveRequestAction(formData: FormData) {
  const auth = await requirePermission("leave.request");
  if (!auth.user.employee) throw new Error("An employee profile is required.");
  const input = returnedRequestInput.parse(Object.fromEntries(formData));
  if (input.startDate.getUTCFullYear() !== input.endDate.getUTCFullYear()) throw new Error("A leave request cannot cross a calendar-year balance boundary.");
  const previous = await prisma.hrLeaveRequestVersion.findFirstOrThrow({ where: { requestId: input.requestId, organizationId: auth.user.organizationId, employeeId: auth.user.employee.id, version: input.expectedVersion }, include: { evidence: true } });
  const [latest, latestTransition] = await Promise.all([
    prisma.hrLeaveRequestVersion.aggregate({ where: { requestId: input.requestId }, _max: { version: true } }),
    prisma.hrLeaveTransition.findFirst({ where: { requestVersionId: previous.id }, orderBy: { createdAt: "desc" } }),
  ]);
  if (latest._max.version !== input.expectedVersion || latestTransition?.toStatus !== "RETURNED") throw new Error("Only the latest returned request version can be edited and resubmitted.");
  const assignment = await prisma.hrEmployeeLeavePolicy.findFirst({ where: { employeeId: auth.user.employee.id, status: "ACTIVE", effectiveFrom: { lte: input.startDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.startDate } }], leavePolicy: { leaveTypeId: input.leaveTypeId, status: "ACTIVE", effectiveFrom: { lte: input.startDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.startDate } }] } }, include: { leavePolicy: { include: { leaveType: true } } }, orderBy: { effectiveFrom: "desc" } });
  if (!assignment) throw new Error("No active leave policy covers the revised request.");
  const policy = assignment.leavePolicy;
  if (policy.entitlementModel === "LONG_TERM") {
    const primaryAssignment = await prisma.hrEmployeeAssignment.findFirst({
      where: { organizationId: auth.user.organizationId, employeeId: auth.user.employee.id, status: "ACTIVE", isPrimary: true, effectiveFrom: { lte: input.startDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.startDate } }] },
      select: { id: true },
    });
    if (!primaryAssignment) throw new Error("Long-term absence requires an active primary employment assignment covering the requested start date.");
  }
  const [scheduleAssignment, calendarAssignment] = await Promise.all([
    prisma.hrWorkScheduleAssignment.findFirst({ where: { organizationId: auth.user.organizationId, employeeId: auth.user.employee.id, effectiveFrom: { lte: input.startDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.startDate } }] }, include: { workScheduleVersion: true }, orderBy: { effectiveFrom: "desc" } }),
    prisma.hrHolidayCalendarAssignment.findFirst({ where: { organizationId: auth.user.organizationId, employeeId: auth.user.employee.id, effectiveFrom: { lte: input.startDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.startDate } }] }, include: { holidayCalendarVersion: { include: { occurrences: { where: { localDate: { gte: input.startDate, lte: input.endDate } } } } } }, orderBy: { effectiveFrom: "desc" } }),
  ]);
  if (!scheduleAssignment || !calendarAssignment) throw new Error("An effective work schedule and holiday calendar are required.");
  const segments = calculateUnit5Segments({ startDate: input.startDate, endDate: input.endDate, unit: policy.leaveType.unit, requestedHours: input.hours, weeklyPattern: scheduleAssignment.workScheduleVersion.weeklyPattern, holidays: calendarAssignment.holidayCalendarVersion.occurrences });
  const amount = segments.reduce((total, segment) => total + segment.chargeableAmount, 0);
  if (amount <= 0) throw new Error("The revised period contains no chargeable working time.");
  await prisma.$transaction(async (tx) => {
    const current = await tx.hrLeaveRequestVersion.aggregate({ where: { requestId: input.requestId }, _max: { version: true } });
    if (current._max.version !== input.expectedVersion) throw new Error("The leave request changed while it was being edited.");
    const overlap = await tx.hrLeaveRequest.findFirst({ where: { id: { not: input.requestId }, employeeId: auth.user.employee!.id, status: { in: ["PENDING", "APPROVED"] }, startDate: { lte: input.endDate }, endDate: { gte: input.startDate } }, select: { id: true } });
    if (overlap) throw new Error("The revised request overlaps another pending or approved leave request.");
    const account = await tx.hrLeaveAccount.findUniqueOrThrow({ where: { organizationId_employeeId_leaveTypeId_unit: { organizationId: auth.user.organizationId, employeeId: auth.user.employee!.id, leaveTypeId: policy.leaveTypeId, unit: policy.leaveType.unit } } });
    const periodStart = new Date(Date.UTC(input.startDate.getUTCFullYear(), 0, 1)); const periodEnd = new Date(Date.UTC(input.startDate.getUTCFullYear() + 1, 0, 1));
    const accountPeriod = await tx.hrLeaveAccountPeriod.findUniqueOrThrow({ where: { accountId_periodStart_periodEnd: { accountId: account.id, periodStart, periodEnd } } });
    const version = await tx.hrLeaveRequestVersion.create({ data: { organizationId: auth.user.organizationId, requestId: input.requestId, version: input.expectedVersion + 1, employeeId: auth.user.employee!.id, leavePolicyId: policy.id, workScheduleVersionId: scheduleAssignment.workScheduleVersionId, holidayCalendarVersionId: calendarAssignment.holidayCalendarVersionId, lifecycleStatus: "SUBMITTED", unit: policy.leaveType.unit, requestedAmount: amount, operationalReason: input.reason, calculationSnapshot: { calendarDays: Math.floor((input.endDate.getTime()-input.startDate.getTime())/86_400_000)+1, chargeableAmount: amount, scheduleVersionId: scheduleAssignment.workScheduleVersionId, calendarVersionId: calendarAssignment.holidayCalendarVersionId, replacesVersionId: previous.id }, correlationId: crypto.randomUUID(), createdById: auth.user.id, segments: { create: segments.map((segment, sequence) => ({ accountPeriodId: accountPeriod.id, sequence, ...segment })) }, evidence: { create: previous.evidence.map((item) => ({ documentVersionId: item.documentVersionId, classification: item.classification, status: item.status, retentionUntil: item.retentionUntil })) } } });
    const workflow = await startConfiguredLeaveWorkflow(tx, { organizationId: auth.user.organizationId, workflowKey: policy.workflowDefinitionKey, requestVersionId: version.id, employeeId: auth.user.employee!.id, requesterUserId: auth.user.id, correlationId: version.correlationId, effectiveAt: input.startDate, context: { entitlementModel: policy.entitlementModel, leaveTypeCode: policy.leaveType.code, requiresEvidence: Boolean(policy.leaveType.requiresAttachment || policy.evidenceClass), requestedAmount: amount } });
    if (!workflow) throw new Error("A returned Unit 5 request requires a configured approval workflow before resubmission.");
    await tx.hrLeaveRequestVersion.update({ where: { id: version.id }, data: { workflowInstanceId: workflow.instanceId } });
    await tx.hrLeaveRequest.update({ where: { id: input.requestId }, data: { leaveTypeId: policy.leaveTypeId, leavePolicyId: policy.id, startDate: input.startDate, endDate: input.endDate, amount, reason: input.reason, status: "PENDING", currentReviewerId: workflow.firstApproverId, submittedAt: new Date(), decidedAt: null } });
    await tx.hrLeaveTransition.createMany({ data: [{ requestVersionId: version.id, fromStatus: null, toStatus: "SUBMITTED", actorUserId: auth.user.id, idempotencyKey: `unit5-resubmitted:${version.id}`, correlationId: version.correlationId }, { requestVersionId: version.id, fromStatus: "SUBMITTED", toStatus: "UNDER_REVIEW", actorUserId: auth.user.id, idempotencyKey: `unit5-review:${version.id}`, correlationId: version.correlationId }] });
    await enqueueHrEmail(tx, { organizationId: auth.user.organizationId, recipient: auth.user.email, template: "hr-leave-submitted", subject: "Revised leave request submitted", payload: { leaveRequestId: input.requestId, requestVersionId: version.id }, idempotencyKey: `hr-leave-submitted:${input.requestId}:${version.version}` });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLeaveRequestVersion", entityId: version.id, action: "hr.leave.request.resubmitted", previousValues: { requestVersionId: previous.id, version: previous.version, status: "RETURNED" }, newValues: { version: version.version, requestedAmount: amount }, reason: input.reason, correlationId: version.correlationId });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/employee/leave"); revalidatePath("/hr/supervisor/leave"); revalidatePath("/hr/admin/leave");
}

export async function withdrawLeaveRequestAction(formData: FormData) {
  const auth = await requirePermission("leave.request");
  if (!auth.user.employee) throw new Error("An employee profile is required.");
  const requestId = z.string().cuid().parse(formData.get("requestId"));
  const unit5Version = await prisma.hrLeaveRequestVersion.findFirst({ where: { requestId, organizationId: auth.user.organizationId, employeeId: auth.user.employee.id }, orderBy: { version: "desc" } });
  if (unit5Version) {
    await transitionUnit5Request({ organizationId: auth.user.organizationId, requestVersionId: unit5Version.id, from: "UNDER_REVIEW", to: "WITHDRAWN", actorUserId: auth.user.id, idempotencyKey: `unit5-withdrawn:${unit5Version.id}` });
    await prisma.$transaction(async (tx) => {
      const request = await tx.hrLeaveRequest.findFirstOrThrow({ where: { id: requestId, employeeId: auth.user.employee!.id, status: "PENDING" } });
      await tx.hrLeaveRequest.update({ where: { id: request.id }, data: { status: "WITHDRAWN", cancelledAt: new Date(), currentReviewerId: null } });
      await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLeaveRequest", entityId: request.id, action: "hr.leave.request.withdrawn", previousValues: { status: request.status }, newValues: { status: "WITHDRAWN", reservationModel: "UNIT5_NO_SUBMISSION_RESERVATION" }, correlationId: unit5Version.correlationId });
    }, { isolationLevel: "Serializable" });
  } else await prisma.$transaction(async (tx) => {
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
