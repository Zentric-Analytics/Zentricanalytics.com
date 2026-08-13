import Link from "next/link";
import { BriefcaseBusiness, Building2, CalendarClock, FileWarning, Mail, Network, UserRoundPlus, Users, WalletCards } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";

export default async function Dashboard() {
  const auth = await requirePermission("employee.read_all");
  const organizationId = auth.user.organizationId;
  const now = new Date(); const inThirtyDays = new Date(now); inThirtyDays.setUTCDate(inThirtyDays.getUTCDate() + 30);
  const [employees, departments, positions, users, invitations, supervisors, outbox, payroll, leave, documents, assets, overdue, approvals] = await Promise.all([
    prisma.hrEmployee.count({ where: { organizationId, employmentStatus: { in: ["ACTIVE", "ON_LEAVE"] } } }),
    prisma.hrDepartment.count({ where: { organizationId, status: "ACTIVE" } }), prisma.hrPosition.count({ where: { organizationId, status: "ACTIVE" } }),
    prisma.hrUser.count({ where: { organizationId } }), prisma.hrUser.count({ where: { organizationId, status: "INVITED" } }),
    prisma.hrSupervisorAssignment.count({ where: { organizationId, status: "ACTIVE", effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] } }),
    prisma.hrEmailOutbox.count({ where: { organizationId, status: "PENDING" } }),
    auth.permissions.has("payroll.read") ? prisma.hrPayrollRun.count({ where: { organizationId, status: { in: ["DRAFT", "CALCULATED", "REVIEWED", "APPROVED"] } } }) : Promise.resolve(null),
    auth.permissions.has("leave.read_all") ? prisma.hrLeaveRequest.count({ where: { organizationId, status: "PENDING" } }) : Promise.resolve(null),
    auth.permissions.has("document.read_employee") ? prisma.hrEmployeeDocument.count({ where: { organizationId, archivedAt: null, expiresAt: { gte: now, lte: inThirtyDays } } }) : Promise.resolve(null),
    auth.permissions.has("asset.manage") ? prisma.hrAssetAssignment.count({ where: { organizationId, status: "ACTIVE", expectedReturnAt: { lte: inThirtyDays } } }) : Promise.resolve(null),
    auth.permissions.has("workflow.review") ? prisma.hrLifecycleTask.count({ where: { organizationId, status: { in: ["PENDING", "IN_PROGRESS"] }, dueAt: { lt: now } } }) : Promise.resolve(null),
    auth.permissions.has("workflow.review") ? prisma.hrWorkflowStageRun.count({ where: { organizationId, status: "ACTIVE" } }) : Promise.resolve(null),
  ]);
  const stats = [
    { label: "Active employees", value: employees, href: "/hr/admin/employees", icon: Users }, { label: "Departments", value: departments, href: "/hr/admin/departments", icon: Building2 },
    { label: "Positions", value: positions, href: "/hr/admin/positions", icon: BriefcaseBusiness }, { label: "Users", value: users, href: "/hr/admin/users", icon: UserRoundPlus },
  ];
  const pending: Array<[string, number | null]> = [["Pending leave requests", leave], ["Pending invitations", invitations], ["Pending email jobs", outbox], ["Active supervisor assignments", supervisors], ["Active approval stages", approvals]];
  return <>
    <h1 className="hr-page-title">HR administration dashboard</h1><p className="hr-page-subtitle">Current Core HR organization and access status.</p>
    <div className="hr-grid-4">{stats.map(({ label, value, href, icon: Icon }) => <Link className="hr-card hr-stat" href={href} key={label}><span className="hr-icon"><Icon /></span><span><strong>{value}</strong><p>{label}</p><span className="hr-link">View details →</span></span></Link>)}</div>
    <div className="hr-section-grid">
      <section className="hr-card hr-panel"><h2>Pending actions</h2><div className="hr-list">{pending.filter((item): item is [string, number] => item[1] !== null).map(([label, value]) => <div className="hr-list-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>
      <section className="hr-card hr-panel"><h2>Workforce overview</h2><div className="hr-list">{[["Active employees",employees],["Departments",departments],["Positions",positions],["Users",users]].map(([label,value]) => <div className="hr-list-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>
      <section className="hr-card hr-panel"><h2>Operational status</h2><div className="hr-list">{[["Payroll runs awaiting completion",payroll],["Documents expiring in 30 days",documents],["Asset returns due/overdue",assets],["Overdue lifecycle tasks",overdue]].filter((item): item is [string, number] => item[1] !== null).map(([label,value]) => <div className="hr-list-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>
    </div>
    <div className="hr-section-grid">
      {documents !== null && <Link className="hr-card hr-stat" href="/hr/admin/documents"><span className="hr-icon"><FileWarning /></span><span><strong>{documents}</strong><p>Documents expiring in 30 days</p></span></Link>}
      {leave !== null && <Link className="hr-card hr-stat" href="/hr/admin/leave"><span className="hr-icon"><CalendarClock /></span><span><strong>{leave}</strong><p>Pending leave requests</p></span></Link>}
      {payroll !== null && <Link className="hr-card hr-stat" href="/hr/admin/payroll"><span className="hr-icon"><WalletCards /></span><span><strong>{payroll}</strong><p>Payroll runs awaiting completion</p></span></Link>}
    </div>
    <section className="hr-card hr-panel" style={{ marginTop: 17 }}><h2>At a glance</h2><div className="hr-grid-4" style={{ marginTop: 14 }}>{[["Active approvals",approvals],["Pending invitations",invitations],["Pending email jobs",outbox],["Overdue lifecycle tasks",overdue]].filter((item): item is [string, number] => item[1] !== null).map(([label,value], index) => <div className="hr-stat" key={label}><span className="hr-icon">{index === 1 ? <Mail /> : <Network />}</span><span><strong>{value}</strong><p>{label}</p></span></div>)}</div></section>
  </>;
}
