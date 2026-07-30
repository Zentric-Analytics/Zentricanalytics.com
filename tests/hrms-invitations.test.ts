import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashOpaqueToken } from "../src/lib/hr/auth/crypto";

process.env.AUTH_SECRET = "unit-test-auth-secret-with-at-least-32-characters";

type Invitation = {
  id: string;
  organizationId: string;
  userId: string;
  tokenHash: string;
  status: "ACTIVE" | "USED" | "REVOKED";
  expiresAt: Date;
  usedAt: Date | null;
  user: {
    id: string;
    status: "INVITED" | "ACTIVE";
    passwordHash: string | null;
    emailVerifiedAt: Date | null;
    mfaEnabled: boolean;
    mfaSecretEncrypted: string | null;
    mfaLastUsedStep: bigint | null;
  };
};

const state = vi.hoisted(() => ({ invitation: null as Invitation | null }));
const tx = vi.hoisted(() => ({
  hrAccountInvitation: {
    findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) =>
      state.invitation?.tokenHash === where.tokenHash ? state.invitation : null),
    updateMany: vi.fn(async () => {
      const invitation = state.invitation;
      if (!invitation || invitation.status !== "ACTIVE" || invitation.usedAt || invitation.expiresAt <= new Date()) return { count: 0 };
      invitation.status = "USED";
      invitation.usedAt = new Date();
      return { count: 1 };
    }),
  },
  hrUser: {
    update: vi.fn(async ({ data }: { data: Partial<Invitation["user"]> }) => {
      Object.assign(state.invitation!.user, data);
      return state.invitation!.user;
    }),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn((callback) => callback(tx)) } }));
vi.mock("@/lib/hr/audit", () => ({ appendHrAudit: vi.fn() }));
vi.mock("@/lib/hr/notifications/outbox", () => ({ enqueueHrEmail: vi.fn() }));

import { consumeHrInvitation, HrInvitationAcceptanceError } from "../src/lib/hr/auth/invitations";

function invitation(token: string, overrides: Partial<Invitation> = {}): Invitation {
  return {
    id: "invitation-1",
    organizationId: "organization-1",
    userId: "user-1",
    tokenHash: hashOpaqueToken(token),
    status: "ACTIVE",
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    user: { id: "user-1", status: "INVITED", passwordHash: null, emailVerifiedAt: null, mfaEnabled: false, mfaSecretEncrypted: null, mfaLastUsedStep: null },
    ...overrides,
  };
}

describe("HR account invitation acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.invitation = null;
  });

  it("accepts a fresh invitation and activates the invited HR administrator", async () => {
    state.invitation = invitation("fresh-token");
    const user = await consumeHrInvitation("fresh-token", "StrongPassword123");
    expect(state.invitation.status).toBe("USED");
    expect(state.invitation.usedAt).toBeInstanceOf(Date);
    expect(state.invitation.user.status).toBe("ACTIVE");
    expect(state.invitation.user.passwordHash).not.toContain("StrongPassword123");
    expect(state.invitation.user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(user.mfaEnabled).toBe(false);
    expect(user.mfaSecretEncrypted).toBeTruthy();
    expect(user.mfaSecretEncrypted).not.toContain("otpauth://");
    expect(user.mfaLastUsedStep).toBeNull();
  });

  it("rejects an expired invitation", async () => {
    state.invitation = invitation("expired-token", { expiresAt: new Date(Date.now() - 1) });
    await expect(consumeHrInvitation("expired-token", "StrongPassword123"))
      .rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });

  it("rejects an already-used invitation", async () => {
    state.invitation = invitation("used-token", { status: "USED", usedAt: new Date() });
    await expect(consumeHrInvitation("used-token", "StrongPassword123"))
      .rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });

  it("rejects an invalid token", async () => {
    state.invitation = invitation("real-token");
    await expect(consumeHrInvitation("invalid-token", "StrongPassword123"))
      .rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });

  it("reports password-policy failures separately without consuming the invitation", async () => {
    state.invitation = invitation("fresh-token");
    await expect(consumeHrInvitation("fresh-token", "twelveletters"))
      .rejects.toEqual(new HrInvitationAcceptanceError("PASSWORD_POLICY"));
    expect(state.invitation.status).toBe("ACTIVE");
    expect(tx.hrAccountInvitation.updateMany).not.toHaveBeenCalled();
  });

  it("allows only one atomic claim of a single-use invitation", async () => {
    state.invitation = invitation("single-use-token");
    await consumeHrInvitation("single-use-token", "StrongPassword123");
    await expect(consumeHrInvitation("single-use-token", "StrongPassword123"))
      .rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });
});
