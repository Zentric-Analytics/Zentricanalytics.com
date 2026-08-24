import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("Unit 9 PostgreSQL concurrency harness", () => {
  it("allocates the next immutable prior-YTD version instead of assuming an empty staging history", () => {
    const source = fs.readFileSync("scripts/hr-unit9-staging-concurrency.ts", "utf8");
    expect(source).toContain('orderBy: { version: "desc" }');
    expect(source).toContain("const priorYtdVersion = (latestPriorYtd?.version ?? 0) + 1");
    expect(source).toContain("version: priorYtdVersion + 1");
    expect(source).not.toContain("taxYear: 2026, version: 1, priorEmployerReference");
  });
});
