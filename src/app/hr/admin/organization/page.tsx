import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { approveOrganizationChangeAction, commitOrganizationImportAction, requestOrganizationChangeAction, validateOrganizationImportAction } from "./actions";

const dimensions = [
  ["Legal entities", "/hr/admin/legal-entities"], ["Business units", "/hr/admin/business-units"], ["Divisions", "/hr/admin/divisions"],
  ["Departments", "/hr/admin/departments"], ["Teams", "/hr/admin/teams"], ["Locations", "/hr/admin/locations"],
  ["Cost centers", "/hr/admin/cost-centers"], ["Job families", "/hr/admin/job-families"], ["Jobs", "/hr/admin/jobs"],
  ["Grades", "/hr/admin/grades"], ["Positions", "/hr/admin/positions"], ["Org chart", "/hr/admin/org-chart"], ["Headcount", "/hr/admin/headcount"],
];

export default async function OrganizationPage() {
  const auth = await requirePermission("organization.report.read");
  const organizationId = auth.user.organizationId;
  const [employees, positions, vacancies, changes] = await Promise.all([
    prisma.hrEmployee.count({ where: { organizationId, employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] } } }),
    prisma.hrPosition.count({ where: { organizationId, lifecycleStatus: { notIn: ["CLOSED", "CANCELLED"] } } }),
    prisma.hrPosition.count({ where: { organizationId, lifecycleStatus: { in: ["OPEN", "PARTIALLY_FILLED"] } } }),
    prisma.hrOrganizationChange.count({ where: { organizationId, status: { in: ["APPROVED", "SCHEDULED"] }, effectiveAt: { gt: new Date() } } }),
  ]);
  const batches = await prisma.hrOrganizationImportBatch.findMany({ where: { organizationId }, include: { rows: { where: { valid: false }, take: 5 } }, orderBy: { createdAt: "desc" }, take: 10 });
  const [departments, teams, positionOptions, scheduledChanges] = await Promise.all([
    prisma.hrDepartment.findMany({ where: { organizationId, status: "ACTIVE" }, select: { id: true, name: true } }),
    prisma.hrTeam.findMany({ where: { organizationId, status: "ACTIVE" }, select: { id: true, name: true } }),
    prisma.hrPosition.findMany({ where: { organizationId, lifecycleStatus: { notIn: ["CLOSED", "CANCELLED"] } }, select: { id: true, title: true } }),
    prisma.hrOrganizationChange.findMany({ where: { organizationId, status: { in: ["PENDING_APPROVAL", "SCHEDULED", "FAILED"] } }, orderBy: { effectiveAt: "asc" } }),
  ]);
  return <><h1 className="text-3xl font-bold">Organization Management</h1><p className="mt-2 text-slate-600">Legal, operational, financial, geographic, HR and position structure management.</p>
    <div className="mt-6 grid gap-4 md:grid-cols-4">{[["Active employees", employees],["Positions", positions],["Vacancies", vacancies],["Future changes", changes]].map(([label,value]) => <div className="rounded-2xl bg-slate-900 p-5 text-white" key={label}><p className="text-sm text-slate-300">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}</div>
    <div className="mt-6 grid gap-4 md:grid-cols-3">{dimensions.map(([label,href]) => <a className="rounded-2xl bg-white p-5 font-semibold hover:ring-2 hover:ring-teal-500" href={href} key={href}>{label}<span className="mt-2 block text-sm font-normal text-slate-500">Manage and review →</span></a>)}</div>
    <section className="mt-6 rounded-2xl bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Validated bulk exchange</h2><p className="text-sm text-slate-600">Validate before committing. Supported import templates: legal entity, job family, and grade.</p></div><a className="btn btn-secondary" href="/api/hr/organization/export">Export organization CSV</a></div>
      <form action={validateOrganizationImportAction} className="mt-4 flex flex-wrap gap-3"><select className="input" name="kind"><option value="legal-entity">Legal entities</option><option value="job-family">Job families</option><option value="grade">Grades</option></select><input className="input" name="file" type="file" accept=".csv,text/csv" required/><button className="btn btn-primary">Validate import</button></form>
      <div className="mt-5 space-y-3">{batches.map(batch => <article className="rounded-xl border p-4" key={batch.id}><div className="flex flex-wrap justify-between gap-3"><div><strong>{batch.originalName}</strong><p className="text-sm text-slate-600">{batch.kind} · {batch.validCount} valid · {batch.invalidCount} invalid · {batch.status}</p></div>{batch.status === "VALIDATED" && batch.invalidCount === 0 && <form action={commitOrganizationImportAction}><input type="hidden" name="batchId" value={batch.id}/><button className="btn btn-primary">Commit {batch.rowCount} rows</button></form>}</div>{batch.rows.map(row => <p className="mt-2 text-sm text-red-700" key={row.id}>Row {row.rowNumber}: {(row.errors as string[]).join("; ")}</p>)}</article>)}</div>
    </section>
    <section className="mt-6 rounded-2xl bg-white p-5"><h2 className="font-bold">Future-dated restructuring</h2><p className="text-sm text-slate-600">Schedule a name revision. A different authorized user must approve it before the worker can activate it.</p>
      <form action={requestOrganizationChangeAction} className="mt-4 grid gap-3 md:grid-cols-3"><select className="input" name="entityType"><option>DEPARTMENT</option><option>TEAM</option><option>POSITION</option></select><select className="input" name="entityId" required><option value="">Entity</option><optgroup label="Departments">{departments.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</optgroup><optgroup label="Teams">{teams.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</optgroup><optgroup label="Positions">{positionOptions.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</optgroup></select><input className="input" name="name" placeholder="Future name" required/><input className="input" name="effectiveAt" type="datetime-local" required/><input className="input" name="reason" placeholder="Business reason" required/><button className="btn btn-primary">Request change</button></form>
      <div className="mt-5 space-y-3">{scheduledChanges.map(change => <article className="rounded-xl border p-4" key={change.id}><strong>{change.entityType}</strong><p className="text-sm">{change.status} · effective {change.effectiveAt.toLocaleString()}</p>{change.failureCode && <p className="text-sm text-red-700">{change.failureCode}</p>}{change.status === "PENDING_APPROVAL" && <form action={approveOrganizationChangeAction} className="mt-3 flex gap-2"><input type="hidden" name="changeId" value={change.id}/><input className="input" name="reason" placeholder="Approval reason" required/><button className="btn btn-primary">Approve schedule</button></form>}</article>)}</div>
    </section>
  </>;
}
