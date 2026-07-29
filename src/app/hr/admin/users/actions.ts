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

const createSchema = z.object({ email: z.string().email().max(180), role: z.enum(["ADMIN","HR_ADMIN","PAYROLL_ADMIN","EMPLOYEE"]) });
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
  const target = await prisma.hrUser.findFirstOrThrow({ where: { id: userId, organizationId: auth.user.organizationId } });
  await prisma.$transaction(async (tx) => {
    await tx.hrUser.update({ where: { id: target.id }, data: { status: "SUSPENDED", suspendedAt: new Date() } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrUser", entityId: target.id, action: "hr.user.suspended", previousValues: { status: target.status }, newValues: { status: "SUSPENDED" } });
  });
  await revokeAllHrSessions(target.id);
  revalidatePath("/hr/admin/users");
}
