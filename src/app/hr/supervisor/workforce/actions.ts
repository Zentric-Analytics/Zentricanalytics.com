"use server";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";
import { supervisedEmployeeIds } from "@/lib/hr/supervisors/scope";
import { createWorkforceEventDraft, submitWorkforceEvent } from "@/lib/hr/workforce/commands";

const inputSchema = z.object({ employeeId: z.string().cuid(), type: z.enum(["PROMOTION", "TRANSFER", "POSITION_CHANGE", "MANAGER_CHANGE", "LOCATION_CHANGE", "WORK_ARRANGEMENT_CHANGE"]), requestedEffectiveAt: z.coerce.date(), reason: z.string().trim().min(3).max(1000), positionId: z.string().cuid().optional().or(z.literal("")).transform((value) => value || undefined), managerEmployeeId: z.string().cuid().optional().or(z.literal("")).transform((value) => value || undefined), locationId: z.string().cuid().optional().or(z.literal("")).transform((value) => value || undefined), workMode: z.enum(["ONSITE", "HYBRID", "REMOTE"]).optional().or(z.literal("")).transform((value) => value || undefined) });
export async function requestTeamWorkforceEventAction(formData: FormData) {
  const auth = await requireAuthenticatedUser(); if (!auth.user.employee || !auth.permissions.has("supervisor.review_assigned")) throw new Error("Forbidden"); const input = inputSchema.parse(Object.fromEntries(formData));
  const employeeIds = await supervisedEmployeeIds(prisma, { organizationId: auth.user.organizationId, supervisorEmployeeId: auth.user.employee.id }); if (!employeeIds.includes(input.employeeId)) throw new Error("The employee is outside your active supervisory scope.");
  const proposedSnapshot = Object.fromEntries(Object.entries({ positionId: input.positionId, managerEmployeeId: input.managerEmployeeId, locationId: input.locationId, workMode: input.workMode }).filter(([, value]) => value !== undefined));
  await prisma.$transaction(async (tx) => { const event = await createWorkforceEventDraft(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0] }, { employeeId: input.employeeId, type: input.type, reason: input.reason, requestedEffectiveAt: input.requestedEffectiveAt, proposedSnapshot, idempotencyKey: crypto.randomUUID(), ownerUserId: auth.user.id }); await submitWorkforceEvent(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0] }, event.id, event.version); }, { isolationLevel: "Serializable" }); revalidatePath("/hr/supervisor/workforce");
}
