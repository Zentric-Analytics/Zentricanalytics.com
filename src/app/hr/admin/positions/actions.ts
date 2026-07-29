"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { positionInput } from "@/lib/hr/core/invariants";
import { requirePermission } from "@/lib/hr/permissions/authorize";

export async function createPositionAction(formData: FormData) {
  const auth = await requirePermission("position.manage");
  const input = positionInput.parse(Object.fromEntries(formData));
  const department = await prisma.hrDepartment.findFirstOrThrow({ where: { id: input.departmentId, organizationId: auth.user.organizationId, status: "ACTIVE" } });
  if (input.teamId) await prisma.hrTeam.findFirstOrThrow({ where: { id: input.teamId, departmentId: department.id, organizationId: auth.user.organizationId, status: "ACTIVE" } });
  await prisma.$transaction(async (tx) => {
    const position = await tx.hrPosition.create({ data: { ...input, organizationId: auth.user.organizationId } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrPosition", entityId: position.id, action: "hr.position.created", newValues: input });
  });
  revalidatePath("/hr/admin/positions");
}

export async function archivePositionAction(formData: FormData) {
  const auth = await requirePermission("position.manage");
  const id = z.string().cuid().parse(formData.get("id"));
  const reason = z.string().trim().min(3).max(500).parse(formData.get("reason"));
  const position = await prisma.hrPosition.findFirstOrThrow({ where: { id, organizationId: auth.user.organizationId } });
  if (position.status === "ARCHIVED") return;
  if (await prisma.hrEmployeeAssignment.count({ where: { positionId: id, status: "ACTIVE", OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] } })) throw new Error("End or transfer active assignments before archiving this position.");
  await prisma.$transaction(async (tx) => {
    await tx.hrPosition.update({ where: { id }, data: { status: "ARCHIVED", archivedAt: new Date() } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrPosition", entityId: id, action: "hr.position.archived", previousValues: { status: position.status }, newValues: { status: "ARCHIVED" }, reason });
  });
  revalidatePath("/hr/admin/positions");
}
