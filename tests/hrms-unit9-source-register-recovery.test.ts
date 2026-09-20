import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import crypto from "node:crypto";
import { recoverSourceRegister, reconstructSourceRegister, sourceRecovery as r } from "../scripts/hr-unit9-source-register-recovery.mjs";

const root = process.cwd();
const unit = "docs/hrms/delivery-units/unit-09/";
const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");
function entries(zip: Buffer) {
  const result = new Map<string, Buffer>();
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    expect(zip.readUInt16LE(offset + 8)).toBe(0);
    const size = zip.readUInt32LE(offset + 18);
    const names = zip.readUInt16LE(offset + 26);
    const extra = zip.readUInt16LE(offset + 28);
    const name = zip.subarray(offset + 30, offset + 30 + names).toString();
    const start = offset + 30 + names + extra;
    result.set(name, zip.subarray(start, start + size));
    offset = start + size;
  }
  return result;
}
describe("Exact sealed source-register representation recovery", () => {
  it("binds the historical raw bytes, unchanged claim and packaged reconstruction", () => {
    const raw = execFileSync("git", ["cat-file", "blob", r.authoritativeGitBlobId]);
    expect(execFileSync("git", ["rev-parse", r.authoritativeCommit + ":" + r.originalArtifactPath]).toString().trim()).toBe(r.authoritativeGitBlobId);
    expect(raw.length).toBe(4016);
    expect(sha(raw)).toBe(r.authoritativeGitBlobSha256);
    expect(fs.readFileSync(r.originalArtifactPath)).toEqual(raw);
    expect(raw.filter(b => b === 10)).toHaveLength(23);
    const recovered = recoverSourceRegister(root);
    expect(recovered.length).toBe(4039);
    expect(sha(recovered)).toBe(r.recoveredSealedSha256);
    let count = 0;
    for (let i = 0; i < recovered.length; i++) {
      if (recovered[i] === 10) { expect(recovered[i - 1]).toBe(13); count++; }
    }
    expect(count).toBe(23);
    expect(Buffer.from([...recovered].filter((b, i) => !(b === 13 && recovered[i + 1] === 10)))).toEqual(raw);
    const oldManifest = JSON.parse(fs.readFileSync(unit + "ng-candidate-2026-2-stage1-manifest.json", "utf8"));
    expect(oldManifest.artifacts.sourceRegisterSha256).toBe(r.recoveredSealedSha256);
    expect(fs.readFileSync(unit + "ng-candidate-2026-2-stage1-package.sha256", "utf8")).toContain(r.recoveredSealedSha256 + "  " + r.originalArtifactPath);
    const dir = unit + "historical-integrity-corrections/";
    const payloads = entries(fs.readFileSync(dir + "Zentric_NG-CANDIDATE-2026.2_Historical_Integrity_Correction.zip"));
    expect(payloads.get(r.payloadPath)).toEqual(recovered);
    const manifest = JSON.parse(payloads.get("correction-manifest-2026.2.json")!.toString());
    expect(manifest.sourceRegisterRecovery).toEqual(r);
    for (const item of manifest.payloads) expect(sha(payloads.get(item.path)!)).toBe(item.sha256);
    expect(payloads.get(unit + "ng-candidate-2026-2-stage1-manifest.json")).toEqual(fs.readFileSync(unit + "ng-candidate-2026-2-stage1-manifest.json"));
  });
  it("rejects textual mutation", () => {
    const raw = execFileSync("git", ["cat-file", "blob", r.authoritativeGitBlobId]);
    raw[0] ^= 1;
    expect(() => reconstructSourceRegister(raw)).toThrow();
  });
  it("rejects changed line counts and trailing lines", () => {
    const raw = execFileSync("git", ["cat-file", "blob", r.authoritativeGitBlobId]);
    expect(() => reconstructSourceRegister(Buffer.concat([raw, Buffer.from("\n")]))).toThrow();
    const changed = Buffer.from(raw); changed[changed.indexOf(10)] = 32;
    expect(() => reconstructSourceRegister(changed)).toThrow();
  });
});
