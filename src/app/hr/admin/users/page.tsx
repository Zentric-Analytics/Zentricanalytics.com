import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import {
  assignHrRoleAction,
  cancelHrInvitationAction,
  createHrUserAction,
  deleteHrInvitationAction,
  linkHrUserEmployeeAction,
  reactivateHrUserAction,
  resendHrInvitationAction,
  revokeHrRoleAction,
  suspendHrUserAction,
} from "./actions";
import { UserDeletionForm } from "./UserDeletionForm";
import { canAssignRole } from "@/lib/hr/permissions/catalog";

const roleKeys = ["ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "EMPLOYEE", "AUDITOR"] as const;

export default async function UsersPage() {
  const auth = await requirePermission("user.read");
  const mayAssignRoles = auth.permissions.has("user.role.assign");
  const mayRevokeRoles = auth.permissions.has("user.role.revoke");
  const assignableRoleKeys = roleKeys.filter((role) => canAssignRole(auth.roles, role));
  const [users, employees] = await Promise.all([
    prisma.hrUser.findMany({
      where: { organizationId: auth.user.organizationId },
      include: {
        employee: true,
        invitationsReceived: { orderBy: { createdAt: "desc" }, take: 10 },
        roles: { where: { revokedAt: null }, include: { role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
    prisma.hrEmployee.findMany({ where: { organizationId: auth.user.organizationId }, orderBy: [{ lastName: "asc" }, { legalFirstName: "asc" }] }),
  ]);

  return <>
    <h1 className="text-3xl font-bold">Users</h1>
    <p className="mt-2 text-slate-600">Manage invitations, account status, permanent roles, and employee identity links.</p>
    <section className="mt-6 rounded-2xl bg-white p-5">
      <h2 className="font-bold">Invite user</h2>
      <form action={createHrUserAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
        <input className="input" name="email" type="email" placeholder="Work email" required />
        <select className="input" name="role" defaultValue="EMPLOYEE">{assignableRoleKeys.map((role) => <option key={role}>{role}</option>)}</select>
        <button className="btn btn-primary">Create and invite</button>
      </form>
    </section>
    <div className="mt-6 space-y-4">{users.map((user) => {
      const hasActiveInvitation = user.invitationsReceived.some((invitation) => invitation.status === "ACTIVE" && !invitation.usedAt && invitation.expiresAt > new Date());
      const hasCancelledInvitation = user.invitationsReceived.some((invitation) => invitation.status === "REVOKED");
      return <article className="rounded-2xl bg-white p-5" key={user.id}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{user.email} {user.isPrimaryAdmin ? <span className="ml-2 rounded-full bg-teal-100 px-2 py-1 text-xs text-teal-800">Primary administrator</span> : null}</p>
            <p className="text-sm text-slate-500">{user.status} · {user.emailVerifiedAt ? "Verified" : "Not verified"} · Last login {user.lastLoginAt?.toLocaleString() ?? "Never"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {user.status === "ACTIVE" && !user.isPrimaryAdmin && user.id !== auth.user.id ? <form action={suspendHrUserAction}><input type="hidden" name="userId" value={user.id} /><button className="btn btn-secondary text-red-700">Suspend</button></form> : null}
            {user.status === "SUSPENDED" || user.status === "DISABLED" ? <form action={reactivateHrUserAction}><input type="hidden" name="userId" value={user.id} /><button className="btn btn-secondary">Reactivate</button></form> : null}
            {user.status === "INVITED" && hasActiveInvitation ? <form action={resendHrInvitationAction}><input type="hidden" name="userId" value={user.id} /><button className="btn btn-secondary">Resend invitation</button></form> : null}
            {auth.user.isPrimaryAdmin && user.status === "INVITED" && hasActiveInvitation ? <form action={cancelHrInvitationAction}><input type="hidden" name="userId" value={user.id} /><button className="btn btn-secondary text-amber-800">Cancel invitation</button></form> : null}
            {auth.user.isPrimaryAdmin && user.status === "INVITED" && !hasActiveInvitation && hasCancelledInvitation ? <form action={deleteHrInvitationAction}><input type="hidden" name="userId" value={user.id} /><button className="btn btn-secondary text-red-700">Delete invitation</button></form> : null}
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section>
            <h2 className="text-sm font-bold">Roles</h2>
            <div className="mt-2 flex flex-wrap gap-2">{user.roles.map(({ id, role }) => mayRevokeRoles ? <form action={revokeHrRoleAction} key={id}><input type="hidden" name="userId" value={user.id} /><input type="hidden" name="role" value={role.key} /><button className="rounded-full bg-slate-100 px-3 py-1 text-sm">{role.name} <span aria-hidden>×</span><span className="sr-only">Revoke</span></button></form> : <span className="rounded-full bg-slate-100 px-3 py-1 text-sm" key={id}>{role.name}</span>)}</div>
            {mayAssignRoles && <form action={assignHrRoleAction} className="mt-3 flex gap-2"><input type="hidden" name="userId" value={user.id} /><select className="input" name="role">{assignableRoleKeys.map((role) => <option key={role}>{role}</option>)}</select><button className="btn btn-secondary">Assign</button></form>}
          </section>
          <section>
            <h2 className="text-sm font-bold">Employee identity</h2>
            <p className="mt-2 text-sm">{user.employee ? `${user.employee.employeeNumber} — ${user.employee.legalFirstName} ${user.employee.lastName}` : "Not linked"}</p>
            <form action={linkHrUserEmployeeAction} className="mt-3 flex gap-2"><input type="hidden" name="userId" value={user.id} /><select className="input" name="employeeId" defaultValue={user.employee?.id ?? ""}><option value="">No employee link</option>{employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.employeeNumber} — {employee.legalFirstName} {employee.lastName}</option>)}</select><button className="btn btn-secondary">Save link</button></form>
          </section>
        </div>
        {auth.user.isPrimaryAdmin && !user.isPrimaryAdmin && user.id !== auth.user.id ? <section className="mt-4 border-t border-slate-200 pt-4">
          <h2 className="text-sm font-bold text-red-800">Deletion controls</h2>
          {user.status !== "DELETED"
            ? <UserDeletionForm hard={false} userId={user.id} />
            : <UserDeletionForm hard userId={user.id} />}
        </section> : null}
      </article>;
    })}</div>
  </>;
}
