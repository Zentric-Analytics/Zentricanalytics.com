import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Stage 3 screening/interview/assessment source checks", () => {
  it("adds generic HiringStage metadata and migration for Stage 3 instructions", () => {
    expect(readFileSync("prisma/schema.prisma", "utf8")).toContain(
      "metadata      Json?",
    );
    expect(
      readFileSync(
        "prisma/migrations/20260622050000_stage3_metadata/migration.sql",
        "utf8",
      ),
    ).toContain('ADD COLUMN IF NOT EXISTS "metadata" JSONB');
  });

  it("candidate portal does not render the lower Stage 3 presentation or upload links", () => {
    const portal = readFileSync("src/app/track/portal/page.tsx", "utf8");
    expect(portal).toContain("Stage 3 unlocks after Stage 2 approval.");
    expect(portal).toContain("Screening details will be shared");
    expect(portal).toContain("Stage 3 workspace");
    expect(portal).toContain("Screening type:");
    expect(portal).toContain("href={stage3Metadata.meetingLink}");
    expect(portal).toContain("stage3Metadata.requiresCandidateResponse");
    expect(portal).toContain("Submit Stage 3");
    expect(portal).toContain("requiresUpload");
    expect(portal).not.toContain(
      "/api/admin/applications/${application.id}/uploads",
    );
  });

  it("candidate Stage 3 action requires a valid session, release, private upload, and safe diagnostics", () => {
    const actions = readFileSync("src/app/track/actions.ts", "utf8");
    expect(actions).toContain("export async function submitStage3");
    expect(actions).toContain("verifiedSessionTokenHash: sha256(session)");
    expect(actions).toContain("application: { deletedAt: null }");
    expect(actions).toContain("metadata.releasedAt");
    expect(actions).toContain("metadata.requiresCandidateResponse");
    expect(actions).toContain("metadata.requiresUpload");
    expect(actions).toContain('success: "stage3_submitted"');
    expect(actions).toContain("validateCvFile");
    expect(actions).toContain("savePrivateUpload");
    expect(actions).toContain("stageSubmission.create");
    expect(actions).toContain("uploadedDocument.create");
    expect(actions).toContain('status: "Under Review"');
    expect(actions).toContain("candidateStage3SubmitDiagnostics");
    const diagnostics = actions.slice(
      actions.indexOf("candidateStage3SubmitDiagnostics"),
    );
    expect(diagnostics).not.toContain("session:");
    expect(diagnostics).not.toContain("file contents");
  });

  it("admin can release, review, correct, reject, and approve Stage 3 to unlock Stage 4", () => {
    const detail = readFileSync(
      "src/app/admin/applications/[id]/page.tsx",
      "utf8",
    );
    const actions = readFileSync(
      "src/app/admin/applications/actions.ts",
      "utf8",
    );
    const workflow = readFileSync("src/lib/workflow.ts", "utf8");
    expect(detail).toContain("Stage 3 Screening / Interview / Assessment");
    expect(detail).toContain("Screening setup");
    expect(detail).toContain("Interview details");
    expect(detail).toContain("Assessment requirements");
    expect(detail).toContain("Candidate instructions");
    expect(detail).toContain("Release/update Stage 3 instructions");
    expect(detail).toContain("Candidate response");
    expect(detail).toContain("Uploaded Stage 3 files");
    expect(detail).toContain("AdminDocumentActions");
    expect(actions).toContain("adminStage3InstructionAction");
    expect(actions).toContain("adminStage3Action");
    expect(actions).toContain("stage-3-instructions-available");
    expect(workflow).toContain("export async function approveStage3");
    expect(workflow).toContain("stageOrder: 4");
    expect(workflow).toContain("status: 'Offer Pending'");
    expect(workflow).toContain("recordAdminStage3Action");
  });

  it("keeps Stage 3 uploads private/admin-only and avoids conflict markers", () => {
    const portal = readFileSync("src/app/track/portal/page.tsx", "utf8");
    const detail = readFileSync(
      "src/app/admin/applications/[id]/page.tsx",
      "utf8",
    );
    const actions = readFileSync("src/app/track/actions.ts", "utf8");
    const storage = readFileSync("src/lib/storage.ts", "utf8");
    for (const source of [portal, detail, actions, storage]) {
      expect(source).not.toContain("<<<<<<<");
      expect(source).not.toContain("=======");
      expect(source).not.toContain(">>>>>>>");
    }
    expect(portal).not.toContain(
      "/api/admin/applications/${application.id}/uploads",
    );
    expect(detail).toContain("AdminDocumentActions");
    expect(actions).toContain("Stage 3 Assessment Upload");
    expect(actions).toContain(
      "deletePrivateUpload(item.storageKey, item.provider)",
    );
    expect(storage).not.toContain("console.log");
  });
});
