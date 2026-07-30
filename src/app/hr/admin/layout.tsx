import { HrPortalShell } from "@/components/HrPortalShell";
import { requireAnyRole } from "@/lib/hr/permissions/authorize";

const links: Array<[string, string]> = [["Dashboard","/hr/admin/dashboard"],["Reports","/hr/admin/reports"],["Employees","/hr/admin/employees"],["Departments","/hr/admin/departments"],["Positions","/hr/admin/positions"],["Users","/hr/admin/users"],["Assignments","/hr/admin/assignments"],["Leave","/hr/admin/leave"],["Payroll","/hr/admin/payroll"],["Documents","/hr/admin/documents"],["Assets","/hr/admin/assets"],["Lifecycle","/hr/admin/lifecycle"],["Workflows","/hr/admin/workflows"],["Audit","/hr/admin/audit"],["Settings","/hr/admin/settings"],["Notifications","/hr/notifications"],["Security","/hr/security"]];

export default async function HrAdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAnyRole(["ADMIN", "HR_ADMIN", "PAYROLL_ADMIN"]);
  return <HrPortalShell title="Administration" email={auth.user.email} links={links}>{children}</HrPortalShell>;
}
