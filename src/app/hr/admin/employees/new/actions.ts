"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { finalizeEmployeeProvisioning } from "@/lib/hr/employees/finalize-provisioning";
import { mergeProvisioningStep, provisioningPayloadSchema, provisioningReadiness, type ProvisioningPayload } from "@/lib/hr/employees/provisioning";
import { requirePermission } from "@/lib/hr/permissions/authorize";

const sections: Array<keyof ProvisioningPayload> = ["personal", "employment", "assignment", "compensation", "payroll", "access", "onboarding"];
const clean = (value: FormDataEntryValue | null) => typeof value === "string" && value.trim() ? value.trim() : undefined;

export async function createProvisioningDraftAction() {
  const auth = await requirePermission("employee.create");
  const draft = await prisma.$transaction(async (tx) => {
    const created = await tx.hrEmployeeProvisioningDraft.create({ data: { organizationId: auth.user.organizationId, payload: {}, createdById: auth.user.id, updatedById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployeeProvisioningDraft", entityId: created.id, action: "hr.employee.provisioning_draft.created" });
    return created;
  });
  redirect(`/hr/admin/employees/new?draft=${draft.id}&step=1`);
}

export async function saveProvisioningStepAction(formData: FormData) {
  const auth = await requirePermission("employee.create");
  const draftId = z.string().cuid().parse(formData.get("draftId"));
  const section = z.enum(sections as [keyof ProvisioningPayload, ...(keyof ProvisioningPayload)[]]).parse(formData.get("section"));
  const nextStep = Math.min(8, Math.max(1, Number(formData.get("nextStep")) || 1));
  const values: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) if (!["draftId", "section", "nextStep"].includes(key)) {
    if (key.startsWith("boolean:")) values[key.slice(8)] = value === "true";
    else if (clean(value) !== undefined) values[key] = clean(value);
  }
  const draft = await prisma.hrEmployeeProvisioningDraft.findFirstOrThrow({ where: { id: draftId, organizationId: auth.user.organizationId, status: "DRAFT" } });
  const payload = mergeProvisioningStep(draft.payload, section, values);
  const readiness = provisioningReadiness(payload);
  await prisma.$transaction(async (tx) => {
    await tx.hrEmployeeProvisioningDraft.update({ where: { id: draft.id }, data: { payload, currentStep: nextStep, version: { increment: 1 }, updatedById: auth.user.id, readinessScore: readiness.score } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployeeProvisioningDraft", entityId: draft.id, action: "hr.employee.provisioning_draft.step_saved", newValues: { section, readinessScore: readiness.score } });
  });
  redirect(`/hr/admin/employees/new?draft=${draft.id}&step=${nextStep}&saved=1`);
}

export async function submitProvisioningDraftAction(formData: FormData) {
  const auth = await requirePermission("employee.create");
  const draftId = z.string().cuid().parse(formData.get("draftId"));
  const draft = await prisma.hrEmployeeProvisioningDraft.findFirstOrThrow({ where: { id: draftId, organizationId: auth.user.organizationId, status: "DRAFT" } });
  const existingEmployeeCount = await prisma.hrEmployee.count({ where: { organizationId: auth.user.organizationId, employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] } } });
  const readiness = provisioningReadiness(provisioningPayloadSchema.parse(draft.payload), { requireManager: existingEmployeeCount > 0 });
  if (readiness.blocking.length) throw new Error(`Complete required readiness items: ${readiness.blocking.map(({ label }) => label).join(", ")}.`);
  await prisma.$transaction(async (tx) => {
    await tx.hrEmployeeProvisioningDraft.update({ where: { id: draft.id }, data: { status: "PENDING_APPROVAL", submittedAt: new Date(), readinessScore: readiness.score, updatedById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployeeProvisioningDraft", entityId: draft.id, action: "hr.employee.provisioning_draft.submitted", newValues: { readinessScore: readiness.score }, reason: "Submitted for independent activation" });
  });
  revalidatePath("/hr/admin/employees/new");
  redirect(`/hr/admin/employees/new?draft=${draft.id}&step=8&submitted=1`);
}

export async function approveAndFinalizeProvisioningAction(formData: FormData) {
  const auth = await requirePermission("employee.update");
  const draftId = z.string().cuid().parse(formData.get("draftId"));
  const employee = await prisma.$transaction((tx) => finalizeEmployeeProvisioning(tx, { draftId, organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0] }), { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/employees");
  redirect(`/hr/admin/employees/${employee.id}?provisioned=1`);
}

export async function cancelProvisioningDraftAction(formData: FormData) {
  const auth = await requirePermission("employee.create");
  const draftId = z.string().cuid().parse(formData.get("draftId"));
  await prisma.$transaction(async (tx) => {
    const draft = await tx.hrEmployeeProvisioningDraft.findFirstOrThrow({ where: { id: draftId, organizationId: auth.user.organizationId, status: { in: ["DRAFT", "PENDING_APPROVAL"] } } });
    await tx.hrEmployeeProvisioningDraft.update({ where: { id: draft.id }, data: { status: "CANCELLED", cancelledAt: new Date(), updatedById: auth.user.id } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrEmployeeProvisioningDraft", entityId: draft.id, action: "hr.employee.provisioning_draft.cancelled", reason: "Provisioning cancelled" });
  });
  redirect("/hr/admin/employees/new");
}
