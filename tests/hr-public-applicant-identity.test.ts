import { beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ tx: vi.fn(), send: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(path); } }));
vi.mock("@/lib/hiring", () => ({
  initialApplicationSchema: { safeParse: (data: unknown) => ({ success: true, data }) },
  toStage1SubmissionPayload: (data: unknown) => data,
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/storage", () => ({
  validateCvFile: () => null, savePrivateUpload: async () => ({ storageKey: "fixture", provider: "fixture" }),
}));
vi.mock("@/lib/workflow", () => ({
  createApplicationWithRetry: (action: (id: string) => unknown) => action("application-public-id"),
  createStageRows: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { jobApplication: { findUnique: async () => null }, $transaction: fixture.tx },
}));
vi.mock("@/lib/hr/audit", () => ({ appendHrAudit: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendAndRecordEmail: fixture.send }));

import { submitStage1Application } from "@/app/apply/actions";

beforeEach(() => vi.resetAllMocks());

it.each([
  { existing: null, submittedName: "Original Candidate" },
  { existing: { id: "existing-applicant", fullName: "Original Candidate" }, submittedName: "Original Candidate" },
  { existing: { id: "existing-applicant", fullName: "Original Candidate" }, submittedName: "Conflicting Name" },
])("preserves shared applicant identity for a public submission named $submittedName", async ({ existing, submittedName }) => {
  const create = vi.fn().mockResolvedValue({ id: "new-applicant" });
  const application = vi.fn().mockResolvedValue({ id: "new-application", applicationId: "application-public-id" });
  const submission = vi.fn().mockResolvedValue({ id: "submission" });
  const tx = {
    hrOrganization: { findUnique: async () => ({ id: "tenant" }) },
    hrVacancy: { findFirst: async () => ({
      id: "vacancy", title: "Fictional vacancy", status: "OPEN", filledOpenings: 0, numberOfOpenings: 1,
      hiringTeam: { members: [] }, responsibleHrTeam: { members: [] },
    }) },
    applicant: { findFirst: vi.fn().mockResolvedValue(existing && Object.freeze(existing)), create },
    hrRecruitmentNumberSequence: { upsert: async () => ({ lastValue: 1 }) },
    jobApplication: { create: application },
    hiringStage: { findFirstOrThrow: async () => ({ id: "stage" }), update: vi.fn() },
    stageSubmission: { create: submission },
    uploadedDocument: { create: async () => ({ id: "document" }) },
    applicantDocument: { create: vi.fn() },
    electronicSignature: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    hrApplicationStageHistory: { create: vi.fn() },
    hrApplicationReviewTask: { create: vi.fn() },
  };
  fixture.tx.mockImplementation((action) => action(tx));
  const form = new FormData();
  form.set("vacancySlug", "fictional");
  form.set("submissionKey", "fictional-submission-key");
  form.set("email", "candidate@example.invalid");
  form.set("fullName", submittedName);
  form.set("cv", new File(["fictional"], "fake.pdf", { type: "application/pdf" }));
  await expect(submitStage1Application({ ok: false, message: "", values: {}, fieldErrors: {} }, form))
    .rejects.toThrow("/apply?submitted=application-public-id");
  expect(tx.applicant.findFirst).toHaveBeenCalledWith(expect.objectContaining({
    where: { organizationId: "tenant", normalizedEmail: "candidate@example.invalid" },
  }));
  expect(create).toHaveBeenCalledTimes(existing ? 0 : 1);
  expect(application).toHaveBeenCalledWith({ data: expect.objectContaining({ applicantId: existing?.id ?? "new-applicant" }) });
  expect(submission).toHaveBeenCalledWith({ data: expect.objectContaining({ payload: expect.objectContaining({ fullName: submittedName }) }) });
});
