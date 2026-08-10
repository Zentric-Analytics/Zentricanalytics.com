"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { createHrInvitation } from "@/lib/hr/auth/invitations";
import { normalizeHrEmail } from "@/lib/hr/auth/crypto";
import { canAssignRole } from "@/lib/hr/permissions/catalog";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { revokeAllHrSessions } from "@/lib/hr/auth/session";
import { userDeletionErrorMessage } from "@/lib/hr/users/deletion-errors";
import { releaseHrUserReferencesForDeletion } from "@/lib/hr/users/hard-delete";

export type HrUserDeletionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

function requirePrimaryAdmin(auth: { roles: string[]; user: { isPrimaryAdmin: boolean } }) {
  if (!auth.user.isPrimaryAdmin || !auth.roles.includes("ADMIN")) {
    throw new Error("Only the primary administrator can perform this action.");
  }
}

const createSchema = z.object({ email: z.string().email().max(180), role: z.enum(["ADMIN","HR_ADMIN","PAYROLL_ADMIN","EMPLOYEE","AUDITOR"]) });
export async function createHrUserAction(formData: FormData) {
  const auth = await requirePermission("user.create");
  const input = createSchema.parse(Object.fromEntries(formData));
  if (!canAssignRole(auth.roles, input.role)) throw new Error("Forbidden role assignment.");
  const email = normalizeHrEmail(input.email);
  const role = await prisma.hrRole.findUniqueOrThrow({ where: { organizationId_key: { organizationId: auth.user.organizationId, key: input.role } } });
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.hrUser.create({ data: { organizationId: auth.user.organizationId, email } });
    await tx.hrUserRole.create({ data: { userId: created.id, roleId: role.id, assignedById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrUser", entityId: created.id, action: "hr.user.created", newValues: { email, role: input.role } });
    return created;
  });
  await createHrInvitation({ organizationId: auth.user.organizationId, userId: user.id, createdById: auth.user.id, recipient: email });
  revalidatePath("/hr/admin/users");
}

export async function suspendHrUserAction(formData: FormData) {
  const auth = await requirePermission("user.suspend");
  const userId = z.string().min(1).parse(formData.get("userId"));
  if (userId === auth.user.id) throw new Error("You cannot suspend your current account.");
  const target = await prisma.hrUser.findFirstOrThrow({ where: { id: userId, organizationId: auth.user.organizationId }, include: { roles: { where: { revokedAt: null }, include: { role: true } } } });
  const targetIsAdmin = target.roles.some(({ role }) => role.key === "ADMIN");
  if (targetIsAdmin && !auth.roles.includes("ADMIN")) throw new Error("Only an ADMIN can suspend another ADMIN.");
  await prisma.$transaction(async (tx) => {
    if (targetIsAdmin) {
      const activeAdmins = await tx.hrUserRole.count({ where: { revokedAt: null, role: { organizationId: auth.user.organizationId, key: "ADMIN" }, user: { status: "ACTIVE" } } });
      if (activeAdmins <= 1) throw new Error("The final active ADMIN cannot be suspended.");
    }
    await tx.hrUser.update({ where: { id: target.id }, data: { status: "SUSPENDED", suspendedAt: new Date() } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrUser", entityId: target.id, action: "hr.user.suspended", previousValues: { status: target.status }, newValues: { status: "SUSPENDED" } });
  });
  await revokeAllHrSessions(target.id);
  revalidatePath("/hr/admin/users");
}

export async function reactivateHrUserAction(formData: FormData) {
  const auth = await requirePermission("user.update");
  const userId = z.string().cuid().parse(formData.get("userId"));
  const target = await prisma.hrUser.findFirstOrThrow({ where: { id: userId, organizationId: auth.user.organizationId, status: { in: ["SUSPENDED", "DISABLED"] } } });
  await prisma.$transaction(async (tx) => {
    await tx.hrUser.update({ where: { id: target.id }, data: { status: target.passwordHash ? "ACTIVE" : "INVITED", suspendedAt: null } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrUser", entityId: target.id, action: "hr.user.reactivated", previousValues: { status: target.status }, newValues: { status: target.passwordHash ? "ACTIVE" : "INVITED" } });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/users");
}

const roleChangeSchema = z.object({ userId: z.string().cuid(), role: z.enum(["ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "EMPLOYEE", "AUDITOR"]) });
export async function assignHrRoleAction(formData: FormData) {
  const auth = await requirePermission("user.role.assign");
  const input = roleChangeSchema.parse(Object.fromEntries(formData));
  if (!canAssignRole(auth.roles, input.role)) throw new Error("Forbidden role assignment.");
  const [target, role] = await Promise.all([
    prisma.hrUser.findFirstOrThrow({ where: { id: input.userId, organizationId: auth.user.organizationId } }),
    prisma.hrRole.findUniqueOrThrow({ where: { organizationId_key: { organizationId: auth.user.organizationId, key: input.role } } }),
  ]);
  await prisma.$transaction(async (tx) => {
    await tx.hrUserRole.upsert({ where: { userId_roleId: { userId: target.id, roleId: role.id } }, update: { revokedAt: null, assignedById: auth.user.id, assignedAt: new Date() }, create: { userId: target.id, roleId: role.id, assignedById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrUserRole", entityId: target.id, action: "hr.user.role.assigned", newValues: { userId: target.id, role: input.role } });
  });
  await revokeAllHrSessions(target.id);
  revalidatePath("/hr/admin/users");
}

export async function revokeHrRoleAction(formData: FormData) {
  const auth = await requirePermission("user.role.revoke");
  const input = roleChangeSchema.parse(Object.fromEntries(formData));
  if (!canAssignRole(auth.roles, input.role)) throw new Error("Forbidden role revocation.");
  const role = await prisma.hrRole.findUniqueOrThrow({ where: { organizationId_key: { organizationId: auth.user.organizationId, key: input.role } } });
  await prisma.$transaction(async (tx) => {
    const assignment = await tx.hrUserRole.findFirstOrThrow({ where: { userId: input.userId, roleId: role.id, revokedAt: null, user: { organizationId: auth.user.organizationId } } });
    if (input.role === "ADMIN") {
      const activeAdmins = await tx.hrUserRole.count({ where: { roleId: role.id, revokedAt: null, user: { status: "ACTIVE" } } });
      if (activeAdmins <= 1) throw new Error("The final active ADMIN role cannot be revoked.");
    }
    await tx.hrUserRole.update({ where: { id: assignment.id }, data: { revokedAt: new Date() } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrUserRole", entityId: assignment.id, action: "hr.user.role.revoked", previousValues: { userId: input.userId, role: input.role, revokedAt: null }, newValues: { revoked: true } });
  }, { isolationLevel: "Serializable" });
  await revokeAllHrSessions(input.userId);
  revalidatePath("/hr/admin/users");
}

export async function resendHrInvitationAction(formData: FormData) {
  const auth = await requirePermission("user.invite");
  const userId = z.string().cuid().parse(formData.get("userId"));
  const target = await prisma.hrUser.findFirstOrThrow({ where: { id: userId, organizationId: auth.user.organizationId, status: "INVITED" } });
  await createHrInvitation({ organizationId: auth.user.organizationId, userId: target.id, createdById: auth.user.id, recipient: target.email });
  revalidatePath("/hr/admin/users");
}

export async function cancelHrInvitationAction(formData: FormData) {
  const auth = await requirePermission("user.invite");
  requirePrimaryAdmin(auth);
  const userId = z.string().cuid().parse(formData.get("userId"));
  const target = await prisma.hrUser.findFirstOrThrow({ where: { id: userId, organizationId: auth.user.organizationId, status: "INVITED" } });
  await prisma.$transaction(async (tx) => {
    const cancelled = await tx.hrAccountInvitation.updateMany({
      where: { organizationId: auth.user.organizationId, userId: target.id, status: "ACTIVE", usedAt: null },
      data: { status: "REVOKED" },
    });
    if (!cancelled.count) throw new Error("There is no active invitation to cancel.");
    await appendHrAudit(tx, {
      organizationId: auth.user.organizationId,
      actorUserId: auth.user.id,
      actorRole: auth.roles[0],
      entityType: "HrAccountInvitation",
      entityId: target.id,
      action: "hr.invitation.cancelled",
      newValues: { userId: target.id, invitationsCancelled: cancelled.count },
      reason: "Cancelled by primary administrator",
    });
  });
  revalidatePath("/hr/admin/users");
}

export async function deleteHrInvitationAction(formData: FormData) {
  const auth = await requirePermission("user.invite");
  requirePrimaryAdmin(auth);
  const userId = z.string().cuid().parse(formData.get("userId"));
  const target = await prisma.hrUser.findFirstOrThrow({ where: { id: userId, organizationId: auth.user.organizationId, status: "INVITED" } });
  await prisma.$transaction(async (tx) => {
    const active = await tx.hrAccountInvitation.count({ where: { organizationId: auth.user.organizationId, userId: target.id, status: "ACTIVE", usedAt: null } });
    if (active) throw new Error("Cancel the active invitation before deleting it.");
    const deleted = await tx.hrAccountInvitation.deleteMany({ where: { organizationId: auth.user.organizationId, userId: target.id, status: { in: ["REVOKED", "USED"] } } });
    if (!deleted.count) throw new Error("There is no cancelled invitation to delete.");
    await appendHrAudit(tx, {
      organizationId: auth.user.organizationId,
      actorUserId: auth.user.id,
      actorRole: auth.roles[0],
      entityType: "HrAccountInvitation",
      entityId: target.id,
      action: "hr.invitation.deleted",
      previousValues: { userId: target.id, invitationsDeleted: deleted.count },
      reason: "Deleted by primary administrator after cancellation",
    });
  });
  revalidatePath("/hr/admin/users");
}

export async function softDeleteHrUserAction(formData: FormData) {
  const auth = await requirePermission("user.update");
  requirePrimaryAdmin(auth);
  const userId = z.string().cuid().parse(formData.get("userId"));
  const reason = z.string().trim().min(3).max(500).parse(formData.get("reason"));
  if (userId === auth.user.id) throw new Error("The primary administrator cannot delete their own account.");
  const target = await prisma.hrUser.findFirstOrThrow({ where: { id: userId, organizationId: auth.user.organizationId, isPrimaryAdmin: false, status: { not: "DELETED" } } });
  await prisma.$transaction(async (tx) => {
    await tx.hrAccountInvitation.updateMany({ where: { userId: target.id, status: "ACTIVE" }, data: { status: "REVOKED" } });
    await tx.hrUserRole.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.hrUser.update({
      where: { id: target.id },
      data: { status: "DELETED", deletedAt: new Date(), deletedById: auth.user.id, suspendedAt: new Date() },
    });
    await appendHrAudit(tx, {
      organizationId: auth.user.organizationId,
      actorUserId: auth.user.id,
      actorRole: auth.roles[0],
      entityType: "HrUser",
      entityId: target.id,
      action: "hr.user.soft_deleted",
      previousValues: { status: target.status, email: target.email },
      newValues: { status: "DELETED" },
      reason,
    });
  }, { isolationLevel: "Serializable" });
  await revokeAllHrSessions(target.id);
  revalidatePath("/hr/admin/users");
}

export async function softDeleteHrUserWithStateAction(
  _previousState: HrUserDeletionState,
  formData: FormData,
): Promise<HrUserDeletionState> {
  try {
    await softDeleteHrUserAction(formData);
    return { status: "success", message: "The user was soft-deleted." };
  } catch (error) {
    return { status: "error", message: userDeletionErrorMessage(error) };
  }
}

export async function hardDeleteHrUserAction(formData: FormData) {
  const auth = await requirePermission("user.update");
  requirePrimaryAdmin(auth);
  const userId = z.string().cuid().parse(formData.get("userId"));
  const reason = z.string().trim().min(3).max(500).parse(formData.get("reason"));
  const target = await prisma.hrUser.findFirstOrThrow({
    where: { id: userId, organizationId: auth.user.organizationId, status: "DELETED", isPrimaryAdmin: false },
  });
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('zentric.primary_admin_hard_delete', 'on', true)`;
      await tx.hrAccountInvitation.deleteMany({ where: { userId: target.id } });
      await appendHrAudit(tx, {
        organizationId: auth.user.organizationId,
        actorUserId: auth.user.id,
        actorRole: auth.roles[0],
        entityType: "HrUser",
        entityId: target.id,
        action: "hr.user.hard_deleted",
        previousValues: { status: target.status, email: target.email, deletedAt: target.deletedAt },
        newValues: { status: "PERMANENTLY_DELETED", retainedOwnershipTransferredTo: auth.user.id },
        reason,
      });
      const releasedReferences = await releaseHrUserReferencesForDeletion(tx, target.id, auth.user.id);
      await appendHrAudit(tx, {
        organizationId: auth.user.organizationId,
        actorUserId: auth.user.id,
        actorRole: auth.roles[0],
        entityType: "HrUser",
        entityId: target.id,
        action: "hr.user.retained_references_released",
        previousValues: { userId: target.id },
        newValues: releasedReferences,
        reason,
      });
      await tx.hrUser.delete({ where: { id: target.id } });
    }, { isolationLevel: "Serializable", timeout: 30_000 });
  } catch {
    throw new Error("The permanent deletion could not be completed.");
  }
  revalidatePath("/hr/admin/users");
}

export async function hardDeleteHrUserWithStateAction(
  _previousState: HrUserDeletionState,
  formData: FormData,
): Promise<HrUserDeletionState> {
  try {
    await hardDeleteHrUserAction(formData);
    return { status: "success", message: "The user was permanently deleted from the database." };
  } catch (error) {
    return { status: "error", message: userDeletionErrorMessage(error) };
  }
}

const employeeLinkSchema = z.object({ userId: z.string().cuid(), employeeId: z.string().cuid().optional().or(z.literal("")).transform((value) => value || undefined) });
export async function linkHrUserEmployeeAction(formData: FormData) {
  const auth = await requirePermission("user.update");
  const input = employeeLinkSchema.parse(Object.fromEntries(formData));
  const target = await prisma.hrUser.findFirstOrThrow({ where: { id: input.userId, organizationId: auth.user.organizationId } });
  if (input.employeeId) await prisma.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: auth.user.organizationId } });
  const previous = await prisma.hrEmployee.findFirst({ where: { userId: target.id }, select: { id: true } });
  await prisma.$transaction(async (tx) => {
    if (previous) await tx.hrEmployee.update({ where: { id: previous.id }, data: { userId: null } });
    if (input.employeeId) await tx.hrEmployee.update({ where: { id: input.employeeId }, data: { userId: target.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrUser", entityId: target.id, action: "hr.user.employee_link.updated", previousValues: { employeeId: previous?.id }, newValues: { employeeId: input.employeeId } });
  });
  revalidatePath("/hr/admin/users");
}

const resetMfaSchema = z.object({ userId: z.string().cuid(), reason: z.string().trim().min(3).max(500) });
export async function resetHrUserMfaAction(formData: FormData) {
  const auth = await requirePermission("user.update");
  if (!auth.roles.includes("ADMIN")) throw new Error("Only an ADMIN can reset MFA.");
  const input = resetMfaSchema.parse(Object.fromEntries(formData));
  if (input.userId === auth.user.id) throw new Error("Use account security to manage your own MFA.");
  const target = await prisma.hrUser.findFirstOrThrow({ where: { id: input.userId, organizationId: auth.user.organizationId, mfaEnabled: true } });
  await prisma.$transaction(async (tx) => {
    await tx.hrUser.update({ where: { id: target.id }, data: { mfaEnabled: false, mfaSecretEncrypted: null, mfaLastUsedStep: null } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrUser", entityId: target.id, action: "hr.auth.mfa.admin_reset", reason: input.reason, previousValues: { mfaEnabled: true }, newValues: { mfaEnabled: false } });
  });
  await revokeAllHrSessions(target.id);
  revalidatePath("/hr/admin/users");
}
