import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { appendHrAudit } from "../audit";

type Client = Prisma.TransactionClient;

export async function updateOnboardingTask(
  tx: Client,
  input: {
    organizationId: string;
    taskId: string;
    actorUserId: string;
    actorRole?: string;
    to: "IN_PROGRESS" | "COMPLETED" | "PENDING" | "CANCELLED";
    notes: string;
    evidenceReference?: string;
    assignedUserId?: string;
    dueAt?: Date;
  },
) {
  const task = await tx.hrLifecycleTask.findFirstOrThrow({
    where: { id: input.taskId, organizationId: input.organizationId, instance: { type: "ONBOARDING" } },
    include: { instance: { include: { tasks: true } } },
  });
  if (task.status === "COMPLETED" && input.to !== "PENDING") throw new Error("Completed tasks may only be reopened.");
  if (input.to === "COMPLETED") {
    if (task.required && !input.notes.trim()) throw new Error("Completion notes are required.");
    const incompleteDependencies = task.predecessorKeys.filter((key) => {
      const dependency = task.instance.tasks.find((item) => item.templateTaskKey === key);
      return !dependency || dependency.status !== "COMPLETED";
    });
    if (incompleteDependencies.length) {
      throw new Error(`Complete dependencies first: ${incompleteDependencies.join(", ")}.`);
    }
  }
  if (input.assignedUserId) {
    await tx.hrUser.findFirstOrThrow({
      where: { id: input.assignedUserId, organizationId: input.organizationId, status: "ACTIVE" },
    });
  }
  await tx.hrLifecycleTask.update({
    where: { id: task.id },
    data: {
      status: input.to,
      completionNotes: input.notes,
      evidenceReference: input.evidenceReference || task.evidenceReference,
      assignedUserId: input.assignedUserId || task.assignedUserId,
      dueAt: input.dueAt || task.dueAt,
      completedAt: input.to === "COMPLETED" ? new Date() : null,
      completedById: input.to === "COMPLETED" ? input.actorUserId : null,
    },
  });
  const remaining = await tx.hrLifecycleTask.count({
    where: { instanceId: task.instanceId, required: true, status: { not: "COMPLETED" } },
  });
  if (!remaining) {
    await tx.hrEmployee.updateMany({
      where: { id: task.instance.employeeId, organizationId: input.organizationId, employmentStatus: "PRE_HIRE" },
      data: { employmentStatus: "READY_FOR_START" },
    });
  }
  await appendHrAudit(tx, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    entityType: "HrLifecycleTask",
    entityId: task.id,
    action: `hr.recruitment.onboarding_task.${input.to.toLowerCase()}`,
    previousValues: { status: task.status },
    newValues: { status: input.to, evidenceReference: input.evidenceReference },
    reason: input.notes,
    correlationId: crypto.randomUUID(),
  });
}

export async function changePreHireState(
  tx: Client,
  input: {
    organizationId: string;
    employeeId: string;
    actorUserId: string;
    actorRole?: string;
    to: "ON_HOLD" | "PRE_HIRE" | "CANCELLED";
    reason: string;
    startDate?: Date;
  },
) {
  const employee = await tx.hrEmployee.findFirstOrThrow({
    where: { id: input.employeeId, organizationId: input.organizationId, employmentStatus: { in: ["PRE_HIRE", "READY_FOR_START", "ON_HOLD"] } },
  });
  await tx.hrEmployee.update({
    where: { id: employee.id },
    data: { employmentStatus: input.to, startDate: input.startDate ?? employee.startDate },
  });
  if (input.startDate) {
    await tx.hrEmployeeAssignment.updateMany({
      where: { employeeId: employee.id, organizationId: input.organizationId, status: "ACTIVE" },
      data: { effectiveFrom: input.startDate },
    });
  }
  await appendHrAudit(tx, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    entityType: "HrEmployee",
    entityId: employee.id,
    action: `hr.recruitment.prehire.${input.to.toLowerCase()}`,
    previousValues: { employmentStatus: employee.employmentStatus, startDate: employee.startDate },
    newValues: { employmentStatus: input.to, startDate: input.startDate ?? employee.startDate },
    reason: input.reason,
    correlationId: crypto.randomUUID(),
  });
}
