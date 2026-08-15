import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const evidence = path.join(root, "docs", "hrms", "delivery-units", "unit-09");
const manifestPath = path.join(evidence, "ng-candidate-2026-2-stage1-manifest.json");

const sha256 = (file: string) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

describe("NG-CANDIDATE-2026.2 immutable Stage 1 package", () => {
  it("remains explicitly not certified and has no human certification event", () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(manifest.candidateVersion).toBe("NG-CANDIDATE-2026.2");
    expect(manifest.certificationStatus).toBe("NOT_CERTIFIED");
    expect(manifest.review).toEqual({
      stage1Reviewer: null,
      stage1Decision: "PENDING",
      stage2Certifier: null,
      certificationEvent: null,
    });
    expect(Object.values(manifest.restrictions).every((value) => value === false)).toBe(true);
  });

  it("preserves the functional identity and independently binds evidence files", () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(manifest.candidateIdentity.functionalCandidateSha).toBe("14632a33b2cf2644089e54399412c7e94ce5dbbd");
    expect(manifest.database.migrationCount).toBe(58);
    expect(manifest.database.pendingMigrationCount).toBe(0);
    expect(manifest.sources).toHaveLength(6);
    expect(manifest.artifacts.expectedValueFixtureCount).toBe(17);
    expect(sha256(path.join(root, "tests", "fixtures", "ng-candidate-2026-2-expected-values.json"))).toBe(
      manifest.artifacts.expectedValueFixtureSha256,
    );
    expect(sha256(path.join(evidence, "ng-candidate-2026-2-postgresql-evidence.md"))).toBe(
      manifest.artifacts.postgresqlEvidenceSha256,
    );
    expect(sha256(path.join(evidence, "ng-candidate-2026-2-source-register.md"))).toBe(
      manifest.artifacts.sourceRegisterSha256,
    );
  });

  it("keeps unresolved law interpretation explicit and official finalization closed", () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(manifest.sources.find((source: { id: string }) => source.id === "NG2-SRC-006")).toEqual(
      expect.objectContaining({ sha256: null, status: "EXTERNAL_COMPLIANCE_DECISION_REQUIRED" }),
    );
    const handoff = fs.readFileSync(path.join(evidence, "ng-candidate-2026-2-stage1-package.md"), "utf8");
    expect(handoff).toContain("NOT CERTIFIED");
    expect(handoff).toContain("Appendix 1 is a blank format");
    expect(handoff).toContain("no filing or remittance");
  });
});
