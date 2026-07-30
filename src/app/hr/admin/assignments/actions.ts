"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { assignmentInput, wouldCreateSupervisorCycle } from "@/lib/hr/core/invariants";
import { requirePermission } from "@/lib/hr/permissions/authorize";

export async function createEmployeeAssignmentAction(formData: FormData) {
  const auth = await requirePermission("assignment.create");
  const input = assignmentInput.parse(Object.fromEntries(formData));
  const [employee, department, position] = await Promise.all([
    prisma.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: auth.user.organizationId, employmentStatus: { notIn: ["TERMINATED", "ARCHIVED"] } } }),
    prisma.hrDepartment.findFirstOrThrow({ where: { id: input.departmentId, organizationId: auth.user.organizationId, status: "ACTIVE" } }),
    prisma.hrPosition.findFirstOrThrow({ where: { id: input.positionId, organizationId: auth.user.organizationId, status: "ACTIVE" } }),
  ]);
  if (position.departmentId !== department.id) throw new Error("The selected position does not belong to the selected department.");
  if ((position.teamId ?? undefined) !== input.teamId) throw new Error("The selected team must match the position’s team.");
  const current = await prisma.hrEmployeeAssignment.findFirst({ where: { organizationId: auth.user.organizationId, employeeId: employee.id, status: "ACTIVE", OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveFrom } }] }, orderBy: { effectiveFrom: "desc" } });
  if (current && current.effectiveFrom >= input.effectiveFrom) throw new Error("The new assignment must begin after the current assignment began.");
  await prisma.$transaction(async (tx) => {
    if (current) await tx.hrEmployeeAssignment.update({ where: { id: current.id }, data: { effectiveTo: input.effectiveFrom, status: "ENDED", endedAt: new Date(), endedById: auth.user.id } });
    const assignment = await tx.hrEmployeeAssignment.create({ data: { ...input, organizationId: auth.user.organizationId, createdById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployeeAssignment", entityId: assignment.id, action: current ? "hr.employee.transferred" : "hr.employee.assignment.created", previousValues: current ? { assignmentId: current.id, departmentId: current.departmentId, positionId: current.positionId } : undefined, newValues: input, reason: input.reason });
  });
  revalidatePath("/hr/admin/assignments");
  revalidatePath(`/hr/admin/employees/${employee.id}`);
}

export async function endEmployeeAssignmentAction(formData: FormData) {
  const auth = await requirePermission("assignment.end");
  const id = z.string().cuid().parse(formData.get("id"));
  const reason = z.string().trim().min(3).max(500).parse(formData.get("reason"));
  const effectiveTo = z.coerce.date().parse(formData.get("effectiveTo"));
  const assignment = await prisma.hrEmployeeAssignment.findFirstOrThrow({ where: { id, organizationId: auth.user.organizationId, status: "ACTIVE" } });
  if (effectiveTo <= assignment.effectiveFrom) throw new Error("Assignment end must be after its start date.");
  await prisma.$transaction(async (tx) => {
    await tx.hrEmployeeAssignment.update({ where: { id }, data: { effectiveTo, status: "ENDED", endedAt: new Date(), endedById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployeeAssignment", entityId: id, action: "hr.employee.assignment.ended", previousValues: { status: assignment.status, effectiveTo: assignment.effectiveTo }, newValues: { status: "ENDED", effectiveTo }, reason });
  });
  revalidatePath("/hr/admin/assignments");
  revalidatePath(`/hr/admin/employees/${assignment.employeeId}`);
}

const supervisorInput = z.object({
  supervisorEmployeeId: z.string().cuid(),
  assignedEmployeeId: z.string().cuid(),
  effectiveFrom: z.coerce.date(),
  reason: z.string().trim().min(3).max(500),
});

export async function createSupervisorAssignmentAction(formData: FormData) {
  const auth = await requirePermission("supervisor.assign");
  const input = supervisorInput.parse(Object.fromEntries(formData));
  const employees = await prisma.hrEmployee.findMany({ where: { organizationId: auth.user.organizationId, id: { in: [input.supervisorEmployeeId, input.assignedEmployeeId] }, employmentStatus: { notIn: ["TERMINATED", "ARCHIVED"] } }, select: { id: true } });
  if (employees.length !== 2) throw new Error("Both supervisor and employee must be active records in this organization.");
  const active = await prisma.hrSupervisorAssignment.findMany({ where: { organizationId: auth.user.organizationId, assignmentType: "DIRECT_REPORT", status: "ACTIVE", OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveFrom } }] }, select: { id: true, supervisorEmployeeId: true, assignedEmployeeId: true, effectiveFrom: true } });
  if (wouldCreateSupervisorCycle(active, input.supervisorEmployeeId, input.assignedEmployeeId)) throw new Error("This supervisor assignment would create a reporting cycle.");
  const current = active.find((assignment) => assignment.assignedEmployeeId === input.assignedEmployeeId);
  if (current && current.effectiveFrom >= input.effectiveFrom) throw new Error("The new supervisor assignment must begin after the current one.");
  await prisma.$transaction(async (tx) => {
    if (current) await tx.hrSupervisorAssignment.update({ where: { id: current.id }, data: { status: "ENDED", effectiveTo: input.effectiveFrom, endedAt: new Date(), endedByUserId: auth.user.id, endReason: `Reassigned: ${input.reason}` } });
    const assignment = await tx.hrSupervisorAssignment.create({ data: { organizationId: auth.user.organizationId, supervisorEmployeeId: input.supervisorEmployeeId, assignedEmployeeId: input.assignedEmployeeId, assignmentType: "DIRECT_REPORT", effectiveFrom: input.effectiveFrom, capabilities: ["supervisor.read_team", "supervisor.review_assigned"], assignedByUserId: auth.user.id, reason: input.reason } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrSupervisorAssignment", entityId: assignment.id, action: current ? "hr.supervisor.reassigned" : "hr.supervisor.assigned", previousValues: current ? { assignmentId: current.id, supervisorEmployeeId: current.supervisorEmployeeId } : undefined, newValues: input, reason: input.reason });
  });
  revalidatePath("/hr/admin/assignments");
}

export async function endSupervisorAssignmentAction(formData: FormData) {
  const auth = await requirePermission("supervisor.revoke");
  const id = z.string().cuid().parse(formData.get("id"));
  const reason = z.string().trim().min(3).max(500).parse(formData.get("reason"));
  const assignment = await prisma.hrSupervisorAssignment.findFirstOrThrow({ where: { id, organizationId: auth.user.organizationId, status: "ACTIVE" } });
  const effectiveTo = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.hrSupervisorAssignment.update({ where: { id }, data: { status: "ENDED", effectiveTo, endedAt: effectiveTo, endedByUserId: auth.user.id, endReason: reason } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrSupervisorAssignment", entityId: id, action: "hr.supervisor.assignment.ended", previousValues: { status: assignment.status }, newValues: { status: "ENDED", effectiveTo }, reason });
  });
  revalidatePath("/hr/admin/assignments");
}
