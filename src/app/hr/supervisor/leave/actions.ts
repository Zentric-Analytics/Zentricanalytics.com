"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";
import { activeSupervisorForEmployee } from "@/lib/hr/supervisors/scope";
import { cancelUnit5Leave, reserveUnit5Request, transitionUnit5Request } from "@/lib/hr/leave/unit5-accounting";

const reviewInput = z.object({ requestId: z.string().cuid(), decision: z.enum(["APPROVED", "REJECTED"]), notes: z.string().trim().max(1000).optional().transform((value) => value || undefined) });
export async function reviewLeaveRequestAction(formData: FormData) {
  const auth = await requireAuthenticatedUser();
  const input = reviewInput.parse(Object.fromEntries(formData));
  const request = await prisma.hrLeaveRequest.findFirstOrThrow({ where: { id: input.requestId, organizationId: auth.user.organizationId, status: "PENDING" }, include: { employee: true, requestedBy: true } });
  const privileged = auth.permissions.has("leave.approve") || auth.permissions.has("leave.override");
  let assignmentScoped = request.currentReviewerId === auth.user.id;
  if (!assignmentScoped && auth.user.employee) {
    const assignment = await activeSupervisorForEmployee(prisma, { organizationId: auth.user.organizationId, employeeId: request.employeeId });
    assignmentScoped = assignment?.supervisorEmployee.userId === auth.user.id
      && Array.isArray(assignment.capabilities)
      && assignment.capabilities.includes("supervisor.review_assigned");
  }
  if (!privileged && !assignmentScoped) throw new Error("You are not authorized to review this leave request.");
  const unit5Version = await prisma.hrLeaveRequestVersion.findFirst({ where: { requestId: request.id, organizationId: auth.user.organizationId }, orderBy: { version: "desc" } });
  if (unit5Version && input.decision === "APPROVED") {
    await reserveUnit5Request({ organizationId: auth.user.organizationId, requestVersionId: unit5Version.id, reviewerUserId: auth.user.id, reason: input.notes, idempotencyKey: `unit5-final-approval:${unit5Version.id}:${unit5Version.version}` });
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.hrLeaveRequest.findFirstOrThrow({ where: { id: request.id, status: "PENDING" } });
      await tx.hrLeaveRequest.update({ where: { id: fresh.id }, data: { status: "APPROVED", decidedAt: new Date(), currentReviewerId: null } });
      await tx.hrLeaveApproval.create({ data: { requestId: fresh.id, reviewerId: auth.user.id, fromStatus: "PENDING", toStatus: "APPROVED", notes: input.notes } });
      await enqueueHrEmail(tx, { organizationId: auth.user.organizationId, recipient: request.requestedBy.email, template: "hr-leave-approved", subject: "Leave request approved", payload: { leaveRequestId: fresh.id, requestVersionId: unit5Version.id }, idempotencyKey: `hr-leave-decision:${fresh.id}:APPROVED` });
      await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLeaveRequest", entityId: fresh.id, action: "hr.leave.request.approved", previousValues: { status: "PENDING" }, newValues: { status: "APPROVED", reservationModel: "UNIT5_FINAL_APPROVAL" }, reason: input.notes, correlationId: unit5Version.correlationId });
    }, { isolationLevel: "Serializable" });
    revalidatePath("/hr/supervisor/leave"); revalidatePath("/hr/admin/leave"); revalidatePath("/hr/employee/leave");
    return;
  }
  if (unit5Version && input.decision === "REJECTED") {
    await transitionUnit5Request({ organizationId: auth.user.organizationId, requestVersionId: unit5Version.id, from: "UNDER_REVIEW", to: "REJECTED", actorUserId: auth.user.id, reason: input.notes, idempotencyKey: `unit5-final-rejection:${unit5Version.id}:${unit5Version.version}` });
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.hrLeaveRequest.findFirstOrThrow({ where: { id: request.id, status: "PENDING" } });
      await tx.hrLeaveRequest.update({ where: { id: fresh.id }, data: { status: "REJECTED", decidedAt: new Date(), currentReviewerId: null } });
      await tx.hrLeaveApproval.create({ data: { requestId: fresh.id, reviewerId: auth.user.id, fromStatus: "PENDING", toStatus: "REJECTED", notes: input.notes } });
      await enqueueHrEmail(tx, { organizationId: auth.user.organizationId, recipient: request.requestedBy.email, template: "hr-leave-rejected", subject: "Leave request rejected", payload: { leaveRequestId: fresh.id, requestVersionId: unit5Version.id }, idempotencyKey: `hr-leave-decision:${fresh.id}:REJECTED` });
      await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLeaveRequest", entityId: fresh.id, action: "hr.leave.request.rejected", previousValues: { status: "PENDING" }, newValues: { status: "REJECTED", reservationModel: "UNIT5_NO_SUBMISSION_RESERVATION" }, reason: input.notes, correlationId: unit5Version.correlationId });
    }, { isolationLevel: "Serializable" });
    revalidatePath("/hr/supervisor/leave"); revalidatePath("/hr/admin/leave"); revalidatePath("/hr/employee/leave");
    return;
  }
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.hrLeaveRequest.findFirstOrThrow({ where: { id: request.id, status: "PENDING" } });
    const decidedAt = new Date();
    await tx.hrLeaveRequest.update({ where: { id: fresh.id }, data: { status: input.decision, decidedAt, currentReviewerId: null } });
    await tx.hrLeaveApproval.create({ data: { requestId: fresh.id, reviewerId: auth.user.id, fromStatus: "PENDING", toStatus: input.decision, notes: input.notes } });
    await tx.hrLeaveBalance.update({ where: { id: fresh.balanceId }, data: input.decision === "APPROVED" ? { reserved: { decrement: fresh.amount }, used: { increment: fresh.amount } } : { reserved: { decrement: fresh.amount } } });
    await tx.hrLeaveLedger.create({ data: { balanceId: fresh.balanceId, requestId: fresh.id, type: "REQUEST_RELEASED", amount: fresh.amount, effectiveAt: decidedAt, reason: `${input.decision === "APPROVED" ? "Approved" : "Rejected"} request released reservation`, actorUserId: auth.user.id, idempotencyKey: `leave-reservation-released:${fresh.id}` } });
    if (input.decision === "APPROVED") await tx.hrLeaveLedger.create({ data: { balanceId: fresh.balanceId, requestId: fresh.id, type: "LEAVE_TAKEN", amount: fresh.amount, effectiveAt: fresh.startDate, reason: "Approved leave", actorUserId: auth.user.id, idempotencyKey: `leave-approved:${fresh.id}` } });
    await enqueueHrEmail(tx, { organizationId: auth.user.organizationId, recipient: request.requestedBy.email, template: `hr-leave-${input.decision.toLowerCase()}`, subject: `Leave request ${input.decision.toLowerCase()}`, payload: { leaveRequestId: fresh.id }, idempotencyKey: `hr-leave-decision:${fresh.id}:${input.decision}` });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLeaveRequest", entityId: fresh.id, action: `hr.leave.request.${input.decision.toLowerCase()}`, previousValues: { status: "PENDING" }, newValues: { status: input.decision }, reason: input.notes });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/supervisor/leave");
  revalidatePath("/hr/admin/leave");
  revalidatePath("/hr/employee/leave");
}

