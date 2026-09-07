import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notifyRecruitmentStageSubmitted } from "../src/lib/hr/recruitment/stage-notifications";
import { enqueueHrEmail } from "../src/lib/hr/notifications/outbox";
vi.mock("../src/lib/hr/notifications/outbox", () => ({ enqueueHrEmail: vi.fn() }));
function fixture() {
  const mocks = {
    jobApplication: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "app", organizationId: "org", vacancyId: "vacancy" }) },
    hrVacancy: { findFirstOrThrow: vi.fn().mockResolvedValue({ hiringTeamId: "team", responsibleHrUserId: "hr", createdById: "creator" }) },
    hrUser: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: "hr", email: "hr@company.test" }), findFirst: vi.fn().mockResolvedValue({ id: "creator", email: "creator@company.test" }) },
    hrHiringTeamMember: { findMany: vi.fn().mockResolvedValue([{ user: { id: "creator", email: "creator@company.test" } }, { user: { id: "member", email: "member@company.test" } }]) },
  };
  return { tx: mocks as unknown as Prisma.TransactionClient, mocks };
}
describe("stage submission routing", () => {
  beforeEach(() => vi.clearAllMocks());
  it("routes stages six and seven only to named HR", async () => {
    for (const stage of [6, 7] as const) {
      const { tx, mocks } = fixture();
      await notifyRecruitmentStageSubmitted(tx, { applicationId: "app", submissionId: `submission${stage}`, stage });
      expect(mocks.hrHiringTeamMember.findMany).not.toHaveBeenCalled();
      expect(enqueueHrEmail).toHaveBeenLastCalledWith(tx, expect.objectContaining({ recipient: "hr@company.test" }));
    }
  });
  it("routes stage five to team and creator once each", async () => {
    const { tx } = fixture();
    expect(await notifyRecruitmentStageSubmitted(tx, { applicationId: "app", submissionId: "s", stage: 5 })).toBe(2);
    expect(enqueueHrEmail).toHaveBeenCalledTimes(2);
  });
  it("routes stages two and three to effective active team membership", async () => {
    const { tx, mocks } = fixture();
    await notifyRecruitmentStageSubmitted(tx, { applicationId: "app", submissionId: "s", stage: 2 });
    expect(mocks.hrHiringTeamMember.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "ACTIVE", effectiveFrom: { lte: expect.any(Date) }, user: { organizationId: "org", status: "ACTIVE" } }) }));
    expect(mocks.hrUser.findFirst).not.toHaveBeenCalled();
  });
  it("includes only routing metadata, not submitted information", async () => {
    const { tx } = fixture();
    await notifyRecruitmentStageSubmitted(tx, { applicationId: "app", submissionId: "s", stage: 6 });
    expect(vi.mocked(enqueueHrEmail).mock.calls[0][1].payload).toEqual({ applicationId: "app", stage: 6, href: "/hr/recruitment/app" });
  });
  it("fails closed when assigned HR is missing", async () => {
    const { tx, mocks } = fixture();
    mocks.hrVacancy.findFirstOrThrow.mockResolvedValueOnce({ hiringTeamId: "team", responsibleHrUserId: null, createdById: "creator" });
    await expect(notifyRecruitmentStageSubmitted(tx, { applicationId: "app", submissionId: "s", stage: 7 })).rejects.toThrow("named HR");
    expect(enqueueHrEmail).not.toHaveBeenCalled();
  });
});
