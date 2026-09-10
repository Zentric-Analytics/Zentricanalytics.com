import React, { type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ResendInvitationForm } from "../src/app/hr/admin/users/ResendInvitationForm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), users: vi.fn() }));
vi.mock("@/lib/hr/permissions/authorize", () => ({ requirePermission: mocks.authorize }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  hrUser: { count: async () => 1, findMany: mocks.users, groupBy: async () => [] },
  hrEmployee: { findMany: async () => [] },
} }));
vi.mock("../src/app/hr/admin/users/actions", () => ({
  assignHrRoleAction: vi.fn(), cancelHrInvitationAction: vi.fn(), createHrUserAction: vi.fn(),
  deleteHrInvitationAction: vi.fn(), linkHrUserEmployeeAction: vi.fn(), reactivateHrUserAction: vi.fn(),
  resendHrInvitationAction: vi.fn(), resendHrInvitationWithStateAction: vi.fn(), revokeHrRoleAction: vi.fn(), suspendHrUserAction: vi.fn(),
}));
vi.mock("../src/app/hr/admin/users/UsersTable", () => ({ UsersTable: () => null }));
vi.mock("../src/app/hr/admin/users/UserDeletionForm", () => ({ UserDeletionForm: () => null }));
import UsersPage from "../src/app/hr/admin/users/page";

function content(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(content).join(" ");
  const element = node as ReactElement<{ children?: ReactNode; controls?: Record<string, ReactNode> }>;
  if (element.type === ResendInvitationForm) return renderToStaticMarkup(element);
  return content(element.props?.children) + " " + Object.values(element.props?.controls ?? {}).map(content).join(" ");
}

describe("reviewed user-management UI permissions", () => {
  beforeEach(() => {
    vi.stubGlobal("React", React);
    mocks.users.mockResolvedValue([{ id: "target", email: "user@example.test", employee: null,
      status: "INVITED", isPrimaryAdmin: false, createdAt: new Date(), lastLoginAt: null,
      invitationsReceived: [{ status: "ACTIVE", usedAt: null, expiresAt: new Date(Date.now() + 60000) }],
      roles: [{ id: "admin-role", role: { key: "ADMIN", name: "Administrator" } },
        { id: "employee-role", role: { key: "EMPLOYEE", name: "Employee" } }],
    }]);
  });

  async function page(primary: boolean, roles = ["ADMIN"]) {
    mocks.authorize.mockResolvedValue({ user: { id: "actor", organizationId: "org", isPrimaryAdmin: primary },
      roles, permissions: new Set(["user.create", "user.invite", "user.role.assign", "user.role.revoke"]) });
    return content(await UsersPage({ searchParams: Promise.resolve({}) })).replace(/\s+/g, " ");
  }

  it.each([["ADMIN"], ["HR_ADMIN"]])("hides direct invitation and ADMIN changes for non-primary %s", async (role) => {
    const text = await page(false, [role]);
    expect(text).not.toContain("Invite new user");
    expect(text).not.toContain("Invite user");
    expect(text).not.toContain("Resend invitation");
    expect(text).not.toContain("Remove Administrator");
    expect(text).not.toMatch(/\bADMIN\b/);
    expect(text).toContain("Assign role");
    expect(text).toContain("Remove Employee");
  });

  it("retains primary-admin invitation and role controls", async () => {
    const text = await page(true);
    expect(text).toContain("Invite new user");
    expect(text).toContain("Resend invitation");
    expect(text).toContain("Remove Administrator");
    expect(text).toMatch(/\bADMIN\b/);
  });
});
