import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { availableLeaveBalance } from "@/lib/hr/leave/engine";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";

export default async function EmployeeDashboard() {
  const auth = await requireAuthenticatedUser();
  const employee = auth.user.employee;
  const [balances, pendingLeave] = employee ? await Promise.all([
    prisma.hrLeaveBalance.findMany({ where: { employeeId: employee.id, periodYear: new Date().getUTCFullYear() } }),
    prisma.hrLeaveRequest.count({ where: { employeeId: employee.id, status: "PENDING" } }),
  ]) : [[], 0];
  const available = balances.reduce((total, balance) => total + availableLeaveBalance({ opening: Number(balance.opening), accrued: Number(balance.accrued), carriedOver: Number(balance.carriedOver), adjusted: Number(balance.adjusted), reserved: Number(balance.reserved), used: Number(balance.used), expired: Number(balance.expired) }), 0);
  return <><h1 className="text-3xl font-bold">My HR dashboard</h1><p className="mt-2 text-slate-600">Welcome, {employee?.preferredName ?? auth.user.email}.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-white p-5"><p className="text-sm text-slate-500">Available leave units</p><p className="mt-2 text-3xl font-bold">{available}</p></div><div className="rounded-2xl bg-white p-5"><p className="text-sm text-slate-500">Pending leave requests</p><p className="mt-2 text-3xl font-bold">{pendingLeave}</p></div></div><Link className="btn btn-primary mt-5 inline-flex" href="/hr/employee/leave">Manage my leave</Link></>;
}
