import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";

export default async function OrgChartPage() {
  const auth = await requirePermission("organization.report.read");
  const organizationId = auth.user.organizationId;
  const positions = await prisma.hrPosition.findMany({ where: { organizationId, lifecycleStatus: { notIn: ["CLOSED", "CANCELLED"] } }, include: { department: true, employeeAssignments: { where: { status: "ACTIVE", OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] }, include: { employee: true } } }, orderBy: [{ department: { name: "asc" } }, { title: "asc" }] });
  return <><a className="text-sm font-semibold text-teal-700" href="/hr/admin/organization">← Organization workspace</a><h1 className="mt-3 text-3xl font-bold">Organization chart</h1><p className="mt-2 text-slate-600">Authoritative position and active-assignment view.</p>
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{positions.map(position => <article className="rounded-2xl bg-white p-5" key={position.id}><p className="text-xs uppercase text-slate-500">{position.department.name}</p><h2 className="mt-1 font-bold">{position.title}</h2><p className="font-mono text-xs">{position.code}</p><div className="mt-3 space-y-2">{position.employeeAssignments.map(({ employee }) => <a className="block rounded-lg bg-slate-50 p-3" href={`/hr/admin/employees/${employee.id}`} key={employee.id}>{employee.legalFirstName} {employee.lastName}<span className="block text-xs text-slate-500">{employee.employeeNumber}</span></a>)}{!position.employeeAssignments.length && <p className="rounded-lg bg-teal-50 p-3 text-sm text-teal-800">Vacant</p>}</div></article>)}</div>
  </>;
}
