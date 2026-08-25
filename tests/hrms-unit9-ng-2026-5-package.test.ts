import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const sha = (file: string) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");

describe("NG-CANDIDATE-2026.5 immutable Stage 1 package", () => {
  it("matches every declared package hash", () => {
    const records = fs.readFileSync(path.join(root, "docs/hrms/delivery-units/unit-09/ng-candidate-2026-5-stage1-package.sha256"), "utf8").trim().split(/\r?\n/).map((line) => { const [hash, file] = line.split(/\s{2,}/); return { hash, file }; });
    expect(records).toHaveLength(10);
    for (const record of records) expect(sha(record.file)).toBe(record.hash);
  });

  it("preserves frozen 2026.2-2026.4 implementation and fixture bytes", () => {
    expect(sha("src/lib/hr/payroll/nigeria-2026-2.ts")).toBe("2bb4273852b4c5cb5685b57fb3852e95886ee3e91b6a18ba523afa8c3b8b8da5");
    expect(sha("src/lib/hr/payroll/nigeria-2026-3.ts")).toBe("d2f82e2983dab31dc721d21a96baebc9669804fe5ad200259d24f4707f2ee46b");
    expect(sha("src/lib/hr/payroll/nigeria-2026-4.ts")).toBe("b3682380a416bbb1fe88bdb192bdf518f8e77a155a35383c1823fd1cbacfa25e");
    expect(sha("src/lib/hr/payroll/unit9-engine-2026-4.ts")).toBe("bc9ab141cae647411910048d58acc8ee93689a14b9ea043c33d439639cfc890d");
    expect(sha("tests/fixtures/ng-candidate-2026-4-expected-values.json")).toBe("4b72633a68af1771690ccf3b9ae1eaeea5b1e0c5e78f61916b84f0143dbb0157");
  });

  it("allows the shared staging status page to advance without changing the frozen package", () => {
    const status = fs.readFileSync(path.join(root, "src/app/hr/admin/unit-9-status/page.tsx"), "utf8");
    expect(status).toContain("NG-CANDIDATE-2026.6");
    expect(status).toContain("NOT CERTIFIED");
    expect(status).not.toContain("dep-da6996ijnfac73a7r360");
    expect(status).not.toContain("981 / 981");
  });
});
