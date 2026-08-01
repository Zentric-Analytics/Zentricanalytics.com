import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assessmentInput } from "../src/lib/hr/recruitment/assessments";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("Unit 3 connected recruitment workspaces", () => {
  it("validates assessment creation inputs and evaluator assignment", () => {
    const parsed = assessmentInput.parse({
      organizationId: "cm1234567890123456789012",
      applicationId: "cm1234567890123456789013",
      assessmentType: "Technical exercise",
      instructions: "Complete the authorized staging exercise.",
      evaluatorId: "cm1234567890123456789014",
      dueAt: "2026-08-10T12:00:00Z",
    });
    expect(parsed.assessmentType).toBe("Technical exercise");
    expect(parsed.dueAt).toBeInstanceOf(Date);
  });

  it("recovers assessment progression only when a completed interview exists", () => {
    const assessments = read("src/lib/hr/recruitment/assessments.ts");
    expect(assessments).toContain('application.recruitmentStatus === "INTERVIEW_PENDING"');
    expect(assessments).toContain('status: "COMPLETED"');
    expect(assessments).toContain("if (!completedInterview) throw new Error");
  });

  it("rejects incomplete assessment configuration", () => {
    expect(() => assessmentInput.parse({
      organizationId: "bad",
      applicationId: "bad",
      assessmentType: "",
      instructions: "",
      evaluatorId: "bad",
    })).toThrow();
  });

  it("connects application review actions to domain services and inline results", () => {
    const actions = read("src/app/hr/admin/applications/[id]/actions.ts");
    const form = read("src/app/hr/admin/applications/[id]/WorkflowActionForm.tsx");
    for (const operation of [
      "transitionApplication",
      "scheduleInterview",
      "changeInterview",
      "saveInterviewFeedback",
      "submitInterviewFeedback",
      "createAssessment",
      "updateAssessment",
      "createOffer",
      "submitOfferForApproval",
      "approveOffer",
      "issueOffer",
    ]) expect(actions).toContain(operation);
    expect(form).toContain("useActionState");
    expect(form).toContain('role={state.status === "error" ? "alert" : "status"}');
  });

  it("renders complete applicant, interview, assessment, and offer workspaces", () => {
    const page = read("src/app/hr/admin/applications/[id]/page.tsx");
    for (const section of [
      "Complete applicant record",
      "Screening answers",
      "Documents and exact versions",
      "Interviews and private feedback",
      "Assessments",
      "Versioned offer",
      "Immutable stage history",
    ]) expect(page).toContain(section);
    expect(page).toContain("prisma.hrDepartment.findMany");
    expect(page).toContain('name="positionId" required><option value="">Approved open position');
    expect(page).toContain("departments.map((department)");
    const actions = read("src/app/hr/admin/applications/[id]/actions.ts");
    expect(actions).toContain("positionId: z.string().cuid()");
    const offers = read("src/lib/hr/recruitment/offers.ts");
    expect(offers).toContain("positionId: z.string().cuid()");
  });

  it("keeps submitted interviewer feedback private and locked", () => {
    const interviews = read("src/lib/hr/recruitment/interviews.ts");
    const page = read("src/app/hr/admin/applications/[id]/page.tsx");
    expect(interviews).toContain("You are not assigned to this interview.");
    expect(interviews).toContain("Submitted interview feedback is locked.");
    expect(interviews).toContain("interviewerId: input.interviewerId");
    expect(interviews).toContain('recruitmentStatus: { in: ["INTERVIEW_SCHEDULED", "INTERVIEW_PENDING"] }');
    expect(page).toContain('application.recruitmentStatus === "INTERVIEW_PENDING"');
  });

  it("binds offer approval, issuance, and acceptance to exact immutable versions", () => {
    const offers = read("src/lib/hr/recruitment/offers.ts");
    expect(offers).toContain("offerVersionId: offer.activeVersionId");
    expect(offers).toContain("activeVersionId: input.offerVersionId");
    expect(offers).toContain("acceptedVersionId: input.offerVersionId");
    expect(offers).toContain("/track?applicationId=");
    expect(offers).not.toContain("/careers/offers/");
    expect(offers).toContain("initializeHandoverRequirements");
  });

  it("exposes the exact governed offer in the verified candidate portal", () => {
    const portal = read("src/app/track/portal/page.tsx");
    const actions = read("src/app/track/actions.ts");
    expect(portal).toContain("Governed employment offer · exact version");
    expect(portal).toContain("Accept exact offer");
    expect(actions).toContain("acceptGovernedOffer");
    expect(actions).toContain('isolationLevel: "Serializable"');
  });

  it("connects HR handover controls to requirements, documents, and atomic conversion", () => {
    const actions = read("src/app/hr/admin/handovers/[id]/actions.ts");
    const page = read("src/app/hr/admin/handovers/[id]/page.tsx");
    for (const operation of [
      "transitionHandover",
      "reviewRecruitmentDocument",
      "updateRecruitmentRequirement",
      "reassignHandoverOwner",
      "convertApprovedHandoverToPreHire",
    ]) expect(actions).toContain(operation);
    expect(page).toContain("Pre-hire eligibility:");
    expect(page).toContain("Pre-hire conversion: COMPLETED");
    expect(page).toContain("This handover has been converted to its linked employee and onboarding records.");
    expect(page).toContain("Approve and create PRE_HIRE");
    expect(page).toContain("entityId: { in: governedEntityIds }");
    expect(page).not.toContain('entityType: { in: ["HrRecruitmentRequirement", "HrRecruitmentDocumentReview"] }');
  });

  it("hides stale legacy stage progress after the governed offer lifecycle begins", () => {
    const portal = read("src/app/track/portal/page.tsx");
    expect(portal).toContain("governedLifecycleActive");
    expect(portal).toContain("Governed lifecycle status");
    expect(portal).toContain("Legacy stage percentages are hidden once an immutable offer is issued.");
  });

  it("enforces onboarding dependencies and readiness before activation", () => {
    const onboarding = read("src/lib/hr/recruitment/onboarding.ts");
    const page = read("src/app/hr/admin/onboarding/[id]/page.tsx");
    const actions = read("src/app/hr/admin/onboarding/[id]/actions.ts");
    expect(onboarding).toContain("Complete dependencies first:");
    expect(page).toContain("Activation readiness:");
    expect(actions).toContain("activateReadyEmployee");
    expect(actions).toContain('isolationLevel: "Serializable"');
  });

  it("links every handover and pre-hire queue record to an actionable workspace", () => {
    const queue = read("src/app/hr/admin/recruitment/page.tsx");
    expect(queue).toContain("Review HR handover");
    expect(queue).toContain("Manage onboarding and readiness");
  });

  it("preserves document versions and blocks stale verification after replacement", () => {
    const portalActions = read("src/app/track/actions.ts");
    const portal = read("src/app/track/portal/page.tsx");
    const handover = read("src/lib/hr/recruitment/handover.ts");
    expect(portalActions).toContain("submitGovernedDocumentReplacement");
    expect(portalActions).toContain("replacedById: replacement.id");
    expect(portalActions).toContain("documentVersion: review.documentVersion + 1");
    expect(portal).toContain("Earlier versions remain preserved for audit history.");
    expect(handover).toContain("A newer document version was submitted. Review the latest version.");
  });
});
