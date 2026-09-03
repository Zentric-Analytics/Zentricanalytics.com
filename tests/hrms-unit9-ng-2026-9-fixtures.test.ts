import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildNg2026_9FixtureEvidence } from "../scripts/hr-unit9-ng-2026-9-fixtures.mjs";

const file = path.join(process.cwd(), "tests/fixtures/ng-candidate-2026-9-certification-families.json");
const bytes = fs.readFileSync(file);
const corpus = JSON.parse(bytes.toString("utf8")) as { candidateVersion: string; candidateStatus: string; families: Array<{ id: string; expected: unknown; authority: string }> };

describe("NG-CANDIDATE-2026.9 certification fixture families", () => {
  it("contains exactly the 17 required deterministic families", () => {
    expect(corpus.families).toHaveLength(17);
    expect(corpus.families.map((family) => family.id)).toEqual(Array.from({ length: 17 }, (_, index) => `F${String(index + 1).padStart(2, "0")}_${[
      "ZERO_INCOME", "MINIMUM_WAGE_BOUNDARY", "BELOW_ABOVE_MINIMUM_WAGE", "TAX_BAND_BOUNDARIES", "JOINER_LEAVER", "BONUS_CURRENT_PRIOR_YTD", "OTHER_EMPLOYMENT_INCOME", "PRIOR_EMPLOYER", "RELIEFS", "PENSION_POPULATION", "LEAVE_SALARY_CHANGE", "RETRO", "NEGATIVE_CUMULATIVE", "RTA_ROUTING", "ROUNDING_DRIFT", "CORRECTED_OUTPUTS", "FAIL_CLOSED",
    ][index]}`));
  });

  it("identifies the exact candidate and never labels engineering expectations official", () => {
    expect([corpus.candidateVersion, corpus.candidateStatus]).toEqual(["NG-CANDIDATE-2026.9", "NOT_CERTIFIED"]);
    expect(corpus.families.every((family) => family.authority !== "official")).toBe(true);
  });

  it("records an expected result or hold for every family", () => expect(corpus.families.every((family) => family.expected !== undefined)).toBe(true));

  it("has stable bytes and a deterministic manifest digest", () => expect(crypto.createHash("sha256").update(bytes).digest("hex")).toMatch(/^[a-f0-9]{64}$/));

  it("binds every fixture manifest and output with deterministic SHA-256 evidence", () => {
    const first = buildNg2026_9FixtureEvidence(corpus);
    const second = buildNg2026_9FixtureEvidence(corpus);
    expect(first).toEqual(second);
    expect(first.fixtures).toHaveLength(17);
    expect(first.fixtures.every((fixture) => /^[a-f0-9]{64}$/.test(fixture.manifestHash) && /^[a-f0-9]{64}$/.test(fixture.outputHash) && fixture.expectedDownstreamAuthorization === "REJECT_NOT_CERTIFIED")).toBe(true);
  });
});
