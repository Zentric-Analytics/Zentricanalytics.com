import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), transaction: vi.fn(), find: vi.fn(), role: vi.fn(), invite: vi.fn(), audit: vi.fn(), refresh: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction, hrUser: { findFirst: mocks.find }, hrRole: { findUniqueOrThrow: mocks.role } } }));
vi.mock("@/lib/hr/permissions/authorize", () => ({ requirePermission: mocks.authorize }));
vi.mock("@/lib/hr/auth/invitations", () => ({ createHrInvitation: mocks.invite }));
vi.mock("@/lib/hr/auth/session", () => ({ revokeAllHrSessions: vi.fn() }));
vi.mock("@/lib/hr/audit", () => ({ appendHrAudit: mocks.audit }));
import { createHrUserAction } from "../src/app/hr/admin/users/actions";

function form() { const data = new FormData(); data.set("email", "Support@example.test"); data.set("role", "EMPLOYEE"); return data; }
const collision = () => new Prisma.PrismaClientKnownRequestError("Unique constraint", { code: "P2002", clientVersion: "test" });
describe("direct user invitation retry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.authorize.mockResolvedValue({ roles: ["ADMIN"], user: { id: "admin", organizationId: "org", isPrimaryAdmin: true } });
    mocks.role.mockResolvedValue({ id: "employee-role" });
    mocks.transaction.mockRejectedValue(collision());
    mocks.find.mockResolvedValue({ id: "pending", roles: [{ roleId: "employee-role" }] });
    mocks.invite.mockResolvedValue({ reused: true });
  });
  it("recovers a unique-email collision and reuses the scoped pending invitation", async () => {
    await createHrUserAction(form());
    expect(mocks.find).toHaveBeenCalledWith({ where: { organizationId: "org", email: "support@example.test", status: "INVITED", passwordHash: null, isPrimaryAdmin: false }, include: { roles: { where: { revokedAt: null } } } });
    expect(mocks.invite).toHaveBeenCalledWith({ organizationId: "org", userId: "pending", createdById: "admin", recipient: "support@example.test" });
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalledWith("/hr/admin/users");
  });
  it("still creates and audits the initial account and role once", async () => {
    const create = vi.fn().mockResolvedValue({ id: "new-user" });
    const assign = vi.fn().mockResolvedValue({});
    mocks.transaction.mockImplementation(async (run) => run({ hrUser: { create }, hrUserRole: { create: assign } }));
    await createHrUserAction(form());
    expect(create).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith({ data: { userId: "new-user", roleId: "employee-role", assignedById: "admin" } });
    expect(mocks.audit).toHaveBeenCalledTimes(1);
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.invite).toHaveBeenCalledWith({ organizationId: "org", userId: "new-user", createdById: "admin", recipient: "support@example.test" });
  });
  it.each([null, { id: "pending", roles: [] }, { id: "pending", roles: [{ roleId: "admin-role" }] }, { id: "pending", roles: [{ roleId: "employee-role" }, { roleId: "extra" }] }])("does not reuse incompatible or inaccessible accounts", async (existing) => {
    mocks.find.mockResolvedValue(existing);
    await expect(createHrUserAction(form())).rejects.toThrow("Unique constraint");
    expect(mocks.invite).not.toHaveBeenCalled();
  });
  it("does not swallow infrastructure errors", async () => {
    mocks.transaction.mockRejectedValue(new Error("Database unavailable"));
    await expect(createHrUserAction(form())).rejects.toThrow("Database unavailable");
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it("does not revive a revoked invitation when the sender rejects reuse", async () => {
    mocks.invite.mockRejectedValue(new Error("Request an explicit resend"));
    await expect(createHrUserAction(form())).rejects.toThrow("explicit resend");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("retains primary-admin authorization before retry lookup", async () => {
    mocks.authorize.mockResolvedValue({ roles: ["ADMIN"], user: { id: "other", organizationId: "org", isPrimaryAdmin: false } });
    await expect(createHrUserAction(form())).rejects.toThrow("primary administrator");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
