import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { openingHeadcount, percentage, reportPeriod, turnoverRate } from "@/lib/hr/reports/metrics";

export default async function ReportsPage() {
  const auth = await requirePermission("report.read");
  const organizationId = auth.user.organizationId;
  const now = new Date();
  const period = reportPeriod(now.getUTCFullYear());
  const canHr = auth.permissions.has("employee.read_all");
  const canLeave = auth.permissions.has("leave.read_all");
  const canPayroll = auth.permissions.has("payroll.read");
  const canAssets = auth.permissions.has("asset.manage");
  const canWorkflow = auth.permissions.has("workflow.review");
  const [headcount, hires, terminations, assignments, recruitmentGroups, leaveGroups, payrollRuns, assetGroups, workflowGroups, lifecycleDue] = await Promise.all([
    canHr ? prisma.hrEmployee.count({ where: { organizationId, employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] } } }) : Promise.resolve(0),
    canHr ? prisma.hrEmployee.count({ where: { organizationId, hireDate: { gte: period.startsAt, lt: period.endsAt } } }) : Promise.resolve(0),
    canHr ? prisma.hrEmployee.count({ where: { organizationId, terminationDate: { gte: period.startsAt, lt: period.endsAt } } }) : Promise.resolve(0),
    canHr ? prisma.hrEmployeeAssignment.findMany({ where: { organizationId, status: "ACTIVE", effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }, include: { department: true, employee: true } }) : Promise.resolve([]),
    canHr ? prisma.jobApplication.groupBy({ by: ["status"], where: { organizationId, deletedAt: null, createdAt: { gte: period.startsAt, lt: period.endsAt } }, _count: { _all: true } }) : Promise.resolve([]),
    canLeave ? prisma.hrLeaveRequest.groupBy({ by: ["status"], where: { organizationId, startDate: { gte: period.startsAt, lt: period.endsAt } }, _count: { _all: true }, _sum: { amount: true } }) : Promise.resolve([]),
    canPayroll ? prisma.hrPayrollRun.findMany({ where: { organizationId, status: { in: ["CALCULATED", "REVIEWED", "APPROVED", "LOCKED", "PAID"] }, period: { startsAt: { gte: period.startsAt, lt: period.endsAt } } }, include: { period: true, items: { select: { grossEarnings: true, totalDeductions: true, netPay: true } } }, orderBy: [{ period: { startsAt: "desc" } }, { version: "desc" }], take: 12 }) : Promise.resolve([]),
    canAssets ? prisma.hrAsset.groupBy({ by: ["status"], where: { organizationId }, _count: { _all: true } }) : Promise.resolve([]),
    canWorkflow ? prisma.hrWorkflowInstance.groupBy({ by: ["status"], where: { organizationId, startedAt: { gte: period.startsAt, lt: period.endsAt } }, _count: { _all: true } }) : Promise.resolve([]),
    canWorkflow ? prisma.hrLifecycleTask.count({ where: { organizationId, status: { in: ["PENDING", "IN_PROGRESS"] }, dueAt: { lt: now } } }) : Promise.resolve(0),
  ]);
  const opening = openingHeadcount({ closingHeadcount: headcount, hires, terminations });
  const turnover = turnoverRate({ openingHeadcount: opening, closingHeadcount: headcount, terminations });
  const departmentCounts = new Map<string, number>();
  for (const assignment of assignments) departmentCounts.set(assignment.department.name, (departmentCounts.get(assignment.department.name) ?? 0) + 1);
  const assetTotal = assetGroups.reduce((sum, group) => sum + group._count._all, 0);
  return <main><div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-bold">Reports & analytics</h1><p className="mt-2 text-slate-600">Tenant-scoped live metrics for {now.getUTCFullYear()}. Protected modules appear only when your permissions allow them.</p></div>{auth.permissions.has("report.export") && <div className="flex flex-wrap gap-2">{canHr && <><Link className="btn btn-secondary" href="/api/hr/reports/headcount">Headcount CSV</Link><Link className="btn btn-secondary" href="/api/hr/reports/turnover">Turnover CSV</Link><Link className="btn btn-secondary" href="/api/hr/reports/recruitment">Hiring pipeline CSV</Link><Link className="btn btn-secondary" href="/api/hr/reports/employees">Employees CSV</Link></>}{canLeave && <Link className="btn btn-secondary" href="/api/hr/reports/leave">Leave CSV</Link>}{canPayroll && <Link className="btn btn-secondary" href="/api/hr/reports/payroll">Payroll CSV</Link>}{canAssets && <Link className="btn btn-secondary" href="/api/hr/reports/assets">Assets CSV</Link>}{auth.permissions.has("audit.read") && <Link className="btn btn-secondary" href="/api/hr/reports/audit">Audit CSV</Link>}</div>}</div>
    {canHr && <><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Current headcount", headcount], ["Hires YTD", hires], ["Terminations YTD", terminations], ["Turnover rate", `${turnover}%`]].map(([label, value]) => <div className="rounded-2xl bg-white p-5" key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}</div><section className="mt-5 rounded-2xl bg-white p-5"><h2 className="font-bold">Headcount by department</h2><div className="mt-4 grid gap-3">{[...departmentCounts.entries()].sort((a, b) => b[1] - a[1]).map(([department, count]) => <div key={department}><div className="flex justify-between text-sm"><span>{department}</span><span>{count} · {percentage(count, headcount)}%</span></div><div className="mt-1 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-teal-600" style={{ width: `${percentage(count, headcount)}%` }} /></div></div>)}</div></section></>}
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      {canHr && <section className="rounded-2xl bg-white p-5"><h2 className="font-bold">Hiring pipeline</h2><table className="mt-4 w-full text-left text-sm"><thead><tr><th>Status</th><th>Applications</th></tr></thead><tbody>{recruitmentGroups.map((group) => <tr className="border-t" key={group.status}><td className="py-2">{group.status}</td><td>{group._count._all}</td></tr>)}</tbody></table></section>}
      {canLeave && <section className="rounded-2xl bg-white p-5"><h2 className="font-bold">Leave analytics</h2><table className="mt-4 w-full text-left text-sm"><thead><tr><th>Status</th><th>Requests</th><th>Amount</th></tr></thead><tbody>{leaveGroups.map((group) => <tr className="border-t" key={group.status}><td className="py-2">{group.status}</td><td>{group._count._all}</td><td>{group._sum.amount?.toString() ?? "0"}</td></tr>)}</tbody></table></section>}
      {canAssets && <section className="rounded-2xl bg-white p-5"><h2 className="font-bold">Asset portfolio</h2><table className="mt-4 w-full text-left text-sm"><thead><tr><th>Status</th><th>Count</th><th>Share</th></tr></thead><tbody>{assetGroups.map((group) => <tr className="border-t" key={group.status}><td className="py-2">{group.status}</td><td>{group._count._all}</td><td>{percentage(group._count._all, assetTotal)}%</td></tr>)}</tbody></table></section>}
      {canWorkflow && <section className="rounded-2xl bg-white p-5"><h2 className="font-bold">Workflow operations</h2><p className="mt-3 text-sm"><span className="text-3xl font-bold">{lifecycleDue}</span> overdue lifecycle tasks</p><table className="mt-4 w-full text-left text-sm"><tbody>{workflowGroups.map((group) => <tr className="border-t" key={group.status}><td className="py-2">{group.status}</td><td>{group._count._all}</td></tr>)}</tbody></table></section>}
      {canPayroll && <section className="rounded-2xl bg-white p-5 xl:col-span-2"><h2 className="font-bold">Payroll analytics</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Period</th><th>Version</th><th>Status</th><th>Employees</th><th>Gross</th><th>Deductions</th><th>Net</th></tr></thead><tbody>{payrollRuns.map((run) => { const totals = run.items.reduce((value, item) => ({ gross: value.gross.add(item.grossEarnings), deductions: value.deductions.add(item.totalDeductions), net: value.net.add(item.netPay) }), { gross: new Prisma.Decimal(0), deductions: new Prisma.Decimal(0), net: new Prisma.Decimal(0) }); return <tr className="border-t" key={run.id}><td className="py-2">{run.period.name}</td><td>{run.version}</td><td>{run.status}</td><td>{run.items.length}</td><td>{totals.gross.toFixed(2)}</td><td>{totals.deductions.toFixed(2)}</td><td>{totals.net.toFixed(2)}</td></tr>; })}</tbody></table></div></section>}
    </div>
  </main>;
}
