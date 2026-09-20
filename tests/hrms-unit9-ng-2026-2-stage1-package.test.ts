import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const evidence = path.join(root, "docs", "hrms", "delivery-units", "unit-09");
const manifestPath = path.join(evidence, "ng-candidate-2026-2-stage1-manifest.json");

const sha256 = (file: string) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const sha256Bytes = (bytes: Buffer) => crypto.createHash("sha256").update(bytes).digest("hex");

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

  it("HISTORICAL INTEGRITY CLAIM SUPERSEDED AND CORRECTED without altering the original claim", () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(manifest.candidateIdentity.functionalCandidateSha).toBe("14632a33b2cf2644089e54399412c7e94ce5dbbd");
    expect(manifest.database.migrationCount).toBe(58);
    expect(manifest.database.pendingMigrationCount).toBe(0);
    expect(manifest.sources).toHaveLength(6);
    expect(manifest.artifacts.expectedValueFixtureCount).toBe(17);
    expect(sha256(path.join(root, "tests", "fixtures", "ng-candidate-2026-2-expected-values.json"))).toBe(
      manifest.artifacts.expectedValueFixtureSha256,
    );
    const originalClaim = "bd1906347d019c23d1ccf1f01d4072bff457badca80efb5c7beeacedc59aca68";
    const retained = execFileSync("git", ["cat-file", "blob", "15e6cf14c953b6bbb5ded950f33fba9898cf5034"], { cwd: root });
    expect(manifest.artifacts.postgresqlEvidenceSha256).toBe(originalClaim);
    expect(sha256Bytes(retained)).toBe("0c220b75ec03045644ffa8d8dcb29610a26e209314ab53e1d4823863a4dac7e2");
    expect(sha256Bytes(retained)).not.toBe(originalClaim);
    const supersession = fs.readFileSync(path.join(evidence, "ng-candidate-2026-2-historical-integrity-supersession.md"), "utf8");
    expect(supersession).toContain("superseded, not repaired");
    expect(supersession).toContain(originalClaim);
    expect(supersession).toContain("15e6cf14c953b6bbb5ded950f33fba9898cf5034");
    const rawSource = execFileSync("git", ["cat-file", "blob", "32dd4ca7ce494299887db159b35946205b1607da"], { cwd: root });
    expect(fs.readFileSync(path.join(evidence, "ng-candidate-2026-2-source-register.md"))).toEqual(rawSource);
    expect(sha256Bytes(rawSource)).toBe("2c4220c6f25f03eb3a74e99b9cb4e9ac84c743a7290f49cdc2712e55c16add5b");
    expect(manifest.artifacts.sourceRegisterSha256).toBe("cb9f11bafa82627f389e62e97de6160143f56db94b8e3598d7ede94d91f32015");
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
