import { describe, expect, it } from "vitest";
import { stage7AdminDecisionSchema, stage7CandidateSchema, toStage7SubmissionPayload } from "../src/lib/hiring";
import * as emails from "../src/lib/email-templates";
import fs from "node:fs";

const validStage7 = {
  session: "1234567890123456",
  privacyAcknowledgement: "on",
  policyAcknowledgement: "on",
  confidentialityAcknowledgement: "on",
  systemAccessAcknowledgement: "on",
  communicationAcknowledgement: "on",
  finalDeclaration: "on",
  finalHrApprovalUnderstanding: "on",
  electronicSignatureConsent: "on",
  signatureName: "Ada Candidate",
  candidateNote: "",
};

describe("Stage 7 policy acknowledgements", () => {
  it("validates all required acknowledgements and removes signature name from payload", () => {
    const parsed = stage7CandidateSchema.parse(validStage7);
    const payload = toStage7SubmissionPayload(parsed);
    expect(payload.sections).toMatchObject({ privacyAcknowledgement: true, systemAccessAcknowledgement: true, finalHrApprovalUnderstanding: true });
    expect(JSON.stringify(payload)).not.toContain(validStage7.signatureName);
  });

  it("rejects missing session, required acknowledgements, and signature", () => {
    const parsed = stage7CandidateSchema.safeParse({ ...validStage7, session: "", privacyAcknowledgement: undefined, signatureName: "A" });
    expect(parsed.success).toBe(false);
  });

  it("validates admin decision actions", () => {
    expect(stage7AdminDecisionSchema.parse({ applicationDbId: "app_1", action: "approve", notes: "Reviewed" }).action).toBe("approve");
    expect(stage7AdminDecisionSchema.safeParse({ applicationDbId: "app_1", action: "hold" }).success).toBe(false);
  });

  it("implements Stage 7 workflow persistence, approval, correction, rejection, and safe audit metadata", () => {
    const candidateActions = fs.readFileSync("src/app/track/actions.ts", "utf8");
    const adminActions = fs.readFileSync("src/app/admin/applications/actions.ts", "utf8");
    expect(adminActions).toContain("Stage 7 unlocked after Stage 6 approval");
    expect(candidateActions).toContain("stage6?.status !== \"Approved\"");
    expect(candidateActions).toContain("Applicant submitted Stage 7 acknowledgements");
    expect(candidateActions).toContain("tx.stageSubmission.create");
    expect(candidateActions).toContain("tx.electronicSignature.create");
    expect(candidateActions).toContain("status: \"Under Review\"");
    expect(adminActions).toContain("stage7_missing_submission");
    expect(adminActions).toContain("Admin approved Stage 7");
    expect(adminActions).toContain("Stage 8 unlocked after Stage 7 approval");
    expect(adminActions).toContain("currentStageOrder: 8");
    expect(adminActions).toContain("Admin requested Stage 7 correction");
    expect(adminActions).toContain("Admin rejected Stage 7");
    expect(adminActions).not.toContain("signatureName");
  });

  it("adds production-safe Stage 7/8 email wording", () => {
    expect(emails.stage7CorrectionRequestedEmail({ applicationId: "ZA-1" }).body).toContain("Final HR approval is still required");
    expect(emails.stage7RejectedEmail({ applicationId: "ZA-1" }).body).not.toContain("fully hired");
    expect(emails.stage8UnlockedEmail({ applicationId: "ZA-1" }).body).toContain("Final HR approval is still required");
  });
});
