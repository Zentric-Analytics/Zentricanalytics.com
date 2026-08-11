import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";

export default async function AdminTimePage() {
  const auth = await requirePermission("time.read_all");
  const [policies, events, exceptions, periods, workers] = await Promise.all([
    prisma.hrTimePolicy.count({ where: { organizationId: auth.user.organizationId } }),
    prisma.hrTimeEvent.count({ where: { organizationId: auth.user.organizationId } }),
    prisma.hrAttendanceDay.count({ where: { organizationId: auth.user.organizationId, currentOutcome: { notIn: ["PRESENT", "APPROVED_LEAVE", "HOLIDAY", "NON_WORKING_DAY"] } } }),
    prisma.hrAttendancePeriod.findMany({ where: { organizationId: auth.user.organizationId }, orderBy: { startsOn: "desc" }, take: 20 }),
    prisma.hrTimeWorkerRun.findMany({ where: { organizationId: auth.user.organizationId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return <><h1 className="text-3xl font-bold">Time & attendance</h1><p className="mt-2 text-slate-600">Policy, exception, approval, lock, and authoritative handoff controls.</p><div className="mt-6 grid gap-4 md:grid-cols-3"><div className="rounded-2xl bg-white p-5"><p className="text-sm text-slate-500">Policies</p><p className="text-3xl font-bold">{policies}</p></div><div className="rounded-2xl bg-white p-5"><p className="text-sm text-slate-500">Immutable events</p><p className="text-3xl font-bold">{events}</p></div><div className="rounded-2xl bg-white p-5"><p className="text-sm text-slate-500">Open exceptions</p><p className="text-3xl font-bold">{exceptions}</p></div></div><section className="mt-6 rounded-2xl bg-white p-5"><h2 className="font-bold">Attendance periods</h2>{periods.map((period) => <p className="mt-2 text-sm" key={period.id}>{period.startsOn.toLocaleDateString()}–{period.endsOn.toLocaleDateString()} · {period.status} · v{period.version}</p>)}</section><section className="mt-6 rounded-2xl bg-white p-5"><h2 className="font-bold">Worker evidence</h2>{workers.map((run) => <p className="mt-2 text-sm" key={run.id}>{run.jobType} · {run.windowKey} · {run.status} · attempts {run.attemptCount}</p>)}</section></>;
}
