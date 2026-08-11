"use server";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";
import { activeSupervisorForEmployee } from "@/lib/hr/supervisors/scope";
import { prisma } from "@/lib/prisma";
import { transitionTimesheet } from "@/lib/hr/time/commands";

export async function reviewTimesheetAction(formData: FormData) {
  const auth = await requireAuthenticatedUser();
  const sheet = await prisma.hrTimesheet.findFirstOrThrow({ where: { id: String(formData.get("timesheetId")), organizationId: auth.user.organizationId } });
  const privileged = auth.permissions.has("time.timesheet.approve");
  let assignmentScoped = false;
  if (!privileged && auth.user.employee) {
    const assignment = await activeSupervisorForEmployee(prisma, { organizationId: auth.user.organizationId, employeeId: sheet.employeeId });
    assignmentScoped = assignment?.supervisorEmployee.userId === auth.user.id
      && Array.isArray(assignment.capabilities)
      && assignment.capabilities.includes("supervisor.review_assigned");
  }
  if (!privileged && !assignmentScoped) throw new Error("Timesheet is outside the active supervisory review scope.");
  await transitionTimesheet({ organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "MANAGER" }, { timesheetId: sheet.id, expectedVersion: Number(formData.get("expectedVersion")), to: String(formData.get("decision")) as "APPROVED" | "RETURNED" | "REJECTED" });
  revalidatePath("/hr/supervisor/time");
}
