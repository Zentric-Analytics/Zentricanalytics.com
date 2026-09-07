import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), scope: vi.fn(), transition: vi.fn(), offer: vi.fn(), issue: vi.fn(), applicant: vi.fn(), update: vi.fn(), email: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/hr/permissions/authorize", () => ({ requireAuthenticatedUser: m.auth, requirePermission: m.auth }));
vi.mock("@/lib/hr/recruitment/stage-access", () => ({ assertRecruitmentStageAccess: m.scope }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: async (fn: (tx: unknown) => unknown) => fn({ hrRecruitmentOffer: { findFirstOrThrow: m.offer }, jobApplication: { findFirstOrThrow: m.applicant, update: m.update } }) } }));
vi.mock("@/lib/hr/notifications/outbox", () => ({ enqueueHrEmail: m.email }));
vi.mock("@/lib/hr/recruitment/applications", () => ({ transitionApplication: m.transition }));
vi.mock("@/lib/hr/recruitment/assessments", () => ({ createAssessment: vi.fn(), updateAssessment: vi.fn() }));
vi.mock("@/lib/hr/recruitment/interviews", () => ({ changeInterview: vi.fn(), saveInterviewFeedback: vi.fn(), scheduleInterview: vi.fn(), submitInterviewFeedback: vi.fn() }));
vi.mock("@/lib/hr/recruitment/offers", () => ({ approveOffer: vi.fn(), createOffer: vi.fn(), issueOffer: m.issue, submitOfferForApproval: vi.fn() }));
import { transitionApplicationAction, manageOfferWithStateAction, feedbackWithStateAction, evaluateAssessmentWithStateAction } from "../src/app/hr/admin/applications/[id]/actions";
const applicationId = "cm1234567890123456789012";
function form(fields: Record<string, string>) { const f = new FormData(); Object.entries(fields).forEach(([k,v]) => f.set(k,v)); return f; }
describe("scoped application actions", () => {
  beforeEach(() => { vi.clearAllMocks(); m.auth.mockResolvedValue({ user: { id: "actor", organizationId: "org" }, roles: ["EMPLOYEE"] }); m.scope.mockResolvedValue({}); m.offer.mockResolvedValue({}); m.applicant.mockResolvedValue({ applicant: { email: "candidate@example.test" } }); });
  it("allows team-scoped employee shortlisting without global admin permission", async () => {
    await transitionApplicationAction(form({ applicationId, expectedVersion: "1", to: "SHORTLISTED", reason: "Reviewed" }));
    expect(m.scope).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ applicationId, stage: 3 }));
    expect(m.transition).toHaveBeenCalledOnce();
  });
  it("team execution updates applicant status and sends only neutral rejection", async () => {
    m.applicant.mockResolvedValueOnce({ id: applicationId, applicationId: "public", applicant: { email: "candidate@example.test", fullName: "Test" } });
    await transitionApplicationAction(form({ applicationId, expectedVersion: "1", to: "REJECTED", reason: "Hiring decision" }));
    expect(m.update).toHaveBeenCalledWith({ where: { id: applicationId }, data: { status: "Rejected" } });
    expect(m.email).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ recipient: "candidate@example.test", template: "hr-application-rejected" }));
  });
  it("denies outsider before transition", async () => {
    m.scope.mockRejectedValue(new Error("Not assigned"));
    await expect(transitionApplicationAction(form({ applicationId, expectedVersion: "1", to: "SHORTLISTED", reason: "Reviewed" }))).rejects.toThrow("Not assigned");
    expect(m.transition).not.toHaveBeenCalled();
  });
  it("checks offer/application binding before reading recipient or issuing", async () => {
    m.offer.mockRejectedValue(new Error("No matching offer"));
    const result = await manageOfferWithStateAction({ status: "idle" }, form({ applicationId, offerId: applicationId, expectedVersion: "1", operation: "ISSUE", reason: "Approved" }));
    expect(result.status).toBe("error");
    expect(m.offer).toHaveBeenCalledWith({ where: { id: applicationId, applicationId, organizationId: "org" } });
    expect(m.applicant).not.toHaveBeenCalled(); expect(m.issue).not.toHaveBeenCalled();
  });
  it("rejects outsider feedback before participant processing", async () => {
    m.scope.mockRejectedValue(new Error("Not assigned"));
    const result = await feedbackWithStateAction({ status: "idle" }, form({ applicationId, interviewId: applicationId, mode: "SUBMIT", score: "80", recommendation: "Proceed" }));
    expect(result).toEqual({ status: "error", message: "Not assigned" });
  });
  it("rejects outsider assessment updates", async () => {
    m.scope.mockRejectedValue(new Error("Not assigned"));
    const result = await evaluateAssessmentWithStateAction({ status: "idle" }, form({ applicationId, assessmentId: applicationId, expectedVersion: "1", to: "IN_PROGRESS" }));
    expect(result).toEqual({ status: "error", message: "Not assigned" });
  });
});
