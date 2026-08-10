"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell, BriefcaseBusiness, Building2, CalendarDays, ChevronDown, CircleUserRound,
  ClipboardCheck, FileText, FolderLock, Gauge, GitBranch, Landmark, LayoutDashboard,
  LogOut, Menu, Network, Package, ScrollText, Settings, UserRoundPlus, Users, WalletCards, X,
} from "lucide-react";
import { hrLogoutAction } from "@/app/hr/actions";
import { HrSessionRotation } from "./HrSessionRotation";

type Item = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };
const groups: Array<{ label?: string; items: Item[] }> = [
  { items: [{ label: "Dashboard", href: "/hr/admin/dashboard", icon: LayoutDashboard }] },
  { label: "CORE MANAGEMENT", items: [
    { label: "Organization", href: "/hr/admin/organization", icon: Building2 },
    { label: "Departments", href: "/hr/admin/departments", icon: Network },
    { label: "Positions", href: "/hr/admin/positions", icon: BriefcaseBusiness },
    { label: "Users", href: "/hr/admin/users", icon: CircleUserRound },
    { label: "Assignments", href: "/hr/admin/assignments", icon: Users },
    { label: "Leave", href: "/hr/admin/leave", icon: CalendarDays },
  ]},
  { label: "PEOPLE & WORKFORCE", items: [
    { label: "Employees", href: "/hr/admin/employees", icon: Users },
    { label: "Workforce Events", href: "/hr/admin/workforce-events", icon: GitBranch },
    { label: "Employment Lifecycle", href: "/hr/admin/employment-lifecycle", icon: ClipboardCheck },
    { label: "Hiring Teams", href: "/hr/admin/hiring-teams", icon: Users },
    { label: "Vacancies", href: "/hr/admin/vacancies", icon: BriefcaseBusiness },
    { label: "Recruitment", href: "/hr/admin/recruitment", icon: UserRoundPlus },
  ]},
  { label: "OPERATIONS", items: [
    { label: "Payroll", href: "/hr/admin/payroll", icon: WalletCards },
    { label: "Documents", href: "/hr/admin/documents", icon: FileText },
    { label: "Assets", href: "/hr/admin/assets", icon: Package },
    { label: "Workflows", href: "/hr/admin/workflows", icon: ClipboardCheck },
  ]},
  { label: "INTELLIGENCE", items: [
    { label: "Reports", href: "/hr/admin/reports", icon: Gauge },
    { label: "Audit", href: "/hr/admin/audit", icon: ScrollText },
  ]},
  { label: "SYSTEM", items: [
    { label: "Settings", href: "/hr/admin/settings", icon: Settings },
    { label: "Security", href: "/hr/security", icon: FolderLock },
  ]},
];

function Brand() {
  return <Link href="/hr/admin/dashboard" className="hr-brand" aria-label="Zentric Analytics HRMS dashboard"><span className="hr-brand-mark">Z</span><span><strong>ZENTRIC</strong><small>ANALYTICS HRMS</small></span></Link>;
}

export function HrAdminShell({ email, role, organization, unread, allowedLinks, children }: { email: string; role: string; organization: string; unread: number; allowedLinks: string[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const initials = email.split("@")[0].split(/[._-]/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "AD";
  const currentLabel = groups.flatMap(group => group.items).find(item => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? "Administration";
  return <div className="hr-admin-shell"><HrSessionRotation />
    <button className="hr-mobile-menu" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu /></button>
    {open && <button className="hr-sidebar-scrim" onClick={() => setOpen(false)} aria-label="Close navigation" />}
    <aside className={`hr-sidebar ${open ? "is-open" : ""}`}>
      <div className="hr-sidebar-brand"><Brand /><button onClick={() => setOpen(false)} aria-label="Close navigation"><X /></button></div>
      <nav aria-label="HR administration navigation" className="hr-sidebar-nav">{groups.map((group, index) => { const items = group.items.filter(item => allowedLinks.includes(item.href)); return items.length ? <div className="hr-nav-group" key={group.label ?? index}>{group.label && <p>{group.label}</p>}{items.map(item => { const active = pathname === item.href || (item.href !== "/hr/admin/dashboard" && pathname.startsWith(`${item.href}/`)); const Icon = item.icon; return <Link aria-current={active ? "page" : undefined} className={active ? "active" : ""} href={item.href} key={item.href} onClick={() => setOpen(false)}><Icon className="hr-nav-icon" />{item.label}</Link>; })}</div> : null; })}</nav>
      <div className="hr-account"><span>{initials}</span><div><strong title={email}>{email}</strong><small>{role.replaceAll("_", " ").toLowerCase()}</small></div><form action={hrLogoutAction}><button aria-label="Sign out" title="Sign out"><LogOut /></button></form></div>
    </aside>
    <div className="hr-admin-stage">
      <header className="hr-topbar"><p className="hr-breadcrumb"><Link href="/hr/admin/dashboard">Dashboard</Link><span>›</span>{currentLabel}</p><div className="hr-topbar-actions"><div className="hr-org"><Landmark /><span>{organization}</span><ChevronDown /></div><Link className="hr-notification" href="/hr/notifications" aria-label={`${unread} unread notifications`}><Bell />{unread > 0 && <span>{unread > 99 ? "99+" : unread}</span>}</Link><div className="hr-avatar" aria-label={`Signed in as ${email}`}>{initials}</div></div></header>
      <main className="hr-admin-main">{children}</main>
    </div>
  </div>;
}
