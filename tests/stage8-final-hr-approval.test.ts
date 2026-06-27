import { describe, expect, it } from "vitest";
import { stage8AdminFinalDecisionSchema, stage8ChecklistKeys, toStage8ChecklistPayload } from "../src/lib/hiring";
import * as emails from "../src/lib/email-templates";
import fs from "node:fs";

describe("Stage 8 final HR approval", () => {
  const validFinalize = Object.fromEntries(stage8ChecklistKeys.map((key) => [key, "on"]));

  it("validates final approval checklist and supports correction/reject actions", () => {
    expect(stage8AdminFinalDecisionSchema.safeParse({ applicationDbId: "app_1", action: "finalize" }).success).toBe(false);
    expect(stage8AdminFinalDecisionSchema.parse({ applicationDbId: "app_1", action: "finalize", ...validFinalize }).action).toBe("finalize");
    expect(stage8AdminFinalDecisionSchema.parse({ applicationDbId: "app_1", action: "correction", finalHrNotes: "Resolve HR condition" }).action).toBe("correction");
    expect(stage8AdminFinalDecisionSchema.parse({ applicationDbId: "app_1", action: "reject" }).action).toBe("reject");
    expect(toStage8ChecklistPayload({ applicationDbId: "app_1", action: "finalize", ...validFinalize }).finalHrNotesPresent).toBe(false);
  });

  it("implements secure admin persistence, statuses, approvals, audit logs, and no sensitive audit metadata", () => {
    const actions = fs.readFileSync("src/app/admin/applications/actions.ts", "utf8");
    expect(actions).toContain("export async function adminStage8Action");
    expect(actions).toContain("getAdminSession");
    expect(actions).toContain("stage8_prior_stages_incomplete");
    expect(actions).toContain("status: 'Approved'");
    expect(actions).toContain("stageApproval.create");
    expect(actions).toContain("status: 'Hired', currentStageOrder: 8");
    expect(actions).toContain("Admin requested Stage 8 correction");
    expect(actions).toContain("status: 'Correction Requested'");
    expect(actions).toContain("Admin rejected Stage 8");
    expect(actions).toContain("status: 'Rejected', currentStageOrder: 8");
    expect(actions).toContain("metadata: { checklistConfirmed: true");
    expect(actions).not.toContain("metadata: { finalHrNotes");
  });

  it("exposes candidate Stage 8 status without candidate finalization", () => {
    const portal = fs.readFileSync("src/app/track/portal/page.tsx", "utf8");
    expect(portal).toContain("Final HR approval unlocks after policy and access acknowledgements are approved.");
    expect(portal).toContain("Your application is in final HR review. Zentric Analytics LTD is reviewing your completed employee file.");
    expect(portal).toContain("Final HR approval completed. Your hiring workflow is complete.");
    expect(portal).not.toContain("submitStage8");
  });

  it("adds production-safe final review emails", () => {
    expect(emails.hiringWorkflowCompletedEmail({ applicationId: "ZA-1" }).body).toContain("Final HR approval has been completed");
    expect(emails.stage8FinalReviewCorrectionEmail({ applicationId: "ZA-1" }).body).not.toContain("payroll");
    expect(emails.stage8RejectedEmail({ applicationId: "ZA-1" }).body).not.toContain("bank");
  });
});
