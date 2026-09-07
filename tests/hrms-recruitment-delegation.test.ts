import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { assertVacancyCreatorOrDelegate, delegateVacancyApprovals, endVacancyDelegation } from "../src/lib/hr/recruitment/delegation";

const scope = { organizationId: "org", vacancyId: "vacancy", actorUserId: "creator" };
function fixture() {
  const mocks = {
    hrUser: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: "creator" }) },
    hrVacancy: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: "vacancy", createdById: "creator", hiringTeamId: "team", delegationVersion: 0 }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    hrHiringTeamMember: { findMany: vi.fn().mockResolvedValue([{ userId: "one" }, { userId: "two" }]), findFirst: vi.fn().mockResolvedValue({ userId: "one" }) },
    hrVacancyDelegation: { findFirst: vi.fn().mockResolvedValue({ id: "delegation" }), updateMany: vi.fn().mockResolvedValue({ count: 2 }), createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    hrAuditEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  return { mocks, tx: mocks as unknown as Prisma.TransactionClient };
}
describe("vacancy-scoped delegation", () => {
  it("requires a reason and specific delegates", async () => {
    const { tx } = fixture();
    await expect(delegateVacancyApprovals(tx, { ...scope, delegateUserIds: ["one"], reason: " " })).rejects.toThrow("absence reason");
    await expect(delegateVacancyApprovals(tx, { ...scope, delegateUserIds: [], reason: "Away" })).rejects.toThrow("specific");
  });
  it("only lets the creator assign or end delegation", async () => {
    const { tx } = fixture();
    await expect(delegateVacancyApprovals(tx, { ...scope, actorUserId: "one", delegateUserIds: ["two"], reason: "Away" })).rejects.toThrow("creator");
    await expect(endVacancyDelegation(tx, { ...scope, actorUserId: "one" })).rejects.toThrow("creator");
  });
  it("rejects nonmembers and checks effective membership and org", async () => {
    const { tx, mocks } = fixture();
    await expect(delegateVacancyApprovals(tx, { ...scope, delegateUserIds: ["outsider"], reason: "Away" })).rejects.toThrow("active member");
    expect(mocks.hrHiringTeamMember.findMany.mock.calls[0][0].where).toMatchObject({ hiringTeamId: "team", status: "ACTIVE", user: { organizationId: "org", status: "ACTIVE" }, effectiveFrom: { lte: expect.any(Date) } });
  });
  it("keeps history, deduplicates delegates, and does not change offer version", async () => {
    const { tx, mocks } = fixture();
    await delegateVacancyApprovals(tx, { ...scope, delegateUserIds: ["one", "two", "one"], reason: "Away" });
    expect(mocks.hrVacancyDelegation.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(mocks.hrVacancy.updateMany.mock.calls[0][0].data).toEqual({ delegationVersion: { increment: 1 } });
    expect(mocks.hrAuditEvent.create.mock.calls[0][0].data).toMatchObject({ action: "hr.recruitment.vacancy.delegated", reason: "Away" });
    expect(mocks.hrAuditEvent.create.mock.calls[0][0].data).not.toHaveProperty("vacancyId");
  });
  it("allows either selected delegate without collective approval", async () => {
    const { tx } = fixture();
    for (const actorUserId of ["one", "two"]) await expect(assertVacancyCreatorOrDelegate(tx, { ...scope, actorUserId })).resolves.toMatchObject({ id: "vacancy" });
  });
  it("denies ended delegates and removed members", async () => {
    const { tx, mocks } = fixture();
    mocks.hrVacancyDelegation.findFirst.mockResolvedValueOnce(null);
    await expect(assertVacancyCreatorOrDelegate(tx, { ...scope, actorUserId: "one" })).rejects.toThrow("selected delegate");
    mocks.hrHiringTeamMember.findFirst.mockResolvedValueOnce(null);
    await expect(assertVacancyCreatorOrDelegate(tx, { ...scope, actorUserId: "one" })).rejects.toThrow("selected delegate");
  });
  it("ends manually and audits without deleting history", async () => {
    const { tx, mocks } = fixture();
    await endVacancyDelegation(tx, scope);
    expect(mocks.hrVacancyDelegation.updateMany.mock.calls[0][0]).toMatchObject({ where: { vacancyId: "vacancy", endedAt: null }, data: { endedById: "creator", endedAt: expect.any(Date) } });
    expect(mocks.hrAuditEvent.create.mock.calls[0][0].data.action).toBe("hr.recruitment.vacancy.delegation-ended");
  });
  it("fails concurrent replacement before writing delegates", async () => {
    const { tx, mocks } = fixture();
    mocks.hrVacancy.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(delegateVacancyApprovals(tx, { ...scope, delegateUserIds: ["one"], reason: "Away" })).rejects.toThrow("concurrently");
    expect(mocks.hrVacancyDelegation.createMany).not.toHaveBeenCalled();
  });
});
