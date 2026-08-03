import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { provisioningPayloadSchema, provisioningReadiness } from "@/lib/hr/employees/provisioning";
import { EmployeeProvisioningWizard } from "@/components/EmployeeProvisioningWizard";
import { createProvisioningDraftAction } from "./actions";

export default async function NewEmployeePage({ searchParams }: { searchParams: Promise<{ draft?: string; step?: string; saved?: string }> }) {
  const auth = await requirePermission("employee.create");
  const params = await searchParams;
  const drafts = await prisma.hrEmployeeProvisioningDraft.findMany({ where: { organizationId: auth.user.organizationId, status: { in: ["DRAFT", "PENDING_APPROVAL"] } }, orderBy: { updatedAt: "desc" }, take: 20 });
  if (!params.draft) return <><h1 className="text-3xl font-bold">Provision an employee</h1><p className="mt-2 text-slate-600">Create a complete, independently approved employee record without partial activation.</p><form action={createProvisioningDraftAction} className="mt-6"><button className="btn btn-primary">Start employee provisioning</button></form><section className="mt-8 rounded-2xl bg-white p-5"><h2 className="font-bold">Open drafts</h2><div className="mt-3 space-y-2">{drafts.map(draft => <a className="block rounded-xl border p-3 hover:border-teal-500" href={`?draft=${draft.id}&step=${draft.currentStep}`} key={draft.id}>{draft.status} · {draft.readinessScore}% ready · updated {draft.updatedAt.toLocaleString()}</a>)}{!drafts.length && <p className="text-slate-500">No open provisioning drafts.</p>}</div></section></>;
  const draft = drafts.find(({ id }) => id === params.draft);
  if (!draft) throw new Error("Provisioning draft is unavailable.");
  const payload = provisioningPayloadSchema.parse(draft.payload);
  const [departments, teams, positions, managers, templates] = await Promise.all([
    prisma.hrDepartment.findMany({ where: { organizationId: auth.user.organizationId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.hrTeam.findMany({ where: { organizationId: auth.user.organizationId, status: "ACTIVE" }, include: { department: true }, orderBy: { name: "asc" } }),
    prisma.hrPosition.findMany({ where: { organizationId: auth.user.organizationId, status: "ACTIVE", lifecycleStatus: { in: ["OPEN", "PARTIALLY_FILLED"] } }, include: { department: true }, orderBy: { title: "asc" } }),
    prisma.hrEmployee.findMany({ where: { organizationId: auth.user.organizationId, employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] } }, orderBy: [{ lastName: "asc" }] }),
    prisma.hrLifecycleTemplate.findMany({ where: { organizationId: auth.user.organizationId, type: "ONBOARDING", active: true }, orderBy: [{ name: "asc" }, { version: "desc" }] }),
  ]);
  const readiness = provisioningReadiness(payload, { requireManager: managers.length > 0 });
  return <EmployeeProvisioningWizard draft={{ id: draft.id, status: draft.status, createdById: draft.createdById }} payload={payload} step={Math.min(8, Math.max(1, Number(params.step) || draft.currentStep))} score={readiness.score} checks={readiness.checks} actorId={auth.user.id}
    departments={departments.map(item => ({ id: item.id, label: item.name }))} teams={teams.map(item => ({ id: item.id, label: `${item.department.name} · ${item.name}` }))} positions={positions.map(item => ({ id: item.id, label: `${item.department.name} · ${item.title}` }))} managers={managers.map(item => ({ id: item.id, label: `${item.legalFirstName} ${item.lastName}` }))} templates={templates.map(item => ({ id: item.id, label: `${item.name} v${item.version}` }))} />;
}
