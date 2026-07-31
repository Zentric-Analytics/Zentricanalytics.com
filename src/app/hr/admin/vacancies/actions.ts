"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { createVacancy, transitionVacancy, vacancyInput } from "@/lib/hr/recruitment/vacancies";
import { prisma } from "@/lib/prisma";

export async function createVacancyAction(formData: FormData) {
  const auth = await requirePermission("vacancy.create");
  const raw = Object.fromEntries(formData);
  const input = vacancyInput.parse({ ...raw, publicSalary: formData.get("publicSalary") === "true" });
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
