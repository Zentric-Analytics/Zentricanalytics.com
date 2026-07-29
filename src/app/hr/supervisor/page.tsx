import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";

export default async function SupervisorDashboard() {
  const auth = await requireAuthenticatedUser();
  if (!auth.user.employee) throw new Error("An employee profile is required.");
  const assignments = await prisma.hrSupervisorAssignment.findMany({ where: { supervisorEmployeeId: auth.user.employee.id, status: "ACTIVE", effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] }, select: { assignedEmployeeId: true } });
  const employeeIds = [...new Set(assignments.flatMap(({ assignedEmployeeId }) => assignedEmployeeId ? [assignedEmployeeId] : []))];
  const pendingLeave = await prisma.hrLeaveRequest.count({ where: { employeeId: { in: employeeIds }, status: "PENDING" } });
  return <><h1 className="text-3xl font-bold">Supervisor dashboard</h1><p className="mt-2 text-slate-600">Only active assignment-scoped responsibilities are shown.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-white p-5"><p className="text-sm text-slate-500">Active direct reports</p><p className="mt-2 text-3xl font-bold">{employeeIds.length}</p></div><div className="rounded-2xl bg-white p-5"><p className="text-sm text-slate-500">Pending leave reviews</p><p className="mt-2 text-3xl font-bold">{pendingLeave}</p></div></div><Link className="btn btn-primary mt-5 inline-flex" href="/hr/supervisor/leave">Review leave requests</Link></>;
}
