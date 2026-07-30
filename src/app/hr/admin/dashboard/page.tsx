import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";

export default async function Dashboard() {
  const auth = await requireAuthenticatedUser();
  const organizationId = auth.user.organizationId;
  const now = new Date();
  const [employees, departments, positions, users, pendingInvitations, activeSupervisors, pendingOutbox] = await Promise.all([
    prisma.hrEmployee.count({ where: { organizationId, employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] } } }),
    prisma.hrDepartment.count({ where: { organizationId, status: "ACTIVE" } }),
    prisma.hrPosition.count({ where: { organizationId, status: "ACTIVE" } }),
    prisma.hrUser.count({ where: { organizationId } }),
    prisma.hrUser.count({ where: { organizationId, status: "INVITED" } }),
    prisma.hrSupervisorAssignment.count({ where: { organizationId, status: "ACTIVE", effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] } }),
    prisma.hrEmailOutbox.count({ where: { organizationId, status: "PENDING" } }),
  ]);
  const metrics = [["Active employees", employees], ["Departments", departments], ["Positions", positions], ["Users", users], ["Pending invitations", pendingInvitations], ["Active supervisor assignments", activeSupervisors], ["Pending email jobs", pendingOutbox]];
  return <><h1 className="text-3xl font-bold">HR administration dashboard</h1><p className="mt-2 text-slate-600">Current Core HR organization and access status.</p><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value]) => <div className="rounded-2xl bg-white p-5 shadow-sm" key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}</div></>;
}
