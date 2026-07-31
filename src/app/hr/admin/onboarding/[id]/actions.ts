"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { changePreHireState, updateOnboardingTask } from "@/lib/hr/recruitment/onboarding";
import { activateReadyEmployee } from "@/lib/hr/recruitment/prehire";
import { prisma } from "@/lib/prisma";

export type OnboardingActionState = { status: "idle" | "success" | "error"; message?: string };

export async function onboardingAction(_state: OnboardingActionState, formData: FormData): Promise<OnboardingActionState> {
  try {
    const operation = z.enum(["TASK", "STATE", "ACTIVATE"]).parse(formData.get("operation"));
    const employeeId = z.string().cuid().parse(formData.get("employeeId"));
    if (operation === "TASK") {
      const input = z.object({
        taskId: z.string().cuid(),
        to: z.enum(["IN_PROGRESS", "COMPLETED", "PENDING", "CANCELLED"]),
        notes: z.string().trim().min(3).max(5000),
        evidenceReference: z.string().trim().max(2048).optional(),
        assignedUserId: z.string().cuid().optional().or(z.literal("")),
        dueAt: z.string().optional(),
      }).parse(Object.fromEntries(formData));
      const auth = await requirePermission(input.to === "PENDING" || input.to === "CANCELLED" ? "onboarding.override" : "onboarding.complete_task");
      await prisma.$transaction((tx) => updateOnboardingTask(tx, {
        ...input,
        assignedUserId: input.assignedUserId || undefined,
        dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        organizationId: auth.user.organizationId,
        actorUserId: auth.user.id,
        actorRole: auth.roles[0],
      }), { isolationLevel: "Serializable" });
    } else if (operation === "STATE") {
      const input = z.object({
        to: z.enum(["ON_HOLD", "PRE_HIRE", "CANCELLED"]),
        reason: z.string().trim().min(3).max(1000),
        startDate: z.string().optional(),
      }).parse(Object.fromEntries(formData));
      const auth = await requirePermission("onboarding.manage");
      await prisma.$transaction((tx) => changePreHireState(tx, {
        ...input,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        employeeId,
        organizationId: auth.user.organizationId,
        actorUserId: auth.user.id,
        actorRole: auth.roles[0],
      }), { isolationLevel: "Serializable" });
    } else {
      const auth = await requirePermission("employee.activate");
      await prisma.$transaction((tx) => activateReadyEmployee(tx, {
        employeeId,
        organizationId: auth.user.organizationId,
        actorUserId: auth.user.id,
        source: "USER",
      }), { isolationLevel: "Serializable" });
    }
    revalidatePath(`/hr/admin/onboarding/${employeeId}`);
    revalidatePath("/hr/admin/recruitment");
    return { status: "success", message: "Onboarding and readiness state updated." };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "The onboarding action failed." };
  }
}
