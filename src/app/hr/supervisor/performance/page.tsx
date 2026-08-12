import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { addTeamFeedbackAction, approveTeamGoalAction, recordTeamCheckInAction } from "./actions";

export default async function SupervisorPerformancePage() {
  const auth = await requirePermission("supervisor.review_assigned");
  if (!auth.user.employee) throw new Error("A manager employee profile is required.");
  const assignments = await prisma.hrSupervisorAssignment.findMany({
    where: { organizationId: auth.user.organizationId, supervisorEmployeeId: auth.user.employee.id, assignedEmployeeId: { not: null }, status: "ACTIVE", effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] },
    include: { assignedEmployee: true },
    orderBy: { assignedEmployee: { lastName: "asc" } },
  });
  const employeeIds = assignments.map(({ assignedEmployeeId }) => assignedEmployeeId).filter((id): id is string => id !== null);
  const goals = await prisma.hrPerformanceGoal.findMany({ where: { organizationId: auth.user.organizationId, employeeId: { in: employeeIds }, status: { in: ["PROPOSED", "ACTIVE", "RETURNED", "REVISED"] } }, orderBy: { updatedAt: "desc" }, take: 200 });
  const employeeName = (employee: NonNullable<(typeof assignments)[number]["assignedEmployee"]>) => employee.preferredName ?? `${employee.legalFirstName} ${employee.lastName}`;
  return <>
    <h1 className="text-3xl font-bold">Team performance</h1><p className="mt-2 text-slate-600">Direct-report goals, shared feedback, and lightweight check-ins. Direct URL requests remain constrained to the effective reporting line.</p>
    <section className="mt-6 rounded-2xl bg-white p-5"><h2 className="font-bold">Goal queue</h2><div className="mt-4 space-y-3">{goals.map((goal) => {
      const employee = assignments.find((item) => item.assignedEmployeeId === goal.employeeId)?.assignedEmployee;
      return <article className="rounded-xl border p-4" key={goal.id}><p><strong>{employee ? employeeName(employee) : "Direct report"}</strong> · {goal.goalType} · {goal.status} · v{goal.currentVersion}</p>{goal.status === "PROPOSED" && <form action={approveTeamGoalAction} className="mt-3 flex gap-2"><input type="hidden" name="employeeId" value={goal.employeeId ?? ""}/><input type="hidden" name="goalId" value={goal.id}/><input type="hidden" name="expectedVersion" value={goal.currentVersion}/><input className="input flex-1" name="reason" placeholder="Approval rationale" required/><button className="btn btn-primary">Approve</button></form>}</article>;
    })}</div></section>
    <section className="mt-6 grid gap-5 lg:grid-cols-2"><form action={addTeamFeedbackAction} className="rounded-2xl bg-white p-5"><h2 className="font-bold">Give structured feedback</h2><select className="input mt-4" name="employeeId" required><option value="">Direct report</option>{assignments.flatMap(({ assignedEmployee }) => assignedEmployee ? [<option key={assignedEmployee.id} value={assignedEmployee.id}>{employeeName(assignedEmployee)}</option>] : [])}</select><select className="input mt-3" name="kind"><option value="RECOGNITION">Recognition</option><option value="COACHING">Coaching</option><option value="DEVELOPMENTAL">Developmental</option></select><select className="input mt-3" name="visibility"><option value="EMPLOYEE_VISIBLE">Employee visible</option><option value="MANAGER_EMPLOYEE">Manager and employee</option><option value="HR_CONFIDENTIAL">HR confidential</option></select><textarea className="input mt-3" name="summary" placeholder="Evidence-based feedback" required/><button className="btn btn-primary mt-3">Submit immutable feedback</button></form>
      <form action={recordTeamCheckInAction} className="rounded-2xl bg-white p-5"><h2 className="font-bold">Record check-in</h2><select className="input mt-4" name="employeeId" required><option value="">Direct report</option>{assignments.flatMap(({ assignedEmployee }) => assignedEmployee ? [<option key={assignedEmployee.id} value={assignedEmployee.id}>{employeeName(assignedEmployee)}</option>] : [])}</select><input className="input mt-3" name="topics" placeholder="Shared topics" required/><input className="input mt-3" name="blockers" placeholder="Blockers"/><input className="input mt-3" name="agreedActions" placeholder="Agreed actions" required/><input className="input mt-3" name="followUpAt" type="date"/><button className="btn btn-primary mt-3">Record check-in</button></form></section>
  </>;
}
