import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const evidence = path.join(root, "docs/hrms/delivery-units/unit-09");
const manifest = JSON.parse(fs.readFileSync(path.join(evidence, "ng-candidate-2026-3-stage1-manifest.json"), "utf8"));
const sha256 = (file: string) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const sha256Bytes = (bytes: Buffer) => crypto.createHash("sha256").update(bytes).digest("hex");
const sha256CanonicalCrlf = (file: string) => crypto.createHash("sha256").update(fs.readFileSync(file, "utf8").replace(/\r?\n/g, "\r\n")).digest("hex");

describe("NG-CANDIDATE-2026.3 immutable Stage 1 closure package", () => {
  it("binds exact candidate identity and remains uncertified", () => {
    expect(manifest.candidateVersion).toBe("NG-CANDIDATE-2026.3");
    expect(manifest.certificationStatus).toBe("NOT_CERTIFIED");
    expect(manifest.review.stage1ClosureReviewer).toBeNull();
    expect(manifest.review.stage2Certifier).toBeNull();
    expect(Object.values(manifest.restrictions).every((allowed) => allowed === false)).toBe(true);
  });
  it("HISTORICAL INTEGRITY CLAIM SUPERSEDED AND CORRECTED without altering the original claim", () => {
    expect(sha256(path.join(root, "src/lib/hr/payroll/nigeria-2026-3.ts"))).toBe(manifest.artifacts.ruleConfigurationSha256);
    // The immutable 2026.3 manifest was sealed from a Windows checkout. Canonicalize
    // line endings so the same source bytes verify on both Windows and Linux runners.
    expect(sha256CanonicalCrlf(path.join(root, "src/lib/hr/payroll/unit9-engine.ts"))).toBe(manifest.artifacts.engineSha256);
    expect(sha256(path.join(root, "tests/fixtures/ng-candidate-2026-3-expected-values.json"))).toBe(manifest.artifacts.expectedValueFixtureSha256);
    expect(sha256(path.join(evidence, "ng-candidate-2026-3-source-register.md"))).toBe(manifest.artifacts.sourceRegisterSha256);
    const originalClaim = "517b048c6689d1a872fdbd2d6b87401c033c83101cfe598a2fd569d1352cd7a9";
    const retained = execFileSync("git", ["cat-file", "blob", "7853154d2614296f4923af5945a5ebfcdc6f15ac"], { cwd: root });
    expect(manifest.artifacts.remediationMatrixSha256).toBe(originalClaim);
    expect(sha256Bytes(retained)).toBe("d7bf9466ed568b350d9d3e11d41f7b393a312e04f522b553123cc121852f3dec");
    expect(sha256Bytes(retained)).not.toBe(originalClaim);
    const supersession = fs.readFileSync(path.join(evidence, "ng-candidate-2026-3-historical-integrity-supersession.md"), "utf8");
    expect(supersession).toContain("superseded, not repaired");
    expect(supersession).toContain(originalClaim);
    expect(supersession).toContain("7853154d2614296f4923af5945a5ebfcdc6f15ac");
  });
  it("preserves 2026.2 bytes and records unresolved authority without inventing evidence", () => {
    expect(sha256(path.join(root, "tests/fixtures/ng-candidate-2026-2-expected-values.json"))).toBe("bc7113ecd2057f70a1215f7b9c61af018c70dfbb155cfb6177d50916dc20af30");
    expect(sha256(path.join(root, "src/lib/hr/payroll/nigeria-2026-2.ts"))).toBe("2bb4273852b4c5cb5685b57fb3852e95886ee3e91b6a18ba523afa8c3b8b8da5");
    expect(manifest.externalComplianceQuestions).toHaveLength(3);
    expect(manifest.sources.find((source: { id: string }) => source.id === "NG3-SRC-NMW-2024-BILL").status).toBe("FINAL_ACT_BYTES_REQUIRED");
  });
});
