import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { csvCell } from "@/lib/hr/organization/import";

export async function GET() {
  const auth = await requirePermission("organization.report.export");
  const organizationId = auth.user.organizationId;
  const [legalEntities, businessUnits, divisions, departments, teams, locations, costCenters, jobs, grades, positions] = await Promise.all([
    prisma.hrLegalEntity.findMany({ where: { organizationId } }), prisma.hrBusinessUnit.findMany({ where: { organizationId } }),
    prisma.hrDivision.findMany({ where: { organizationId } }), prisma.hrDepartment.findMany({ where: { organizationId } }),
    prisma.hrTeam.findMany({ where: { organizationId } }), prisma.hrLocation.findMany({ where: { organizationId } }),
    prisma.hrCostCenter.findMany({ where: { organizationId } }), prisma.hrJobProfile.findMany({ where: { organizationId } }),
    prisma.hrGrade.findMany({ where: { organizationId } }), prisma.hrPosition.findMany({ where: { organizationId } }),
  ]);
  const rows = [["type","code","name","status"], ...[
    ...legalEntities.map(x => ["legal-entity",x.code,x.name,x.status]), ...businessUnits.map(x => ["business-unit",x.code,x.name,x.status]),
    ...divisions.map(x => ["division",x.code,x.name,x.status]), ...departments.map(x => ["department",x.code,x.name,x.status]),
    ...teams.map(x => ["team",x.code,x.name,x.status]), ...locations.map(x => ["location",x.code,x.name,x.status]),
    ...costCenters.map(x => ["cost-center",x.code,x.name,x.status]), ...jobs.map(x => ["job",x.code,x.title,x.status]),
    ...grades.map(x => ["grade",x.code,x.name,x.status]), ...positions.map(x => ["position",x.code,x.title,x.lifecycleStatus]),
  ]];
  await appendHrAudit(prisma, { organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrOrganization", entityId: organizationId, action: "hr.organization.report_exported", newValues: { rowCount: rows.length - 1 }, reason: "Organization structure CSV export" });
  return new Response(rows.map(row => row.map(csvCell).join(",")).join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="organization-structure.csv"', "cache-control": "private, no-store" } });
}
