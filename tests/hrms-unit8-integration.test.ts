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
    expect(worker).toContain('"DEAD_LETTER" : "FAILED"');
    expect(read("scripts/start-with-hr-workers.mjs")).toContain('/api/internal/hr/compensation');
  });

  it("uses an atomic budget ledger and exact decision handoff", () => {
    const commands = read("src/lib/hr/compensation/commands.ts");
    expect(commands).toContain("FOR UPDATE");
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
  });
});
