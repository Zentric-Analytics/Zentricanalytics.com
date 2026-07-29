import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";
import { supervisedEmployeeIds } from "@/lib/hr/supervisors/scope";

export default async function SupervisorTeamPage() {
  const auth = await requireAuthenticatedUser();
  if (!auth.user.employee || !auth.permissions.has("supervisor.read_team")) throw new Error("Forbidden");
  const employeeIds = await supervisedEmployeeIds(prisma, { organizationId: auth.user.organizationId, supervisorEmployeeId: auth.user.employee.id });
  const employees = await prisma.hrEmployee.findMany({
    where: { organizationId: auth.user.organizationId, id: { in: employeeIds } },
    include: { employmentAssignments: { where: { status: "ACTIVE" }, include: { department: true, team: true, position: true }, orderBy: { effectiveFrom: "desc" }, take: 1 } },
    orderBy: [{ lastName: "asc" }, { legalFirstName: "asc" }],
  });
  return <main><h1 className="text-3xl font-bold">My team</h1><p className="mt-2 text-slate-600">Active direct-report, team, and department assignment scopes only. Salary, banking, identity, and personal-email fields are excluded.</p>
    <div className="mt-6 overflow-x-auto rounded-2xl bg-white"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-4">Employee</th><th className="p-4">Position</th><th className="p-4">Department</th><th className="p-4">Company contact</th><th className="p-4">Status</th></tr></thead><tbody>{employees.map((employee) => { const current = employee.employmentAssignments[0]; return <tr className="border-b last:border-0" key={employee.id}><td className="p-4 font-semibold">{employee.legalFirstName} {employee.lastName}<span className="block text-xs text-slate-500">{employee.employeeNumber}</span></td><td className="p-4">{current?.position.title ?? "—"}</td><td className="p-4">{current?.department.name ?? "—"}{current?.team ? ` · ${current.team.name}` : ""}</td><td className="break-all p-4">{employee.companyEmail ?? "—"}</td><td className="p-4">{employee.employmentStatus}</td></tr>; })}</tbody></table>{!employees.length && <p className="p-6 text-slate-500">No employees are currently within your active scope.</p>}</div>
  </main>;
}
