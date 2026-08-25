import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const expected: Record<string, string> = {
  "src/lib/hr/payroll/nigeria-2026-5.ts": "752ee33ae95bfebdef1f7aa6f51398086b7370c64e1305bada4fddb8455c9fc4",
  "src/lib/hr/payroll/unit9-engine-2026-5.ts": "23dac52fe495b972ebbfda64b243e058c36f9f1f771c711cd0f134b3e81bfb4a",
  "tests/fixtures/ng-candidate-2026-5-expected-values.json": "ecd3b56bced253af1be879d73759baf7fdf29b8ea44eba3fe5fcd0167b0e3177",
  "docs/hrms/delivery-units/unit-09/ng-candidate-2026-5-stage1-manifest.json": "23f72a5cf37c4bf3ea0cae22f708402f955eae0ccb7367955c42f11c1fe8a0f6",
  "docs/hrms/delivery-units/unit-09/ng-candidate-2026-5-stage1-package.md": "581b3d09213dfbde84b05b88511f4c7b2e01002ff62dfc603abd6938cbfee390",
  "docs/hrms/delivery-units/unit-09/ng-candidate-2026-5-stage1-package.sha256": "c3cf9d2ff1b0beaa08e7a235649f38ade38284b7a70eca0b1c33efa25db9f422",
  "docs/hrms/delivery-units/unit-09/ng-candidate-2026-5-source-register.md": "1a656a50d6023c832187bf917cd2d6152fff788fec753de3131849eaade63236",
  "docs/hrms/delivery-units/unit-09/ng-candidate-2026-5-staging-validation.md": "2aa64c58bf0c4525fc36cf3959faf27e89f2f9400a45f98b80aa2ac9cd5cfef5",
};

describe("NG-CANDIDATE-2026.6 immutable predecessor preservation", () => {
  it.each(Object.entries(expected))("preserves %s byte-for-byte", (file, digest) => {
    expect(crypto.createHash("sha256").update(fs.readFileSync(path.join(process.cwd(), file))).digest("hex")).toBe(digest);
  });
});
