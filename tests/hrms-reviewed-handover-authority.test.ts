import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { assertNamedHrHandoverAccess, reassignHandoverOwner, updateRecruitmentRequirement } from "../src/lib/hr/recruitment/handover";

function fixture() {
  const mocks = {
    hrUserRole: { findFirst: vi.fn().mockResolvedValue({ role: { key: "HR_ADMIN" } }) },
    hrRecruitmentHandover: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: "handover", applicationId: "app", ownerUserId: "stale" }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    jobApplication: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: "app", vacancyId: "vacancy" }) },
    hrVacancy: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: "vacancy", createdById: "creator", responsibleHrUserId: "named" }), update: vi.fn() },
    hrUser: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: "creator", isPrimaryAdmin: false, roles: [] }) },
    hrRecruitmentRequirement: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: "req", handoverId: "handover" }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    hrAuditEvent: { create: vi.fn() },
  };
  return { tx: mocks as unknown as Prisma.TransactionClient, mocks };
}
describe("named HR handover authority", () => {
  it("uses current vacancy owner rather than stale handover owner", async () => {
    const { tx } = fixture();
    await expect(assertNamedHrHandoverAccess(tx, { organizationId: "org", handoverId: "handover", actorUserId: "named" })).resolves.toMatchObject({ id: "handover" });
    await expect(assertNamedHrHandoverAccess(tx, { organizationId: "org", handoverId: "handover", actorUserId: "stale" })).rejects.toThrow("assigned HR");
  });
  it("guards requirement mutation through its real handover", async () => {
    const { tx, mocks } = fixture();
    await expect(updateRecruitmentRequirement(tx, { organizationId: "org", requirementId: "req", actorUserId: "other", expectedVersion: 1, to: "VERIFIED", reason: "checked" })).rejects.toThrow("assigned HR");
    expect(mocks.hrRecruitmentRequirement.updateMany).not.toHaveBeenCalled();
    expect(mocks.hrRecruitmentRequirement.findFirstOrThrow).toHaveBeenCalledWith({ where: { id: "req", handover: { organizationId: "org" } } });
  });
  it("creator reassignment updates named vacancy HR too", async () => {
    const { tx, mocks } = fixture();
    await reassignHandoverOwner(tx, { organizationId: "org", handoverId: "handover", actorUserId: "creator", ownerUserId: "replacement", expectedVersion: 1, reason: "Coverage" });
    expect(mocks.hrVacancy.update).toHaveBeenCalledWith({ where: { id: "vacancy" }, data: { responsibleHrUserId: "replacement" } });
  });
  it("ordinary HR cannot reassign responsibility", async () => {
    const { tx, mocks } = fixture();
    mocks.hrUser.findFirstOrThrow.mockResolvedValueOnce({ id: "named", isPrimaryAdmin: false, roles: [] });
    await expect(reassignHandoverOwner(tx, { organizationId: "org", handoverId: "handover", actorUserId: "named", ownerUserId: "replacement", expectedVersion: 1, reason: "Coverage" })).rejects.toThrow("creator or primary");
    expect(mocks.hrVacancy.update).not.toHaveBeenCalled();
  });
});
