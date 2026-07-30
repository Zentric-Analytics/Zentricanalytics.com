import Link from "next/link";
import type { HrEmploymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";

const statuses: HrEmploymentStatus[] = ["DRAFT", "ACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED", "ARCHIVED"];

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const auth = await requirePermission("employee.read_all");
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 100) ?? "";
  const status = statuses.includes(params.status as HrEmploymentStatus) ? params.status as HrEmploymentStatus : undefined;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const perPage = 50;
  const where: Prisma.HrEmployeeWhereInput = {
    organizationId: auth.user.organizationId,
    ...(status ? { employmentStatus: status } : {}),
    ...(q ? { OR: [
      { employeeNumber: { contains: q, mode: "insensitive" } },
      { legalFirstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { companyEmail: { contains: q, mode: "insensitive" } },
    ] } : {}),
  };
  const [employees, total] = await Promise.all([
    prisma.hrEmployee.findMany({ where, include: { employmentAssignments: { where: { status: "ACTIVE", OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] }, include: { department: true, position: true }, orderBy: { effectiveFrom: "desc" }, take: 1 } }, orderBy: [{ lastName: "asc" }, { legalFirstName: "asc" }], skip: (page - 1) * perPage, take: perPage }),
    prisma.hrEmployee.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / perPage));
  const pageHref = (target: number) => {
    const query = new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(target) });
    return `?${query.toString()}`;
  };
  return <><h1 className="text-3xl font-bold">Employees</h1><p className="mt-2 text-slate-600">Complete employee records with effective-dated organization assignments.</p>
    <form className="mt-6 grid gap-3 rounded-2xl bg-white p-5 sm:grid-cols-[1fr_220px_auto]"><input className="input" name="q" defaultValue={q} placeholder="Search name, number, or company email" /><select className="input" name="status" defaultValue={status ?? ""}><option value="">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select><button className="btn btn-secondary">Filter</button></form>
    {auth.permissions.has("employee.create") && <section className="mt-6 rounded-2xl bg-white p-5"><h2 className="font-bold">Provision an employee</h2><p className="mt-2 text-sm text-slate-600">Create the personnel record, assignment, manager, compensation, payroll details, access, and onboarding through one controlled workflow.</p><Link className="btn btn-primary mt-4 inline-flex" href="/hr/admin/employees/new">Start provisioning wizard</Link></section>}
    <div className="mt-6 overflow-x-auto rounded-2xl bg-white"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-4">Employee</th><th className="p-4">Number</th><th className="p-4">Contact</th><th className="p-4">Department</th><th className="p-4">Position</th><th className="p-4">Status</th></tr></thead><tbody>{employees.map((employee) => { const assignment = employee.employmentAssignments[0]; return <tr className="border-b last:border-0" key={employee.id}><td className="p-4"><Link className="font-semibold text-teal-700 underline-offset-2 hover:underline" href={`/hr/admin/employees/${employee.id}`}>{employee.legalFirstName} {employee.middleName} {employee.lastName}</Link></td><td className="p-4 font-mono">{employee.employeeNumber}</td><td className="p-4"><p className="break-all">{employee.companyEmail ?? "No company email"}</p><p className="text-slate-500">{employee.phone ?? "No phone"}</p></td><td className="p-4">{assignment?.department.name ?? "Unassigned"}</td><td className="p-4">{assignment?.position.title ?? "Unassigned"}</td><td className="p-4">{employee.employmentStatus}</td></tr>; })}</tbody></table>{!employees.length && <p className="p-6 text-slate-500">No employees match these filters.</p>}</div>
    <nav aria-label="Employee pages" className="mt-4 flex items-center justify-between text-sm"><span>Page {Math.min(page, pages)} of {pages} · {total} records</span><div className="flex gap-2">{page > 1 && <Link className="btn btn-secondary" href={pageHref(page - 1)}>Previous</Link>}{page < pages && <Link className="btn btn-secondary" href={pageHref(page + 1)}>Next</Link>}</div></nav>
  </>;
}
