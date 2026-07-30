"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { assertAssetStatusTransition, assetAssignmentInput, assetInput } from "@/lib/hr/assets/validation";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { requirePermission } from "@/lib/hr/permissions/authorize";

export async function createAssetAction(formData: FormData) {
  const auth = await requirePermission("asset.manage");
  const input = assetInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => {
    const asset = await tx.hrAsset.create({ data: { ...input, organizationId: auth.user.organizationId, createdById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrAsset", entityId: asset.id, action: "hr.asset.created", newValues: { assetTag: asset.assetTag, type: asset.type, name: asset.name, condition: asset.condition, status: asset.status } });
  });
  revalidatePath("/hr/admin/assets");
}

export async function assignAssetAction(formData: FormData) {
  const auth = await requirePermission("asset.assign");
  const input = assetAssignmentInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => {
    const [asset, employee] = await Promise.all([
      tx.hrAsset.findFirstOrThrow({ where: { id: input.assetId, organizationId: auth.user.organizationId, status: "AVAILABLE" } }),
      tx.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: auth.user.organizationId, employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] } }, include: { user: true } }),
    ]);
    const assignment = await tx.hrAssetAssignment.create({ data: { ...input, organizationId: auth.user.organizationId, assignedById: auth.user.id } });
    await tx.hrAsset.update({ where: { id: asset.id }, data: { status: "ASSIGNED", condition: input.issueCondition } });
    if (employee.user) await enqueueHrEmail(tx, { organizationId: auth.user.organizationId, recipient: employee.user.email, template: "hr-asset-assigned", subject: "An asset has been assigned to you", payload: { assetAssignmentId: assignment.id }, idempotencyKey: `hr-asset-assigned:${assignment.id}` });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrAssetAssignment", entityId: assignment.id, action: "hr.asset.assigned", newValues: { assetId: asset.id, employeeId: employee.id, assignedAt: input.assignedAt, expectedReturnAt: input.expectedReturnAt, issueCondition: input.issueCondition } });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/assets");
  revalidatePath("/hr/employee/assets");
}

const returnInput = z.object({ assignmentId: z.string().cuid(), returnedAt: z.coerce.date(), returnCondition: z.enum(["NEW", "GOOD", "FAIR", "DAMAGED", "UNUSABLE"]), returnNotes: z.string().trim().min(3).max(1000) });
export async function returnAssetAction(formData: FormData) {
  const auth = await requirePermission("asset.return");
  const input = returnInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => {
    const assignment = await tx.hrAssetAssignment.findFirstOrThrow({ where: { id: input.assignmentId, organizationId: auth.user.organizationId, status: "ACTIVE" }, include: { asset: true, employee: { include: { user: true } } } });
    if (input.returnedAt < assignment.assignedAt) throw new Error("Return date cannot precede assignment.");
    const assetStatus = ["DAMAGED", "UNUSABLE"].includes(input.returnCondition) ? "UNDER_REPAIR" : "AVAILABLE";
    await tx.hrAssetAssignment.update({ where: { id: assignment.id }, data: { returnedAt: input.returnedAt, returnCondition: input.returnCondition, returnNotes: input.returnNotes, returnRecordedById: auth.user.id, status: "RETURNED" } });
    await tx.hrAsset.update({ where: { id: assignment.assetId }, data: { status: assetStatus, condition: input.returnCondition } });
    if (assignment.employee.user) await enqueueHrEmail(tx, { organizationId: auth.user.organizationId, recipient: assignment.employee.user.email, template: "hr-asset-return-recorded", subject: "Your asset return was recorded", payload: { assetAssignmentId: assignment.id }, idempotencyKey: `hr-asset-return:${assignment.id}` });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrAssetAssignment", entityId: assignment.id, action: "hr.asset.returned", previousValues: { status: assignment.status, assetStatus: assignment.asset.status }, newValues: { status: "RETURNED", assetStatus, returnedAt: input.returnedAt, returnCondition: input.returnCondition }, reason: input.returnNotes });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/assets");
  revalidatePath("/hr/employee/assets");
}

