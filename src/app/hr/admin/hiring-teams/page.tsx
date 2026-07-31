import { HIRING_TEAM_MEMBER_PERMISSIONS } from "@/lib/hr/recruitment/hiring-teams";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { prisma } from "@/lib/prisma";
import { addHiringTeamMemberAction, createHiringTeamAction, deactivateHiringTeamAction, endHiringTeamMemberAction } from "./actions";

export default async function HiringTeamsPage() {
  const auth = await requirePermission("hiring_team.view");
  const [teams, departments, users] = await Promise.all([
    prisma.hrHiringTeam.findMany({
      where: { organizationId: auth.user.organizationId },
      include: {
        department: true,
        members: { include: { user: true, permissions: { where: { revokedAt: null } } }, orderBy: { addedAt: "asc" } },
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    prisma.hrDepartment.findMany({ where: { organizationId: auth.user.organizationId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.hrUser.findMany({ where: { organizationId: auth.user.organizationId, status: "ACTIVE" }, orderBy: { email: "asc" } }),
  ]);
  const canCreate = auth.permissions.has("hiring_team.create");
  const canManageMembers = auth.permissions.has("hiring_team.manage_members");
  const canDeactivate = auth.permissions.has("hiring_team.deactivate");

  return <main>
    <p className="text-sm font-bold uppercase tracking-widest text-teal-700">Recruitment administration</p>
    <h1 className="mt-2 text-3xl font-bold">Hiring Teams</h1>
    <p className="mt-2 text-slate-600">Membership and capability grants are separate. Every action remains organization-scoped and server-authorized.</p>

    {canCreate ? <form action={createHiringTeamAction} className="mt-7 grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-2">
      <h2 className="text-xl font-bold md:col-span-2">Create Hiring Team</h2>
      <input className="input" name="name" placeholder="Team name" required />
      <select className="input" name="departmentId"><option value="">Organization-wide</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>
      <textarea className="input md:col-span-2" name="description" placeholder="Purpose and scope" />
      <button className="btn btn-primary md:col-span-2">Create Hiring Team</button>
    </form> : null}

    <section className="mt-7 space-y-5">
      {teams.length ? teams.map((team) => <article className="rounded-2xl border bg-white p-5" key={team.id}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-xl font-bold">{team.name}</h2><p className="text-sm text-slate-600">{team.department?.name ?? "Organization-wide"} · {team.status} · version {team.version}</p></div>
          {canDeactivate && team.status === "ACTIVE" ? <form action={deactivateHiringTeamAction} className="flex gap-2">
            <input type="hidden" name="teamId" value={team.id} /><input type="hidden" name="expectedVersion" value={team.version} />
            <input className="input" name="reason" placeholder="Deactivation reason" required minLength={3} />
            <button className="font-semibold text-red-700">Deactivate</button>
          </form> : null}
        </div>
        <div className="mt-4 space-y-3">
          {team.members.map((member) => <div className="rounded-xl bg-slate-50 p-3" key={member.id}>
            <p className="font-semibold">{member.user.email} · {member.status}</p>
            <p className="mt-1 break-words text-xs text-slate-600">{member.permissions.map(({ permission }) => permission).join(", ") || "No active permissions"}</p>
            {canManageMembers && member.status === "ACTIVE" ? <form action={endHiringTeamMemberAction} className="mt-2 flex gap-2"><input type="hidden" name="memberId" value={member.id} /><input className="input" name="reason" placeholder="Removal reason" required minLength={3} /><button className="font-semibold text-red-700">Remove</button></form> : null}
          </div>)}
        </div>
        {canManageMembers && team.status === "ACTIVE" ? <form action={addHiringTeamMemberAction} className="mt-4 grid gap-3 rounded-xl border p-4">
          <input type="hidden" name="hiringTeamId" value={team.id} />
          <select className="input" name="userId" required><option value="">Select active user</option>{users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}</select>
          <label className="text-sm font-semibold">Comma-separated team permissions
            <textarea className="input mt-2 w-full font-mono text-xs" name="permissions" defaultValue="application.view,application.review" required />
          </label>
          <details><summary className="cursor-pointer text-sm font-semibold">Allowed capabilities</summary><p className="mt-2 text-xs text-slate-600">{HIRING_TEAM_MEMBER_PERMISSIONS.join(", ")}</p></details>
          <button className="btn btn-secondary">Add or update member</button>
        </form> : null}
      </article>) : <p className="rounded-2xl border bg-white p-5 text-slate-600">No Hiring Teams have been configured.</p>}
    </section>
  </main>;
}
