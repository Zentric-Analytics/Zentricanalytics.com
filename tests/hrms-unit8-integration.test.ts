import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { permissionsForRole } from "../src/lib/hr/permissions/catalog";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("Unit 8 compensation integration safeguards", () => {
  it("keeps general administration separate from individual-pay authority", () => {
    expect(permissionsForRole("ADMIN").some((key) => key.startsWith("compensation."))).toBe(false);
    expect(permissionsForRole("HR_ADMIN").some((key) => key.startsWith("compensation."))).toBe(false);
    expect(permissionsForRole("COMPENSATION_ADMIN")).toContain("compensation.architecture.manage");
    expect(permissionsForRole("BUDGET_OWNER")).toContain("compensation.budget.read");
    expect(permissionsForRole("PAYROLL_READER")).not.toContain("compensation.recommendation.review");
  });

  it("exposes four server-authorized and privacy-filtered experiences", () => {
    expect(read("src/app/hr/employee/compensation/page.tsx")).toContain('requirePermission("compensation.read_self")');
    expect(read("src/app/hr/supervisor/compensation/page.tsx")).toContain('requirePermission("compensation.recommendation.create")');
    expect(read("src/app/hr/admin/compensation/page.tsx")).toContain('requirePermission("compensation.architecture.manage")');
    const auditor = read("src/app/hr/auditor/compensation/page.tsx");
    expect(auditor).toContain('requirePermission("compensation.audit.read")');
    expect(auditor).not.toContain("newAmount: true");
    expect(auditor).not.toContain("rationale: true");
  });

  it("registers a guarded replay-safe compensation worker", () => {
    const route = read("src/app/api/internal/hr/compensation/route.ts");
    const worker = read("src/lib/hr/compensation/worker.ts");
    expect(route).toContain("ORGANIZATION_WORKER_SECRET");
    expect(worker).toContain("TransactionIsolationLevel.Serializable");
    expect(worker).toContain('status: { in: ["SCHEDULED", "EFFECTIVE"] }');
    expect(worker).toContain("recommendationId: { not: null }");
    expect(worker).not.toContain('status: { in: ["APPROVED", "SCHEDULED"] }');
    const commands = read("src/lib/hr/compensation/commands.ts");
    expect(commands.indexOf("if (existing) return existing")).toBeLessThan(commands.indexOf("A base compensation decision requires its approved recommendation"));
    expect(commands).toContain('context.actorUserId === "WORKER" ? undefined : context.actorUserId');
    expect(worker).toContain('"DEAD_LETTER" : "FAILED"');
    expect(worker).toContain("replayCompensationDeadLetter");
    expect(worker).toContain("hr.compensation.worker.dead_letter_replayed");
    expect(route).toContain('input.action === "replay-dead-letter"');
    expect(read("scripts/start-with-hr-workers.mjs")).toContain('/api/internal/hr/compensation');
  });

  it("uses an atomic budget ledger and exact decision handoff", () => {
    const commands = read("src/lib/hr/compensation/commands.ts");
    const domain = read("src/lib/hr/compensation/domain.ts");
    expect(commands).toContain("FOR UPDATE");
    expect(commands).not.toContain("Number(recommendation.");
    expect(domain).not.toContain("Number(parseMoney");
    expect(commands).toContain("Final decision cannot consume more budget");
    expect(commands).toContain('payrollHandoffKey("record", record.id)');
  });

  it("adds immutable publication and non-overlap database controls", () => {
    const migration = read("prisma/migrations/20260813193000_hrms_unit8_compensation_foundation/migration.sql");
    expect(migration).toContain("EXCLUDE USING gist");
    expect(migration).toContain('tsrange("effectiveFrom", COALESCE("effectiveTo", \'infinity\'::timestamp)');
    expect(migration).not.toContain("tstzrange(");
    expect(migration).toContain("hr_comp_protect_immutable");
    expect(migration).toContain("btree_gist");
    const remediation = read("prisma/migrations/20260813195500_hrms_unit8_compensation_trigger_scope/migration.sql");
    expect(remediation).toContain('OLD."status"::text <> \'DRAFT\'');
    expect(remediation).toContain("CREATE OR REPLACE FUNCTION hr_comp_protect_immutable");
    const guarded = read("prisma/migrations/20260813200000_hrms_unit8_compensation_trigger_record_guards/migration.sql");
    expect(guarded).toContain("IF TG_TABLE_NAME = 'HrCompDecision' AND TG_OP = 'UPDATE' THEN");
    expect(guarded).toContain("IF TG_TABLE_NAME = 'HrCompensationRecord' AND TG_OP = 'UPDATE' THEN");
  });

  it("guards the real staging lifecycle fixture and preserves governed provenance", () => {
    const fixture = read("scripts/hr-unit8-staging-fixture.mjs");
    expect(fixture).toContain('HR_UNIT8_STAGING_FIXTURE_CONFIRM !== "staging-only"');
    expect(fixture).toContain('databaseUrl.pathname.slice(1) !== "zentric_analytics_staging"');
    expect(fixture).toContain("salaryBandMinimum");
    expect(fixture).toContain("assignmentCandidates.find");
    expect(fixture).toContain("complete non-degenerate legacy position range");
    expect(fixture).toContain("hrPromotionDecision.findFirst");
    expect(fixture).toContain("authoritative compensation timeline overlaps");
    expect(fixture).not.toContain("deleteMany");
    expect(fixture).toContain("policyVersion, initialRecord, recommendation");
  });

  it("provides append-only guarded staging audit reconciliation", () => {
    const script = read("scripts/hr-unit8-staging-audit-reconcile.mjs");
    expect(script).toContain('HR_UNIT8_STAGING_AUDIT_CONFIRM !== "staging-only"');
    expect(script).toContain("hr.compensation.record.audit_reconciled");
    expect(script).not.toContain("update(");
    expect(script).not.toContain("delete");
  });

  it("registers a guarded real PostgreSQL concurrency gate", () => {
    const script = read("scripts/hr-unit8-staging-concurrency.mjs");
    expect(script).toContain('HR_UNIT8_STAGING_CONCURRENCY_CONFIRM !== "staging-only"');
    expect(script).toContain("TransactionIsolationLevel.Serializable");
    expect(script).toContain("FOR UPDATE");
    expect(script).toContain("INSUFFICIENT_BUDGET");
    expect(script).toContain('baselineBand.maximum.plus("1000")');
    expect(script).toContain("hr.compensation.concurrency.validated");
    expect(script).not.toContain("deleteMany");
  });
});
