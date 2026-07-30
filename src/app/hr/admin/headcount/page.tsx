import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";

export default async function HeadcountPage() {
  const auth = await requirePermission("organization.report.read");
  const organizationId = auth.user.organizationId;
  const [departments, positions, orphaned] = await Promise.all([
    prisma.hrDepartment.findMany({ where: { organizationId }, include: { employeeAssignments: { where: { status: "ACTIVE", OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] } }, positions: { where: { lifecycleStatus: { notIn: ["CLOSED", "CANCELLED"] } } } }, orderBy: { name: "asc" } }),
    prisma.hrPosition.findMany({ where: { organizationId, lifecycleStatus: { notIn: ["CLOSED", "CANCELLED"] } }, include: { employeeAssignments: { where: { status: "ACTIVE", OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] } } }, orderBy: { title: "asc" } }),
    prisma.hrEmployee.count({ where: { organizationId, employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] }, employmentAssignments: { none: { status: "ACTIVE", OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] } } } }),
  ]);
  return <><a className="text-sm font-semibold text-teal-700" href="/hr/admin/organization">← Organization workspace</a><h1 className="mt-3 text-3xl font-bold">Headcount and vacancies</h1>
    <div className="mt-6 grid gap-4 md:grid-cols-3"><div className="rounded-2xl bg-slate-900 p-5 text-white"><p>Approved capacity</p><strong className="text-3xl">{positions.reduce((sum, item) => sum + item.headcountLimit, 0)}</strong></div><div className="rounded-2xl bg-slate-900 p-5 text-white"><p>Filled seats</p><strong className="text-3xl">{positions.reduce((sum, item) => sum + item.employeeAssignments.length, 0)}</strong></div><div className="rounded-2xl bg-amber-50 p-5 text-amber-900"><p>Employees without assignment</p><strong className="text-3xl">{orphaned}</strong></div></div>
    <section className="mt-6 overflow-x-auto rounded-2xl bg-white p-5"><h2 className="font-bold">By department</h2><table className="mt-4 w-full text-left text-sm"><thead><tr><th>Department</th><th>Employees</th><th>Positions</th><th>Capacity</th></tr></thead><tbody>{departments.map(item => <tr className="border-t" key={item.id}><td className="py-3">{item.name}</td><td>{item.employeeAssignments.length}</td><td>{item.positions.length}</td><td>{item.positions.reduce((sum, position) => sum + position.headcountLimit, 0)}</td></tr>)}</tbody></table></section>
    <section className="mt-6 overflow-x-auto rounded-2xl bg-white p-5"><h2 className="font-bold">Position vacancy report</h2><table className="mt-4 w-full text-left text-sm"><thead><tr><th>Position</th><th>Status</th><th>Filled</th><th>Capacity</th><th>Vacancies</th></tr></thead><tbody>{positions.map(item => <tr className="border-t" key={item.id}><td className="py-3">{item.title}</td><td>{item.lifecycleStatus}</td><td>{item.employeeAssignments.length}</td><td>{item.headcountLimit}</td><td>{Math.max(0, item.headcountLimit - item.employeeAssignments.length)}</td></tr>)}</tbody></table></section>
  </>;
}
