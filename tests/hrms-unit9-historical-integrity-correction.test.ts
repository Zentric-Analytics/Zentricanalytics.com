import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const unit = path.join(root, "docs/hrms/delivery-units/unit-09");
const corrections = [
  {
    version: "2026.2",
    originalPath: "docs/hrms/delivery-units/unit-09/ng-candidate-2026-2-postgresql-evidence.md",
    originalClaim: "bd1906347d019c23d1ccf1f01d4072bff457badca80efb5c7beeacedc59aca68",
    retained: "0c220b75ec03045644ffa8d8dcb29610a26e209314ab53e1d4823863a4dac7e2",
    blob: "15e6cf14c953b6bbb5ded950f33fba9898cf5034",
  },
  {
    version: "2026.3",
    originalPath: "docs/hrms/delivery-units/unit-09/ng-candidate-2026-3-remediation-matrix.md",
    originalClaim: "517b048c6689d1a872fdbd2d6b87401c033c83101cfe598a2fd569d1352cd7a9",
    retained: "d7bf9466ed568b350d9d3e11d41f7b393a312e04f522b553123cc121852f3dec",
    blob: "7853154d2614296f4923af5945a5ebfcdc6f15ac",
  },
];
const sha = (data: Buffer) => crypto.createHash("sha256").update(data).digest("hex");

describe("HISTORICAL INTEGRITY CLAIM SUPERSEDED AND CORRECTED", () => {
  it("covers exactly the two approved artifacts, preserves claims, and binds retained blobs", () => {
    const register = fs.readFileSync(path.join(unit, "ng-candidate-2026-10-historical-integrity-correction-register.md"), "utf8");
    const owner = fs.readFileSync(path.join(unit, "ng-candidate-2026-10-owner-historical-integrity-correction.md"), "utf8");
    expect(owner).toContain("Signature: Olayinka Ogunlade");
    expect(owner).toContain("HISTORICAL CHECKSUM CLAIMS SUPERSEDED BY FORMAL VERSIONED CORRECTION");
    expect(owner).toContain("Unit 9 remains `NOT_CERTIFIED`");
    for (const correction of corrections) {
      expect(register).toContain(correction.originalPath.split("/").at(-1)!);
      expect(register).toContain(correction.originalClaim);
      expect(register).toContain(correction.retained);
      expect(register).toContain(correction.blob);
      const raw = execFileSync("git", ["cat-file", "blob", correction.blob], { cwd: root });
      expect(sha(raw)).toBe(correction.retained);
      expect(sha(raw)).not.toBe(correction.originalClaim);
    }
    expect((register.match(/\| 2026\.[23] \|/g) ?? [])).toHaveLength(2);
  });

  it("creates deterministic correction packages with only correction-aware payloads", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "unit9-historical-correction-"));
    try {
      execFileSync(process.execPath, ["scripts/hr-unit9-historical-integrity-correction-package.mjs", "--output-dir", out], { cwd: root, stdio: "pipe" });
      for (const correction of corrections) {
        const archive = `Zentric_NG-CANDIDATE-${correction.version}_Historical_Integrity_Correction.zip`;
        const packageHash = fs.readFileSync(path.join(out, `${archive}.sha256`), "utf8").split(/\s+/)[0];
        expect(packageHash).toMatch(/^[a-f0-9]{64}$/);
        expect(sha(fs.readFileSync(path.join(out, archive)))).toBe(packageHash);
        expect(fs.readFileSync(path.join(out, archive))).toEqual(fs.readFileSync(path.join(unit, "historical-integrity-corrections", archive)));
        const manifest = JSON.parse(fs.readFileSync(path.join(out, `correction-manifest-${correction.version}.json`), "utf8"));
        expect(manifest).toMatchObject({ originalClaimedSha256: correction.originalClaim, authoritativeRetainedSha256: correction.retained, authoritativeRetainedGitBlob: correction.blob, originalBytesAvailable: false, historicalClaimStatus: "SUPERSEDED", correctionStatus: "CLOSED_BY_VERSIONED_INTEGRITY_CORRECTION", unit9Status: "NOT_CERTIFIED", officialPayrollOutputsBlocked: true });
        expect(manifest.payloads).toHaveLength(correction.version === "2026.2" ? 8 : 7);
      }
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
});
