import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";

const dimensions = [
  ["Legal entities", "/hr/admin/legal-entities"], ["Business units", "/hr/admin/business-units"], ["Divisions", "/hr/admin/divisions"],
  ["Departments", "/hr/admin/departments"], ["Teams", "/hr/admin/teams"], ["Locations", "/hr/admin/locations"],
  ["Cost centers", "/hr/admin/cost-centers"], ["Job families", "/hr/admin/job-families"], ["Jobs", "/hr/admin/jobs"],
  ["Grades", "/hr/admin/grades"], ["Positions", "/hr/admin/positions"], ["Org chart", "/hr/admin/org-chart"], ["Headcount", "/hr/admin/headcount"],
];

export default async function OrganizationPage() {
  const auth = await requirePermission("organization.report.read");
  const organizationId = auth.user.organizationId;
  const [employees, positions, vacancies, changes] = await Promise.all([
    prisma.hrEmployee.count({ where: { organizationId, employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] } } }),
    prisma.hrPosition.count({ where: { organizationId, lifecycleStatus: { notIn: ["CLOSED", "CANCELLED"] } } }),
    prisma.hrPosition.count({ where: { organizationId, lifecycleStatus: { in: ["OPEN", "PARTIALLY_FILLED"] } } }),
    prisma.hrOrganizationChange.count({ where: { organizationId, status: { in: ["APPROVED", "SCHEDULED"] }, effectiveAt: { gt: new Date() } } }),
  ]);
  return <><h1 className="text-3xl font-bold">Organization management</h1><p className="mt-2 text-slate-600">Legal, operational, financial, geographic, job, grade, and position structures.</p>
    <div className="mt-6 grid gap-4 md:grid-cols-4">{[["Active employees", employees],["Positions", positions],["Vacancies", vacancies],["Future changes", changes]].map(([label,value]) => <div className="rounded-2xl bg-slate-900 p-5 text-white" key={label}><p className="text-sm text-slate-300">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}</div>
    <div className="mt-6 grid gap-4 md:grid-cols-3">{dimensions.map(([label,href]) => <a className="rounded-2xl bg-white p-5 font-semibold hover:ring-2 hover:ring-teal-500" href={href} key={href}>{label}<span className="mt-2 block text-sm font-normal text-slate-500">Manage and review →</span></a>)}</div>
  </>;
}
