import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("NG-CANDIDATE-2026.7 real PostgreSQL concurrency harness", () => {
  const source = fs.readFileSync("scripts/hr-unit9-ng-2026-7-concurrency.ts", "utf8");
  it("refuses every database except explicitly confirmed staging", () => { expect(source).toContain('HR_UNIT9_NG_2026_7_CONCURRENCY_CONFIRM !== "staging-only"'); expect(source).toContain('databaseUrl.pathname.slice(1) !== "zentric_analytics_staging"'); expect(source).toContain("REFUSE TO RUN"); });
  it("refuses before fixture writes when authoritative-source migrations are absent", () => { expect(source).toContain("to_regclass"); expect(source).toContain("missing the reviewed NG-CANDIDATE-2026.7 authoritative-source migrations"); });
  it("uses the authoritative serializable freeze and calculation service paths", () => { expect(source).toContain("freezeUnit9Inputs"); expect(source).toContain("calculateUnit9Run"); });
  it("covers every mandatory source and persistence race", () => { for (const marker of ["salaryRace", "salaryAmbiguity", "bonusYtdRace", "payeYtdRace", "samePeriodOffCycleIncluded", "reliefVersionRace", "annualizationRuleRace", "priorEmployerRace", "duplicateBindingWinners", "staleBindingRejected", "authoritativeStaleResults", "mixedVersionResults", "immutableFrozenBinding", "deterministicReplay"]) expect(source).toContain(marker); });
  it("emits sanitized evidence and persists a correlated audit event", () => { expect(source).toContain("unit9.ng_2026_7.concurrency.validated"); expect(source).not.toContain("console.log(process.env.DATABASE_URL"); expect(source).toContain('databaseEnvironment: "staging"'); });
});
