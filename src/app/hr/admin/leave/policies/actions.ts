"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { requirePermission } from "@/lib/hr/permissions/authorize";

const archiveInput = z.object({ id: z.string().cuid(), reason: z.string().trim().min(3).max(500) });
export async function archiveLeaveTypeAction(formData: FormData) {
  const auth = await requirePermission("leave.policy.manage");
  const input = archiveInput.parse(Object.fromEntries(formData));
  const leaveType = await prisma.hrLeaveType.findFirstOrThrow({ where: { id: input.id, organizationId: auth.user.organizationId, status: "ACTIVE" } });
  if (await prisma.hrLeavePolicy.count({ where: { leaveTypeId: leaveType.id, status: "ACTIVE" } })) throw new Error("Archive or supersede active policies before archiving this leave type.");
  await prisma.$transaction(async (tx) => {
    await tx.hrLeaveType.update({ where: { id: leaveType.id }, data: { status: "ARCHIVED", archivedAt: new Date() } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLeaveType", entityId: leaveType.id, action: "hr.leave.type.archived", previousValues: { status: leaveType.status }, newValues: { status: "ARCHIVED" }, reason: input.reason });
  });
  revalidatePath("/hr/admin/leave");
  revalidatePath("/hr/admin/leave/policies");
}

export async function archiveLeavePolicyAction(formData: FormData) {
  const auth = await requirePermission("leave.policy.manage");
  const input = archiveInput.parse(Object.fromEntries(formData));
  const policy = await prisma.hrLeavePolicy.findFirstOrThrow({ where: { id: input.id, organizationId: auth.user.organizationId, status: "ACTIVE" } });
  if (await prisma.hrEmployeeLeavePolicy.count({ where: { leavePolicyId: policy.id, status: "ACTIVE" } })) throw new Error("End active employee policy assignments before archiving this policy.");
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.hrLeavePolicy.update({ where: { id: policy.id }, data: { status: "ARCHIVED", effectiveTo: policy.effectiveTo ?? (policy.effectiveFrom < now ? now : null) } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLeavePolicy", entityId: policy.id, action: "hr.leave.policy.archived", previousValues: { status: policy.status }, newValues: { status: "ARCHIVED" }, reason: input.reason });
  });
  revalidatePath("/hr/admin/leave");
  revalidatePath("/hr/admin/leave/policies");
}

const endAssignmentInput = z.object({ id: z.string().cuid(), effectiveTo: z.coerce.date(), reason: z.string().trim().min(3).max(500) });
export async function endEmployeeLeavePolicyAction(formData: FormData) {
  const auth = await requirePermission("leave.policy.manage");
  const input = endAssignmentInput.parse(Object.fromEntries(formData));
  const assignment = await prisma.hrEmployeeLeavePolicy.findFirstOrThrow({ where: { id: input.id, status: "ACTIVE", employee: { organizationId: auth.user.organizationId } } });
  if (input.effectiveTo <= assignment.effectiveFrom) throw new Error("Assignment end must be after its start.");
  await prisma.$transaction(async (tx) => {
    await tx.hrEmployeeLeavePolicy.update({ where: { id: assignment.id }, data: { status: "ENDED", effectiveTo: input.effectiveTo, endedById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployeeLeavePolicy", entityId: assignment.id, action: "hr.leave.policy.assignment.ended", previousValues: { status: assignment.status }, newValues: { status: "ENDED", effectiveTo: input.effectiveTo }, reason: input.reason });
  });
  revalidatePath("/hr/admin/leave");
  revalidatePath("/hr/admin/leave/policies");
}
