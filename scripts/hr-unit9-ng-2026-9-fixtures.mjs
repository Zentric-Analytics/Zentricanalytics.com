import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.join(root, "tests/fixtures/ng-candidate-2026-9-certification-families.json");
const outputPath = path.join(root, "docs/hrms/delivery-units/unit-09/ng-candidate-2026-9-fixture-evidence.json");

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)]));
  return value;
}

const digest = (value) => crypto.createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(canonical(value))).digest("hex");

export function buildNg2026_9FixtureEvidence(source = JSON.parse(fs.readFileSync(inputPath, "utf8"))) {
  const fixtures = source.families.map((family) => {
    const manifest = { candidateVersion: source.candidateVersion, candidateStatus: source.candidateStatus, currency: source.currency, precision: source.precision, family };
    const output = { familyId: family.id, expected: family.expected, authority: family.authority };
    return { familyId: family.id, manifestHash: digest(manifest), outputHash: digest(output), expectedDownstreamAuthorization: "REJECT_NOT_CERTIFIED", evidenceClassification: family.authority };
  });
  const evidence = { candidateVersion: "NG-CANDIDATE-2026.9", candidateStatus: "NOT_CERTIFIED", generatedBy: "DETERMINISTIC_CANONICAL_JSON_SHA256", fixtures };
  return { ...evidence, evidenceHash: digest(evidence) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const evidence = buildNg2026_9FixtureEvidence();
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`${evidence.fixtures.length} fixture families; ${evidence.evidenceHash}\n`);
}
