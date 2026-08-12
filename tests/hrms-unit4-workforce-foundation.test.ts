import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  assertEffectiveDateNotEarly,
  assertEventVersion,
  assertIndependentApproval,
  assertSupportedImpactSnapshot,
  assertWorkforceEventTransition,
  changedImpactKeys,
  eventsConflict,
  WORKFORCE_EVENT_STATUSES,
} from "../src/lib/hr/workforce/events";
import { assertEmployeeMayInitiateProfileChange, visibleProfileFieldsFor } from "../src/lib/hr/workforce/profile-fields";

describe("Unit 4 workforce foundation", () => {
  it("declares every state and only allows controlled transitions", () => {
    expect(WORKFORCE_EVENT_STATUSES).toHaveLength(11);
    expect(() => assertWorkforceEventTransition("DRAFT", "SUBMITTED")).not.toThrow();
    expect(() => assertWorkforceEventTransition("APPLIED", "DRAFT")).toThrow(/Invalid workforce event transition/);
    expect(() => assertWorkforceEventTransition("SCHEDULED", "APPLIED")).toThrow(/Invalid workforce event transition/);
  });

  it("rejects stale approval and self approval", () => {
    expect(() => assertEventVersion(2, 3)).toThrow(/changed while you were reviewing/);
    expect(() => assertIndependentApproval("user-1", "user-1")).toThrow(/Independent approval/);
    expect(() => assertIndependentApproval("user-1", "user-2")).not.toThrow();
  });

  it("fails closed for unsupported impact fields and identifies real changes", () => {
    expect(() => assertSupportedImpactSnapshot({ salary: 100 })).toThrow(/Unsupported workforce event impact/);
    expect(() => assertSupportedImpactSnapshot({})).toThrow(/at least one governed change/);
    expect(changedImpactKeys({ departmentId: "d1" }, { departmentId: "d2" })).toEqual(["departmentId"]);
  });

  it("detects same-employee same-date overlapping changes", () => {
    const effectiveAt = new Date("2026-09-01T00:00:00.000Z");
    expect(eventsConflict(
      { employeeId: "e1", effectiveAt, changes: { positionId: "p2", departmentId: "d2" } },
      { employeeId: "e1", effectiveAt, changes: { departmentId: "d3" } },
    )).toBe(true);
    expect(eventsConflict(
      { employeeId: "e1", effectiveAt, changes: { positionId: "p2" } },
      { employeeId: "e2", effectiveAt, changes: { positionId: "p2" } },
    )).toBe(false);
  });

  it("does not apply a scheduled event early", () => {
    expect(() => assertEffectiveDateNotEarly(new Date("2026-09-01"), new Date("2026-08-31"))).toThrow(/cannot be applied early/);
    expect(() => assertEffectiveDateNotEarly(new Date("2026-09-01"), new Date("2026-09-01"))).not.toThrow();
  });

  it("classifies employee and manager visibility without exposing protected fields", () => {
    expect(() => assertEmployeeMayInitiateProfileChange("phone", true)).not.toThrow();
    expect(() => assertEmployeeMayInitiateProfileChange("legalName", true)).toThrow(/governed change request/);
    expect(() => assertEmployeeMayInitiateProfileChange("employeeNumber", false)).toThrow(/cannot be changed/);
    expect(visibleProfileFieldsFor("MANAGER")).toContain("employeeNumber");
    expect(visibleProfileFieldsFor("MANAGER")).not.toContain("bankAccount");
    expect(visibleProfileFieldsFor("MANAGER")).not.toContain("nationalIdentifier");
  });

  it("gives auditors a tenant-scoped read-only workspace without protected values or mutations", () => {
    const migration = readFileSync("prisma/migrations/20260810153000_hrms_unit4_auditor_role/migration.sql", "utf8");
    const seedMigration = readFileSync("prisma/migrations/20260810153100_hrms_unit4_auditor_role_seed/migration.sql", "utf8");
    const page = readFileSync("src/app/hr/auditor/page.tsx", "utf8");
    const layout = readFileSync("src/app/hr/auditor/layout.tsx", "utf8");
    expect(migration).toContain("ALTER TYPE \"HrRoleKey\" ADD VALUE IF NOT EXISTS 'AUDITOR'");
    expect(seedMigration).toContain("p.\"key\" IN ('audit.read', 'report.read')");
    expect(layout).toContain('requireAnyRole(["AUDITOR"])');
    expect(page).toContain('organizationId: auth.user.organizationId');
    expect(page).toContain('requirePermission("audit.read")');
    expect(page).not.toMatch(/previousValues|newValues|actor.*email|form action=|employee\.update|document\.read/);
  });

  it("hides privileged navigation and controls from HR-only users", () => {
    const layout = readFileSync("src/app/hr/admin/layout.tsx", "utf8");
    const profile = readFileSync("src/app/hr/admin/employees/[id]/page.tsx", "utf8");
    const users = readFileSync("src/app/hr/admin/users/page.tsx", "utf8");
    expect(layout).toContain('"Payroll","/hr/admin/payroll","payroll.read"');
    expect(layout).toContain('"Settings","/hr/admin/settings","settings.manage"');
    expect(layout).toContain("auth.permissions.has(permission)");
    expect(profile).toContain('auth.permissions.has("payroll.read_salary")');
    expect(profile).toContain('auth.permissions.has("user.update")');
    expect(users).toContain('auth.permissions.has("user.role.assign")');
    expect(users).toContain('auth.permissions.has("user.role.revoke")');
    expect(users).toContain("canAssignRole(auth.roles,r)");
    expect(users).toContain("assignable.map");
    expect(users).toContain('!u.isPrimaryAdmin');
  });

  it("uses an additive migration that reconciles existing employees", () => {
    const sql = readFileSync("prisma/migrations/20260809090000_hrms_unit4_workforce_foundation/migration.sql", "utf8");
    expect(sql).toContain('CREATE TABLE "HrPerson"');
    expect(sql).toContain('CREATE TABLE "HrWorkRelationship"');
    expect(sql).toContain('CREATE TABLE "HrWorkforceEvent"');
    expect(sql).toContain('INSERT INTO "HrPerson"');
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|TRUNCATE/);
  });

  it("revalidates tenant, capacity, manager, workflow, and execution claims", () => {
    const commands = readFileSync("src/lib/hr/workforce/commands.ts", "utf8");
    const actions = readFileSync("src/app/hr/admin/workforce-events/actions.ts", "utf8");
    expect(commands).toContain("target position no longer has available capacity");
    expect(commands).toContain("An employee cannot be their own manager");
    expect(commands).toContain("A cross-department transfer requires a compatible target position");
    expect(commands).toContain("A grade change requires a target position in that grade");
    expect(commands).toContain("A job change requires a target position with that job profile");
    expect(commands).toContain("The proposed team does not belong to the destination department");
    expect(commands).toContain('organizationId: context.organizationId');
    expect(commands).toContain('workflowInstanceId');
    expect(commands).toContain('status: "APPLYING"');
    expect(actions).toContain('isolationLevel: "Serializable"');
    expect(actions).toContain("idempotencyKey");
  });

  it("provides a governed review start path with an exact event subject", () => {
    const register = readFileSync("src/app/hr/admin/workforce-events/page.tsx", "utf8");
    const review = readFileSync("src/app/hr/admin/workforce-events/[eventId]/review/page.tsx", "utf8");
    const workflowActions = readFileSync("src/app/hr/admin/workflows/actions.ts", "utf8");
    expect(register).toContain("Start governed review");
    expect(review).toContain('subjectType: "HrWorkforceEvent"');
    expect(review).toContain('name="subjectId" value={event.id}');
    expect(review).toContain('name="subjectEmployeeId" value={event.employeeId}');
    expect(review).toContain("startWorkflowAction");
    expect(workflowActions).toContain("if (existing) return existing;");
  });

  it("accepts reconciled work relationships without accepting arbitrary identifiers", () => {
    const lifecycleActions = readFileSync("src/app/hr/admin/employment-lifecycle/actions.ts", "utf8");
    expect(lifecycleActions).toContain("/^legacy_relationship_[a-f0-9]{32}$/");
    expect(lifecycleActions).toContain("workRelationshipId,");
  });

  it("creates the rehire relationship and effective-dated assignment atomically", () => {
    const commands = readFileSync("src/lib/hr/workforce/lifecycle-commands.ts", "utf8");
    const actions = readFileSync("src/app/hr/admin/employment-lifecycle/actions.ts", "utf8");
    const page = readFileSync("src/app/hr/admin/employment-lifecycle/page.tsx", "utf8");
    expect(commands).toContain("hrEmployeeAssignment.create");
    expect(commands).toContain('source: "REHIRE"');
    expect(commands).toContain("assignmentId: assignment.id");
    expect(commands).toContain("does not have enough available FTE capacity");
    expect(actions).toContain("positionId: z.string().cuid()");
    expect(actions).toContain("isolationLevel: \"Serializable\"");
    expect(page).toContain('name="positionId"');
    expect(page).toContain("Create relationship and assignment");
  });

  it("treats an already-applied worker winner as an idempotent retry", () => {
    const commands = readFileSync("src/lib/hr/workforce/commands.ts", "utf8");
    expect(commands).toContain('if (event.status === "APPLIED") return event;');
    expect(commands).toContain('status: "APPLYING"');
    expect(commands).toContain("Another worker or administrator already claimed this workforce event.");
    expect(commands).toContain("const appliedEffectiveAt = event.requestedEffectiveAt < now ? now : event.requestedEffectiveAt");
    expect(commands).toContain("requestedEffectiveAt: event.requestedEffectiveAt, appliedEffectiveAt");
  });
});