export async function cancelApprovedLeaveAction(formData: FormData) {
  const auth = await requireAuthenticatedUser();
  if (!auth.permissions.has("leave.override")) throw new Error("Leave override permission is required.");
  const requestId = z.string().cuid().parse(formData.get("requestId"));
  const reason = z.string().trim().min(3).max(1000).parse(formData.get("reason"));
  const unit5Version = await prisma.hrLeaveRequestVersion.findFirst({ where: { requestId, organizationId: auth.user.organizationId }, orderBy: { version: "desc" } });
  if (unit5Version) {
    await cancelUnit5Leave({ organizationId: auth.user.organizationId, requestVersionId: unit5Version.id, actorUserId: auth.user.id, reason, effectiveAt: new Date() });
    await prisma.$transaction(async (tx) => {
      const request = await tx.hrLeaveRequest.findFirstOrThrow({ where: { id: requestId, organizationId: auth.user.organizationId, status: "APPROVED" }, include: { requestedBy: true } });
      await tx.hrLeaveRequest.update({ where: { id: request.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      await enqueueHrEmail(tx, { organizationId: auth.user.organizationId, recipient: request.requestedBy.email, template: "hr-leave-cancelled", subject: "Approved leave cancelled", payload: { leaveRequestId: request.id, requestVersionId: unit5Version.id }, idempotencyKey: `hr-leave-cancelled:${request.id}` });
      await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLeaveRequest", entityId: request.id, action: "hr.leave.request.cancelled", previousValues: { status: "APPROVED" }, newValues: { status: "CANCELLED", accountingModel: "UNIT5_AUTHORITATIVE_LEDGER" }, reason, correlationId: unit5Version.correlationId });
    }, { isolationLevel: "Serializable" });
  } else await prisma.$transaction(async (tx) => {
    const request = await tx.hrLeaveRequest.findFirstOrThrow({ where: { id: requestId, organizationId: auth.user.organizationId, status: "APPROVED" }, include: { requestedBy: true } });
    await tx.hrLeaveRequest.update({ where: { id: request.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    await tx.hrLeaveBalance.update({ where: { id: request.balanceId }, data: { used: { decrement: request.amount } } });
    await tx.hrLeaveLedger.create({ data: { balanceId: request.balanceId, requestId: request.id, type: "LEAVE_RESTORED", amount: request.amount, effectiveAt: new Date(), reason, actorUserId: auth.user.id, idempotencyKey: `leave-restored:${request.id}` } });
    await enqueueHrEmail(tx, { organizationId: auth.user.organizationId, recipient: request.requestedBy.email, template: "hr-leave-cancelled", subject: "Approved leave cancelled", payload: { leaveRequestId: request.id }, idempotencyKey: `hr-leave-cancelled:${request.id}` });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLeaveRequest", entityId: request.id, action: "hr.leave.request.cancelled", previousValues: { status: "APPROVED" }, newValues: { status: "CANCELLED" }, reason });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/supervisor/leave");
  revalidatePath("/hr/admin/leave");
  revalidatePath("/hr/employee/leave");
}
