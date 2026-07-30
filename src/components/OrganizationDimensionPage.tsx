import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { createOrganizationRecordAction } from "@/app/hr/admin/organization/actions";

export type OrganizationDimensionKind = "legal-entity" | "business-unit" | "division" | "location" | "cost-center" | "job-family" | "job" | "grade";

const labels: Record<OrganizationDimensionKind, string> = {
  "legal-entity": "Legal entities", "business-unit": "Business units", division: "Divisions", location: "Locations",
  "cost-center": "Cost centers", "job-family": "Job families", job: "Jobs", grade: "Grades",
};

export async function OrganizationDimensionPage({ kind }: { kind: OrganizationDimensionKind }) {
  const auth = await requirePermission("organization.structure.manage");
  const organizationId = auth.user.organizationId;
  const [legalEntities, businessUnits, jobFamilies] = await Promise.all([
    prisma.hrLegalEntity.findMany({ where: { organizationId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.hrBusinessUnit.findMany({ where: { organizationId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.hrJobFamily.findMany({ where: { organizationId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);
  const records: Array<{ id: string; code: string; name: string; status: string; effectiveFrom?: Date }> =
    kind === "legal-entity" ? await prisma.hrLegalEntity.findMany({ where: { organizationId }, orderBy: { name: "asc" } })
    : kind === "business-unit" ? await prisma.hrBusinessUnit.findMany({ where: { organizationId }, orderBy: { name: "asc" } })
    : kind === "division" ? await prisma.hrDivision.findMany({ where: { organizationId }, orderBy: { name: "asc" } })
    : kind === "location" ? await prisma.hrLocation.findMany({ where: { organizationId }, orderBy: { name: "asc" } })
    : kind === "cost-center" ? await prisma.hrCostCenter.findMany({ where: { organizationId }, orderBy: { name: "asc" } })
    : kind === "job-family" ? await prisma.hrJobFamily.findMany({ where: { organizationId }, orderBy: { name: "asc" } })
    : kind === "job" ? (await prisma.hrJobProfile.findMany({ where: { organizationId }, orderBy: { title: "asc" } })).map(record => ({ ...record, name: record.title }))
    : await prisma.hrGrade.findMany({ where: { organizationId }, orderBy: { level: "asc" } });

  const needsLegalEntity = ["business-unit", "location", "cost-center"].includes(kind);
  return <><a className="text-sm font-semibold text-teal-700" href="/hr/admin/organization">← Organization workspace</a>
    <h1 className="mt-3 text-3xl font-bold">{labels[kind]}</h1>
    <p className="mt-2 text-slate-600">Organization-scoped records with status and effective-date governance.</p>
    <section className="mt-6 rounded-2xl bg-white p-5"><h2 className="font-bold">Create {labels[kind].toLowerCase().replace(/s$/, "")}</h2>
      <form action={createOrganizationRecordAction} className="mt-4 grid gap-3 md:grid-cols-3">
        <input type="hidden" name="kind" value={kind} /><input className="input" name="code" placeholder="Code" required /><input className="input" name="name" placeholder="Name" required />
        {needsLegalEntity && <select className="input" name="legalEntityId" required><option value="">Legal entity</option>{legalEntities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
        {kind === "division" && <select className="input" name="businessUnitId" required><option value="">Business unit</option>{businessUnits.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
        {kind === "job" && <select className="input" name="jobFamilyId" required><option value="">Job family</option>{jobFamilies.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
        {["legal-entity", "location"].includes(kind) && <input className="input" name="countryCode" defaultValue="NG" maxLength={2} aria-label="Country code" />}
        {["legal-entity", "location"].includes(kind) && <input className="input" name="timezone" defaultValue="Africa/Lagos" aria-label="Timezone" />}
        {["legal-entity", "cost-center", "grade"].includes(kind) && <input className="input" name="currency" defaultValue="NGN" maxLength={3} aria-label="Currency" />}
        {kind === "location" && <select className="input" name="locationType"><option>HEAD_OFFICE</option><option>REGIONAL_OFFICE</option><option>BRANCH</option><option>CLIENT_SITE</option><option>REMOTE</option><option>VIRTUAL</option></select>}
        {kind === "grade" && <><input className="input" name="level" type="number" min="1" placeholder="Level" required /><input className="input" name="minimumSalary" type="number" min="0" step="0.01" placeholder="Minimum salary" /><input className="input" name="midpointSalary" type="number" min="0" step="0.01" placeholder="Midpoint salary" /><input className="input" name="maximumSalary" type="number" min="0" step="0.01" placeholder="Maximum salary" /></>}
        {!["job-family", "job", "grade"].includes(kind) && <input className="input" name="effectiveFrom" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />}
        <button className="btn btn-primary">Create</button>
      </form>
    </section>
    <section className="mt-6 overflow-x-auto rounded-2xl bg-white p-5"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-3">Code</th><th>Name</th><th>Status</th><th>Effective</th></tr></thead><tbody>{records.map(record => <tr className="border-b last:border-0" key={record.id}><td className="py-3 font-mono">{record.code}</td><td>{record.name}</td><td>{record.status}</td><td>{record.effectiveFrom?.toLocaleDateString() ?? "Current"}</td></tr>)}</tbody></table>{!records.length && <p className="py-5 text-slate-500">No records yet.</p>}</section>
  </>;
}
