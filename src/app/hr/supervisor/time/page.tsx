import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";
import { supervisedEmployeeIds } from "@/lib/hr/supervisors/scope";

export default async function SupervisorTimePage() {
  const auth = await requireAuthenticatedUser();
  if (!auth.permissions.has("time.read_team") && !auth.permissions.has("time.read_all")) throw new Error("Forbidden");
  if (!auth.user.employee) throw new Error("A supervisor employee profile is required.");
  const employeeIds = auth.permissions.has("time.read_all") ? undefined : await supervisedEmployeeIds(prisma, { organizationId: auth.user.organizationId, supervisorEmployeeId: auth.user.employee.id });
  const days = await prisma.hrAttendanceDay.findMany({ where: { organizationId: auth.user.organizationId, ...(employeeIds ? { employeeId: { in: employeeIds } } : {}) }, orderBy: { businessDate: "desc" }, take: 100 });
  return <><h1 className="text-3xl font-bold">Team time</h1><p className="mt-2 text-slate-600">Direct-report attendance only. Protected HR and medical fields are excluded.</p><section className="mt-6 rounded-2xl bg-white p-5">{days.map((day) => <p className="border-b py-2 text-sm" key={day.id}>{day.businessDate.toLocaleDateString()} · {day.currentOutcome} · employee {day.employeeId.slice(-6)}</p>)}{!days.length ? <p className="text-sm text-slate-500">No attendance records in scope.</p> : null}</section></>;
}
