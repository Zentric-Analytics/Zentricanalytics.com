"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { positionInput } from "@/lib/hr/core/invariants";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { changePositionState, decidePosition, submitPosition } from "@/lib/hr/organization/position-commands";

export async function createPositionAction(formData: FormData) {
  const auth = await requirePermission("position.manage");
  const input = positionInput.parse(Object.fromEntries(formData));
  const organizationId = auth.user.organizationId;
  const [department, legalEntity, businessUnit, division, location, costCenter, jobProfile, grade] = await Promise.all([
    prisma.hrDepartment.findFirstOrThrow({ where: { id: input.departmentId, organizationId, status: "ACTIVE" } }),
    prisma.hrLegalEntity.findUniqueOrThrow({ where: { organizationId_code: { organizationId, code: "DEFAULT" } } }),
    prisma.hrBusinessUnit.findUniqueOrThrow({ where: { organizationId_code: { organizationId, code: "DEFAULT" } } }),
    prisma.hrDivision.findUniqueOrThrow({ where: { organizationId_code: { organizationId, code: "DEFAULT" } } }),
    prisma.hrLocation.findUniqueOrThrow({ where: { organizationId_code: { organizationId, code: "DEFAULT" } } }),
    prisma.hrCostCenter.findUniqueOrThrow({ where: { organizationId_code: { organizationId, code: "DEFAULT" } } }),
    prisma.hrJobProfile.findUniqueOrThrow({ where: { organizationId_code: { organizationId, code: "DEFAULT" } } }),
    prisma.hrGrade.findUniqueOrThrow({ where: { organizationId_code: { organizationId, code: "DEFAULT" } } }),
  ]);
  if (input.teamId) await prisma.hrTeam.findFirstOrThrow({ where: { id: input.teamId, departmentId: department.id, organizationId: auth.user.organizationId, status: "ACTIVE" } });
  await prisma.$transaction(async (tx) => {
    const position = await tx.hrPosition.create({ data: {
      ...input,
      organizationId,
      legalEntityId: legalEntity.id,
      businessUnitId: businessUnit.id,
      divisionId: division.id,
      locationId: location.id,
      costCenterId: costCenter.id,
      jobProfileId: jobProfile.id,
      gradeId: grade.id,
    } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrPosition", entityId: position.id, action: "hr.position.created", newValues: input });
  });
  revalidatePath("/hr/admin/positions");
}

const positionDecisionInput = z.object({ id: z.string().cuid(), reason: z.string().trim().min(3).max(500) });
export async function submitPositionAction(formData: FormData) {
  const auth = await requirePermission("organization.position.create");
  const input = positionDecisionInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(tx => submitPosition(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0] }, { positionId: input.id, reason: input.reason }), { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/positions");
}

export async function approvePositionAction(formData: FormData) {
  const auth = await requirePermission("organization.position.approve");
  const input = positionDecisionInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(tx => decidePosition(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0] }, { positionId: input.id, approve: true, reason: input.reason }), { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/positions");
}

export async function rejectPositionAction(formData: FormData) {
  const auth = await requirePermission("organization.position.approve");
  const input = positionDecisionInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(tx => decidePosition(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0] }, { positionId: input.id, approve: false, reason: input.reason }), { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/positions");
}

export async function openPositionAction(formData: FormData) {
  const auth = await requirePermission("organization.position.manage_state");
  const input = positionDecisionInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(tx => changePositionState(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0] }, { positionId: input.id, target: "OPEN", reason: input.reason }), { isolationLevel: "Serializable" });
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

const updatePositionInput = z.intersection(positionInput, z.object({ id: z.string().cuid(), reason: z.string().trim().min(3).max(500) }));
export async function updatePositionAction(formData: FormData) {
  const auth = await requirePermission("position.manage");
  const { id, reason, ...input } = updatePositionInput.parse(Object.fromEntries(formData));
  const [position, department] = await Promise.all([
    prisma.hrPosition.findFirstOrThrow({ where: { id, organizationId: auth.user.organizationId, status: "ACTIVE" } }),
    prisma.hrDepartment.findFirstOrThrow({ where: { id: input.departmentId, organizationId: auth.user.organizationId, status: "ACTIVE" } }),
  ]);
  if (input.teamId) await prisma.hrTeam.findFirstOrThrow({ where: { id: input.teamId, departmentId: department.id, organizationId: auth.user.organizationId, status: "ACTIVE" } });
  await prisma.$transaction(async (tx) => {
    await tx.hrPosition.update({ where: { id }, data: input });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrPosition", entityId: id, action: "hr.position.updated", previousValues: { title: position.title, departmentId: position.departmentId, teamId: position.teamId, description: position.description, salaryBandMinimum: position.salaryBandMinimum?.toString(), salaryBandMaximum: position.salaryBandMaximum?.toString(), currency: position.currency }, newValues: input, reason });
  });
  revalidatePath("/hr/admin/positions");
}
