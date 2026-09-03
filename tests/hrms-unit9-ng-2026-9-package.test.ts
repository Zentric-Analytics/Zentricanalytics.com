import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const unit = path.join(root, "docs/hrms/delivery-units/unit-09");

describe("NG-CANDIDATE-2026.9 review-package identity", () => {
  it("preserves the sealed 2026.8 archive byte-for-byte", () => {
    const bytes = fs.readFileSync(path.join(unit, "Zentric_NG-CANDIDATE-2026.8_Immutable_Review_Package.zip"));
    expect(crypto.createHash("sha256").update(bytes).digest("hex")).toBe("1b6a00096032958adc20b6d36e3c96d79ccdf362c3b4fab8365e6c3ebf9f2f03");
  });

  it("gives every current 2026.9 document the exact current identity and status", () => {
    const files = fs.readdirSync(unit).filter((name) => name.startsWith("ng-candidate-2026-9-") && name.endsWith(".md"));
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const file of files) {
      const source = fs.readFileSync(path.join(unit, file), "utf8");
      expect(source, file).toContain("NG-CANDIDATE-2026.9");
      expect(source, file).toContain("NOT_CERTIFIED");
      expect(source, file).not.toMatch(/current\s+(?:candidate|version)[^\n]*NG-CANDIDATE-2026\.(?:1|3)\b/i);
    }
  });

  it("keeps the 2026.9 calculation status hard-coded as NOT_CERTIFIED", () => {
    const source = fs.readFileSync(path.join(root, "src/lib/hr/payroll/nigeria-2026-9.ts"), "utf8");
    expect(source).toContain('NG_2026_9_STATUS = "NOT_CERTIFIED"');
    expect(source).toContain('throw new Error("NG-CANDIDATE-2026.9_NOT_CERTIFIED")');
  });

  it("includes the machine-verifiable transitive inventory and omitted 2026.4 dependency", () => {
    const inventory = JSON.parse(fs.readFileSync(path.join(unit, "ng-candidate-2026-9-dependency-inventory.json"), "utf8")) as { candidateVersion: string; candidateStatus: string; files: Array<{ path: string; sha256: string }> };
    expect([inventory.candidateVersion, inventory.candidateStatus]).toEqual(["NG-CANDIDATE-2026.9", "NOT_CERTIFIED"]);
    expect(inventory.files).toContainEqual(expect.objectContaining({ path: "src/lib/hr/payroll/nigeria-2026-4.ts", sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }));
  });
});
