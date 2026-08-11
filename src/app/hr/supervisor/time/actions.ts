"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { supervisedEmployeeIds } from "@/lib/hr/supervisors/scope";
import { prisma } from "@/lib/prisma";
import { transitionTimesheet } from "@/lib/hr/time/commands";

export async function reviewTimesheetAction(formData: FormData) {
  const auth = await requirePermission("time.timesheet.approve");
  if (!auth.user.employee) throw new Error("A supervisor employee profile is required.");
  const sheet = await prisma.hrTimesheet.findFirstOrThrow({ where: { id: String(formData.get("timesheetId")), organizationId: auth.user.organizationId } });
  const employeeIds = await supervisedEmployeeIds(prisma, { organizationId: auth.user.organizationId, supervisorEmployeeId: auth.user.employee.id });
  if (!auth.permissions.has("time.read_all") && !employeeIds.includes(sheet.employeeId)) throw new Error("Timesheet is outside the active supervisory scope.");
  await transitionTimesheet({ organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "MANAGER" }, { timesheetId: sheet.id, expectedVersion: Number(formData.get("expectedVersion")), to: String(formData.get("decision")) as "APPROVED" | "RETURNED" | "REJECTED" });
  revalidatePath("/hr/supervisor/time");
}
