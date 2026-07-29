import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";

export default async function HrHome() {
  const auth = await requireAuthenticatedUser();
  if (auth.roles.some((role) => role === "ADMIN" || role === "HR_ADMIN" || role === "PAYROLL_ADMIN")) redirect("/hr/admin/dashboard");
  if (auth.user.employee) {
    const supervisor = await import("@/lib/prisma").then(({ prisma }) => prisma.hrSupervisorAssignment.findFirst({ where: { supervisorEmployeeId: auth.user.employee!.id, status: "ACTIVE", effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] } }));
    if (supervisor) redirect("/hr/supervisor");
  }
  redirect("/hr/employee");
}
