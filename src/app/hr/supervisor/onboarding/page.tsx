import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { completeLifecycleTaskAction } from "@/app/hr/admin/lifecycle/actions";

export default async function SupervisorOnboardingPage() {
  const auth = await requirePermission("workflow.task.complete");
  const assignments = await prisma.hrSupervisorAssignment.findMany({ where: { organizationId: auth.user.organizationId, supervisorEmployee: { userId: auth.user.id }, status: "ACTIVE", effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }] }, select: { assignedEmployeeId: true } });
  const employeeIds = assignments.flatMap(({ assignedEmployeeId }) => assignedEmployeeId ? [assignedEmployeeId] : []);
  const tasks = await prisma.hrLifecycleTask.findMany({ where: { organizationId: auth.user.organizationId, ownerType: "SUPERVISOR", instance: { employeeId: { in: employeeIds }, status: "ACTIVE" } }, include: { instance: { include: { employee: true } } }, orderBy: { dueAt: "asc" } });
  return <main><h1 className="text-3xl font-bold">Team lifecycle tasks</h1><p className="mt-2 text-slate-600">Only tasks for employees currently assigned to you are shown.</p><div className="mt-6 grid gap-4">{tasks.length === 0 ? <div className="rounded-2xl bg-white p-6 text-slate-600">No team lifecycle tasks are waiting.</div> : tasks.map((task) => <article className="rounded-2xl bg-white p-5" key={task.id}><h2 className="font-bold">{task.title}</h2><p className="text-sm text-slate-600">{task.instance.employee.employeeNumber} — {task.instance.employee.legalFirstName} {task.instance.employee.lastName} · due {task.dueAt.toLocaleDateString()} · {task.status}</p>{["PENDING", "IN_PROGRESS"].includes(task.status) && <form action={completeLifecycleTaskAction} className="mt-4 grid gap-3"><input type="hidden" name="taskId" value={task.id} /><textarea className="input" name="completionNotes" placeholder="Completion notes" required /><input className="input" name="evidenceReference" placeholder="Evidence reference" /><button className="btn btn-primary">Complete task</button></form>}</article>)}</div></main>;
}
