import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

describe("Stage 5 employment agreement workflow source checks", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const migration = readFileSync("prisma/migrations/20260625000000_stage5_employment_agreement/migration.sql", "utf8");
  const hiring = readFileSync("src/lib/hiring.ts", "utf8");
  const adminActions = readFileSync("src/app/admin/applications/actions.ts", "utf8");
  const trackActions = readFileSync("src/app/track/actions.ts", "utf8");
  const adminPage = readFileSync("src/app/admin/applications/[id]/page.tsx", "utf8");
  const portal = readFileSync("src/app/track/portal/page.tsx", "utf8");
  const emails = readFileSync("src/lib/email-templates.ts", "utf8");

  it("extends EmploymentAgreement safely for Stage 5 persistence", () => {
    for (const field of ["title", "releasedAt", "releasedByAdminEmail", "candidateSubmittedAt", "approvedAt", "updatedAt", "roleSchedule"]) expect(schema).toContain(field);
    expect(migration).toContain("ALTER TABLE \"EmploymentAgreement\" ADD COLUMN");
  });

  it("adds server-side schemas and actions for admin and candidate Stage 5", () => {
    expect(hiring).toContain("stage5AgreementSchema");
    expect(hiring).toContain("stage5CandidateSubmissionSchema");
    expect(adminActions).toContain("adminStage5AgreementAction");
    expect(adminActions).toContain("adminStage5Action");
    expect(trackActions).toContain("submitStage5");
  });

  it("persists submission, signature, audit, review, approval, correction, reject, and Stage 6 unlock transitions", () => {
    expect(trackActions).toContain("tx.stageSubmission.create");
    expect(trackActions).toContain("tx.electronicSignature.create");
    expect(trackActions).toContain("Applicant submitted Stage 5 agreement");
    expect(adminActions).toContain("stage6.status === 'Locked'");
    expect(adminActions).toContain("status: 'Onboarding Pending', currentStageOrder: 6");
    expect(adminActions).toContain("Admin requested Stage 5 correction");
    expect(adminActions).toContain("Admin rejected Stage 5");
  });

  it("renders admin and candidate production Stage 5 workspaces and emails", () => {
    expect(adminPage).toContain("Stage 5 Agreement / onboarding · Employment Agreement + Role Schedule");
    expect(adminPage).toContain("action={adminStage5AgreementAction}");
    expect(adminPage).toContain("action={adminStage5Action}");
    expect(adminPage).toContain("application.stages.map");
    expect(portal).toContain("Employment agreement unlocks after offer acceptance.");
    expect(portal).toContain("Your employment agreement is being prepared.");
    expect(portal).toContain("action={submitStage5}");
    for (const template of ["stage5AgreementReleasedEmail", "stage5CorrectionRequestedEmail", "stage5RejectedEmail", "stage6UnlockedEmail"]) expect(emails).toContain(template);
  });
});
