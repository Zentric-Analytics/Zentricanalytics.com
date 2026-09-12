import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), app: vi.fn(), vacancy: vi.fn(), reply: vi.fn(), verified: vi.fn(), update: vi.fn(), audit: vi.fn(), send: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/hr/permissions/authorize", () => ({ requireAuthenticatedUser: m.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { jobApplication: { findFirstOrThrow: m.app }, hrVacancy: { findFirstOrThrow: m.vacancy }, hrUser: { findFirst: m.reply }, applicationAccessCode: { findFirst: m.verified }, $transaction: async (fn: (tx: unknown) => unknown) => fn({ hrUser: { findFirst: eligibility.actor }, jobApplication: { findFirstOrThrow: m.app }, applicationAccessCode: { findFirst: m.verified }, hrVacancy: { findFirstOrThrow: m.vacancy }, hrEmployee: { update: m.update, findFirstOrThrow: async () => ({ userId: null, employmentStatus: "DRAFT", recruitmentApplicationId: "cm1234567890123456789012" }) } }) } }));
vi.mock("@/lib/hr/audit", () => ({ appendHrAudit: m.audit }));
vi.mock("@/lib/email", () => ({ sendAndRecordEmail: m.send }));
vi.mock("@/lib/hr/recruitment/employee-access", () => ({ createLinkedEmployeeInvitation: vi.fn() }));
import { sendMailboxWelcomeAction } from "../src/app/hr/recruitment/[id]/access/actions";
const id = "cm1234567890123456789012";
const eligibility = vi.hoisted(() => ({ lock: vi.fn(), actor: vi.fn() }));
vi.mock("@/lib/hr/recruitment/hr-authority-lock", () => ({ lockNamedHrEligibility: eligibility.lock }));
function form() { const f = new FormData(); Object.entries({ applicationId: id, companyEmail: "person@zentricanalytics.com", temporaryPassword: "SyntheticOnly-Example7", replyTo: "hr@zentricanalytics.com" }).forEach(([k,v]) => f.set(k,v)); return f; }
describe("mailbox action delivery boundary", () => {
  beforeEach(() => {
    eligibility.lock.mockReset();
    eligibility.actor.mockReset().mockResolvedValue({ id: "hr", isPrimaryAdmin: false, roles: [{ role: { key: "HR_ADMIN" } }] });
  });
  it.each([null, { id: "hr", isPrimaryAdmin: false, roles: [] }])("blocks changed account eligibility before saving or delivery", async actor => {
    eligibility.actor.mockResolvedValue(actor);
    await expect(sendMailboxWelcomeAction(form())).rejects.toThrow("active HR or admin");
    expect(m.update).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });
  it("acquires eligibility protection before reading the current actor", async () => {
    eligibility.lock.mockImplementation(async () => {
      expect(eligibility.actor).not.toHaveBeenCalled();
      expect(m.update).not.toHaveBeenCalled();
    });
    await sendMailboxWelcomeAction(form());
    expect(eligibility.lock).toHaveBeenCalledWith(expect.anything(), "org", "vacancy", "hr");
    expect(eligibility.actor).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "hr", organizationId: "org", status: "ACTIVE" } }));
  });
  it("does not deliver when the eligibility lock reports a conflict", async () => {
    eligibility.lock.mockRejectedValue(new Error("Reload after eligibility conflict"));
    await expect(sendMailboxWelcomeAction(form())).rejects.toThrow("Reload");
    expect(m.update).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });
  it("does not deliver when final approval disappears before the transaction", async () => {
    m.app.mockResolvedValueOnce({ id, vacancyId: "vacancy", applicant: { email: "personal@example.test" }, hrEmployee: { id: "employee", userId: null } }).mockRejectedValueOnce(new Error("Approval no longer exists"));
    await expect(sendMailboxWelcomeAction(form())).rejects.toThrow("Approval no longer exists");
    expect(m.send).not.toHaveBeenCalled();
  });
  beforeEach(() => { vi.clearAllMocks(); m.auth.mockResolvedValue({ roles: ["HR_ADMIN"], user: { id: "hr", organizationId: "org", isPrimaryAdmin: false } }); m.app.mockResolvedValue({ id, vacancyId: "vacancy", applicant: { email: "personal@example.test" }, hrEmployee: { id: "employee", userId: null } }); m.vacancy.mockResolvedValue({ responsibleHrUserId: "hr" }); m.reply.mockResolvedValue({ id: "hr" }); m.verified.mockResolvedValue({ id: "verification" }); m.send.mockResolvedValue({ status: "sent", id: "notification" }); });
  it("sends to personal email with sensitive-body marker and never writes secret to audit/employee", async () => {
    await sendMailboxWelcomeAction(form());
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ to: "personal@example.test", replyTo: "hr@zentricanalytics.com", sensitiveBody: true, body: expect.stringContaining("SyntheticOnly-Example7") }));
    expect(JSON.stringify(m.audit.mock.calls)).not.toContain("SyntheticOnly");
    expect(JSON.stringify(m.update.mock.calls)).not.toContain("SyntheticOnly");
  });
  it("rejects unverified personal address before delivery", async () => { m.verified.mockResolvedValue(null); await expect(sendMailboxWelcomeAction(form())).rejects.toThrow("not been verified"); expect(m.send).not.toHaveBeenCalled(); });
  it("rejects unassigned actor", async () => { m.vacancy.mockResolvedValue({ responsibleHrUserId: "other" }); await expect(sendMailboxWelcomeAction(form())).rejects.toThrow("assigned HR"); expect(m.send).not.toHaveBeenCalled(); });
  it("reports failed delivery without claiming success", async () => { m.send.mockResolvedValue({ status: "failed", id: "notification" }); await expect(sendMailboxWelcomeAction(form())).rejects.toThrow("not sent"); });
});
