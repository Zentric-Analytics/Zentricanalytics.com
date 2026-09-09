import type { Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";
import { issueOffer } from "../src/lib/hr/recruitment/offers";
import { enqueueHrEmail } from "../src/lib/hr/notifications/outbox";
vi.mock("../src/lib/hr/notifications/outbox", () => ({ enqueueHrEmail: vi.fn() }));
vi.mock("../src/lib/hr/recruitment/handover", () => ({ initializeHandoverRequirements: vi.fn() }));
const input = { organizationId: "org", offerId: "offer", actorUserId: "actor", recipient: "fixture@example.invalid", expectedVersion: 3 };
function fixture() {
  const offer = { id: "offer", applicationId: "app", version: 3, status: "APPROVED", activeVersionId: "v1", activeVersion: { id: "v1", expiresAt: new Date("2099-01-01"), positionTitle: "Test" }, approvals: [{ offerVersionId: "v1", decision: "APPROVED" }] };
  const mocks = {
    hrRecruitmentOffer: { findFirstOrThrow: vi.fn().mockResolvedValue(offer), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    hrRecruitmentOfferDelivery: { upsert: vi.fn() },
    jobApplication: { findFirstOrThrow: vi.fn().mockResolvedValue({ applicationId: "test", applicant: { fullName: "Test" } }), updateMany: vi.fn() },
    hrAuditEvent: { create: vi.fn() },
  };
  return { offer, mocks, tx: mocks as unknown as Prisma.TransactionClient };
}
beforeEach(() => vi.clearAllMocks());
it("rejects an old page even when the current offer has fresh approval", async () => {
  const { tx, mocks, offer } = fixture(); offer.version = 6;
  await expect(issueOffer(tx, input)).rejects.toThrow("Reload and review");
  expect(mocks.hrRecruitmentOffer.updateMany).not.toHaveBeenCalled();
  expect(mocks.hrRecruitmentOfferDelivery.upsert).not.toHaveBeenCalled();
  expect(enqueueHrEmail).not.toHaveBeenCalled();
});
it("rejects a competing change before delivery or email", async () => {
  const { tx, mocks } = fixture(); mocks.hrRecruitmentOffer.updateMany.mockResolvedValue({ count: 0 });
  await expect(issueOffer(tx, input)).rejects.toThrow("Reload and review");
  expect(mocks.hrRecruitmentOfferDelivery.upsert).not.toHaveBeenCalled();
  expect(enqueueHrEmail).not.toHaveBeenCalled();
});
it("claims the exact approved version before sending", async () => {
  const { tx, mocks } = fixture();
  await expect(issueOffer(tx, input)).resolves.toMatchObject({ status: "ISSUED", version: 4 });
  expect(mocks.hrRecruitmentOffer.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "offer", organizationId: "org", status: "APPROVED", version: 3, activeVersionId: "v1" } }));
  expect(enqueueHrEmail).toHaveBeenCalledTimes(1);
  expect(mocks.hrRecruitmentOffer.updateMany.mock.invocationCallOrder[0]).toBeLessThan(mocks.hrRecruitmentOfferDelivery.upsert.mock.invocationCallOrder[0]);
});
