"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { applyWorkforceEvent, approveWorkforceEvent, createWorkforceEventDraft, submitWorkforceEvent } from "@/lib/hr/workforce/commands";
import type { WorkforceImpactSnapshot } from "@/lib/hr/workforce/events";

const eventInput = z.object({ employeeId: z.string().cuid(), workRelationshipId: z.string().cuid().optional().or(z.literal("")).transform((value) => value || undefined), type: z.enum(["JOB_CHANGE", "POSITION_CHANGE", "PROMOTION", "TRANSFER", "DEPARTMENT_CHANGE", "TEAM_CHANGE", "MANAGER_CHANGE", "LOCATION_CHANGE", "LEGAL_ENTITY_TRANSFER", "GRADE_CHANGE", "EMPLOYMENT_TYPE_CHANGE", "WORK_ARRANGEMENT_CHANGE", "CONTRACT_CHANGE", "PROBATION_CONFIRMATION", "PROBATION_EXTENSION"]), reason: z.string().trim().min(3).max(1000), requestedEffectiveAt: z.coerce.date(), idempotencyKey: z.string().uuid(), positionId: z.string().cuid().optional().or(z.literal("")).transform((value) => value || undefined), departmentId: z.string().cuid().optional().or(z.literal("")).transform((value) => value || undefined), teamId: z.string().cuid().optional().or(z.literal("")).transform((value) => value || undefined), managerEmployeeId: z.string().cuid().optional().or(z.literal("")).transform((value) => value || undefined), locationId: z.string().cuid().optional().or(z.literal("")).transform((value) => value || undefined), legalEntityId: z.string().cuid().optional().or(z.literal("")).transform((value) => value || undefined), gradeId: z.string().cuid().optional().or(z.literal("")).transform((value) => value || undefined), jobProfileId: z.string().cuid().optional().or(z.literal("")).transform((value) => value || undefined), employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "TEMPORARY", "CONSULTANT"]).optional().or(z.literal("")).transform((value) => value || undefined), workMode: z.enum(["ONSITE", "HYBRID", "REMOTE"]).optional().or(z.literal("")).transform((value) => value || undefined) });
const refresh = () => revalidatePath("/hr/admin/workforce-events");

export async function createWorkforceEventAction(formData: FormData) {
  const auth = await requirePermission("workforce_event.create");
  const input = eventInput.parse(Object.fromEntries(formData));
  const keys = ["positionId", "departmentId", "teamId", "managerEmployeeId", "locationId", "legalEntityId", "gradeId", "jobProfileId", "employmentType", "workMode"];
  const proposedSnapshot = Object.fromEntries(Object.entries(input).filter(([key, value]) => keys.includes(key) && value !== undefined)) as WorkforceImpactSnapshot;
  await prisma.$transaction(async (tx) => { const event = await createWorkforceEventDraft(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0] }, { employeeId: input.employeeId, workRelationshipId: input.workRelationshipId, type: input.type, reason: input.reason, proposedSnapshot, requestedEffectiveAt: input.requestedEffectiveAt, idempotencyKey: input.idempotencyKey }); if (event.status === "DRAFT") await submitWorkforceEvent(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0] }, event.id, event.version); }, { isolationLevel: "Serializable" });
  refresh();
}

const attachInput = z.object({ eventId: z.string().cuid(), workflowInstanceId: z.string().cuid(), expectedVersion: z.coerce.number().int().positive() });
export async function attachWorkforceWorkflowAction(formData: FormData) {
  const auth = await requirePermission("workforce_event.review"); const input = attachInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => { const event = await tx.hrWorkforceEvent.findFirstOrThrow({ where: { id: input.eventId, organizationId: auth.user.organizationId, version: input.expectedVersion, status: "SUBMITTED" } }); await tx.hrWorkflowInstance.findFirstOrThrow({ where: { id: input.workflowInstanceId, organizationId: auth.user.organizationId, subjectType: "HrWorkforceEvent", subjectId: event.id } }); const result = await tx.hrWorkforceEvent.updateMany({ where: { id: event.id, version: input.expectedVersion, workflowInstanceId: null }, data: { workflowInstanceId: input.workflowInstanceId, status: "UNDER_REVIEW" } }); if (result.count !== 1) throw new Error("The workflow was already attached or the event changed."); }, { isolationLevel: "Serializable" }); refresh();
}

const decisionInput = z.object({ eventId: z.string().cuid(), expectedVersion: z.coerce.number().int().positive(), reason: z.string().trim().min(3).max(1000) });
export async function approveWorkforceEventAction(formData: FormData) { const auth = await requirePermission("workforce_event.review"); const input = decisionInput.parse(Object.fromEntries(formData)); await prisma.$transaction((tx) => approveWorkforceEvent(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0] }, input.eventId, input.expectedVersion, input.reason), { isolationLevel: "Serializable" }); refresh(); }
export async function applyWorkforceEventAction(formData: FormData) { const auth = await requirePermission("workforce_event.apply"); const eventId = z.string().cuid().parse(formData.get("eventId")); await prisma.$transaction((tx) => applyWorkforceEvent(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0] }, eventId), { isolationLevel: "Serializable" }); refresh(); }
