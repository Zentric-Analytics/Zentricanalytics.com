import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ accept: vi.fn(), prisma: {
  applicationAccessCode: { findFirst: vi.fn() }, hrRecruitmentOffer: { findUnique: vi.fn() }, hrRecruitmentOfferDecline: { findFirst: vi.fn() }, $transaction: vi.fn(),
} }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(url); } }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/hr/recruitment/offers", () => ({ acceptOffer: mocks.accept }));
vi.mock("@/lib/workflow", () => ({ acceptOffer: vi.fn(), StageActionError: class extends Error {} }));
vi.mock("@/lib/storage", () => ({}));
vi.mock("@/lib/email", () => ({ sendAndRecordEmail: vi.fn() }));
import { submitOfferDecision } from "../src/app/track/actions";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.hrRecruitmentOfferDecline.findFirst.mockResolvedValue(null);
  mocks.prisma.applicationAccessCode.findFirst.mockResolvedValue({ application: { id: "app", organizationId: "org", applicantId: "candidate" } });
  mocks.prisma.hrRecruitmentOffer.findUnique.mockResolvedValue({ id: "offer", status: "ISSUED", activeVersionId: "current", activeVersion: { id: "current" } });
  mocks.prisma.$transaction.mockImplementation(async run => run({}));
});
function form(version: string | null) {
  const data = new FormData(); data.set("session", "synthetic-session-for-test"); data.set("decision", "accept"); data.set("confirmation", "on");
  if (version !== null) data.set("offerVersionId", version);
  return data;
}
it.each(["old", null])("rejects stale or absent displayed version %s before acceptance", async version => {
  await expect(submitOfferDecision(form(version))).rejects.toThrow("offer_changed");
  expect(mocks.accept).not.toHaveBeenCalled();
  expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
});
it("passes the displayed matching version into acceptance", async () => {
  await expect(submitOfferDecision(form("current"))).rejects.toThrow("offer_accepted");
  expect(mocks.accept).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ offerVersionId: "current", applicantId: "candidate" }));
});
it("rejects a stale decline before any transaction", async () => {
  const data = form("old"); data.set("decision", "decline");
  await expect(submitOfferDecision(data)).rejects.toThrow("offer_changed");
  expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
});
it("conditionally claims the exact issued version before recording a decline", async () => {
  const updateMany = vi.fn().mockResolvedValue({ count: 0 });
  const upsert = vi.fn();
  mocks.prisma.$transaction.mockImplementation(async run => run({ hrRecruitmentOffer: { updateMany }, hrRecruitmentOfferDecline: { upsert } }));
  const data = form("current"); data.set("decision", "decline");
  await expect(submitOfferDecision(data)).rejects.toThrow("offer_changed");
  expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org", status: "ISSUED", activeVersionId: "current" }) }));
  expect(upsert).not.toHaveBeenCalled();
});
it("blocks a decline after acceptance without opening a transaction", async () => {
  mocks.prisma.hrRecruitmentOffer.findUnique.mockResolvedValue({ id: "offer", status: "ACCEPTED", activeVersionId: "current", activeVersion: { id: "current" } });
  const data = form("current"); data.set("decision", "decline");
  await expect(submitOfferDecision(data)).rejects.toThrow("offer_not_open");
  expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
});
it.each(["accept", "decline"])("blocks %s without a valid candidate session", async decision => {
  mocks.prisma.applicationAccessCode.findFirst.mockResolvedValue(null);
  const data = form("current"); data.set("decision", decision);
  await expect(submitOfferDecision(data)).rejects.toThrow("verified=0");
  expect(mocks.prisma.hrRecruitmentOffer.findUnique).not.toHaveBeenCalled();
  expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
});
it("records a current decline once and preserves its success on replay", async () => {
  const application = { id: "app", applicationId: "synthetic", organizationId: "org", applicantId: "candidate", applicant: { email: "candidate@example.invalid", fullName: "Synthetic" }, stages: [{ stageOrder: 4, status: "Available" }], offer: null };
  mocks.prisma.applicationAccessCode.findFirst.mockResolvedValue({ application });
  const offer = { id: "offer", status: "ISSUED", version: 1, activeVersionId: "current", activeVersion: { id: "current" } };
  mocks.prisma.hrRecruitmentOffer.findUnique.mockImplementation(async () => ({ ...offer }));
  const updateMany = vi.fn().mockImplementation(async () => { offer.status = "DECLINED"; offer.version++; return { count: 1 }; });
  const upsert = vi.fn().mockResolvedValue({ id: "decline", applicantId: "candidate", offerVersionId: "current" });
  mocks.prisma.hrRecruitmentOfferDecline.findFirst.mockResolvedValue({ id: "decline" });
  const outbox = vi.fn().mockResolvedValue({ id: "email" });
  mocks.prisma.$transaction.mockImplementation(async run => run({ hrRecruitmentOffer: { updateMany }, hrRecruitmentOfferDecline: { upsert }, jobApplication: { update: vi.fn() }, hrUser: { findFirst: vi.fn().mockResolvedValue(null) }, hrEmailOutbox: { upsert: outbox } }));
  const data = form("current"); data.set("decision", "decline");
  await expect(submitOfferDecision(data)).rejects.toThrow("offer_declined");
  await expect(submitOfferDecision(data)).rejects.toThrow("offer_declined");
  expect(updateMany).toHaveBeenCalledTimes(1);
  expect(upsert).toHaveBeenCalledTimes(1);
  expect(outbox).toHaveBeenCalledTimes(1);
  expect(mocks.prisma.hrRecruitmentOfferDecline.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { offerId: "offer", offerVersionId: "current", applicantId: "candidate" } }));
});
it.each(["accept", "decline"])("does not permit %s on a declined offer without a matching saved decline", async decision => {
  mocks.prisma.hrRecruitmentOffer.findUnique.mockResolvedValue({ id: "offer", status: "DECLINED", activeVersionId: "current" });
  const data = form("current"); data.set("decision", decision);
  await expect(submitOfferDecision(data)).rejects.toThrow("offer_not_open");
  expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  expect(mocks.accept).not.toHaveBeenCalled();
});
