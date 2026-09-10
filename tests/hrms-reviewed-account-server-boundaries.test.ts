import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HrRoleKey } from "@prisma/client";
import { permissionsForRole } from "../src/lib/hr/permissions/catalog";

const mocks = vi.hoisted(() => ({ session: vi.fn(), transaction: vi.fn(), target: vi.fn(), role: vi.fn(), invite: vi.fn(), audit: vi.fn(), revokeSessions: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  forbidden: () => { throw new Error("Forbidden"); },
  redirect: (path: string) => { throw new Error(`Redirect: ${path}`); },
}));
vi.mock("@/lib/hr/auth/session", () => ({ getAuthenticatedHrUser: mocks.session, revokeAllHrSessions: mocks.revokeSessions }));
vi.mock("@/lib/hr/audit", () => ({ appendHrAudit: mocks.audit }));
vi.mock("@/lib/hr/permissions/mfa-policy", () => ({ privilegedMfaRequired: () => false }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  hrUser: { findFirstOrThrow: mocks.target }, hrRole: { findUniqueOrThrow: mocks.role }, $transaction: mocks.transaction,
} }));
vi.mock("@/lib/hr/auth/invitations", () => ({ createHrInvitation: mocks.invite }));
import { assignHrRoleAction, revokeHrRoleAction, createHrUserAction, resendHrInvitationAction, suspendHrUserAction } from "../src/app/hr/admin/users/actions";

function form() {
  return new Map<string, string>([
    ["userId", "cm1234567890123456789012"], ["email", "synthetic@example.test"],
    ["role", "EMPLOYEE"], ["invitationId", "cm1234567890123456789013"],
  ]);
}
function input() { const data = new FormData(); for (const [k, v] of form()) data.set(k, v); return data; }
function signIn(role: HrRoleKey, primary = false) {
  mocks.session.mockResolvedValue({ roles: [role], permissions: new Set(permissionsForRole(role)),
    user: { id: "actor", organizationId: "actor-org", isPrimaryAdmin: primary, mfaEnabled: true } });
}

describe("review two: real permission guard with isolated database doubles", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  for (const role of ["HR_ADMIN", "EMPLOYEE"] as const) {
    it.each([assignHrRoleAction, revokeHrRoleAction, createHrUserAction, resendHrInvitationAction])(
      `${role} cannot invoke restricted account actions directly`, async (action) => {
        signIn(role);
        await expect(action(input())).rejects.toThrow();
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.target).not.toHaveBeenCalled();
        expect(mocks.role).not.toHaveBeenCalled();
        expect(mocks.invite).not.toHaveBeenCalled();
      });
  }

  it.each([assignHrRoleAction, suspendHrUserAction, resendHrInvitationAction])(
    "requires an account in the actor organization before mutation", async (action) => {
      signIn("ADMIN", true);
      mocks.role.mockResolvedValue({ id: "employee-role" });
      mocks.target.mockRejectedValue(new Error("Scoped target not found"));
      await expect(action(input())).rejects.toThrow("Scoped target not found");
      expect(mocks.target).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: "cm1234567890123456789012", organizationId: "actor-org" }),
      }));
      expect(mocks.transaction).not.toHaveBeenCalled();
      expect(mocks.invite).not.toHaveBeenCalled();
    });

  it("rejects an unauthenticated role-change request before lookup", async () => {
    mocks.session.mockResolvedValue(null);
    await expect(assignHrRoleAction(input())).rejects.toThrow("Redirect: /hr/login");
    expect(mocks.target).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([
    { primary: true, role: "ADMIN" },
    { primary: true, role: "HR_ADMIN" },
    { primary: false, role: "HR_ADMIN" },
    { primary: false, role: "EMPLOYEE" },
  ])("allows reviewed ADMIN assignment path $primary / $role", async ({ primary, role }) => {
    signIn("ADMIN", primary);
    const data = input(); data.set("role", role);
    mocks.target.mockResolvedValue({ id: data.get("userId") });
    mocks.role.mockResolvedValue({ id: "scoped-role" });
    const upsert = vi.fn().mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback) => callback({ hrUserRole: { upsert } }));
    await assignHrRoleAction(data);
    expect(mocks.target).toHaveBeenCalledWith({ where: { id: data.get("userId"), organizationId: "actor-org" } });
    expect(mocks.role).toHaveBeenCalledWith({ where: { organizationId_key: { organizationId: "actor-org", key: role } } });
    expect(upsert).toHaveBeenCalledOnce();
    expect(mocks.audit).toHaveBeenCalledOnce();
    expect(mocks.revokeSessions).toHaveBeenCalledWith(data.get("userId"));
    expect(mocks.invite).not.toHaveBeenCalled();
  });

  it.each([true, false])("scopes revocation inside its transaction (primary=$0)", async (primary) => {
    signIn("ADMIN", primary);
    mocks.role.mockResolvedValue({ id: "scoped-role" });
    const lookup = vi.fn().mockRejectedValue(new Error("Scoped assignment not found"));
    const update = vi.fn();
    mocks.transaction.mockImplementation(async (callback) => callback({ hrUserRole: { findFirstOrThrow: lookup, update } }));
    await expect(revokeHrRoleAction(input())).rejects.toThrow("Scoped assignment not found");
    expect(lookup).toHaveBeenCalledWith({ where: { userId: input().get("userId"), roleId: "scoped-role", revokedAt: null, user: { organizationId: "actor-org" } } });
    expect(update).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.revokeSessions).not.toHaveBeenCalled();
  });

  it.each([1, 0])("protects remaining active administrators, excluding the revoked account (remaining=$0)", async (remaining) => {
    signIn("ADMIN", true);
    const data = input(); data.set("role", "ADMIN");
    mocks.role.mockResolvedValue({ id: "admin-role" });
    const count = vi.fn().mockResolvedValue(remaining);
    const update = vi.fn().mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback) => callback({ hrUserRole: {
      findFirstOrThrow: vi.fn().mockResolvedValue({ id: "assignment", userId: data.get("userId") }), count, update,
    } }));
    if (remaining) {
      await revokeHrRoleAction(data);
      expect(update).toHaveBeenCalledOnce();
      expect(mocks.audit).toHaveBeenCalledOnce();
      expect(mocks.revokeSessions).toHaveBeenCalledWith(data.get("userId"));
    } else {
      await expect(revokeHrRoleAction(data)).rejects.toThrow("The final active ADMIN role cannot be revoked.");
      expect(update).not.toHaveBeenCalled();
      expect(mocks.audit).not.toHaveBeenCalled();
      expect(mocks.revokeSessions).not.toHaveBeenCalled();
    }
    expect(count).toHaveBeenCalledWith({ where: { roleId: "admin-role", revokedAt: null,
      userId: { not: data.get("userId") }, user: { organizationId: "actor-org", status: "ACTIVE" } } });
  });
});
