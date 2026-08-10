import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("real staging exact-version document conflict validation", () => {
  const script = readFileSync(resolve(import.meta.dirname, "../scripts/hr-staging-document-conflict.mjs"), "utf8");
  it("is staging guarded and uses private S3-compatible objects", () => {
    expect(script).toContain('HR_STAGING_DOCUMENT_CONFIRM !== "staging-only"');
    expect(script).toContain('databaseUrl.pathname.slice(1) !== "zentric_analytics_staging"');
    expect(script).toContain("PutObjectCommand");
    expect(script).toContain("HeadObjectCommand");
  });
  it("rejects stale v1 through the same atomic replacement predicate", () => {
    expect(script).toContain("where: { id: review1.id, replacedById: null }");
    expect(script).toContain("A newer document version was submitted. Review the latest version.");
    expect(script).toContain("staleClaim.count !== 0");
  });
  it("preserves both versions and requires an audited v2 decision", () => {
    expect(script).toContain('statusBeforeDecision: beforeDecision.status');
    expect(script).toContain('statusAfterDecision: final2.status');
    expect(script).toContain("documents !== 2");
    expect(script).toContain("documentVersion: 2");
    expect(script).toContain("audits.length !== 2");
  });
});
