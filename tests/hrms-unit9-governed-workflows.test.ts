import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertSafeRegulatoryWatchUrl } from "../src/lib/hr/payroll/unit9-domain";

const read = (name: string) => fs.readFileSync(path.join(process.cwd(), name), "utf8");

describe("Unit 9 governed mutating workflows", () => {
  it("preserves recalculation attempts and enforces one selected authoritative result", () => {
    const migration = read("prisma/migrations/20260814143000_hrms_unit9_authoritative_attempt_lineage/migration.sql");
    expect(migration).toContain('"calculationAttemptId", "employeeId"');
    expect(migration).toContain('WHERE "authoritativeAt" IS NOT NULL');
  });

  it("requires a frozen manifest and an explicit recalculation reason", () => {
    const service = read("src/lib/hr/payroll/unit9-service.ts");
    expect(service).toContain("calculateFrozenPayroll(manifest, snapshot.inputHash)");
    expect(service).toContain("Recalculation requires an explicit reason");
    expect(service).toContain('action: "unit9.inputs.frozen"');
  });

  it("fails payroll and payment approval closed under maker-checker conflicts", () => {
    const payroll = read("src/lib/hr/payroll/unit9-service.ts");
    const financial = read("src/lib/hr/payroll/unit9-financial-service.ts");
    expect(payroll).toContain("maker/checker separation prohibits self-approval");
    expect(financial).toContain("Payment maker/checker separation prohibits self-approval");
  });

  it("encrypts payment destinations and never returns encrypted values", () => {
    const service = read("src/lib/hr/payroll/unit9-financial-service.ts");
    expect(service).toContain("accountNumberEncrypted: sealHrCredential");
    expect(service).toContain("accountNumberLastFour");
    expect(service).toContain("accountNumberEncrypted: undefined");
  });

  it("generates official payslips only from finalized authoritative results", () => {
    const service = read("src/lib/hr/payroll/unit9-financial-service.ts");
    expect(service).toContain("Official payslips require finalized authoritative payroll");
    expect(service).toContain('authoritativeAt: { not: null }, finalizedAt: { not: null }');
    expect(service).toContain("unit9.payslip.corrected");
  });

  it("keeps payment submission simulated and replay-safe", () => {
    const service = read("src/lib/hr/payroll/unit9-financial-service.ts");
    expect(service).toContain("if (batch.status === input.to) return batch");
    expect(service).toContain("unit9.remittance_simulation.acknowledged");
    expect(service).toContain("realFiling: false");
  });

  it("persists balanced accounting and distinct statutory liability categories", () => {
    const service = read("src/lib/hr/payroll/unit9-financial-service.ts");
    expect(service).toContain("reconcileJournal(lines)");
    expect(service).toContain('category: "EMPLOYER_CONTRIBUTION"');
  });

  it("restricts Regulatory Watch to approved HTTPS public hosts", () => {
    expect(assertSafeRegulatoryWatchUrl("https://official.example.gov.ng/rules", "official.example.gov.ng").hostname).toBe("official.example.gov.ng");
    expect(() => assertSafeRegulatoryWatchUrl("http://official.example.gov.ng/rules", "official.example.gov.ng")).toThrow("HTTPS");
    expect(() => assertSafeRegulatoryWatchUrl("https://127.0.0.1/rules", "127.0.0.1")).toThrow(/forbidden|private/i);
    expect(() => assertSafeRegulatoryWatchUrl("https://evil.example/rules", "official.example.gov.ng")).toThrow("not approved");
  });

  it("never lets Regulatory Watch auto-activate a jurisdiction package", () => {
    const watcher = read("src/lib/hr/payroll/unit9-regulatory-watch.ts");
    expect(watcher).toContain('status: "REVIEW_REQUIRED"');
    expect(watcher).not.toContain("hrPayrollJurisdictionVersion.update");
  });

  it("exposes mutations only through explicit payroll permissions", () => {
    const runRoute = read("src/app/api/hr/payroll/unit9/runs/[id]/route.ts");
    const paymentRoute = read("src/app/api/hr/payroll/unit9/payment-batches/[id]/route.ts");
    expect(runRoute).toContain('"payroll.approve"');
    expect(runRoute).toContain('"payroll.finalize"');
    expect(paymentRoute).toContain('"payroll.payment.approve"');
    expect(paymentRoute).toContain('"payroll.payment.submit"');
  });

  it("ships guarded real-staging lifecycle and integrity gates", () => {
    const lifecycle = read("scripts/hr-unit9-staging-lifecycle.ts");
    const integrity = read("scripts/hr-unit9-staging-integrity.mjs");
    const concurrency = read("scripts/hr-unit9-staging-concurrency.test.ts");
    expect(lifecycle).toContain('HR_UNIT9_STAGING_LIFECYCLE_CONFIRM !== "staging-only"');
    expect(lifecycle).toContain('finalization: "REJECTED_NOT_CERTIFIED"');
    expect(lifecycle).toContain("const payrollCurrency = handoff.currency");
    expect(lifecycle).toContain('equal(certification.employeeBlocked.length, 0, "input certification employee blockers")');
    expect(integrity).toContain('HR_UNIT9_STAGING_INTEGRITY_CONFIRM !== "staging-only"');
    expect(integrity).toContain("employerContributionDeductedFromNet");
    expect(integrity).toContain("uncertifiedFinalizations");
    expect(concurrency).toContain('HR_UNIT9_STAGING_CONCURRENCY_CONFIRM === "staging-only"');
    expect(concurrency).toContain("decisionRaceWinners: 1");
  });
});
