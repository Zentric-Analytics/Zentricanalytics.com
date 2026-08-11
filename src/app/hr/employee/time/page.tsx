import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { captureTimeEventAction } from "./actions";

export default async function EmployeeTimePage() {
  const auth = await requirePermission("time.read_self");
  if (!auth.user.employee) throw new Error("An employee profile is required.");
  const [sessions, days, timesheets] = await Promise.all([
    prisma.hrClockSession.findMany({ where: { organizationId: auth.user.organizationId, employeeId: auth.user.employee.id }, orderBy: { startedAt: "desc" }, take: 30 }),
    prisma.hrAttendanceDay.findMany({ where: { organizationId: auth.user.organizationId, employeeId: auth.user.employee.id }, include: { interpretations: { orderBy: { version: "desc" }, take: 1 } }, orderBy: { businessDate: "desc" }, take: 30 }),
    prisma.hrTimesheet.findMany({ where: { organizationId: auth.user.organizationId, employeeId: auth.user.employee.id }, orderBy: { periodStart: "desc" }, take: 20 }),
  ]);
  const open = sessions.find(({ status }) => status === "CLOCKED_IN" || status === "ON_BREAK");
  return <><h1 className="text-3xl font-bold">My time</h1><p className="mt-2 text-slate-600">Governed clock events, attendance outcomes, and weekly timesheets.</p><section className="mt-6 rounded-2xl bg-white p-5"><h2 className="font-bold">Clock</h2><p className="mt-2 text-sm">Current state: <strong>{open?.status ?? "NOT_STARTED"}</strong></p><form action={captureTimeEventAction} className="mt-4 flex flex-wrap gap-2">{!open ? <button className="btn btn-primary" name="eventType" value="CLOCK_IN">Clock in</button> : open.status === "CLOCKED_IN" ? <><button className="btn btn-secondary" name="eventType" value="BREAK_START">Start break</button><button className="btn btn-primary" name="eventType" value="CLOCK_OUT">Clock out</button></> : <button className="btn btn-primary" name="eventType" value="BREAK_END">End break</button>}</form></section><section className="mt-6 rounded-2xl bg-white p-5"><h2 className="font-bold">Attendance history</h2><div className="mt-3 space-y-2">{days.map((day) => <p className="text-sm" key={day.id}>{day.businessDate.toLocaleDateString()} · {day.currentOutcome} · v{day.currentVersion}</p>)}{!days.length ? <p className="text-sm text-slate-500">No interpreted attendance yet.</p> : null}</div></section><section className="mt-6 rounded-2xl bg-white p-5"><h2 className="font-bold">Timesheets</h2>{timesheets.map((sheet) => <p className="mt-2 text-sm" key={sheet.id}>{sheet.periodStart.toLocaleDateString()}–{sheet.periodEnd.toLocaleDateString()} · {sheet.status} · v{sheet.version}</p>)}</section></>;
}
