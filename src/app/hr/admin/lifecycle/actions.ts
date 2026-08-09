"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { completeLifecycleTaskInput, dueDate, lifecycleType, STANDARD_LIFECYCLE_TASKS, startLifecycleInput, taskIsUnblocked } from "@/lib/hr/lifecycle/definitions";
import { activeSupervisorForEmployee } from "@/lib/hr/supervisors/scope";
import { createSeparationCase } from "@/lib/hr/workforce/lifecycle-commands";

const paths = ["/hr/admin/lifecycle", "/hr/employee/tasks", "/hr/supervisor/onboarding", "/hr/supervisor/tasks"];
function refresh() { paths.forEach((path) => revalidatePath(path)); }

export async function createStandardLifecycleTemplateAction(formData: FormData) {
  const auth = await requirePermission("workflow.create");
  const type = lifecycleType.parse(formData.get("type"));
  const name = `${type === "ONBOARDING" ? "Standard onboarding" : "Standard offboarding"}`;
  await prisma.$transaction(async (tx) => {
    const latest = await tx.hrLifecycleTemplate.aggregate({ where: { organizationId: auth.user.organizationId, name, type }, _max: { version: true } });
    const version = (latest._max.version ?? 0) + 1;
    const template = await tx.hrLifecycleTemplate.create({ data: {
      organizationId: auth.user.organizationId, name, type, version,
      tasks: { create: STANDARD_LIFECYCLE_TASKS[type].map((task, sortOrder) => ({ ...task, sortOrder, predecessorKeys: task.predecessorKeys ?? [] })) },
    } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLifecycleTemplate", entityId: template.id, action: "hr.lifecycle.template.created", newValues: { type, version, taskCount: STANDARD_LIFECYCLE_TASKS[type].length } });
  });
  refresh();
}

export async function startLifecycleAction(formData: FormData) {
  const auth = await requirePermission("workflow.assign");
  const input = startLifecycleInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => {
    const [template, employee] = await Promise.all([
      tx.hrLifecycleTemplate.findFirstOrThrow({ where: { id: input.templateId, organizationId: auth.user.organizationId, active: true }, include: { tasks: { orderBy: { sortOrder: "asc" } } } }),
      tx.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: auth.user.organizationId }, include: { user: true } }),
    ]);
    const supervisor = await activeSupervisorForEmployee(tx, { organizationId: auth.user.organizationId, employeeId: input.employeeId, now: input.effectiveDate });
    if (template.type === "ONBOARDING" && !["DRAFT", "ACTIVE"].includes(employee.employmentStatus)) throw new Error("Onboarding requires a draft or active employee.");
    if (template.type === "OFFBOARDING" && !["ACTIVE", "ON_LEAVE"].includes(employee.employmentStatus)) throw new Error("Offboarding requires an active employee.");
    if (template.type === "OFFBOARDING" && !input.knowledgeTransferToId) throw new Error("A knowledge-transfer owner is required for offboarding.");
    if (template.type === "OFFBOARDING" && (!input.reason || !input.payrollStopDate || input.finalPayrollRequired === undefined || !input.leaveReconciliation)) {
      throw new Error("Offboarding requires a reason, payroll stop date, final payroll decision, and leave reconciliation plan.");
    }
    if (input.knowledgeTransferToId) {
      if (input.knowledgeTransferToId === employee.id) throw new Error("Knowledge transfer must be assigned to another active employee.");
      await tx.hrEmployee.findFirstOrThrow({ where: { id: input.knowledgeTransferToId, organizationId: auth.user.organizationId, employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] }, archivedAt: null } });
    }
    if (template.type === "OFFBOARDING") {
      await createSeparationCase(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0] }, {
        employeeId: employee.id, type: input.separationType, reason: input.reason!, finalWorkingDate: input.effectiveDate,
      });
    }
    const instance = await tx.hrLifecycleInstance.create({ data: {
      organizationId: auth.user.organizationId, templateId: template.id, employeeId: employee.id, type: template.type,
      status: "ACTIVE", effectiveDate: input.effectiveDate, startedAt: new Date(), createdById: auth.user.id,
      knowledgeTransferToId: input.knowledgeTransferToId,
      reason: input.reason, payrollStopDate: input.payrollStopDate, finalPayrollRequired: input.finalPayrollRequired,
      leaveReconciliation: input.leaveReconciliation,
      tasks: { create: template.tasks.map((task) => ({
        organizationId: auth.user.organizationId, templateTaskKey: task.key, title: task.title, description: task.description,
        ownerType: task.ownerType, dueAt: dueDate(input.effectiveDate, task.dueOffsetDays), required: task.required,
        instructions: task.instructions, predecessorKeys: task.predecessorKeys,
        status: task.predecessorKeys.length ? "BLOCKED" : "PENDING",
        assignedUserId: task.ownerType === "EMPLOYEE" ? employee.userId : task.ownerType === "SUPERVISOR" ? supervisor?.supervisorEmployee.userId : null,
      })) },
    } });
    if (employee.user) await enqueueHrEmail(tx, { organizationId: auth.user.organizationId, recipient: employee.user.email, template: "hr-lifecycle-started", subject: `${template.type === "ONBOARDING" ? "Onboarding" : "Offboarding"} checklist started`, payload: { lifecycleInstanceId: instance.id }, idempotencyKey: `hr-lifecycle-started:${instance.id}` });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLifecycleInstance", entityId: instance.id, action: "hr.lifecycle.started", newValues: { employeeId: employee.id, type: template.type, effectiveDate: input.effectiveDate, templateVersion: template.version } });
  }, { isolationLevel: "Serializable" });
  refresh();
}

