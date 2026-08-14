import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";

export default async function TeamCompensationPage() {
  const auth = await requirePermission("compensation.recommendation.create");
  if (!auth.user.employee) throw new Error("A manager employee profile is required.");
  const organizationId = auth.user.organizationId;
  const scopes = await prisma.hrSupervisorAssignment.findMany({ where: { organizationId, supervisorEmployeeId: auth.user.employee.id, assignedEmployeeId: { not: null }, status: "ACTIVE", effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] }, include: { assignedEmployee: true } });
  const employeeIds = scopes.flatMap(({ assignedEmployeeId }) => assignedEmployeeId ? [assignedEmployeeId] : []);
  const [records, recommendations] = await Promise.all([
    prisma.hrCompensationRecord.findMany({ where: { organizationId, employeeId: { in: employeeIds }, status: "EFFECTIVE" }, select: { employeeId: true, amount: true, currency: true, payBasis: true, bandVersionId: true }, take: 200 }),
    prisma.hrCompRecommendation.findMany({ where: { organizationId, managerUserId: auth.user.id, employeeId: { in: employeeIds } }, select: { id: true, employeeId: true, status: true, proposedAmount: true, currency: true, rangePosition: true, version: true }, orderBy: { updatedAt: "desc" }, take: 200 }),
  ]);
  return <><h1 className="text-3xl font-bold">Team compensation</h1><p className="mt-2 text-slate-600">Only effective direct-report scope is queried server-side. Managers cannot edit markets, bands, policies, or view unrelated employees.</p><section className="mt-6 rounded-2xl bg-white p-5"><h2 className="font-bold">Authorized population</h2>{scopes.map(({ assignedEmployee }) => { const record = records.find((item) => item.employeeId === assignedEmployee?.id); const recommendation = recommendations.find((item) => item.employeeId === assignedEmployee?.id); return assignedEmployee ? <article className="mt-4 rounded-xl border p-4" key={assignedEmployee.id}><strong>{assignedEmployee.preferredName ?? `${assignedEmployee.legalFirstName} ${assignedEmployee.lastName}`}</strong><p className="mt-2 text-sm">{record ? `${record.currency} ${record.amount.toFixed(2)} · ${record.payBasis.toLowerCase()}` : "No effective record"}</p><p className="mt-1 text-sm text-slate-600">Recommendation: {recommendation ? `${recommendation.status} · v${recommendation.version} · ${recommendation.rangePosition}` : "not started"}</p></article> : null; })}</section></>;
}
