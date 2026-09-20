import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

export const sourceRecovery = Object.freeze({
  authoritativeCommit: "85f099be7b309adda88d84e73a2c4ce00586f6d1",
  originalArtifactPath: "docs/hrms/delivery-units/unit-09/ng-candidate-2026-2-source-register.md",
  payloadPath: "recovered-sealed/ng-candidate-2026-2-source-register.md",
  authoritativeGitBlobSha256: "2c4220c6f25f03eb3a74e99b9cb4e9ac84c743a7290f49cdc2712e55c16add5b",
  authoritativeGitBlobId: "32dd4ca7ce494299887db159b35946205b1607da",
  authoritativeGitBlobSize: 4016,
  recoveredSealedSha256: "cb9f11bafa82627f389e62e97de6160143f56db94b8e3598d7ede94d91f32015",
  recoveredSealedSize: 4039,
  lineEndingTransformation: "LF_TO_CRLF",
  transformedLineEndingCount: 23,
  recoveryStatus: "EXACT_SEALED_REPRESENTATION_RECOVERED",
});
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

export function reconstructSourceRegister(raw) {
  if (raw.length !== 4016 || sha(raw) !== sourceRecovery.authoritativeGitBlobSha256 ||
      raw.includes(13) || raw.filter((b) => b === 10).length !== 23) {
    throw new Error("Authoritative source-register bytes or line-ending count changed");
  }
  // Byte transformation only: never decode text, normalize Unicode, or trim.
  const output = Buffer.alloc(4039);
  let i = 0;
  for (const byte of raw) {
    if (byte === 10) output[i++] = 13;
    output[i++] = byte;
  }
  if (i !== 4039 || sha(output) !== sourceRecovery.recoveredSealedSha256) {
    throw new Error("Recovered sealed representation mismatch");
  }
  return output;
}

export function recoverSourceRegister(root) {
  const blob = execFileSync("git", ["rev-parse", sourceRecovery.authoritativeCommit + ":" + sourceRecovery.originalArtifactPath], { cwd: root }).toString().trim();
  if (blob !== sourceRecovery.authoritativeGitBlobId) throw new Error("Historical commit/blob binding changed");
  return reconstructSourceRegister(execFileSync("git", ["cat-file", "blob", blob], { cwd: root }));
}
