import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Unit 7 real staging concurrency gate", () => {
  const script = readFileSync("scripts/hr-unit7-staging-concurrency.mjs", "utf8");

  it("is staging-only and covers the mandatory exactly-once race matrix", () => {
    expect(script).toContain('HR_UNIT7_STAGING_CONCURRENCY_CONFIRM !== "staging-only"');
    expect(script).toContain('databaseUrl.pathname.slice(1) !== "zentric_analytics_staging"');
    for (const race of [
      "goal_edit_vs_approval", "self_review_vs_manager_submission", "manager_review_vs_calibration",
      "calibration_finalize_vs_finalize", "review_finalization_vs_late_edit", "development_edit_vs_finalization",
      "readiness_vs_target_change", "promotion_recommendation_vs_transfer", "promotion_approval_vs_separation",
      "promotion_approval_vs_long_term_leave", "duplicate_promotion_approval", "duplicate_unit7_to_unit4_handoff",
      "unit4_promotion_apply_vs_apply", "cycle_close_vs_late_submission", "worker_replay", "notification_replay",
    ]) expect(script).toContain(race);
    expect(script).toContain('action: "hr.performance.concurrency.validated"');
    expect(script).toContain('loser: "STALE_CONFLICT"');
  });
});
