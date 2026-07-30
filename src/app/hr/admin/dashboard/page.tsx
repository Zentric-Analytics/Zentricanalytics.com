import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";

export default async function Dashboard() {
  const auth = await requireAuthenticatedUser();
  const organizationId = auth.user.organizationId;
  const now = new Date();
  const inThirtyDays = new Date(now); inThirtyDays.setUTCDate(inThirtyDays.getUTCDate() + 30);
  const [employees, departments, positions, users, pendingInvitations, activeSupervisors, pendingOutbox, pendingPayroll, pendingLeave, expiringDocuments, assetReturns, overdueTasks, pendingWorkflows] = await Promise.all([
    prisma.hrEmployee.count({ where: { organizationId, employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] } } }),
    prisma.hrDepartment.count({ where: { organizationId, status: "ACTIVE" } }),
    prisma.hrPosition.count({ where: { organizationId, status: "ACTIVE" } }),
    prisma.hrUser.count({ where: { organizationId } }),
    prisma.hrUser.count({ where: { organizationId, status: "INVITED" } }),
    prisma.hrSupervisorAssignment.count({ where: { organizationId, status: "ACTIVE", effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] } }),
    prisma.hrEmailOutbox.count({ where: { organizationId, status: "PENDING" } }),
    auth.permissions.has("payroll.read") ? prisma.hrPayrollRun.count({ where: { organizationId, status: { in: ["DRAFT", "CALCULATED", "REVIEWED", "APPROVED"] } } }) : Promise.resolve(null),
    auth.permissions.has("leave.read_all") ? prisma.hrLeaveRequest.count({ where: { organizationId, status: "PENDING" } }) : Promise.resolve(null),
    auth.permissions.has("document.read_employee") ? prisma.hrEmployeeDocument.count({ where: { organizationId, archivedAt: null, expiresAt: { gte: now, lte: inThirtyDays } } }) : Promise.resolve(null),
    auth.permissions.has("asset.manage") ? prisma.hrAssetAssignment.count({ where: { organizationId, status: "ACTIVE", expectedReturnAt: { lte: inThirtyDays } } }) : Promise.resolve(null),
    auth.permissions.has("workflow.review") ? prisma.hrLifecycleTask.count({ where: { organizationId, status: { in: ["PENDING", "IN_PROGRESS"] }, dueAt: { lt: now } } }) : Promise.resolve(null),
    auth.permissions.has("workflow.review") ? prisma.hrWorkflowStageRun.count({ where: { organizationId, status: "ACTIVE" } }) : Promise.resolve(null),
  ]);
  const metrics: Array<[string, number]> = [["Active employees", employees], ["Departments", departments], ["Positions", positions], ["Users", users], ["Pending invitations", pendingInvitations], ["Active supervisor assignments", activeSupervisors], ["Pending email jobs", pendingOutbox]];
  if (pendingPayroll !== null) metrics.push(["Payroll runs awaiting completion", pendingPayroll]);
  if (pendingLeave !== null) metrics.push(["Pending leave requests", pendingLeave]);
  if (expiringDocuments !== null) metrics.push(["Documents expiring in 30 days", expiringDocuments]);
  if (assetReturns !== null) metrics.push(["Asset returns due/overdue", assetReturns]);
  if (overdueTasks !== null) metrics.push(["Overdue lifecycle tasks", overdueTasks]);
  if (pendingWorkflows !== null) metrics.push(["Active approval stages", pendingWorkflows]);
  return <><h1 className="text-3xl font-bold">HR administration dashboard</h1><p className="mt-2 text-slate-600">Current Core HR organization and access status.</p><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value]) => <div className="rounded-2xl bg-white p-5 shadow-sm" key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}</div></>;
}
