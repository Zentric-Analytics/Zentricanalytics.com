import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";
import { HR_PERMISSION_KEYS, HR_ROLE_KEYS, runHrBootstrap, validateBootstrapEnvironment } from "../scripts/hr-bootstrap-lib.mjs";
import { runHrPreflight } from "../scripts/hr-preflight-lib.mjs";

const validHash = bcrypt.hashSync("LocalTestOnly123", 12);
const validEnv = {
  APP_ENV: "staging",
  HR_BOOTSTRAP_CONFIRM_ENV: "staging",
  DATABASE_URL: "postgresql://hidden",
  BOOTSTRAP_ADMIN_EMAIL: "admin@example.test",
  BOOTSTRAP_ADMIN_PASSWORD_HASH: validHash,
  AUTH_SECRET: "test-auth-secret-that-is-longer-than-thirty-two-characters",
  APPLICATION_BASE_URL: "https://staging.example.test",
  EMAIL_WORKER_SECRET: "a".repeat(64),
  DOCUMENT_SCANNER_SECRET: "b".repeat(64),
  MONITORING_SECRET: "c".repeat(64),
  EMAIL_PROVIDER: "console",
  OBJECT_STORAGE_PROVIDER: "s3-compatible",
  OBJECT_STORAGE_ENDPOINT: "https://objects.example.test",
  OBJECT_STORAGE_BUCKET: "test-private",
  OBJECT_STORAGE_REGION: "auto",
  OBJECT_STORAGE_ACCESS_KEY_ID: "test-access",
  OBJECT_STORAGE_SECRET_ACCESS_KEY: "test-secret",
  OBJECT_STORAGE_FORCE_PATH_STYLE: "false",
};

type State = {
  organization: null | { id: string; slug: string };
  users: Array<{ id: string; organizationId: string; email: string; passwordHash: string; status: string }>;
  roles: Map<string, { id: string; key: string; organizationId: string }>;
  permissions: Map<string, { id: string; key: string; organizationId: string }>;
  adminUserId: string | null;
  auditCount: number;
  writes: number;
};

function makeDatabase(initial?: Partial<State>, failAudit = false) {
  const state: State = { organization: null, users: [], roles: new Map(), permissions: new Map(), adminUserId: null, auditCount: 0, writes: 0, ...initial };
  const userRoleFind = async ({ where }: { where: { user?: { status?: string } } }) => {
    if (!state.adminUserId) return null;
    const user = state.users.find((item) => item.id === state.adminUserId);
    if (where.user?.status && user?.status !== where.user.status) return null;
    return { id: "assignment-admin", user, role: { key: "ADMIN", organization: state.organization } };
  };
  const prisma = {
    state,
    $queryRawUnsafe: vi.fn(async () => [{ "?column?": 1 }]),
    hrUserRole: { findFirst: vi.fn(userRoleFind) },
    hrOrganization: { findUnique: vi.fn(async () => state.organization) },
    hrUser: {
      findUnique: vi.fn(async ({ where }: { where: { organizationId_email: { email: string } } }) => state.users.find((user) => user.email === where.organizationId_email.email) ?? null),
      count: vi.fn(async () => 0),
    },
    hrRole: { count: vi.fn(async () => state.roles.size) },
    hrPermission: { count: vi.fn(async () => state.permissions.size) },
    hrDepartment: { count: vi.fn(async () => 0) },
    hrLeaveType: { count: vi.fn(async () => 0) },
    hrPayrollRun: { count: vi.fn(async () => 0) },
    hrEmployeeDocument: { count: vi.fn(async () => 0) },
    hrAsset: { count: vi.fn(async () => 0) },
    hrLifecycleTemplate: { count: vi.fn(async () => 0) },
    hrWorkflowDefinition: { count: vi.fn(async () => 0), findFirst: vi.fn(async (): Promise<{ id: string } | null> => ({ id: "workflow-definition-1" })) },
    $transaction: vi.fn(async (operation: (tx: object) => Promise<void>) => {
      const snapshot = { organization: state.organization, users: [...state.users], roles: new Map(state.roles), permissions: new Map(state.permissions), adminUserId: state.adminUserId, auditCount: state.auditCount, writes: state.writes };
      const tx = {
        hrOrganization: { upsert: async () => { state.writes++; return state.organization ?? (state.organization = { id: "org-1", slug: "zentric-analytics" }); } },
        hrRole: { upsert: async ({ create }: { create: { key: string } }) => { state.writes++; const role = state.roles.get(create.key) ?? { id: `role-${create.key}`, key: create.key, organizationId: "org-1" }; state.roles.set(create.key, role); return role; } },
        hrPermission: { upsert: async ({ create }: { create: { key: string } }) => { state.writes++; const permission = state.permissions.get(create.key) ?? { id: `permission-${create.key}`, key: create.key, organizationId: "org-1" }; state.permissions.set(create.key, permission); return permission; } },
        hrRolePermission: { upsert: async () => { state.writes++; return {}; } },
        hrUser: { create: async ({ data }: { data: { email: string; passwordHash: string; status: string } }) => { state.writes++; const user = { id: "user-admin", organizationId: "org-1", ...data }; state.users.push(user); return user; } },
        hrUserRole: { create: async ({ data }: { data: { userId: string } }) => { state.writes++; state.adminUserId = data.userId; return {}; } },
        hrOrganizationSetting: { upsert: async () => { state.writes++; return {}; } },
        hrAuditEvent: { create: async () => { if (failAudit) throw new Error("audit failed"); state.writes++; state.auditCount++; return {}; } },
      };
      try { await operation(tx); } catch (error) { Object.assign(state, snapshot); throw error; }
    }),
  };
  return prisma;
}

