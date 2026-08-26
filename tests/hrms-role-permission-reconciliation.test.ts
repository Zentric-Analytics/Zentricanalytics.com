import { describe, expect, it } from "vitest";
import { HR_PERMISSION_KEYS, HR_ROLE_KEYS, permissionKeysByRole, reconcileHrRolePermissions } from "../scripts/hr-bootstrap-lib.mjs";

type Role = { id: string; organizationId: string; key: string; name: string };
type Permission = { id: string; organizationId: string; key: string };
type Pair = { id: string; roleId: string; permissionId: string };

function makeReconciliationDatabase(organizationIds = ["org-1"]) {
  const state = {
    organizations: organizationIds.map((id) => ({ id })),
    roles: [] as Role[],
    permissions: [] as Permission[],
    pairs: [] as Pair[],
    audits: [] as Array<Record<string, unknown>>,
    transactionOptions: [] as Array<Record<string, unknown>>,
    transactionQueryCounts: [] as number[],
  };
  let pairSequence = 0;
  const roleId = (organizationId: string, key: string) => `${organizationId}:role:${key}`;
  const permissionId = (organizationId: string, key: string) => `${organizationId}:permission:${key}`;
  const seedRole = (organizationId: string, key: string) => {
    const existing = state.roles.find((role) => role.organizationId === organizationId && role.key === key);
    if (existing) return existing;
    const role = { id: roleId(organizationId, key), organizationId, key, name: key.replaceAll("_", " ") };
    state.roles.push(role);
    return role;
  };
  const seedPermission = (organizationId: string, key: string) => {
    const existing = state.permissions.find((permission) => permission.organizationId === organizationId && permission.key === key);
    if (existing) return existing;
    const permission = { id: permissionId(organizationId, key), organizationId, key };
    state.permissions.push(permission);
    return permission;
  };
  const seedPair = (role: Role, permission: Permission) => {
    const existing = state.pairs.find((pair) => pair.roleId === role.id && pair.permissionId === permission.id);
    if (existing) return existing;
    const pair = { id: `pair-${++pairSequence}`, roleId: role.id, permissionId: permission.id };
    state.pairs.push(pair);
    return pair;
  };
  const seedCanonical = (organizationId: string) => {
    for (const key of HR_ROLE_KEYS) seedRole(organizationId, key);
    for (const key of HR_PERMISSION_KEYS) seedPermission(organizationId, key);
    for (const [roleKey, permissionKeys] of Object.entries(permissionKeysByRole)) {
      const role = seedRole(organizationId, roleKey);
      for (const key of permissionKeys) seedPair(role, seedPermission(organizationId, key));
    }
  };
  const permissionKeys = (organizationId: string, roleKey: string) => {
    const role = state.roles.find((entry) => entry.organizationId === organizationId && entry.key === roleKey);
    if (!role) return [];
    return state.pairs.filter((pair) => pair.roleId === role.id).map((pair) => state.permissions.find((permission) => permission.id === pair.permissionId)?.key).filter(Boolean).sort();
  };
  const prisma = {
    hrOrganization: { findMany: async () => state.organizations },
    $transaction: async (operation: (tx: object) => Promise<void>, options: Record<string, unknown>) => {
      let queries = 0;
      const counted = <T extends (...args: never[]) => unknown>(fn: T) => (async (...args: Parameters<T>) => { queries += 1; return fn(...args); }) as T;
      const tx = {
        hrRole: {
          createMany: counted(async ({ data }: { data: Role[] }) => { let count = 0; for (const item of data) if (!state.roles.some((role) => role.organizationId === item.organizationId && role.key === item.key)) { state.roles.push({ ...item, id: roleId(item.organizationId, item.key) }); count += 1; } return { count }; }),
          findMany: counted(async ({ where }: { where: { organizationId: string; key: { in: string[] } } }) => state.roles.filter((role) => role.organizationId === where.organizationId && where.key.in.includes(role.key)).map(({ id, key }) => ({ id, key }))),
        },
        hrPermission: {
          createMany: counted(async ({ data }: { data: Permission[] }) => { let count = 0; for (const item of data) if (!state.permissions.some((permission) => permission.organizationId === item.organizationId && permission.key === item.key)) { state.permissions.push({ ...item, id: permissionId(item.organizationId, item.key) }); count += 1; } return { count }; }),
          findMany: counted(async ({ where }: { where: { organizationId: string; key: { in: string[] } } }) => state.permissions.filter((permission) => permission.organizationId === where.organizationId && where.key.in.includes(permission.key)).map(({ id, key }) => ({ id, key }))),
        },
        hrRolePermission: {
          createMany: counted(async ({ data }: { data: Array<{ roleId: string; permissionId: string }> }) => { let count = 0; for (const item of data) if (!state.pairs.some((pair) => pair.roleId === item.roleId && pair.permissionId === item.permissionId)) { state.pairs.push({ id: `pair-${++pairSequence}`, ...item }); count += 1; } return { count }; }),
          findMany: counted(async ({ where }: { where: { roleId: { in: string[] } } }) => state.pairs.filter((pair) => where.roleId.in.includes(pair.roleId)).map((pair) => ({ ...pair, permission: { key: state.permissions.find((permission) => permission.id === pair.permissionId)?.key ?? "UNKNOWN" } }))),
          deleteMany: counted(async ({ where }: { where: { id: { in: string[] } } }) => { const before = state.pairs.length; state.pairs = state.pairs.filter((pair) => !where.id.in.includes(pair.id)); return { count: before - state.pairs.length }; }),
        },
        hrAuditEvent: { createMany: counted(async ({ data }: { data: Array<Record<string, unknown>> }) => { state.audits.push(...data); return { count: data.length }; }) },
      };
      await operation(tx);
      state.transactionOptions.push(options);
      state.transactionQueryCounts.push(queries);
    },
  };
  return { prisma, state, seedRole, seedPermission, seedPair, seedCanonical, permissionKeys };
}

