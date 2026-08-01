import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";

export default async function SupervisorTasksPage() {
  const auth = await requireAuthenticatedUser();
  if (!auth.user.employee) throw new Error("Forbidden");
  const [tasks, approvals] = await Promise.all([
    prisma.hrLifecycleTask.findMany({ where: { organizationId: auth.user.organizationId, assignedUserId: auth.user.id, status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED"] } }, include: { instance: { include: { employee: true } } }, orderBy: { dueAt: "asc" }, take: 100 }),
    prisma.hrWorkflowStageRun.findMany({ where: { organizationId: auth.user.organizationId, status: "ACTIVE", approverUserIds: { has: auth.user.id } }, include: { instance: { include: { definition: true } } }, orderBy: { dueAt: "asc" }, take: 100 }),
  ]);
  return <main><h1 className="text-3xl font-bold">Review tasks</h1><p className="mt-2 text-slate-600">Lifecycle tasks and approval stages assigned directly to your account.</p>
    <div className="mt-6 grid gap-5 lg:grid-cols-2"><section className="rounded-2xl bg-white p-5"><h2 className="font-bold">Lifecycle tasks</h2><div className="mt-3 space-y-3">{tasks.map((task) => <article className="rounded-xl border p-4" key={task.id}><h3 className="font-semibold">{task.title}</h3><p className="text-sm text-slate-600">{task.instance.employee.legalFirstName} {task.instance.employee.lastName} · due {task.dueAt.toLocaleDateString()} · {task.status}</p></article>)}{!tasks.length && <p className="text-sm text-slate-500">No assigned lifecycle tasks.</p>}</div><Link className="mt-4 inline-block font-semibold text-teal-700" href="/hr/supervisor/onboarding">Open lifecycle workspace</Link></section>
      <section className="rounded-2xl bg-white p-5"><h2 className="font-bold">Workflow approvals</h2><div className="mt-3 space-y-3">{approvals.map((run) => <article className="rounded-xl border p-4" key={run.id}><h3 className="font-semibold">{run.stageName}</h3><p className="text-sm text-slate-600">{run.instance.definition.name}{run.dueAt ? ` · due ${run.dueAt.toLocaleString()}` : ""}</p></article>)}{!approvals.length && <p className="text-sm text-slate-500">No assigned approval stages.</p>}</div><Link className="mt-4 inline-block font-semibold text-teal-700" href="/hr/supervisor/reviews">Open approval workspace</Link></section></div>
  </main>;
}
