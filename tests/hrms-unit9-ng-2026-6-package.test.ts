import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const sha = (file: string) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");

describe("NG-CANDIDATE-2026.6 immutable Stage 1 package", () => {
  it("matches every declared package hash", () => {
    const records = fs.readFileSync(path.join(root, "docs/hrms/delivery-units/unit-09/ng-candidate-2026-6-stage1-package.sha256"), "utf8").trim().split(/\r?\n/).map((line) => {
      const [hash, file] = line.split(/\s{2,}/);
      return { hash, file };
    });
    expect(records).toHaveLength(17);
    for (const record of records) expect(sha(record.file)).toBe(record.hash);
  });

  it("binds the manifest to the exact staging evidence without claiming certification", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "docs/hrms/delivery-units/unit-09/ng-candidate-2026-6-stage1-manifest.json"), "utf8"));
    expect(manifest).toMatchObject({
      candidateVersion: "NG-CANDIDATE-2026.6",
      status: "READY_FOR_STAGE_1_CLOSURE_REVIEW_NOT_CERTIFIED",
      stagingEvidenceCommit: "492f8f47c72eff4aa435ae2dc7fd21fc1fd50623",
      stagingDeployment: "dep-da6tvv3l550s73fe0asg",
      migrationCount: 62,
      pendingMigrations: 0,
      finalizationAllowed: false,
      stage2Started: false,
    });
  });

  it("publishes a non-sensitive status boundary", () => {
    const status = fs.readFileSync(path.join(root, "src/app/hr/admin/unit-9-status/page.tsx"), "utf8");
    expect(status).toContain("NG-CANDIDATE-2026.6");
    expect(status).toContain("NOT CERTIFIED");
    expect(status).toContain("No employee payroll, tax, bank or payment data is displayed.");
    expect(status).not.toMatch(/password|mfa secret|account number/i);
  });
});