export async function acknowledgeAssetAction(formData: FormData) {
  const auth = await requirePermission("asset.read_self");
  if (!auth.user.employee) throw new Error("An employee profile is required.");
  const assignmentId = z.string().cuid().parse(formData.get("assignmentId"));
  await prisma.$transaction(async (tx) => {
    const assignment = await tx.hrAssetAssignment.findFirstOrThrow({ where: { id: assignmentId, employeeId: auth.user.employee!.id, status: "ACTIVE", acknowledgedAt: null } });
    await tx.hrAssetAssignment.update({ where: { id: assignment.id }, data: { acknowledgedAt: new Date() } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrAssetAssignment", entityId: assignment.id, action: "hr.asset.receipt.acknowledged", newValues: { acknowledged: true } });
  });
  revalidatePath("/hr/admin/assets");
  revalidatePath("/hr/employee/assets");
}

const statusInput = z.object({ assetId: z.string().cuid(), status: z.enum(["AVAILABLE", "UNDER_REPAIR", "LOST", "RETIRED", "DISPOSED"]), condition: z.enum(["NEW", "GOOD", "FAIR", "DAMAGED", "UNUSABLE"]), reason: z.string().trim().min(3).max(1000) });
export async function updateAssetStatusAction(formData: FormData) {
  const auth = await requirePermission("asset.manage");
  const input = statusInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => {
    const asset = await tx.hrAsset.findFirstOrThrow({ where: { id: input.assetId, organizationId: auth.user.organizationId } });
    if (await tx.hrAssetAssignment.count({ where: { assetId: asset.id, status: "ACTIVE" } })) throw new Error("Return or report the active assignment before changing this asset status.");
    assertAssetStatusTransition(asset.status, input.status);
    await tx.hrAsset.update({ where: { id: asset.id }, data: { status: input.status, condition: input.condition } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrAsset", entityId: asset.id, action: "hr.asset.status.changed", previousValues: { status: asset.status, condition: asset.condition }, newValues: { status: input.status, condition: input.condition }, reason: input.reason });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/assets");
}

const lostInput = z.object({ assignmentId: z.string().cuid(), reason: z.string().trim().min(3).max(1000) });
export async function reportAssignedAssetLostAction(formData: FormData) {
  const auth = await requirePermission("asset.manage");
  const input = lostInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => {
    const assignment = await tx.hrAssetAssignment.findFirstOrThrow({ where: { id: input.assignmentId, organizationId: auth.user.organizationId, status: "ACTIVE" }, include: { asset: true } });
    await tx.hrAssetAssignment.update({ where: { id: assignment.id }, data: { status: "LOST", returnNotes: input.reason, returnRecordedById: auth.user.id } });
    await tx.hrAsset.update({ where: { id: assignment.assetId }, data: { status: "LOST" } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrAssetAssignment", entityId: assignment.id, action: "hr.asset.reported_lost", previousValues: { status: assignment.status, assetStatus: assignment.asset.status }, newValues: { status: "LOST", assetStatus: "LOST" }, reason: input.reason });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/assets");
  revalidatePath("/hr/employee/assets");
}

export async function sendAssetReturnRemindersAction(formData: FormData) {
  const auth = await requirePermission("asset.manage");
  const asOf = z.coerce.date().parse(formData.get("asOf"));
  const deadline = new Date(asOf);
  deadline.setUTCDate(deadline.getUTCDate() + 7);
  const assignments = await prisma.hrAssetAssignment.findMany({ where: { organizationId: auth.user.organizationId, status: "ACTIVE", expectedReturnAt: { lte: deadline } }, include: { employee: { include: { user: true } } } });
  await prisma.$transaction(async (tx) => {
    for (const assignment of assignments) if (assignment.employee.user) await enqueueHrEmail(tx, { organizationId: auth.user.organizationId, recipient: assignment.employee.user.email, template: "hr-asset-return-reminder", subject: "An assigned asset is due for return", payload: { assetAssignmentId: assignment.id }, idempotencyKey: `hr-asset-return-reminder:${assignment.id}:${asOf.toISOString().slice(0, 10)}` });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrAssetAssignment", action: "hr.asset.return_reminders.queued", newValues: { asOf, assignmentCount: assignments.length } });
  });
  revalidatePath("/hr/admin/assets");
}
