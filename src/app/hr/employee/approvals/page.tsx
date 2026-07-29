import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { decideWorkflowStageAction } from "@/app/hr/admin/workflows/actions";

export default async function EmployeeApprovalsPage() {
  const auth = await requirePermission("workflow.task.complete");
  const runs = await prisma.hrWorkflowStageRun.findMany({ where: { organizationId: auth.user.organizationId, status: "ACTIVE", approverUserIds: { has: auth.user.id }, instance: { status: "ACTIVE" } }, include: { instance: { include: { definition: true } }, approvals: true }, orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }] });
  return <main><h1 className="text-3xl font-bold">My approvals</h1><p className="mt-2 text-slate-600">Active workflow stages assigned exactly to your account.</p><div className="mt-6 grid gap-4">{runs.length === 0 ? <div className="rounded-2xl bg-white p-6 text-slate-600">No approval is waiting for you.</div> : runs.map((run) => <article className="rounded-2xl bg-white p-5" key={run.id}><h2 className="font-bold">{run.stageName}</h2><p className="text-sm text-slate-600">{run.instance.definition.name} · {run.instance.subjectType} {run.instance.subjectId} · {run.approvalMode} ({run.approvals.length}/{run.requiredApprovals}){run.dueAt ? ` · due ${run.dueAt.toLocaleString()}` : ""}</p><form action={decideWorkflowStageAction} className="mt-4 grid gap-3"><input type="hidden" name="stageRunId" value={run.id} /><select className="input" name="decision"><option>APPROVED</option><option>REJECTED</option></select><textarea className="input" name="reason" placeholder="Decision reason" required /><button className="btn btn-primary">Submit immutable decision</button></form></article>)}</div></main>;
}
