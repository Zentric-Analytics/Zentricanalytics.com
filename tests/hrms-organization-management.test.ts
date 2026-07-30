import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertEffectiveInterval, assertPositionTransition, positionOccupancyStatus, wouldCreateHierarchyCycle } from "../src/lib/hr/organization/validation";
import { parseOrganizationCsv } from "../src/lib/hr/organization/import";

describe("enterprise organization management", () => {
  it("blocks direct and indirect hierarchy cycles", () => {
    const records = [{ id: "a", parentId: null }, { id: "b", parentId: "a" }, { id: "c", parentId: "b" }];
    expect(wouldCreateHierarchyCycle(records, "a", "c")).toBe(true);
    expect(wouldCreateHierarchyCycle(records, "c", "a")).toBe(false);
    expect(wouldCreateHierarchyCycle(records, "a", "a")).toBe(true);
  });
  it("enforces position state transitions", () => {
    expect(() => assertPositionTransition("DRAFT", "PENDING_APPROVAL")).not.toThrow();
    expect(() => assertPositionTransition("DRAFT", "FILLED")).toThrow();
    expect(() => assertPositionTransition("CLOSED", "OPEN")).toThrow();
  });
  it("derives vacancy state and rejects over-capacity occupancy", () => {
    expect(positionOccupancyStatus({ activeCount: 0, occupiedFte: 0, headcountLimit: 2, fullTimeEquivalent: 2 })).toBe("OPEN");
    expect(positionOccupancyStatus({ activeCount: 1, occupiedFte: 1, headcountLimit: 2, fullTimeEquivalent: 2 })).toBe("PARTIALLY_FILLED");
    expect(positionOccupancyStatus({ activeCount: 2, occupiedFte: 2, headcountLimit: 2, fullTimeEquivalent: 2 })).toBe("FILLED");
    expect(() => positionOccupancyStatus({ activeCount: 3, occupiedFte: 3, headcountLimit: 2, fullTimeEquivalent: 2 })).toThrow();
  });
  it("rejects invalid effective intervals", () => {
    expect(() => assertEffectiveInterval(new Date("2026-01-02"), new Date("2026-01-01"))).toThrow();
    expect(() => assertEffectiveInterval(new Date("2026-01-01"), null)).not.toThrow();
  });
  it("uses organization-scoped serializable commands and separation of duties", () => {
    const position = readFileSync("src/lib/hr/organization/position-commands.ts", "utf8");
    const actions = readFileSync("src/app/hr/admin/positions/actions.ts", "utf8");
    expect(position).toContain("organizationId: context.organizationId");
    expect(position).toContain("Position requester cannot approve");
    expect(actions).toContain('isolationLevel: "Serializable"');
    expect(position).toContain("appendHrAudit");
  });
  it("integrates position capacity with assignments and provisioning", () => {
    const assignments = readFileSync("src/app/hr/admin/assignments/actions.ts", "utf8");
    const provisioning = readFileSync("src/lib/hr/employees/finalize-provisioning.ts", "utf8");
    expect(assignments).toContain("exceed the approved position capacity");
    expect(assignments).toContain("reconcilePositionOccupancy");
    expect(provisioning).toContain("reconcilePositionOccupancy");
    expect(provisioning).toContain('lifecycleStatus: { in: ["OPEN", "PARTIALLY_FILLED"] }');
  });
  it("ships every required organization administration route", () => {
    const workspace = readFileSync("src/app/hr/admin/organization/page.tsx", "utf8");
    for (const route of ["legal-entities", "business-units", "divisions", "departments", "teams", "locations", "cost-centers", "job-families", "jobs", "grades", "positions", "org-chart", "headcount"]) expect(workspace).toContain(`/hr/admin/${route}`);
  });
  it("validates imports before any commit", () => {
    const valid = parseOrganizationCsv("legal-entity", "code,name,countryCode,currency,timezone\nZA,Zentric Analytics,NG,NGN,Africa/Lagos");
    expect(valid).toMatchObject([{ rowNumber: 2, valid: true }]);
    const invalid = parseOrganizationCsv("grade", "code,name,level,currency,minimumSalary,midpointSalary,maximumSalary\nG1,Grade 1,1,NGN,200,100,300");
    expect(invalid[0].valid).toBe(false);
  });
  it("provides approval-controlled idempotent restructuring activation", () => {
    const service = readFileSync("src/lib/hr/organization/restructuring.ts", "utf8");
    const route = readFileSync("src/app/api/internal/hr/organization-changes/route.ts", "utf8");
    expect(service).toContain("Organization change requester cannot approve");
    expect(service).toContain('status: "SCHEDULED"');
    expect(service).toContain("hrOrganizationStructureRevision.create");
    expect(service).toContain('isolationLevel: "Serializable"');
    expect(route).toContain("authorizeInternalRequest");
    expect(route).toContain("ORGANIZATION_WORKER_SECRET");
  });
  it("keeps the migration additive and records import and revision history", () => {
    const migration = readFileSync("prisma/migrations/20260730110000_hrms_organization_management/migration.sql", "utf8");
    const reconciliation = readFileSync("prisma/migrations/20260730120000_hrms_organization_default_backfill/migration.sql", "utf8");
    expect(migration).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
    expect(reconciliation).not.toMatch(/\b(DROP|DELETE|TRUNCATE)\b/i);
    expect(reconciliation).toContain('ON CONFLICT ("organizationId","code") DO NOTHING');
    expect(reconciliation).toContain('"placementSnapshot" = jsonb_build_object');
    expect(migration).toContain('CREATE TABLE "HrOrganizationImportBatch"');
    expect(migration).toContain('CREATE TABLE "HrOrganizationStructureRevision"');
    expect(migration).toContain("HrPosition_headcount_check");
  });
  it("audits exports without exposing protected employee data", () => {
    const route = readFileSync("src/app/api/hr/organization/export/route.ts", "utf8");
    expect(route).toContain('requirePermission("organization.report.export")');
    expect(route).toContain("hr.organization.report_exported");
    for (const protectedField of ["accountNumberEncrypted", "taxIdentifierEncrypted", "salaryRecords"]) expect(route).not.toContain(protectedField);
  });
});
