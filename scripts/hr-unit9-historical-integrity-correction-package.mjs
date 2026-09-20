import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { recoverSourceRegister, sourceRecovery } from "./hr-unit9-source-register-recovery.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const unit = path.join(root, "docs/hrms/delivery-units/unit-09");
const assessment = path.join(unit, "NG-CANDIDATE-2026.9_Historical_Evidence_Exception_Assessment.md");
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const corrections = {
  "2026.2": { artifact: "docs/hrms/delivery-units/unit-09/ng-candidate-2026-2-postgresql-evidence.md", artifactName: "ng-candidate-2026-2-postgresql-evidence.md", claimed: "bd1906347d019c23d1ccf1f01d4072bff457badca80efb5c7beeacedc59aca68", retained: "0c220b75ec03045644ffa8d8dcb29610a26e209314ab53e1d4823863a4dac7e2", commit: "a793a25416f98ca41c47c3e71fd25ecc4423f849", blob: "15e6cf14c953b6bbb5ded950f33fba9898cf5034", manifest: "docs/hrms/delivery-units/unit-09/ng-candidate-2026-2-stage1-manifest.json", checksum: "docs/hrms/delivery-units/unit-09/ng-candidate-2026-2-stage1-package.sha256", supersession: "docs/hrms/delivery-units/unit-09/ng-candidate-2026-2-historical-integrity-supersession.md" },
  "2026.3": { artifact: "docs/hrms/delivery-units/unit-09/ng-candidate-2026-3-remediation-matrix.md", artifactName: "ng-candidate-2026-3-remediation-matrix.md", claimed: "517b048c6689d1a872fdbd2d6b87401c033c83101cfe598a2fd569d1352cd7a9", retained: "d7bf9466ed568b350d9d3e11d41f7b393a312e04f522b553123cc121852f3dec", commit: "f13696df41a20f07a165215c0b1a57e376b4b16b", blob: "7853154d2614296f4923af5945a5ebfcdc6f15ac", manifest: "docs/hrms/delivery-units/unit-09/ng-candidate-2026-3-stage1-manifest.json", checksum: "docs/hrms/delivery-units/unit-09/ng-candidate-2026-3-stage1-package.sha256", supersession: "docs/hrms/delivery-units/unit-09/ng-candidate-2026-3-historical-integrity-supersession.md" },
};

function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
function u16(value) { const out = Buffer.alloc(2); out.writeUInt16LE(value); return out; }
function u32(value) { const out = Buffer.alloc(4); out.writeUInt32LE(value >>> 0); return out; }
function zip(entries) {
  let offset = 0; const locals = []; const central = [];
  for (const [name, data] of entries) {
    const nameBytes = Buffer.from(name); const crc = crc32(data); const size = data.length;
    const local = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), u16(20), u16(0), u16(0), u16(0), u16(33), u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0), nameBytes, data]);
    locals.push(local);
    central.push(Buffer.concat([Buffer.from([0x50, 0x4b, 0x01, 0x02]), u16(20), u16(20), u16(0), u16(0), u16(0), u16(33), u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0x81a40000), u32(offset), nameBytes]));
    offset += local.length;
  }
  const directory = Buffer.concat(central);
  return Buffer.concat([...locals, directory, Buffer.from([0x50, 0x4b, 0x05, 0x06]), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(directory.length), u32(offset), u16(0)]);
}
const rawBlob = (blob) => execFileSync("git", ["cat-file", "blob", blob], { cwd: root });
const current = (relative) => fs.readFileSync(path.join(root, relative));

function build(version, config, outputDir) {
  const retained = rawBlob(config.blob);
  if (sha(retained) !== config.retained) throw new Error(`Retained blob mismatch for ${version}`);
  const payload = new Map([
    [`authoritative-retained/${config.artifactName}`, retained],
    [config.manifest, current(config.manifest)], [config.checksum, current(config.checksum)], [config.supersession, current(config.supersession)],
    ["docs/hrms/delivery-units/unit-09/ng-candidate-2026-10-historical-integrity-correction-register.md", current("docs/hrms/delivery-units/unit-09/ng-candidate-2026-10-historical-integrity-correction-register.md")],
    ["docs/hrms/delivery-units/unit-09/ng-candidate-2026-10-owner-historical-integrity-correction.md", current("docs/hrms/delivery-units/unit-09/ng-candidate-2026-10-owner-historical-integrity-correction.md")],
    [path.relative(root, assessment).split(path.sep).join("/"), fs.readFileSync(assessment)],
  ]);
  if (!payload.get(config.manifest).length || !payload.get(config.checksum).length) throw new Error("Unexpected empty original record");
  if (!payload.get(config.manifest).includes(config.claimed) || !payload.get(config.checksum).includes(config.claimed)) throw new Error(`Original claim missing for ${version}`);
  if (version === "2026.2") payload.set(sourceRecovery.payloadPath, recoverSourceRegister(root));
  const payloads = [...payload].sort(([a], [b]) => a.localeCompare(b)).map(([name, data]) => ({ path: name, sha256: sha(data) }));
  const manifest = Buffer.from(`${JSON.stringify({ candidateVersion: `NG-CANDIDATE-${version}`, originalArtifactPath: config.artifact, originalManifestPath: config.manifest, originalChecksumPath: config.checksum, originalClaimedSha256: config.claimed, authoritativeRetainedSha256: config.retained, authoritativeRetainedCommit: config.commit, authoritativeRetainedGitBlob: config.blob, originalBytesAvailable: false, historicalClaimStatus: "SUPERSEDED", correctionStatus: "CLOSED_BY_VERSIONED_INTEGRITY_CORRECTION", unit9Status: "NOT_CERTIFIED", officialPayrollOutputsBlocked: true, payloads }, null, 2)}\n`);
  const manifestObject = JSON.parse(manifest.toString());
  if (version === "2026.2") manifestObject.sourceRegisterRecovery = sourceRecovery;
  const finalManifest = version === "2026.2" ? Buffer.from(JSON.stringify(manifestObject, null, 2) + "\n") : manifest;
  const checksums = Buffer.from(payloads.map((item) => `${item.sha256}  ${item.path}\n`).join(""));
  const manifestName = `correction-manifest-${version}.json`; const checksumName = `correction-package-${version}.sha256`;
  const archive = `Zentric_NG-CANDIDATE-${version}_Historical_Integrity_Correction.zip`;
  const entries = [...payload, [manifestName, finalManifest], [checksumName, checksums]].sort(([a], [b]) => a.localeCompare(b));
  const first = zip(entries); const second = zip(entries); if (!first.equals(second)) throw new Error(`Non-deterministic package for ${version}`);
  fs.writeFileSync(path.join(outputDir, archive), first);
  fs.writeFileSync(path.join(outputDir, `${archive}.sha256`), `${sha(first)}  ${archive}\n`);
  fs.writeFileSync(path.join(outputDir, manifestName), finalManifest);
  fs.writeFileSync(path.join(outputDir, checksumName), checksums);
  return { archive, archiveSha256: sha(first), manifest: manifestName, checksum: checksumName, authoritativeRetainedSha256: config.retained };
}

const flag = process.argv.indexOf("--output-dir");
const outputDir = path.resolve(flag >= 0 ? process.argv[flag + 1] : path.join(unit, "historical-integrity-corrections"));
if (!fs.existsSync(assessment)) throw new Error(`Missing recovery assessment: ${assessment}`);
fs.mkdirSync(outputDir, { recursive: true });
console.log(JSON.stringify(Object.fromEntries(Object.entries(corrections).map(([version, config]) => [version, build(version, config, outputDir)])), null, 2));
