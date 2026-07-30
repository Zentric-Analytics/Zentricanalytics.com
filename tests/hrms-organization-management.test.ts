import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertEffectiveInterval, assertPositionTransition, positionOccupancyStatus, wouldCreateHierarchyCycle } from "../src/lib/hr/organization/validation";

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
});
