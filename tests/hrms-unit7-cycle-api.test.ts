import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Unit 7 governed cycle-open API", () => {
  const source = readFileSync("src/app/api/hr/performance/cycles/[cycleId]/open/route.ts", "utf8");

  it("uses the existing authorized domain command and serializable transaction", () => {
    expect(source).toContain('requirePermission("performance.review.admin")');
    expect(source).toContain("openPerformanceCycle(tx");
    expect(source).toContain('isolationLevel: "Serializable"');
    expect(source).toContain("auth.user.organizationId");
  });

  it("requires optimistic version input", () => {
    expect(source).toContain("Number.isInteger(body.expectedVersion)");
    expect(source).toContain("expectedVersion: Number(body.expectedVersion)");
  });
});
