"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { departmentInput } from "@/lib/hr/core/invariants";
import { requirePermission } from "@/lib/hr/permissions/authorize";

export async function createDepartmentAction(formData: FormData) {
  const auth = await requirePermission("department.manage");
  const input = departmentInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => {
    const department = await tx.hrDepartment.create({ data: { ...input, organizationId: auth.user.organizationId } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrDepartment", entityId: department.id, action: "hr.department.created", newValues: input });
  });
  revalidatePath("/hr/admin/departments");
}

export async function archiveDepartmentAction(formData: FormData) {
  const auth = await requirePermission("department.manage");
  const id = z.string().cuid().parse(formData.get("id"));
  const reason = z.string().trim().min(3).max(500).parse(formData.get("reason"));
  const department = await prisma.hrDepartment.findFirstOrThrow({ where: { id, organizationId: auth.user.organizationId } });
  if (department.status === "ARCHIVED") return;
  const activeAssignments = await prisma.hrEmployeeAssignment.count({ where: { departmentId: id, status: "ACTIVE", OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] } });
  if (activeAssignments) throw new Error("Move or end active employee assignments before archiving this department.");
  await prisma.$transaction(async (tx) => {
    await tx.hrDepartment.update({ where: { id }, data: { status: "ARCHIVED", archivedAt: new Date() } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrDepartment", entityId: id, action: "hr.department.archived", previousValues: { status: department.status }, newValues: { status: "ARCHIVED" }, reason });
  });
  revalidatePath("/hr/admin/departments");
}

const teamInput = z.object({ departmentId: z.string().cuid(), code: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9_-]+$/).transform((value) => value.toUpperCase()), name: z.string().trim().min(2).max(120), description: z.string().trim().max(500).optional().transform((value) => value || undefined) });
export async function createTeamAction(formData: FormData) {
  const auth = await requirePermission("department.manage");
  const input = teamInput.parse(Object.fromEntries(formData));
  await prisma.hrDepartment.findFirstOrThrow({ where: { id: input.departmentId, organizationId: auth.user.organizationId, status: "ACTIVE" } });
  await prisma.$transaction(async (tx) => {
    const team = await tx.hrTeam.create({ data: { ...input, organizationId: auth.user.organizationId } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrTeam", entityId: team.id, action: "hr.team.created", newValues: input });
  });
  revalidatePath("/hr/admin/departments");
}

export async function archiveTeamAction(formData: FormData) {
  const auth = await requirePermission("department.manage");
  const id = z.string().cuid().parse(formData.get("id"));
  const reason = z.string().trim().min(3).max(500).parse(formData.get("reason"));
  const team = await prisma.hrTeam.findFirstOrThrow({ where: { id, organizationId: auth.user.organizationId } });
  if (await prisma.hrEmployeeAssignment.count({ where: { teamId: id, status: "ACTIVE", OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] } })) throw new Error("Move active employee assignments before archiving this team.");
  await prisma.$transaction(async (tx) => {
    await tx.hrTeam.update({ where: { id }, data: { status: "ARCHIVED", archivedAt: new Date() } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrTeam", entityId: id, action: "hr.team.archived", previousValues: { status: team.status }, newValues: { status: "ARCHIVED" }, reason });
  });
  revalidatePath("/hr/admin/departments");
}
