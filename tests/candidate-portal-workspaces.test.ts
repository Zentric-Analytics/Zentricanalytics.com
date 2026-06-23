import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

describe("candidate portal selected-stage workspaces", () => {
  const portal = readFileSync("src/app/track/portal/page.tsx", "utf8");
  const actions = readFileSync("src/app/track/actions.ts", "utf8");

  it("renders real Stage 2, Stage 3, and Stage 4 workspaces with backend actions", () => {
    expect(portal).toContain(
      "import { submitOfferDecision, submitStage2, submitStage3 }",
    );
    expect(portal).toContain("action={submitStage2}");
    expect(portal).toContain('name="fullLegalName"');
    expect(portal).toContain('name="governmentIdDocument"');
    expect(portal).toContain("action={submitStage3}");
    expect(portal).toContain("Candidate availability/confirmation input");
    expect(portal).toContain("action={submitOfferDecision}");
    expect(portal).toContain("Accept Offer");
    expect(portal).toContain("Decline Offer");
    expect(portal).toContain(
      "Offer details will appear here when released by admin.",
    );
  });

  it("defaults to the best next candidate-actionable stage before review-only stages", () => {
    expect(portal).toContain(
      "const bestNextActionableStage = portalStages.find",
    );
    expect(portal).toContain("isCandidateActionable(stage.status)");
    expect(portal).toContain(
      "requestedStage && isSelectable(requestedStage.status)",
    );
    expect(portal).toContain(
      "Your initial application is under review. The next step will",
    );
    expect(portal).toContain("Stage 2 submitted and under review.");
    expect(portal).toContain("Stage 3 submitted and under review.");
  });

  it("preserves selected stage on candidate action redirects", () => {
    expect(actions).toContain("{ stage: '2', success: 'stage2_submitted' }");
    expect(actions).toContain("{ stage: '3', success: 'stage3_submitted' }");
    expect(actions).toContain("{ stage: '4', success: 'offer_accepted' }");
    expect(actions).toContain("{ stage: '4', success: 'offer_declined' }");
  });

  it("keeps selectable statuses broad and documents admin-review only", () => {
    for (const status of [
      "Correction Requested",
      "Submitted",
      "Under Review",
      "Rejected",
    ]) {
      expect(portal).toContain(status);
    }
    expect(portal).not.toContain("Application Documents");
    expect(portal).not.toContain(
      "Submitted documents are available for admin review. You can track your application status here.",
    );
    expect(portal).not.toContain("/api/candidate/documents");
    expect(portal).not.toContain("<<<<<<<");
    expect(portal).not.toContain("=======");
    expect(portal).not.toContain(">>>>>>>");
  });
});
