import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { acceptOffer, approveOffer, createApprovedAgreementHandover, rejectOfferApproval } from "../src/lib/hr/recruitment/offers";
import { assertVacancyCreatorOrDelegate } from "../src/lib/hr/recruitment/delegation";
import { enqueueHrEmail } from "../src/lib/hr/notifications/outbox";
vi.mock("../src/lib/hr/recruitment/delegation", () => ({ assertVacancyCreatorOrDelegate: vi.fn() }));
vi.mock("../src/lib/hr/recruitment/handover", () => ({ initializeHandoverRequirements: vi.fn() }));
vi.mock("../src/lib/hr/notifications/outbox", () => ({ enqueueHrEmail: vi.fn() }));
function fixture() {
  const offer = { id: "offer", applicationId: "application", activeVersionId: "v1", acceptedVersionId: "v1", version: 1, createdById: "creator", status: "DRAFT", activeVersion: { expiresAt: new Date("2099-01-01") } };
  const application = { id: "application", applicantId: "candidate", vacancyId: "vacancy", applicationId: "public", applicant: { email: "candidate@example.test", fullName: "Test" } };
  const mocks = {
    hrRecruitmentOffer: { findFirstOrThrow: vi.fn().mockResolvedValue(offer), updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn() },
    jobApplication: { findFirstOrThrow: vi.fn().mockResolvedValue(application), update: vi.fn(), updateMany: vi.fn() },
    hrRecruitmentOfferApproval: { upsert: vi.fn(), create: vi.fn() },
    hrHiringTeamMember: { findMany: vi.fn().mockResolvedValue([{ userId: "member", user: { email: "member@company.test" } }]) },
    hrRecruitmentOfferAcceptance: { upsert: vi.fn().mockResolvedValue({ id: "accepted", applicantId: "candidate", offerVersionId: "v1" }), findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "accepted", applicantId: "candidate", offerVersionId: "v1" }) },
    hiringStage: { findFirst: vi.fn().mockResolvedValue({ status: "Approved" }), findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
    employmentAgreement: { findUnique: vi.fn().mockResolvedValue({ status: "Approved", candidateSubmittedAt: new Date() }) },
    hrVacancy: { findFirst: vi.fn().mockResolvedValue({ responsibleHrUserId: "hr", responsibleHrTeamId: "team" }) },
    hrUser: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: "hr", email: "hr@example.test" }) },
    hrRecruitmentHandover: { upsert: vi.fn().mockResolvedValue({ id: "handover" }) },
    hrAuditEvent: { create: vi.fn() },
  };
  return { tx: mocks as unknown as Prisma.TransactionClient, mocks };
}
describe("reviewed offer approval and agreement handover", () => {
  beforeEach(() => vi.clearAllMocks());
  it("allows creator self-participation through vacancy scoped authority", async () => {
    const { tx, mocks } = fixture();
    await approveOffer(tx, { organizationId: "org", offerId: "offer", actorUserId: "creator" });
    expect(assertVacancyCreatorOrDelegate).toHaveBeenCalledWith(tx, expect.objectContaining({ vacancyId: "vacancy", actorUserId: "creator" }));
    expect(mocks.hrRecruitmentOfferApproval.upsert.mock.calls[0][0].create.offerVersionId).toBe("v1");
  });
  it("denies actors rejected by scoped authority", async () => {
    const { tx, mocks } = fixture();
    vi.mocked(assertVacancyCreatorOrDelegate).mockRejectedValueOnce(new Error("Not selected"));
    await expect(approveOffer(tx, { organizationId: "org", offerId: "offer", actorUserId: "other" })).rejects.toThrow("Not selected");
    expect(mocks.hrRecruitmentOfferApproval.upsert).not.toHaveBeenCalled();
  });
  it("declines internally and notifies only hiring team", async () => {
    const { tx, mocks } = fixture();
    const offer = await mocks.hrRecruitmentOffer.findFirstOrThrow(); offer.status = "PENDING_APPROVAL";
    vi.mocked(assertVacancyCreatorOrDelegate).mockResolvedValueOnce({ hiringTeamId: "team" } as never);
    await rejectOfferApproval(tx, { organizationId: "org", offerId: "offer", actorUserId: "creator", expectedVersion: 1, reason: "Not selected" });
    expect(mocks.hrRecruitmentOfferApproval.create).toHaveBeenCalledWith({ data: expect.objectContaining({ decision: "REJECTED", offerVersionId: "v1" }) });
    expect(enqueueHrEmail).toHaveBeenCalledTimes(1);
    expect(enqueueHrEmail).toHaveBeenCalledWith(tx, expect.objectContaining({ recipient: "member@company.test" }));
    expect(mocks.jobApplication.update).not.toHaveBeenCalled();
  });
  it("cannot internally decline an issued offer", async () => {
    const { tx, mocks } = fixture();
    const offer = await mocks.hrRecruitmentOffer.findFirstOrThrow(); offer.status = "ISSUED";
    await expect(rejectOfferApproval(tx, { organizationId: "org", offerId: "offer", actorUserId: "creator", expectedVersion: 1, reason: "Not selected" })).rejects.toThrow("awaiting approval");
    expect(enqueueHrEmail).not.toHaveBeenCalled();
  });
  it("rejects concurrently changed exact offer versions", async () => {
    const { tx, mocks } = fixture();
    mocks.hrRecruitmentOffer.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(approveOffer(tx, { organizationId: "org", offerId: "offer", actorUserId: "creator" })).rejects.toThrow("concurrently");
    expect(mocks.hrRecruitmentOfferApproval.upsert).not.toHaveBeenCalled();
  });
  it("acceptance only acknowledges candidate and does not create HR handover", async () => {
    const { tx, mocks } = fixture();
    await acceptOffer(tx, { organizationId: "org", offerId: "offer", applicantId: "candidate", offerVersionId: "v1", method: "PORTAL" });
    expect(mocks.hrRecruitmentHandover.upsert).not.toHaveBeenCalled();
    expect(enqueueHrEmail).toHaveBeenCalledTimes(1);
    expect(enqueueHrEmail).toHaveBeenCalledWith(tx, expect.objectContaining({ recipient: "candidate@example.test" }));
  });
  it("rejects acceptance for an already accepted different version", async () => {
    const { tx, mocks } = fixture();
    mocks.hrRecruitmentOfferAcceptance.upsert.mockResolvedValueOnce({ id: "accepted", applicantId: "candidate", offerVersionId: "other" });
    await expect(acceptOffer(tx, { organizationId: "org", offerId: "offer", applicantId: "candidate", offerVersionId: "v1", method: "PORTAL" })).rejects.toThrow("different candidate or version");
    expect(enqueueHrEmail).not.toHaveBeenCalled();
  });
  it("rejects handover when accepted version is inconsistent", async () => {
    const { tx, mocks } = fixture();
    mocks.hrRecruitmentOfferAcceptance.findUniqueOrThrow.mockResolvedValueOnce({ id: "accepted", applicantId: "candidate", offerVersionId: "other" });
    await expect(createApprovedAgreementHandover(tx, { organizationId: "org", applicationId: "application", actorUserId: "creator" })).rejects.toThrow("version does not match");
    expect(mocks.hrRecruitmentHandover.upsert).not.toHaveBeenCalled();
  });
  it.each(["ISSUED", "ACCEPTED"])("synchronizes the summary on %s acceptance without regressing later stages", async (status) => {
    const { tx, mocks } = fixture();
    const offer = await mocks.hrRecruitmentOffer.findFirstOrThrow();
    offer.status = status;
    Object.assign(offer.activeVersion, { id: "v1" });
    mocks.hiringStage.findMany.mockResolvedValueOnce([1, 2, 3, 4].map((stageOrder) => ({ stageOrder, status: "Approved" })));
    const legacy = { findUnique: vi.fn().mockResolvedValue({ specialConditions: "Governed offer version: v1", status: "Accepted" }), create: vi.fn() };
    Object.assign(tx, { offer: legacy });
    await acceptOffer(tx, { organizationId: "org", offerId: "offer", applicantId: "candidate", offerVersionId: "v1", method: "PORTAL" });
    expect(mocks.jobApplication.updateMany).toHaveBeenCalledWith({
      where: { id: "application", organizationId: "org", currentStageOrder: { lte: 5 }, status: { in: ["Offer Pending", "Offer Sent", "Agreement Pending"] } },
      data: { status: "Agreement Pending", currentStageOrder: 5 },
    });
    expect(legacy.create).not.toHaveBeenCalled();
    expect(mocks.hrRecruitmentHandover.upsert).not.toHaveBeenCalled();
    if (status === "ACCEPTED") expect(mocks.jobApplication.update).not.toHaveBeenCalled();
  });
  it("requires completed signed agreement before handover", async () => {
    const { tx, mocks } = fixture();
    mocks.employmentAgreement.findUnique.mockResolvedValueOnce({ status: "Draft", candidateSubmittedAt: new Date() });
    await expect(createApprovedAgreementHandover(tx, { organizationId: "org", applicationId: "application", actorUserId: "creator" })).rejects.toThrow("signed and approved");
    expect(mocks.hrRecruitmentHandover.upsert).not.toHaveBeenCalled();
  });
  it("blocks governed acceptance if earlier applicant stages are incomplete", async () => {
    const { tx, mocks } = fixture();
    mocks.hiringStage.findMany.mockResolvedValueOnce([{ stageOrder: 1, status: "Under Review" }]);
    await expect(acceptOffer(tx, { organizationId: "org", offerId: "offer", applicantId: "candidate", offerVersionId: "v1", method: "PORTAL" })).rejects.toThrow("initial application");
  });
  it("bridges accepted exact offer into agreement stage without sending handover", async () => {
    const { tx, mocks } = fixture();
    mocks.hiringStage.findMany.mockResolvedValueOnce([1, 2, 3].map((stageOrder) => ({ stageOrder, status: "Approved" })));
    const offer = await mocks.hrRecruitmentOffer.findFirstOrThrow();
    Object.assign(offer.activeVersion, { id: "v1", positionTitle: "Engineer", salary: 100, currency: "NGN", startDate: new Date(), workMode: "REMOTE" });
    const legacy = { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() };
    Object.assign(tx, { offer: legacy });
    Object.assign(mocks.jobApplication, { updateMany: vi.fn() });
    await acceptOffer(tx, { organizationId: "org", offerId: "offer", applicantId: "candidate", offerVersionId: "v1", method: "PORTAL" });
    expect(legacy.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "Accepted", specialConditions: "Governed offer version: v1" }) }));
    expect(mocks.hiringStage.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ stageOrder: 5 }), data: expect.objectContaining({ status: "Available" }) }));
    expect(mocks.hrRecruitmentHandover.upsert).not.toHaveBeenCalled();
  });
  it("assigns and notifies only the named HR after agreement approval", async () => {
    const { tx, mocks } = fixture();
    await createApprovedAgreementHandover(tx, { organizationId: "org", applicationId: "application", actorUserId: "creator" });
    expect(mocks.hrRecruitmentHandover.upsert.mock.calls[0][0].create.ownerUserId).toBe("hr");
    expect(enqueueHrEmail).toHaveBeenCalledWith(tx, expect.objectContaining({ recipient: "hr@example.test" }));
  });
});
