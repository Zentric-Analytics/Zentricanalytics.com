import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";
import { HR_ADMIN_WORKSPACE_ROLES } from "@/lib/hr/permissions/catalog";

export default async function HrHome() {
  const auth = await requireAuthenticatedUser();
  if (auth.roles.includes("COMPENSATION_ADMIN")) redirect("/hr/admin/compensation");
  if (auth.roles.includes("BUDGET_OWNER")) redirect("/hr/admin/compensation/budgets");
  if (auth.roles.includes("PAYROLL_READER")) redirect("/hr/admin/compensation/payroll-handoffs");
  if (auth.roles.some((role) => [
    "PAYROLL_ADMIN",
    "PAYROLL_PROCESSOR",
    "PAYROLL_APPROVER",
    "PAYROLL_COMPLIANCE_ADMIN",
    "PAYMENT_OPERATOR",
    "PAYMENT_APPROVER",
    "FINANCE_READER",
    "PAYROLL_AUDITOR",
    "STATUTORY_COMPLIANCE_OPERATOR",
  ].includes(role))) redirect("/hr/admin/payroll/unit9");
  if (auth.roles.some((role) => HR_ADMIN_WORKSPACE_ROLES.includes(role))) redirect("/hr/admin/dashboard");
  if (auth.roles.includes("AUDITOR")) redirect("/hr/auditor");
  if (auth.user.employee) {
    const supervisor = await import("@/lib/prisma").then(({ prisma }) => prisma.hrSupervisorAssignment.findFirst({ where: { organizationId: auth.user.organizationId, supervisorEmployeeId: auth.user.employee!.id, status: "ACTIVE", effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] } }));
    if (supervisor) redirect("/hr/supervisor");
  }
  redirect("/hr/employee");
}
