"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { seedPerformanceFramework } from "@/lib/hr/performance/commands";

export async function initializePerformanceFrameworkAction() {
  const auth = await requirePermission("performance.framework.manage");
  await prisma.$transaction((tx) => seedPerformanceFramework(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "TALENT_ADMIN" }), { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/performance");
}