describe("set-based canonical HR role-permission reconciliation", () => {
  it("does not change an already canonical organization and is idempotent", async () => {
    const db = makeReconciliationDatabase(); db.seedCanonical("org-1");
    const before = JSON.stringify({ roles: db.state.roles, permissions: db.state.permissions, pairs: db.state.pairs });
    await expect(reconcileHrRolePermissions(db.prisma)).resolves.toMatchObject({ organizations: 1, rolesCreated: 0, removed: 0 });
    await expect(reconcileHrRolePermissions(db.prisma)).resolves.toMatchObject({ organizations: 1, rolesCreated: 0, removed: 0 });
    expect(JSON.stringify({ roles: db.state.roles, permissions: db.state.permissions, pairs: db.state.pairs })).toBe(before);
    expect(db.state.transactionQueryCounts.every((count) => count <= 6)).toBe(true);
    expect(db.state.transactionOptions).toEqual([{ timeout: 15_000 }, { timeout: 15_000 }]);
  });

  it("creates a missing canonical permission and grants it only to canonical roles", async () => {
    const db = makeReconciliationDatabase(); db.seedCanonical("org-1");
    const key = "payroll.calculate";
    const permission = db.state.permissions.find((entry) => entry.key === key)!;
    db.state.permissions = db.state.permissions.filter((entry) => entry.id !== permission.id);
    db.state.pairs = db.state.pairs.filter((pair) => pair.permissionId !== permission.id);
    await reconcileHrRolePermissions(db.prisma);
    expect(db.permissionKeys("org-1", "PAYROLL_PROCESSOR")).toContain(key);
    expect(db.permissionKeys("org-1", "ADMIN")).not.toContain(key);
  });

  it("creates a missing built-in role with its exact canonical permissions", async () => {
    const db = makeReconciliationDatabase(); db.seedCanonical("org-1");
    const missing = db.state.roles.find((role) => role.key === "PAYROLL_APPROVER")!;
    db.state.roles = db.state.roles.filter((role) => role.id !== missing.id);
    db.state.pairs = db.state.pairs.filter((pair) => pair.roleId !== missing.id);
    await expect(reconcileHrRolePermissions(db.prisma)).resolves.toMatchObject({ rolesCreated: 1 });
    expect(db.permissionKeys("org-1", "PAYROLL_APPROVER")).toEqual([...permissionKeysByRole.PAYROLL_APPROVER].sort());
  });

  it("removes and audits a stale ADMIN permission", async () => {
    const db = makeReconciliationDatabase(); db.seedCanonical("org-1");
    db.seedPair(db.seedRole("org-1", "ADMIN"), db.seedPermission("org-1", "payroll.calculate"));
    await expect(reconcileHrRolePermissions(db.prisma)).resolves.toMatchObject({ removed: 1 });
    expect(db.permissionKeys("org-1", "ADMIN")).not.toContain("payroll.calculate");
    expect(db.state.audits).toEqual(expect.arrayContaining([expect.objectContaining({ action: "hr.role.permissions.reconciled", previousValues: { removedPermissionKeys: ["payroll.calculate"] } })]));
  });

  it.each(["ADMIN", "HR_ADMIN"])("never grants compensation or payroll permissions to %s", async (roleKey) => {
    const db = makeReconciliationDatabase(); await reconcileHrRolePermissions(db.prisma);
    expect(db.permissionKeys("org-1", roleKey).some((key) => key?.startsWith("compensation.") || key?.startsWith("payroll."))).toBe(false);
  });

  it.each(["PAYROLL_PROCESSOR", "PAYROLL_APPROVER"])("grants only the canonical set to %s", async (roleKey) => {
    const db = makeReconciliationDatabase(); await reconcileHrRolePermissions(db.prisma);
    expect(db.permissionKeys("org-1", roleKey)).toEqual([...permissionKeysByRole[roleKey as keyof typeof permissionKeysByRole]].sort());
  });

  it("preserves payment operator and approver separation", async () => {
    const db = makeReconciliationDatabase(); await reconcileHrRolePermissions(db.prisma);
    expect(db.permissionKeys("org-1", "PAYMENT_OPERATOR")).not.toContain("payroll.payment.approve");
    expect(db.permissionKeys("org-1", "PAYMENT_APPROVER")).not.toContain("payroll.payment.submit");
  });

  it("does not rewrite custom roles", async () => {
    const db = makeReconciliationDatabase(); db.seedCanonical("org-1");
    const custom = db.seedRole("org-1", "CUSTOM_FINANCE");
    db.seedPair(custom, db.seedPermission("org-1", "payroll.calculate"));
    await reconcileHrRolePermissions(db.prisma);
    expect(db.permissionKeys("org-1", "CUSTOM_FINANCE")).toEqual(["payroll.calculate"]);
  });

  it("removes an unknown permission from a built-in role", async () => {
    const db = makeReconciliationDatabase(); db.seedCanonical("org-1");
    db.seedPair(db.seedRole("org-1", "PAYROLL_PROCESSOR"), db.seedPermission("org-1", "legacy.unknown"));
    await reconcileHrRolePermissions(db.prisma);
    expect(db.permissionKeys("org-1", "PAYROLL_PROCESSOR")).not.toContain("legacy.unknown");
  });

  it("reconciles multiple organizations without crossing tenant boundaries", async () => {
    const db = makeReconciliationDatabase(["org-1", "org-2"]);
    db.seedCanonical("org-1"); db.seedCanonical("org-2");
    db.seedPair(db.seedRole("org-1", "ADMIN"), db.seedPermission("org-1", "payroll.calculate"));
    await expect(reconcileHrRolePermissions(db.prisma)).resolves.toMatchObject({ organizations: 2, removed: 1 });
    expect(db.permissionKeys("org-1", "ADMIN")).not.toContain("payroll.calculate");
    expect(db.permissionKeys("org-2", "PAYROLL_PROCESSOR")).toContain("payroll.calculate");
    expect(db.state.pairs.every((pair) => pair.roleId.split(":role:")[0] === pair.permissionId.split(":permission:")[0])).toBe(true);
  });
});
