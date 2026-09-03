import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildNg2026_9DependencyInventory } from "../scripts/hr-unit9-ng-2026-9-dependency-inventory.mjs";

describe("NG-CANDIDATE-2026.9 transitive calculation dependency inventory", () => {
  it("discovers the omitted 2026.4 transitive PAYE dependency automatically", () => {
    const inventory = buildNg2026_9DependencyInventory();
    const paths = inventory.files.map((entry: { path: string }) => entry.path);
    expect(paths).toContain("src/lib/hr/payroll/nigeria-2026-4.ts");
    expect(paths).toContain("src/lib/hr/payroll/nigeria-2026-7.ts");
    expect(paths).toContain("src/lib/hr/payroll/nigeria-2026-8.ts");
    expect(paths).toContain("src/lib/hr/payroll/nigeria-2026-9.ts");
  });

  it("fails package construction when a relative imported dependency is absent", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ng-2026-9-deps-"));
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "entry.ts"), 'import "./missing";\n');
    expect(() => buildNg2026_9DependencyInventory(["src/entry.ts"], root)).toThrow("NG_2026_9_CALCULATION_DEPENDENCY_MISSING:src/entry.ts:./missing");
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("is deterministic", () => {
    expect(buildNg2026_9DependencyInventory().inventorySha256).toBe(buildNg2026_9DependencyInventory().inventorySha256);
  });
});
