import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";
import { supervisedEmployeeIds } from "@/lib/hr/supervisors/scope";
import { reviewTimesheetAction } from "./actions";

export default async function SupervisorTimePage() {
  const auth = await requireAuthenticatedUser();
  if (!auth.user.employee) throw new Error("A supervisor employee profile is required.");
  const employeeIds = auth.permissions.has("time.read_all")
    ? undefined
    : await supervisedEmployeeIds(prisma, {
        organizationId: auth.user.organizationId,
        supervisorEmployeeId: auth.user.employee.id,
      });
  const [days, timesheets] = await Promise.all([
    prisma.hrAttendanceDay.findMany({
      where: { organizationId: auth.user.organizationId, ...(employeeIds ? { employeeId: { in: employeeIds } } : {}) },
      orderBy: { businessDate: "desc" },
      take: 100,
    }),
    prisma.hrTimesheet.findMany({
      where: {
        organizationId: auth.user.organizationId,
        status: { in: ["SUBMITTED", "IN_REVIEW"] },
        ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
      },
      orderBy: { submittedAt: "asc" },
      take: 100,
    }),
  ]);

  return <>
    <h1 className="text-3xl font-bold">Team time</h1>
    <p className="mt-2 text-slate-600">Direct-report attendance only. Protected HR and medical fields are excluded.</p>
    <section className="mt-6 rounded-2xl bg-white p-5">
      <h2 className="font-bold">Timesheets awaiting review</h2>
      {timesheets.map((sheet) => <form action={reviewTimesheetAction} className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border p-3" key={sheet.id}>
        <input type="hidden" name="timesheetId" value={sheet.id}/>
        <input type="hidden" name="expectedVersion" value={sheet.version}/>
        <p className="mr-auto text-sm">Employee {sheet.employeeId.slice(-6)} · {sheet.periodStart.toLocaleDateString()}–{sheet.periodEnd.toLocaleDateString()} · {sheet.status} v{sheet.version}</p>
        {sheet.status === "SUBMITTED"
          ? <button className="btn btn-primary" name="decision" value="IN_REVIEW">Start review</button>
          : <>
              <button className="btn btn-primary" name="decision" value="APPROVED">Approve</button>
              <button className="btn btn-secondary" name="decision" value="RETURNED">Return</button>
              <button className="btn btn-secondary" name="decision" value="REJECTED">Reject</button>
            </>}
      </form>)}
      {!timesheets.length ? <p className="mt-3 text-sm text-slate-500">No submitted timesheets in scope.</p> : null}
    </section>
    <section className="mt-6 rounded-2xl bg-white p-5">
      <h2 className="font-bold">Attendance</h2>
      {days.map((day) => <p className="border-b py-2 text-sm" key={day.id}>{day.businessDate.toLocaleDateString()} · {day.currentOutcome} · employee {day.employeeId.slice(-6)}</p>)}
      {!days.length ? <p className="text-slate-500">No attendance records in scope.</p> : null}
    </section>
  </>;
}