describe("guarded HRMS bootstrap", () => {
  it.each([
    ["missing bootstrap email", { BOOTSTRAP_ADMIN_EMAIL: "" }, "BOOTSTRAP_ADMIN_EMAIL is required"],
    ["invalid bootstrap email", { BOOTSTRAP_ADMIN_EMAIL: "invalid" }, "valid email"],
    ["missing password hash", { BOOTSTRAP_ADMIN_PASSWORD_HASH: "" }, "plaintext passwords are refused"],
    ["plaintext password", { BOOTSTRAP_ADMIN_PASSWORD_HASH: "DoNotAcceptPlaintext123" }, "bcrypt hash, not plaintext"],
    ["invalid bcrypt hash", { BOOTSTRAP_ADMIN_PASSWORD_HASH: "$2b$12$invalid" }, "valid bcrypt hash"],
    ["missing APP_ENV", { APP_ENV: "" }, "APP_ENV"],
    ["environment mismatch", { HR_BOOTSTRAP_CONFIRM_ENV: "production" }, "must exactly match APP_ENV"],
  ])("rejects %s", (_name, override, message) => {
    expect(() => validateBootstrapEnvironment({ ...validEnv, ...override })).toThrow(message);
  });

  it("creates the organization, roles, permissions, ADMIN, and audit event once", async () => {
    const db = makeDatabase();
    await expect(runHrBootstrap(db, validEnv)).resolves.toMatchObject({ status: "created", environment: "staging" });
    expect(db.state.organization?.slug).toBe("zentric-analytics");
    expect([...db.state.roles.keys()]).toEqual(expect.arrayContaining(HR_ROLE_KEYS));
    expect(db.state.permissions.size).toBe(HR_PERMISSION_KEYS.length);
    expect(db.state.adminUserId).toBe("user-admin");
    expect(db.state.auditCount).toBe(1);
    const writes = db.state.writes;
    await expect(runHrBootstrap(db, validEnv)).resolves.toMatchObject({ status: "already_initialized" });
    expect(db.state.writes).toBe(writes);
  });

  it("reuses an organization but rejects a conflicting user without replacing its password", async () => {
    const originalHash = bcrypt.hashSync("DifferentLocalTest123", 12);
    const db = makeDatabase({ organization: { id: "org-1", slug: "zentric-analytics" }, users: [{ id: "existing", organizationId: "org-1", email: "admin@example.test", passwordHash: originalHash, status: "ACTIVE" }] });
    await expect(runHrBootstrap(db, validEnv)).rejects.toThrow("conflicting existing account");
    expect(db.state.users[0].passwordHash).toBe(originalHash);
    expect(db.state.adminUserId).toBeNull();
  });

  it("rolls back every bootstrap write when the transaction fails", async () => {
    const db = makeDatabase({}, true);
    await expect(runHrBootstrap(db, validEnv)).rejects.toThrow("audit failed");
    expect(db.state.organization).toBeNull();
    expect(db.state.users).toHaveLength(0);
    expect(db.state.roles.size).toBe(0);
    expect(db.state.permissions.size).toBe(0);
  });

  it("reports only safe status text", async () => {
    const db = makeDatabase();
    const output: string[] = [];
    await runHrBootstrap(db, validEnv, (message) => output.push(message));
    const rendered = output.join("\n");
    expect(rendered).not.toContain(validEnv.DATABASE_URL);
    expect(rendered).not.toContain(validEnv.BOOTSTRAP_ADMIN_EMAIL);
    expect(rendered).not.toContain(validEnv.BOOTSTRAP_ADMIN_PASSWORD_HASH);
    expect(rendered).toContain("target environment: staging");
    expect(rendered).toContain("result: created");
  });
});

describe("read-only HRMS preflight", () => {
  it("detects a missing active ADMIN without writing", async () => {
    const db = makeDatabase({ organization: { id: "org-1", slug: "zentric-analytics" }, roles: new Map(HR_ROLE_KEYS.map((key) => [key, { id: `role-${key}`, key, organizationId: "org-1" }])), permissions: new Map(HR_PERMISSION_KEYS.map((key) => [key, { id: `permission-${key}`, key, organizationId: "org-1" }])) });
    const writes = db.state.writes;
    const result = await runHrPreflight(db, validEnv);
    expect(result.ready).toBe(false);
    expect(result.issues.join(" ")).toContain("no active ADMIN");
    expect(db.state.writes).toBe(writes);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("succeeds after initialization and remains read-only", async () => {
    const db = makeDatabase();
    await runHrBootstrap(db, validEnv);
    const writes = db.state.writes;
    await expect(runHrPreflight(db, validEnv)).resolves.toMatchObject({ ready: true, issues: [] });
    expect(db.state.writes).toBe(writes);
  });

  it("blocks production when the Unit 4 workforce approval definition is missing", async () => {
    const db = makeDatabase();
    await runHrBootstrap(db, validEnv);
    db.hrWorkflowDefinition.findFirst.mockResolvedValueOnce(null);
    const result = await runHrPreflight(db, { ...validEnv, APP_ENV: "production", APPLICATION_BASE_URL: "https://www.example.test" });
    expect(result.issues).toContain("No active production HrWorkforceEvent approval workflow definition exists.");
  });

  it("leaves legacy recruitment authentication untouched", () => {
    const packageText = readFileSync("package.json", "utf8");
    const legacyAuth = readFileSync("src/lib/admin-auth.ts", "utf8");
    const bootstrap = readFileSync("scripts/hr-bootstrap-lib.mjs", "utf8");
    expect(packageText).toContain('"hr:preflight"');
    expect(legacyAuth).toContain("ADMIN_SESSION_SECRET");
    expect(bootstrap).not.toContain("ADMIN_SESSION_SECRET");
    expect(bootstrap).not.toContain("process.env.ADMIN_PASSWORD_HASH");
  });
});
