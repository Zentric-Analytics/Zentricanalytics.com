import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ accept: vi.fn(), prisma: {
  applicationAccessCode: { findFirst: vi.fn() }, hrRecruitmentOffer: { findUnique: vi.fn() }, $transaction: vi.fn(),
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
