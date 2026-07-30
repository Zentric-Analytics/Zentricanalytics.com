import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";

export default async function LeaveCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const auth = await requirePermission("leave.read_all");
  const requested = (await searchParams).month;
  const parsed = requested && /^\d{4}-\d{2}$/.test(requested) ? new Date(`${requested}-01T00:00:00.000Z`) : new Date();
  const start = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
  const end = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 1));
  const [requests, holidays] = await Promise.all([
    prisma.hrLeaveRequest.findMany({ where: { organizationId: auth.user.organizationId, status: "APPROVED", startDate: { lt: end }, endDate: { gte: start } }, include: { employee: true, leaveType: true }, orderBy: { startDate: "asc" } }),
    prisma.hrPublicHoliday.findMany({ where: { organizationId: auth.user.organizationId, date: { gte: start, lt: end } }, orderBy: { date: "asc" } }),
  ]);
  const previous = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).toISOString().slice(0, 7);
  return <><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold">Leave calendar</h1><p className="mt-2 text-slate-600">{start.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}</p></div><div className="flex gap-2"><Link className="btn btn-secondary" href={`/hr/admin/leave/calendar?month=${previous}`}>Previous</Link><Link className="btn btn-secondary" href={`/hr/admin/leave/calendar?month=${next}`}>Next</Link></div></div><div className="mt-6 grid gap-5 lg:grid-cols-2"><section className="rounded-2xl bg-white p-5"><h2 className="font-bold">Approved leave</h2><ul className="mt-4 space-y-3">{requests.map((request) => <li className="border-b pb-3 last:border-0" key={request.id}><p className="font-semibold">{request.employee.legalFirstName} {request.employee.lastName} · {request.leaveType.name}</p><p className="text-sm text-slate-600">{request.startDate.toLocaleDateString()} – {request.endDate.toLocaleDateString()}</p></li>)}</ul>{!requests.length ? <p className="mt-3 text-sm text-slate-500">No approved leave overlaps this month.</p> : null}</section><section className="rounded-2xl bg-white p-5"><h2 className="font-bold">Public holidays</h2><ul className="mt-4 space-y-3">{holidays.map((holiday) => <li className="border-b pb-3 last:border-0" key={holiday.id}><p className="font-semibold">{holiday.name}</p><p className="text-sm text-slate-600">{holiday.date.toLocaleDateString()}{holiday.region ? ` · ${holiday.region}` : ""}</p></li>)}</ul>{!holidays.length ? <p className="mt-3 text-sm text-slate-500">No holidays configured for this month.</p> : null}</section></div></>;
}
