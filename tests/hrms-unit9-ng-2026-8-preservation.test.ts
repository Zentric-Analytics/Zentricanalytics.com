import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const expected = {
  "src/lib/hr/payroll/nigeria-2026-7.ts": "ea95fdfd2b903ebaafcdec230b83ebacdb6cf0ccbf3f45921d9faad3317a2f16",
  "src/lib/hr/payroll/unit9-engine-2026-7.ts": "a9aba974a0ea4f2963c3ac1a5bedebe0a362593b6ebb285b6a186b7d4472c085",
  "tests/hrms-unit9-ng-2026-7.test.ts": "afa174453da3d0b642f12ae94d18610bb6e1921442356acf546518fe6b98bb74",
  "scripts/hr-unit9-ng-2026-7-concurrency.ts": "1e851e5293d15542507cb9d7375117160827e5bd442ab09b5a75f03744ae873d",
  "docs/hrms/delivery-units/unit-09/ng-candidate-2026-7-stage1-manifest.json": "809e2f5cb27a95913a52b6c995ad33b18a7ef2e93d675b862c699eafd24b47e9",
  "docs/hrms/delivery-units/unit-09/Zentric_NG-CANDIDATE-2026.7_Immutable_Review_Package.zip": "e07a60de7a382fcb4cd04eeeb71c59af5f0ece37bcf4a6969e426a4a561233b9",
} as const;

describe("NG-CANDIDATE-2026.8 predecessor preservation", () => {
  it("keeps the sealed 2026.7 runtime, tests, harness, manifest and ZIP byte-identical", () => {
    for (const [relative, hash] of Object.entries(expected)) expect(crypto.createHash("sha256").update(fs.readFileSync(path.join(process.cwd(), relative))).digest("hex"), relative).toBe(hash);
  });
});
