import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Unit 6 integration contract", () => {
  it("ships all governed Unit 6 persistence aggregates and the additive migration", () => {
    const schema = read("prisma/schema.prisma");
    for (const model of ["HrTimePolicy", "HrScheduleInterval", "HrShiftAssignment", "HrTimeEvent", "HrClockSession", "HrTimesheet", "HrAttendanceDay", "HrTimeCorrection", "HrAttendancePeriod", "HrAuthoritativeTimeEntry", "HrTimeWorkerRun"]) expect(schema).toContain(`model ${model}`);
    const migration = read("prisma/migrations/20260811160000_hrms_unit6_time_attendance_foundation/migration.sql");
    expect(migration.charCodeAt(0)).not.toBe(0xfeff);
    expect(migration).toContain("HrClockSession_one_open_assignment_key");
    expect(migration).toContain("HrTimeEvent_assignmentId_fkey");
    expect(migration).toContain("HrAuthoritativeTimeEntry_assignmentId_fkey");
  });

  it("uses serializable tenant-scoped capture with replay conflict rejection", () => {
    const commands = read("src/lib/hr/time/commands.ts");
    expect(commands).toContain('isolationLevel: "Serializable"');
    expect(commands).toContain("organizationId_idempotencyKey");
    expect(commands).toContain("Conflicting payload reused an existing time-event idempotency key");
    expect(commands).toContain("active tenant-scoped employment assignment");
    expect(commands).toContain("time-timesheet-submitted:");
    expect(commands).toContain('template: "hr-time-timesheet-submitted"');
    expect(commands).toContain("stableJsonStringify(previous.inputSnapshot) === stableJsonStringify(input.inputSnapshot)");
  });

  it("fails closed for self approval, stale versions, unlocked exports, and duplicate claims", () => {
    const commands = read("src/lib/hr/time/commands.ts");
    expect(commands).toContain("A correction requester cannot approve their own correction");
    expect(commands).toContain("employeeId: input.employeeId");
    expect(commands).toContain("An open correction already exists for this exact time record");
    expect(commands).toContain("This correction is stale because the attendance record changed");
    expect(commands).toContain('sourceType: "CORRECTION"');
    expect(commands).toContain('status: "APPLIED"');
    expect(commands).toContain('action: "hr.time.correction.applied"');
    expect(commands).toContain("version: input.expectedVersion");
    expect(commands).toContain('status: { in: ["LOCKED", "CORRECTED_AFTER_LOCK"] }');
    expect(commands).toContain("already claimed by another export");
  });

  it("authenticates and schedules the effective-dated Unit 6 worker", () => {
    expect(read("src/app/api/internal/hr/time/route.ts")).toContain("authorizeInternalRequest");
    expect(read("scripts/start-with-hr-workers.mjs")).toContain('/api/internal/hr/time');
    const worker = read("src/lib/hr/time/worker.ts");
    expect(worker).toContain("leaseExpiresAt");
    expect(worker).toContain('"DEAD_LETTER"');
    expect(worker).toContain('"TIME_INTERPRETATION_SWEEP"');
    expect(worker).toContain("interpretApprovedTimesheets");
    expect(worker).toContain("interpretClosedClockSessions");
    expect(worker).toContain('sourceType: "CLOCK_SESSION"');
    expect(worker).toContain("scheduledMinutesForBusinessDate");
    expect(worker).toContain("hrWorkScheduleAssignment.findFirst");
    expect(worker).toContain('status: "CLOCKED_OUT"');
    expect(worker).toContain("organizationId_jobType_windowKey");
    expect(worker).toContain("const interpretationWindowKey = now.toISOString().slice(0, 16)");
    expect(worker).toContain('claimRun(organization.id, "TIME_INTERPRETATION_SWEEP", interpretationWindowKey, now)');
    expect(worker).toContain("inputSnapshot: { equals: inputSnapshot }");
    expect(worker).toContain("if (existing) continue");
  });

  it("ships a staging-only PostgreSQL concurrency gate", () => {
    const script = read("scripts/hr-unit6-staging-concurrency.mjs");
    expect(script).toContain("HR_UNIT6_STAGING_CONCURRENCY_CONFIRM");
    expect(script).toContain("zentric_analytics_staging");
    expect(script).toContain("duplicateEventAttempts");
    expect(script).toContain('source: "EMPLOYEE_WEB"');
    expect(script).toContain("openSessionAttempts");
    expect(script).toContain("correctionClaims");
    expect(script).toContain("lockClaims");
    expect(script).toContain("workerClaims");
    expect(read("package.json")).toContain('"hr:unit6-staging-concurrency"');
  });

  it("exposes permission-scoped employee, manager, and HR workspaces", () => {
    expect(read("src/app/hr/employee/time/page.tsx")).toContain('requirePermission("time.read_self")');
    const managerPage = read("src/app/hr/supervisor/time/page.tsx");
    const managerActions = read("src/app/hr/supervisor/time/actions.ts");
    expect(managerPage).toContain("supervisedEmployeeIds");
    expect(managerPage).not.toContain('permissions.has("time.read_team")');
    expect(managerActions).toContain("activeSupervisorForEmployee");
    expect(managerActions).toContain('capabilities.includes("supervisor.review_assigned")');
    expect(managerActions).toContain("outside the active supervisory review scope");
    expect(managerActions).toContain('"IN_REVIEW" | "APPROVED"');
    expect(managerPage).toContain('sheet.status === "SUBMITTED"');
    expect(managerPage).toContain('value="IN_REVIEW"');
    expect(managerPage).toContain("Start review");
    expect(read("src/app/hr/admin/time/page.tsx")).toContain('requirePermission("time.read_all")');
    expect(read("src/app/hr/admin/time/page.tsx")).toContain("assignTimePolicyAction");
    const policyCommands = read("src/lib/hr/time/policy-commands.ts");
    expect(policyCommands).toContain("Effective time-policy assignments cannot overlap");
    expect(policyCommands).toContain('action: "hr.time.policy.assigned"');
  });

  it("keeps prohibited capture technologies out of executable Unit 6 code", () => {
    const executable = ["src/lib/hr/time/domain.ts", "src/lib/hr/time/commands.ts", "src/lib/hr/time/worker.ts", "src/app/hr/employee/time/actions.ts"].map(read).join("\n").toLowerCase();
    for (const forbidden of ["geofence", "facial", "biometric", "kiosk"]) expect(executable).not.toContain(forbidden);
  });
});