async function actorCanCompleteTask(auth: Awaited<ReturnType<typeof requirePermission>>, task: { assignedUserId: string | null; ownerType: string; instance: { employeeId: string } }) {
  if (task.assignedUserId === auth.user.id) return true;
  if (auth.permissions.has("workflow.override")) return true;
  if (task.ownerType === "HR" || task.ownerType === "IT") return auth.permissions.has("workflow.review");
  if (task.ownerType === "PAYROLL") return auth.permissions.has("payroll.review");
  if (task.ownerType === "SUPERVISOR") {
    const assignment = await activeSupervisorForEmployee(prisma, { organizationId: auth.user.organizationId, employeeId: task.instance.employeeId });
    return assignment?.supervisorEmployee.userId === auth.user.id
      && Array.isArray(assignment.capabilities)
      && assignment.capabilities.includes("supervisor.review_assigned");
  }
  return false;
}

export async function completeLifecycleTaskAction(formData: FormData) {
  const auth = await requirePermission("workflow.task.complete");
  const input = completeLifecycleTaskInput.parse(Object.fromEntries(formData));
  const snapshot = await prisma.hrLifecycleTask.findFirstOrThrow({ where: { id: input.taskId, organizationId: auth.user.organizationId }, include: { instance: true } });
  if (!await actorCanCompleteTask(auth, snapshot)) throw new Error("You are not assigned to this lifecycle task.");
  await prisma.$transaction(async (tx) => {
    const task = await tx.hrLifecycleTask.findFirstOrThrow({ where: { id: input.taskId, organizationId: auth.user.organizationId, status: { in: ["PENDING", "IN_PROGRESS"] }, instance: { status: "ACTIVE" } } });
    await tx.hrLifecycleTask.update({ where: { id: task.id }, data: { status: "COMPLETED", completionNotes: input.completionNotes, evidenceReference: input.evidenceReference, completedAt: new Date(), completedById: auth.user.id } });
    const tasks = await tx.hrLifecycleTask.findMany({ where: { instanceId: task.instanceId } });
    const completedKeys = new Set(tasks.filter((item) => item.status === "COMPLETED" || item.id === task.id).map((item) => item.templateTaskKey));
    for (const blocked of tasks.filter((item) => item.status === "BLOCKED" && taskIsUnblocked(item.predecessorKeys, completedKeys))) {
      await tx.hrLifecycleTask.update({ where: { id: blocked.id }, data: { status: "PENDING" } });
    }
    const incompleteRequired = tasks.some((item) => item.required && item.id !== task.id && !["COMPLETED", "SKIPPED"].includes(item.status));
    if (!incompleteRequired) {
      await tx.hrLifecycleTask.updateMany({ where: { instanceId: task.instanceId, required: false, status: { in: ["BLOCKED", "PENDING", "IN_PROGRESS"] } }, data: { status: "CANCELLED" } });
      const instance = await tx.hrLifecycleInstance.update({ where: { id: task.instanceId }, data: { status: "COMPLETED", completedAt: new Date() } });
      if (instance.type === "ONBOARDING") await tx.hrEmployee.update({ where: { id: instance.employeeId }, data: { employmentStatus: "ACTIVE" } });
      if (instance.type === "OFFBOARDING") {
        const activeAssets = await tx.hrAssetAssignment.count({ where: { employeeId: instance.employeeId, status: "ACTIVE" } });
        if (activeAssets) throw new Error("Offboarding cannot complete while the employee has active asset assignments.");
        const completedTasks = new Set(tasks.filter((item) => item.status === "COMPLETED" || item.id === task.id).map((item) => item.templateTaskKey));
        for (const requiredKey of ["final-payroll", "leave-reconciliation", "account-close", "company-email-disable", "exit-documents", "final-communication"]) {
          if (!completedTasks.has(requiredKey)) throw new Error(`Offboarding cannot complete before ${requiredKey} is completed.`);
        }
        if (!instance.payrollStopDate || instance.finalPayrollRequired === null || !instance.leaveReconciliation) throw new Error("Offboarding control fields are incomplete.");
        const completedAt = new Date();
        await tx.hrLifecycleInstance.update({ where: { id: instance.id }, data: { finalCommunicationSentAt: completedAt } });
      }
      await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLifecycleInstance", entityId: task.instanceId, action: "hr.lifecycle.completed", newValues: { type: instance.type, employeeId: instance.employeeId } });
    }
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLifecycleTask", entityId: task.id, action: "hr.lifecycle.task.completed", previousValues: { status: task.status }, newValues: { status: "COMPLETED", evidenceReference: input.evidenceReference } });
  }, { isolationLevel: "Serializable" });
  refresh();
}

