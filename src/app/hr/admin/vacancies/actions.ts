"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { createVacancy, transitionVacancy, vacancyInput } from "@/lib/hr/recruitment/vacancies";
import { prisma } from "@/lib/prisma";
import { delegateVacancyApprovals, endVacancyDelegation } from "@/lib/hr/recruitment/delegation";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";

export async function vacancyDelegationAction(formData: FormData) {
  const auth = await requireAuthenticatedUser();
  const vacancyId = z.string().cuid().parse(formData.get("vacancyId"));
  const scope = { vacancyId, organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0] };
  await prisma.$transaction(async (tx) => {
    if (formData.get("operation") === "end") await endVacancyDelegation(tx, scope);
    else await delegateVacancyApprovals(tx, { ...scope,
      reason: z.string().trim().min(1).max(2000).parse(formData.get("reason")),
      delegateUserIds: z.array(z.string().cuid()).min(1).parse(formData.getAll("delegateUserIds")),
    });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/vacancies");
}

export async function assignResponsibleHrAction(formData: FormData) {
  const auth = await requireAuthenticatedUser();
  const input = z.object({ vacancyId: z.string().cuid(), responsibleHrUserId: z.string().cuid() }).parse(Object.fromEntries(formData));
  await prisma.$transaction(async tx => {
    const vacancy = await tx.hrVacancy.findFirstOrThrow({ where: { id: input.vacancyId, organizationId: auth.user.organizationId } });
    if (vacancy.createdById !== auth.user.id && !auth.user.isPrimaryAdmin) throw new Error("Only the vacancy creator or primary administrator may assign responsible HR.");
    await tx.hrUser.findFirstOrThrow({ where: { id: input.responsibleHrUserId, organizationId: auth.user.organizationId, status: "ACTIVE", roles: { some: { revokedAt: null, role: { key: { in: ["ADMIN", "HR_ADMIN"] } } } } } });
    await tx.hrVacancy.update({ where: { id: vacancy.id }, data: { responsibleHrUserId: input.responsibleHrUserId } });
    const { appendHrAudit } = await import("@/lib/hr/audit");
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, entityType: "HrVacancy", entityId: vacancy.id, action: "hr.vacancy.responsible_hr.assigned", previousValues: { responsibleHrUserId: vacancy.responsibleHrUserId }, newValues: { responsibleHrUserId: input.responsibleHrUserId } });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/vacancies");
}

export async function createVacancyAction(formData: FormData) {
  const auth = await requirePermission("vacancy.create");
  const raw = Object.fromEntries(formData);
  // Preserve the legacy required team reference; named HR owns new routing.
  const input = vacancyInput.parse({ ...raw, vacancyOwnerId: auth.user.id, responsibleHrTeamId: raw.hiringTeamId, publicSalary: formData.get("publicSalary") === "true" });
  await prisma.$transaction((tx) => createVacancy(tx, {
    ...input, organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0],
  }));
  revalidatePath("/hr/admin/vacancies");
  revalidatePath("/careers");
}

const transitionInput = z.object({
  vacancyId: z.string().cuid(),
  expectedVersion: z.coerce.number().int().positive(),
  to: z.enum(["PENDING_APPROVAL", "RETURNED_FOR_CORRECTION", "APPROVED", "SCHEDULED", "OPEN", "PAUSED", "CLOSED", "FILLED", "CANCELLED"]),
  reason: z.string().trim().min(3).max(1000),
});

const transitionPermission = {
  PENDING_APPROVAL: "vacancy.submit",
  RETURNED_FOR_CORRECTION: "vacancy.approve",
  APPROVED: "vacancy.approve",
  SCHEDULED: "vacancy.publish",
  OPEN: "vacancy.publish",
  PAUSED: "vacancy.pause",
  CLOSED: "vacancy.close",
  FILLED: "vacancy.fill",
  CANCELLED: "vacancy.cancel",
} as const;

export async function transitionVacancyAction(formData: FormData) {
  const input = transitionInput.parse(Object.fromEntries(formData));
  const auth = await requirePermission(transitionPermission[input.to]);
  await prisma.$transaction((tx) => transitionVacancy(tx, {
    ...input, organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0],
  }));
  revalidatePath("/hr/admin/vacancies");
  revalidatePath("/careers");
}

export type VacancyTransitionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export async function transitionVacancyWithStateAction(
  _previousState: VacancyTransitionState,
  formData: FormData,
): Promise<VacancyTransitionState> {
  try {
    await transitionVacancyAction(formData);
    return { status: "success", message: "Vacancy updated." };
  } catch (error) {
    const message = error instanceof Error && error.message
      ? error.message
      : "You are not authorized to perform this vacancy action.";
    return { status: "error", message };
  }
}
