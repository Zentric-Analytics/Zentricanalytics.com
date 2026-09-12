import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireAuthenticatedUser } = vi.hoisted(() => ({
  prisma: {
    jobApplication: { findFirstOrThrow: vi.fn() },
    hrVacancy: { findFirstOrThrow: vi.fn() },
    hrAccountInvitation: { findMany: vi.fn() },
  },
  requireAuthenticatedUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/hr/permissions/authorize", () => ({ requireAuthenticatedUser }));
vi.mock("@/app/hr/recruitment/[id]/access/actions", () => ({
  sendMailboxWelcomeAction: vi.fn(), sendLinkedInvitationAction: vi.fn(), reconcileEmploymentAction: vi.fn(),
}));
vi.mock("@/app/hr/recruitment/[id]/access/ReviewedFlowForm", () => ({ ReviewedFlowForm: () => null }));
import Page from "@/app/hr/recruitment/[id]/access/page";

const auth = (roles: string[], primary = false, status = "ACTIVE") => ({
  user: { id: "reviewer", organizationId: "org", email: "reviewer@example.invalid", isPrimaryAdmin: primary, status },
  roles, permissions: new Set<string>(),
});
const render = () => Page({ params: Promise.resolve({ id: "application" }) });
beforeEach(() => {
  vi.resetAllMocks();
  requireAuthenticatedUser.mockResolvedValue(auth(["HR_ADMIN"]));
  prisma.jobApplication.findFirstOrThrow.mockResolvedValue({
    vacancyId: "vacancy", applicant: { fullName: "Synthetic", email: "candidate@example.invalid" },
    applicationId: "synthetic", hrEmployee: { id: "employee", userId: "linked-user" }, emails: [],
  });
  prisma.hrVacancy.findFirstOrThrow.mockResolvedValue({ responsibleHrUserId: "reviewer" });
  prisma.hrAccountInvitation.findMany.mockResolvedValue([]);
});
describe("account setup history privacy", () => {
  it.each([
    ["revoked HR role", ["EMPLOYEE"], false, "ACTIVE"],
    ["primary flag without Admin", ["EMPLOYEE"], true, "ACTIVE"],
    ["suspended reviewer", ["HR_ADMIN"], false, "SUSPENDED"],
  ])("blocks %s before reading private history", async (_label, roles, primary, status) => {
    requireAuthenticatedUser.mockResolvedValue(auth(roles as string[], primary as boolean, status as string));
    await expect(render()).rejects.toThrow();
    expect(prisma.jobApplication.findFirstOrThrow).not.toHaveBeenCalled();
    expect(prisma.hrAccountInvitation.findMany).not.toHaveBeenCalled();
  });
  it("rejects an unrelated HR reviewer before invitation history is queried", async () => {
    prisma.hrVacancy.findFirstOrThrow.mockResolvedValue({ responsibleHrUserId: "other" });
    await expect(render()).rejects.toThrow("Only the assigned HR person");
    expect(prisma.hrAccountInvitation.findMany).not.toHaveBeenCalled();
  });
  it.each([["HR_ADMIN", false], ["ADMIN", true]])("allows eligible %s with scoped metadata only", async (role, primary) => {
    requireAuthenticatedUser.mockResolvedValue(auth([role as string], primary as boolean));
    if (primary) prisma.hrVacancy.findFirstOrThrow.mockResolvedValue({ responsibleHrUserId: "other" });
    await expect(render()).resolves.toBeTruthy();
    expect(prisma.jobApplication.findFirstOrThrow).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "application", organizationId: "org", deletedAt: null } }));
    expect(prisma.hrAccountInvitation.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org", userId: "linked-user" },
      select: { id: true, createdAt: true, expiresAt: true, usedAt: true, status: true, createdBy: { select: { email: true } } },
      orderBy: { createdAt: "desc" }, take: 10,
    });
  });
});
