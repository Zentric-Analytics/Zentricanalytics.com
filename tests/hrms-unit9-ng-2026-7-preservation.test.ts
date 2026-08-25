import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const expected: Record<string, string> = {
  "src/lib/hr/payroll/nigeria-2026-2.ts": "2bb4273852b4c5cb5685b57fb3852e95886ee3e91b6a18ba523afa8c3b8b8da5",
  "src/lib/hr/payroll/nigeria-2026-3.ts": "d2f82e2983dab31dc721d21a96baebc9669804fe5ad200259d24f4707f2ee46b",
  "src/lib/hr/payroll/nigeria-2026-4.ts": "b3682380a416bbb1fe88bdb192bdf518f8e77a155a35383c1823fd1cbacfa25e",
  "src/lib/hr/payroll/nigeria-2026-5.ts": "752ee33ae95bfebdef1f7aa6f51398086b7370c64e1305bada4fddb8455c9fc4",
  "src/lib/hr/payroll/nigeria-2026-6.ts": "aa32d1f5fc48b965028b8fbb701bcdb321109e59a12a55a2bde6f25f991e56b5",
  "src/lib/hr/payroll/unit9-engine-2026-6.ts": "c932c175899c9bcdeb3d648316ac013b88bbf818015c8aad44cb85c57c20e121",
  "tests/fixtures/ng-candidate-2026-6-expected-values.json": "c45ee28cc0e251c9daf58c3b059b7f1e7a33fb6b9f8c16631a9efb4ead1f0cb7"
};

describe("NG-CANDIDATE-2026.7 immutable predecessor preservation", () => {
  it.each(Object.entries(expected))("preserves %s byte-for-byte", (file, digest) => expect(crypto.createHash("sha256").update(fs.readFileSync(path.join(process.cwd(), file))).digest("hex")).toBe(digest));
});
