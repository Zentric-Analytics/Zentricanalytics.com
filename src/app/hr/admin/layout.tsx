import { HrAdminShell } from "@/components/HrAdminShell";
import { prisma } from "@/lib/prisma";
import { requireAnyRole } from "@/lib/hr/permissions/authorize";
import type { HrPermissionKey } from "@/lib/hr/permissions/catalog";

const links: Array<[string, string, HrPermissionKey?]> = [["Dashboard","/hr/admin/dashboard"],["Workforce Events","/hr/admin/workforce-events","workforce_event.review"],["Employment Lifecycle","/hr/admin/employment-lifecycle","employee.read_all"],["Hiring Teams","/hr/admin/hiring-teams","hiring_team.view"],["Vacancies","/hr/admin/vacancies","vacancy.view"],["Recruitment","/hr/admin/recruitment","application.view"],["Organization","/hr/admin/organization","organization.report.read"],["Reports","/hr/admin/reports","report.read"],["Employees","/hr/admin/employees","employee.read_all"],["Departments","/hr/admin/departments","department.manage"],["Positions","/hr/admin/positions","position.manage"],["Users","/hr/admin/users","user.read"],["Assignments","/hr/admin/assignments","assignment.create"],["Leave","/hr/admin/leave","leave.read_all"],["Payroll","/hr/admin/payroll","payroll.read"],["Documents","/hr/admin/documents","document.read_employee"],["Assets","/hr/admin/assets","asset.manage"],["Onboarding & Offboarding","/hr/admin/lifecycle","workflow.create"],["Workflows","/hr/admin/workflows","workflow.review"],["Audit","/hr/admin/audit","audit.read"],["Settings","/hr/admin/settings","settings.manage"],["Security","/hr/security"]];

export default async function HrAdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAnyRole(["ADMIN", "HR_ADMIN", "PAYROLL_ADMIN"]);
  const visibleLinks = links.filter(([, , permission]) => !permission || auth.permissions.has(permission));
  const [organization, unread] = await Promise.all([
    prisma.hrOrganization.findUnique({ where: { id: auth.user.organizationId }, select: { name: true } }),
    prisma.hrNotification.count({ where: { organizationId: auth.user.organizationId, userId: auth.user.id, readAt: null } }),
  ]);
  return <HrAdminShell email={auth.user.email} role={auth.roles[0] ?? "Administrator"} organization={organization?.name ?? "Zentric Analytics"} unread={unread} allowedLinks={visibleLinks.map(([, href]) => href)}>{children}</HrAdminShell>;
}
