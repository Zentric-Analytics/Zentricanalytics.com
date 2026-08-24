import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const evidence = path.join(root, "docs/hrms/delivery-units/unit-09");
const manifest = JSON.parse(fs.readFileSync(path.join(evidence, "ng-candidate-2026-4-stage1-manifest.json"), "utf8"));
const sha = (file: string) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n")).digest("hex");

describe("NG-CANDIDATE-2026.4 immutable Stage 1 closure-review package", () => {
  it("binds candidate identity, owner taxonomy and fail-closed restrictions", () => {
    expect(manifest.candidateVersion).toBe("NG-CANDIDATE-2026.4");
    expect(manifest.certificationStatus).toBe("NOT_CERTIFIED");
    expect(manifest.ownerDecision).toBe("UNIT 9 ORDINARY EARNINGS = SALARY + BONUS ONLY");
    expect(manifest.review).toEqual({ stage1ClosureReviewer: null, stage1Decision: null, stage2Certifier: null });
    expect(Object.values(manifest.restrictions).every((value) => value === false)).toBe(true);
  });

  it("binds exact implementation, fixture and evidence bytes", () => {
    const bindings: Record<string, string> = {
      ruleConfigurationSha256: "src/lib/hr/payroll/nigeria-2026-4.ts",
      sharedEngineSha256: "src/lib/hr/payroll/unit9-engine.ts",
      candidateEngineAdapterSha256: "src/lib/hr/payroll/unit9-engine-2026-4.ts",
      expectedValueFixtureSha256: "tests/fixtures/ng-candidate-2026-4-expected-values.json",
      sourceRegisterSha256: "docs/hrms/delivery-units/unit-09/ng-candidate-2026-4-source-register.md",
      ownerDecisionSha256: "docs/hrms/delivery-units/unit-09/ng-candidate-2026-4-owner-decision.md",
      earningTaxonomySha256: "docs/hrms/delivery-units/unit-09/ng-candidate-2026-4-earning-taxonomy.md",
      compensationInventorySha256: "docs/hrms/delivery-units/unit-09/ng-candidate-2026-4-compensation-inventory.json",
      remediationMatrixSha256: "docs/hrms/delivery-units/unit-09/ng-candidate-2026-4-remediation-matrix.md",
      preservationProofSha256: "docs/hrms/delivery-units/unit-09/ng-candidate-2026-4-preservation.md",
      calculationManifestSha256: "docs/hrms/delivery-units/unit-09/ng-candidate-2026-4-calculation-manifest.json",
      stage1PackageSha256: "docs/hrms/delivery-units/unit-09/ng-candidate-2026-4-stage1-package.md"
    };
    for (const [key, file] of Object.entries(bindings)) expect(sha(file), file).toBe(manifest.artifacts[key]);
  });

  it("records unresolved external evidence without inventing Stage 1 closure", () => {
    expect(manifest.externalEvidenceGaps).toHaveLength(5);
    expect(manifest.externalEvidenceGaps).toContain("RTA refund or offset execution procedure");
  });
});
