import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { approvePositionAction, createPositionAction, openPositionAction, rejectPositionAction, submitPositionAction } from "./actions";

export default async function PositionsPage() {
  const auth = await requirePermission("position.manage");
  const organizationId = auth.user.organizationId;
  const [positions, departments, teams] = await Promise.all([
    prisma.hrPosition.findMany({ where: { organizationId }, include: { department: true, team: true, _count: { select: { employeeAssignments: true } } }, orderBy: [{ lifecycleStatus: "asc" }, { title: "asc" }] }),
    prisma.hrDepartment.findMany({ where: { organizationId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.hrTeam.findMany({ where: { organizationId, status: "ACTIVE" }, include: { department: true }, orderBy: { name: "asc" } }),
  ]);
  return <><h1 className="text-3xl font-bold">Positions</h1><p className="mt-2 text-slate-600">Approval-controlled organizational seats with governed capacity.</p>
    <section className="mt-6 rounded-2xl bg-white p-5"><h2 className="font-bold">Create draft position</h2><form action={createPositionAction} className="mt-4 grid gap-3 md:grid-cols-4">
      <input className="input" name="code" placeholder="Code" required /><input className="input" name="title" placeholder="Title" required />
      <select className="input" name="departmentId" required><option value="">Department</option>{departments.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
      <select className="input" name="teamId"><option value="">No team</option>{teams.map(item => <option value={item.id} key={item.id}>{item.department.name} — {item.name}</option>)}</select>
      <input className="input" name="currency" defaultValue="NGN" maxLength={3} required /><input className="input" name="salaryBandMinimum" type="number" min="0" step="0.01" placeholder="Band minimum" />
      <input className="input" name="salaryBandMaximum" type="number" min="0" step="0.01" placeholder="Band maximum" /><input className="input" name="description" placeholder="Description" />
      <button className="btn btn-primary">Create draft</button>
    </form></section>
    <div className="mt-6 space-y-4">{positions.map(position => <article className="rounded-2xl bg-white p-5" key={position.id}>
      <div className="flex flex-wrap justify-between gap-3"><div><p className="font-mono text-sm">{position.code}</p><h2 className="text-xl font-bold">{position.title}</h2><p className="text-sm text-slate-600">{position.department.name}{position.team ? ` · ${position.team.name}` : ""} · {position._count.employeeAssignments} assignment records</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{position.lifecycleStatus}</span></div>
      <p className="mt-3 text-sm">Capacity: {position.headcountLimit} people / {position.fullTimeEquivalent.toString()} FTE</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {position.lifecycleStatus === "DRAFT" && <DecisionForm action={submitPositionAction} id={position.id} label="Submit for approval" />}
        {position.lifecycleStatus === "PENDING_APPROVAL" && <><DecisionForm action={approvePositionAction} id={position.id} label="Approve" /><DecisionForm action={rejectPositionAction} id={position.id} label="Reject" secondary /></>}
        {position.lifecycleStatus === "APPROVED" && <DecisionForm action={openPositionAction} id={position.id} label="Open position" />}
      </div>
    </article>)}{!positions.length && <p className="rounded-2xl bg-white p-6 text-slate-500">No positions yet.</p>}</div>
  </>;
}

function DecisionForm({ action, id, label, secondary = false }: { action: (formData: FormData) => Promise<void>; id: string; label: string; secondary?: boolean }) {
  return <form action={action} className="flex flex-wrap gap-2"><input type="hidden" name="id" value={id}/><input className="input" name="reason" placeholder={`${label} reason`} required/><button className={`btn ${secondary ? "btn-secondary" : "btn-primary"}`}>{label}</button></form>;
}
