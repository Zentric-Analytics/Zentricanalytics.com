import type { HrRoleKey } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHrUser } from "@/lib/hr/auth/session";
import type { HrPermissionKey } from "./catalog";

export async function requireAuthenticatedUser() {
  const auth = await getAuthenticatedHrUser();
  if (!auth) redirect("/hr/login");
  return auth;
}

export async function requireRole(role: HrRoleKey) {
  const auth = await requireAuthenticatedUser();
  if (!auth.roles.includes(role)) throw new Error("Forbidden");
  return auth;
}

export async function requireAnyRole(roles: HrRoleKey[]) {
  const auth = await requireAuthenticatedUser();
  if (!roles.some((role) => auth.roles.includes(role))) throw new Error("Forbidden");
  return auth;
}

export async function requirePermission(permission: HrPermissionKey) {
  const auth = await requireAuthenticatedUser();
  if (!auth.permissions.has(permission)) throw new Error("Forbidden");
  return auth;
}

export async function requireAnyPermission(permissions: HrPermissionKey[]) {
  const auth = await requireAuthenticatedUser();
  if (!permissions.some((permission) => auth.permissions.has(permission))) throw new Error("Forbidden");
  return auth;
}

export async function canAccessEmployee(userId: string, employeeId: string, now = new Date()) {
  const user = await prisma.hrUser.findUnique({ where: { id: userId }, include: { employee: true, roles: { where: { revokedAt: null }, include: { role: { include: { permissions: { include: { permission: true } } } } } } } });
  if (!user || user.status !== "ACTIVE") return false;
  const permissions = new Set(user.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.key)));
  if (permissions.has("employee.read_all") || user.employee?.id === employeeId) return true;
  if (!user.employee || !permissions.has("supervisor.read_team")) return false;
  return Boolean(await prisma.hrSupervisorAssignment.findFirst({ where: { supervisorEmployeeId: user.employee.id, assignedEmployeeId: employeeId, status: "ACTIVE", effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }, select: { id: true } }));
}

export const canManageEmployee = canAccessEmployee;