const skipInput = z.object({ taskId: z.string().cuid(), reason: z.string().trim().min(3).max(1000) });
export async function skipLifecycleTaskAction(formData: FormData) {
  const auth = await requirePermission("workflow.override");
  const input = skipInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => {
    const task = await tx.hrLifecycleTask.findFirstOrThrow({ where: { id: input.taskId, organizationId: auth.user.organizationId, required: false, status: { in: ["BLOCKED", "PENDING", "IN_PROGRESS"] }, instance: { status: "ACTIVE" } } });
    await tx.hrLifecycleTask.update({ where: { id: task.id }, data: { status: "SKIPPED", skippedAt: new Date(), skipReason: input.reason } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLifecycleTask", entityId: task.id, action: "hr.lifecycle.task.skipped", reason: input.reason });
  });
  refresh();
}

const cancelInput = z.object({ instanceId: z.string().cuid(), reason: z.string().trim().min(3).max(1000) });
export async function cancelLifecycleAction(formData: FormData) {
  const auth = await requirePermission("workflow.override");
  const input = cancelInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => {
    const instance = await tx.hrLifecycleInstance.findFirstOrThrow({ where: { id: input.instanceId, organizationId: auth.user.organizationId, status: { in: ["DRAFT", "ACTIVE"] } } });
    await tx.hrLifecycleInstance.update({ where: { id: instance.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: input.reason } });
    await tx.hrLifecycleTask.updateMany({ where: { instanceId: instance.id, status: { in: ["BLOCKED", "PENDING", "IN_PROGRESS"] } }, data: { status: "CANCELLED" } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrLifecycleInstance", entityId: instance.id, action: "hr.lifecycle.cancelled", reason: input.reason, previousValues: { status: instance.status }, newValues: { status: "CANCELLED" } });
  });
  refresh();
}

export async function sendLifecycleRemindersAction(formData: FormData) {
  const auth = await requirePermission("workflow.assign");
  const asOf = z.coerce.date().parse(formData.get("asOf"));
  const deadline = new Date(asOf); deadline.setUTCDate(deadline.getUTCDate() + 3);
  const tasks = await prisma.hrLifecycleTask.findMany({ where: { organizationId: auth.user.organizationId, status: { in: ["PENDING", "IN_PROGRESS"] }, dueAt: { lte: deadline }, assignedUser: { isNot: null } }, include: { assignedUser: true } });
  await prisma.$transaction(async (tx) => {
    for (const task of tasks) {
      if (!task.assignedUser) continue;
      await enqueueHrEmail(tx, { organizationId: auth.user.organizationId, recipient: task.assignedUser.email, template: "hr-lifecycle-task-due", subject: "Lifecycle task due", payload: { lifecycleTaskId: task.id }, idempotencyKey: `hr-lifecycle-task-due:${task.id}:${asOf.toISOString().slice(0, 10)}` });
      await tx.hrLifecycleTask.update({ where: { id: task.id }, data: { reminderSentAt: new Date() } });
    }
  });
  refresh();
}
