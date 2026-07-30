import type { HrRoleKey } from "@prisma/client";

export const HR_PERMISSIONS = [
  "user.create", "user.read", "user.update", "user.suspend", "user.invite", "user.role.assign", "user.role.revoke",
  "employee.create", "employee.read_all", "employee.read_assigned", "employee.read_self", "employee.update", "employee.update_self",
  "department.manage", "position.manage", "assignment.create", "assignment.update", "assignment.end", "assignment.override",
  "organization.structure.manage", "organization.structure.import", "organization.position.create", "organization.position.approve",
  "organization.position.manage_state", "organization.position.fill", "organization.assignment.transfer",
  "organization.report.read", "organization.report.export",
  "supervisor.assign", "supervisor.revoke", "supervisor.read_team", "supervisor.review_assigned",
  "leave.request", "leave.read_self", "leave.read_all", "leave.review_assigned", "leave.approve", "leave.override", "leave.policy.manage",
  "payroll.read", "payroll.create", "payroll.calculate", "payroll.review", "payroll.approve", "payroll.mark_paid", "payroll.export", "payroll.read_salary", "payroll.read_bank_details",
  "document.upload", "document.read_self", "document.read_employee", "document.read_sensitive", "document.update", "document.archive",
  "asset.manage", "asset.assign", "asset.return", "asset.read_self", "workflow.create", "workflow.assign", "workflow.review", "workflow.task.complete", "workflow.override",
  "report.read", "report.export", "audit.read", "settings.manage",
] as const;

export type HrPermissionKey = (typeof HR_PERMISSIONS)[number];

const rolePermissions: Record<HrRoleKey, readonly HrPermissionKey[]> = {
  ADMIN: HR_PERMISSIONS,
  HR_ADMIN: HR_PERMISSIONS.filter((permission) => !permission.startsWith("payroll.") && !["user.role.assign", "user.role.revoke", "settings.manage"].includes(permission)),
  PAYROLL_ADMIN: HR_PERMISSIONS.filter((permission) => permission.startsWith("payroll.") || ["employee.read_all", "workflow.task.complete", "report.read", "report.export"].includes(permission)),
  EMPLOYEE: ["employee.read_self", "employee.update_self", "leave.request", "leave.read_self", "document.read_self", "asset.read_self", "workflow.task.complete"],
};

export function permissionsForRole(role: HrRoleKey) {
  return rolePermissions[role];
}

export function canAssignRole(actorRoles: HrRoleKey[], targetRole: HrRoleKey) {
  if (actorRoles.includes("ADMIN")) return true;
  if (actorRoles.includes("HR_ADMIN")) return targetRole === "EMPLOYEE";
  return false;
}
