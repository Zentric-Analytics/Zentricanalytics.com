import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
export default async function TeamsPage() {
  const auth = await requirePermission("organization.structure.manage");
  const teams = await prisma.hrTeam.findMany({ where: { organizationId: auth.user.organizationId }, include: { department: true, _count: { select: { assignments: true, positions: true } } }, orderBy: { name: "asc" } });
  return <><a className="text-sm font-semibold text-teal-700" href="/hr/admin/departments">← Manage teams</a><h1 className="mt-3 text-3xl font-bold">Teams</h1><div className="mt-6 grid gap-4 md:grid-cols-2">{teams.map(team => <article className="rounded-2xl bg-white p-5" key={team.id}><p className="font-mono text-sm">{team.code}</p><h2 className="font-bold">{team.name}</h2><p className="text-sm text-slate-600">{team.department.name} · {team._count.positions} positions · {team._count.assignments} assignment records</p></article>)}</div></>;
}
