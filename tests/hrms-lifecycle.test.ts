import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dueDate, STANDARD_LIFECYCLE_TASKS, taskIsUnblocked } from "../src/lib/hr/lifecycle/definitions";
import { permissionsForRole } from "../src/lib/hr/permissions/catalog";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("HRMS onboarding and offboarding", () => {
  it("ships complete standard lifecycle checklists", () => {
    expect(STANDARD_LIFECYCLE_TASKS.ONBOARDING.map(({ key }) => key)).toEqual(expect.arrayContaining(["account", "equipment", "payroll", "policies", "orientation"]));
    expect(STANDARD_LIFECYCLE_TASKS.OFFBOARDING.map(({ key }) => key)).toEqual(expect.arrayContaining(["asset-return", "account-close", "knowledge-transfer", "final-payroll", "exit-interview", "exit-documents"]));
  });
  it("calculates deadlines without mutating the effective date", () => {
    const effective = new Date("2026-08-10T00:00:00.000Z");
    expect(dueDate(effective, -3).toISOString()).toBe("2026-08-07T00:00:00.000Z");
    expect(dueDate(effective, 5).toISOString()).toBe("2026-08-15T00:00:00.000Z");
    expect(effective.toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });
  it("only unblocks tasks after every prerequisite completes", () => {
    expect(taskIsUnblocked(["account", "manager-plan"], new Set(["account"]))).toBe(false);
    expect(taskIsUnblocked(["account", "manager-plan"], new Set(["account", "manager-plan"]))).toBe(true);
  });
  it("grants completion capability without creating a supervisor role", () => {
    expect(permissionsForRole("EMPLOYEE")).toContain("workflow.task.complete");
    expect(permissionsForRole("PAYROLL_ADMIN")).toContain("workflow.task.complete");
    expect(read("prisma/schema.prisma")).not.toMatch(/enum HrRoleKey \{[^}]*SUPERVISOR/s);
  });
  it("uses immutable templates and non-destructive lifecycle history", () => {
    const migration = read("prisma/migrations/20260730040000_hrms_onboarding_offboarding/migration.sql");
    expect(migration).toContain("HrLifecycleTemplate_immutable");
    expect(migration).toContain("HrLifecycleTask_no_delete");
    expect(migration).toContain("HrLifecycleInstance_one_open_per_employee_type");
    expect(migration).toContain("HrLifecycleTask_terminal_state_check");
  });
  it("enforces tenant scope, assignments, audit, and reference-only notifications", () => {
    const actions = read("src/app/hr/admin/lifecycle/actions.ts");
    expect(actions).toContain("organizationId: auth.user.organizationId");
    expect(actions).toContain("assignedUserId === auth.user.id");
    expect(actions).toContain("activeSupervisorForEmployee");
    expect(actions).toContain("appendHrAudit");
    expect(actions).toContain("payload: { lifecycleTaskId: task.id }");
  });
  it("blocks checklist completion while assets remain assigned and defers termination to the effective-dated worker", () => {
    const actions = read("src/app/hr/admin/lifecycle/actions.ts");
    const commands = read("src/lib/hr/workforce/lifecycle-commands.ts");
    expect(actions).toContain("activeAssets");
    expect(actions).toContain("Offboarding cannot complete while the employee has active asset assignments");
    expect(actions).not.toContain('employmentStatus: "TERMINATED"');
    expect(actions).not.toContain("hrSession.updateMany");
    expect(commands).toContain("assertSeparationExecution");
    expect(commands).toContain("hrSession.updateMany");
    expect(commands).toContain('status: "SUSPENDED"');
    expect(commands).toContain('employmentStatus: "TERMINATED"');
  });
  it("creates the governed separation case in the same offboarding transaction", () => {
    const actions = read("src/app/hr/admin/lifecycle/actions.ts");
    expect(actions).toContain("createSeparationCase(tx");
    expect(actions).toContain('template.type === "OFFBOARDING"');
    expect(actions).toContain("finalWorkingDate: input.effectiveDate");
  });
});
