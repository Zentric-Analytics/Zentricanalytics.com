"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";

const selfProfileInput = z.object({
  preferredName: z.string().trim().max(120).optional().transform((value) => value || null),
  personalEmail: z.string().trim().email().optional().or(z.literal("")).transform((value) => value || null),
  preferredNotificationEmail: z.string().trim().email().optional().or(z.literal("")).transform((value) => value || null),
  phone: z.string().trim().max(40).optional().transform((value) => value || null),
});

export async function updateSelfProfileAction(formData: FormData) {
  const auth = await requireAuthenticatedUser();
  if (!auth.permissions.has("employee.update_self") || !auth.user.employee) throw new Error("Forbidden");
  const input = selfProfileInput.parse(Object.fromEntries(formData));
  const employee = await prisma.hrEmployee.findFirstOrThrow({ where: { id: auth.user.employee.id, organizationId: auth.user.organizationId } });
  await prisma.$transaction(async (tx) => {
    await tx.hrEmployee.update({ where: { id: employee.id }, data: input });
    await appendHrAudit(tx, {
      organizationId: auth.user.organizationId,
      actorUserId: auth.user.id,
      actorRole: auth.roles[0],
      entityType: "HrEmployee",
      entityId: employee.id,
      action: "hr.employee.self_profile.updated",
      previousValues: { preferredName: employee.preferredName, personalEmail: employee.personalEmail, preferredNotificationEmail: employee.preferredNotificationEmail, phone: employee.phone },
      newValues: input,
      reason: "Employee self-service profile update",
    });
  });
  revalidatePath("/hr/employee/profile");
}
