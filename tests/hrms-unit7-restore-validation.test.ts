import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Unit 7 isolated restore validator", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "scripts/hr-unit7-restore-validation.mjs"), "utf8");

  it("is staging-only and checks the locked promotion chain", () => {
    expect(source).toContain('process.env.APP_ENV !== "staging"');
    expect(source).toContain('DR_RESTORE_CONFIRM !== "isolated-restore"');
    expect(source).toContain('employeeNumber: "U7-IMMEDIATE-001"');
    expect(source).toContain('reference: "WFE-2026-5B0A5F70"');
    expect(source).toContain('finalizedAt: { not: null }');
    expect(source).toContain('Boolean(calibration.managerRatingItemId)');
    expect(source).toContain('!employeeRationale.includes(calibrationRationale)');
    expect(source).toContain('activeAssignment.effectiveFrom.getTime() === event.appliedAt.getTime()');
    expect(source).toContain('`%${promotionCase.id}%`');
    expect(source).toContain("migrations.length === 43");
  });

  it("checks confidentiality, exactly-once application, and duplicates", () => {
    expect(source).toContain("managerRecommendationPreserved");
    expect(source).toContain("calibratedOutcomeSeparate");
    expect(source).toContain("employeeRationaleSafe");
    expect(source).toContain("attempts.length === 1");
    expect(source).toContain("overlapCount === 0");
  });
});
