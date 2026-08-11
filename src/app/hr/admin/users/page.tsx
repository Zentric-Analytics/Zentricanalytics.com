import { Clock3, LockKeyhole, UserRoundPlus, UsersRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { assignHrRoleAction, cancelHrInvitationAction, createHrUserAction, deleteHrInvitationAction, linkHrUserEmployeeAction, reactivateHrUserAction, resendHrInvitationAction, revokeHrRoleAction, suspendHrUserAction } from "./actions";
import { UserDeletionForm } from "./UserDeletionForm";
import { canAssignRole } from "@/lib/hr/permissions/catalog";

const roleKeys = ["ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "EMPLOYEE", "AUDITOR"] as const;

export default async function UsersPage() {
  const auth = await requirePermission("user.read");
  const mayAssignRoles = auth.permissions.has("user.role.assign");
  const mayRevokeRoles = auth.permissions.has("user.role.revoke");
  const assignableRoleKeys = roleKeys.filter((role) => canAssignRole(auth.roles, role));
  const [users, employees] = await Promise.all([
    prisma.hrUser.findMany({ where: { organizationId: auth.user.organizationId }, include: { employee: true, invitationsReceived: { orderBy: { createdAt: "desc" }, take: 10 }, roles: { where: { revokedAt: null }, include: { role: true } } }, orderBy: { createdAt: "desc" }, take: 250 }),
    prisma.hrEmployee.findMany({ where: { organizationId: auth.user.organizationId }, orderBy: [{ lastName: "asc" }, { legalFirstName: "asc" }] }),
  ]);
  const stats = [
    { label: "Total users", value: users.length, note: "All system users", icon: UsersRound },
    { label: "Active users", value: users.filter(user => user.status === "ACTIVE").length, note: "Currently active", icon: UsersRound },
    { label: "Pending invites", value: users.filter(user => user.status === "INVITED").length, note: "Awaiting acceptance", icon: Clock3 },
    { label: "Suspended users", value: users.filter(user => ["SUSPENDED", "DISABLED"].includes(user.status)).length, note: "Access suspended", icon: LockKeyhole },
  ];
  return <main><div className="hr-page-heading"><div><h1 className="hr-page-title">Users</h1><p className="hr-page-subtitle">Manage invitations, account status, permanent roles, and employee identity links.</p></div><a className="btn btn-primary" href="#invite-user"><UserRoundPlus size={16}/> Invite user</a></div>
    <div className="hr-grid-4">{stats.map(({ label, value, note, icon: Icon }) => <article className="hr-card hr-stat" key={label}><span className="hr-icon"><Icon /></span><div><strong>{value}</strong><p>{label}</p><small>{note}</small></div></article>)}</div>
    <section className="hr-card hr-form-panel hr-wide-form" id="invite-user"><div className="hr-panel-heading"><span className="hr-icon"><UserRoundPlus /></span><div><h2>Invite new user</h2><p>Send an invitation and assign the initial repository-supported role.</p></div></div><form action={createHrUserAction} className="hr-user-invite"><label>Work email<input className="input" name="email" type="email" placeholder="e.g. john.doe@zentric.com" required /></label><label>Default role<select className="input" name="role" defaultValue="EMPLOYEE">{assignableRoleKeys.map(role => <option key={role}>{role}</option>)}</select></label><button className="btn btn-primary">Create and invite</button></form></section>
    <section className="hr-card hr-user-register"><div className="hr-register-heading"><div><h2>Users</h2><p>View and manage all organization-scoped accounts.</p></div><span>{users.length} records</span></div><div className="hr-user-list">{users.map(user => {
      const activeInvitation = user.invitationsReceived.some(invitation => invitation.status === "ACTIVE" && !invitation.usedAt && invitation.expiresAt > new Date());
      const cancelledInvitation = user.invitationsReceived.some(invitation => invitation.status === "REVOKED");
      const initials = user.email.slice(0, 2).toUpperCase();
      return <article className="hr-user-row" key={user.id}><header><span className="hr-person-avatar">{initials}</span><div><strong>{user.email}</strong><p><span className={`hr-status ${user.status === "ACTIVE" ? "success" : "neutral"}`}>{user.status}</span> · {user.emailVerifiedAt ? "Verified" : "Not verified"} · Last login {user.lastLoginAt?.toLocaleString() ?? "Never"}</p></div><div className="hr-user-primary-actions">{user.status === "ACTIVE" && !user.isPrimaryAdmin && user.id !== auth.user.id && <form action={suspendHrUserAction}><input type="hidden" name="userId" value={user.id}/><button className="btn btn-secondary">Suspend</button></form>}{["SUSPENDED","DISABLED"].includes(user.status) && <form action={reactivateHrUserAction}><input type="hidden" name="userId" value={user.id}/><button className="btn btn-secondary">Reactivate</button></form>}{user.status === "INVITED" && activeInvitation && <form action={resendHrInvitationAction}><input type="hidden" name="userId" value={user.id}/><button className="btn btn-secondary">Resend invitation</button></form>}{auth.user.isPrimaryAdmin && user.status === "INVITED" && activeInvitation && <form action={cancelHrInvitationAction}><input type="hidden" name="userId" value={user.id}/><button className="btn btn-secondary">Cancel invitation</button></form>}{auth.user.isPrimaryAdmin && user.status === "INVITED" && !activeInvitation && cancelledInvitation && <form action={deleteHrInvitationAction}><input type="hidden" name="userId" value={user.id}/><button className="btn btn-danger">Delete invitation</button></form>}</div></header>
        <div className="hr-user-details"><section><h3>Roles</h3><div className="hr-role-pills">{user.roles.map(({ id, role }) => mayRevokeRoles ? <form action={revokeHrRoleAction} key={id}><input type="hidden" name="userId" value={user.id}/><input type="hidden" name="role" value={role.key}/><button>{role.name} ×</button></form> : <span key={id}>{role.name}</span>)}</div>{mayAssignRoles && <form action={assignHrRoleAction} className="hr-inline-action"><input type="hidden" name="userId" value={user.id}/><select className="input" name="role">{assignableRoleKeys.map(role => <option key={role}>{role}</option>)}</select><button className="btn btn-secondary">Assign role</button></form>}</section><section><h3>Employee identity</h3><p>{user.employee ? `${user.employee.employeeNumber} — ${user.employee.legalFirstName} ${user.employee.lastName}` : "Not yet linked"}</p><form action={linkHrUserEmployeeAction} className="hr-inline-action"><input type="hidden" name="userId" value={user.id}/><select className="input" name="employeeId" defaultValue={user.employee?.id ?? ""}><option value="">No employee link</option>{employees.map(employee => <option value={employee.id} key={employee.id}>{employee.employeeNumber} — {employee.legalFirstName} {employee.lastName}</option>)}</select><button className="btn btn-secondary">Save link</button></form></section></div>
        {auth.user.isPrimaryAdmin && !user.isPrimaryAdmin && user.id !== auth.user.id && <section className="hr-user-delete"><h3>Deletion controls</h3>{user.status !== "DELETED" ? <UserDeletionForm hard={false} userId={user.id}/> : <UserDeletionForm hard userId={user.id}/>}</section>}
      </article>; })}</div>{!users.length && <p className="hr-empty">No users found.</p>}</section>
  </main>;
}
