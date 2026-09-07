import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(), findUser: vi.fn(), transaction: vi.fn(), invite: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  hrUser: { findFirstOrThrow: mocks.findUser }, $transaction: mocks.transaction,
} }));
vi.mock("@/lib/hr/permissions/authorize", () => ({ requirePermission: mocks.authorize }));
vi.mock("@/lib/hr/auth/invitations", () => ({ createHrInvitation: mocks.invite }));
vi.mock("@/lib/hr/auth/session", () => ({ revokeAllHrSessions: vi.fn() }));
import {
  createHrUserAction, resendHrInvitationAction, assignHrRoleAction,
  revokeHrRoleAction, suspendHrUserAction,
} from "../src/app/hr/admin/users/actions";

function form(values: Record<string, string>) {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) result.set(key, value);
  return result;
}

describe("reviewed primary administrator boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ roles: ["ADMIN"], user: {
      id: "secondary", organizationId: "org", isPrimaryAdmin: false,
    } });
  });

  it.each([createHrUserAction, resendHrInvitationAction])("blocks a secondary admin's direct invitation before writes", async (action) => {
    await expect(action(form({ email: "new@example.test", role: "EMPLOYEE" })))
      .rejects.toThrow("Only the primary administrator");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.invite).not.toHaveBeenCalled();
  });

  it.each([assignHrRoleAction, revokeHrRoleAction])("blocks secondary admin changes to ADMIN assignments", async (action) => {
    await expect(action(form({ userId: "cm1234567890123456789012", role: "ADMIN" })))
      .rejects.toThrow("Only the primary administrator");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("protects the primary account from a crafted suspension request", async () => {
    mocks.findUser.mockResolvedValue({ id: "primary", isPrimaryAdmin: true, roles: [{ role: { key: "ADMIN" } }] });
    await expect(suspendHrUserAction(form({ userId: "primary" })))
      .rejects.toThrow("primary administrator cannot be suspended");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
