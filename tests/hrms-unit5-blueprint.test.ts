import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Unit 5 blueprint", () => {
  it("records repository facts and explicitly identifies legacy leave gaps", () => {
    const audit = read("docs/hrms/delivery-units/unit-05/repository-audit.md");
    expect(audit).toContain("HrLeaveLedger");
    expect(audit).toContain("Unit 4 remains the only workforce status/effective-event engine");
    expect(audit).toContain("exact-version quarantine/release metadata");
    expect(audit).toContain("Production was not accessed or changed");
  });

  it("preserves the approved accounting and governance principles", () => {
    const blueprint = read("docs/hrms/delivery-units/unit-05/blueprint.md");
    for (const statement of ["Policy decides entitlement", "Calendar decides chargeable time", "Ledger explains balance", "Workflow governs approval", "Audit explains every change"]) expect(blueprint).toContain(statement);
    expect(blueprint).toContain("Unit 4 alone changes workforce status");
    expect(blueprint).toContain("HrLeaveLedgerEntry");
    expect(blueprint).toContain("Approval-time reservation is the default");
  });

  it("defines privacy, concurrency, migration, recovery and implementation approval gates", () => {
    const blueprint = read("docs/hrms/delivery-units/unit-05/blueprint.md");
    const validation = read("docs/hrms/delivery-units/unit-05/validation-plan.md");
    for (const term of ["Security and privacy matrix", "Concurrency contract", "Migration strategy", "Observability and recovery", "Open decisions requiring owner approval"]) expect(blueprint).toContain(term);
    for (const term of ["Real PostgreSQL", "Cross-tenant", "encrypted backup", "Accepted GoDaddy deliverability exception"]) expect(validation.toLowerCase()).toContain(term.toLowerCase());
  });

  it("provides a public, secret-free blueprint status artifact", () => {
    const status = read("src/app/hr/admin/unit-5-status/page.tsx");
    expect(status).toContain("CONDITIONAL PASS — OPERATIONAL");
    expect(status).toContain("PASS — Unit 5 Production Ready");
    expect(status).toContain("controlled Unit 5 operational baseline");
    expect(status).toContain("accepted email-deliverability risk");
    expect(status).toContain("c41f55510b8a");
    expect(read("src/app/unit-5-status/page.tsx")).toContain("unit-5-status/page");
    expect(status).not.toMatch(/DATABASE_URL|SECRET_ACCESS_KEY|AUTH_SECRET/);
  });
});
