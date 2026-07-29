"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";

const idInput = z.string().cuid();
const preferenceInput = z.object({
  category: z.string().trim().min(2).max(120),
  inAppEnabled: z.enum(["on"]).optional(),
  emailEnabled: z.enum(["on"]).optional(),
});

export async function markNotificationReadAction(formData: FormData) {
  const auth = await requireAuthenticatedUser();
  const id = idInput.parse(formData.get("id"));
  await prisma.hrNotification.updateMany({
    where: { id, userId: auth.user.id, organizationId: auth.user.organizationId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/hr/notifications");
}

export async function markAllNotificationsReadAction() {
  const auth = await requireAuthenticatedUser();
  await prisma.hrNotification.updateMany({
    where: { userId: auth.user.id, organizationId: auth.user.organizationId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/hr/notifications");
}

export async function updateNotificationPreferenceAction(formData: FormData) {
  const auth = await requireAuthenticatedUser();
  const input = preferenceInput.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => {
    await tx.hrNotificationPreference.upsert({
      where: { userId_category: { userId: auth.user.id, category: input.category } },
      update: { inAppEnabled: Boolean(input.inAppEnabled), emailEnabled: Boolean(input.emailEnabled) },
      create: {
        organizationId: auth.user.organizationId,
        userId: auth.user.id,
        category: input.category,
        inAppEnabled: Boolean(input.inAppEnabled),
        emailEnabled: Boolean(input.emailEnabled),
      },
    });
    await appendHrAudit(tx, {
      organizationId: auth.user.organizationId,
      actorUserId: auth.user.id,
      actorRole: auth.roles[0],
      entityType: "HrNotificationPreference",
      entityId: `${auth.user.id}:${input.category}`,
      action: "hr.notification.preference.updated",
      newValues: { category: input.category, inAppEnabled: Boolean(input.inAppEnabled), emailEnabled: Boolean(input.emailEnabled) },
    });
  });
  revalidatePath("/hr/notifications");
}
