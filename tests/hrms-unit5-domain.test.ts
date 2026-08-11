import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertCurrentRequestVersion, assertIndependentLeaveApproval, assertUnit5RequestTransition, calculateUnit5Segments, expirableCarryover, projectedPeriodBalance, reconstructUnit5Balance, resolveLeavePolicy, usageLabel, validateWeeklyPattern } from "../src/lib/hr/leave/unit5";

describe("Unit 5 leave domain", () => {
  it("resolves policy precedence deterministically and fails closed on ambiguity", () => {
    const context = { countryCode: "NG", legalEntityId: "le1", locationId: "loc1", employmentType: "FULL_TIME", gradeId: "g1" };
    const candidates = [
      { id: "default", priority: 0, explicitEmployee: false },
      { id: "country", priority: 0, explicitEmployee: false, countryCode: "NG" },
      { id: "entity-location", priority: 0, explicitEmployee: false, legalEntityId: "le1", locationId: "loc1" },
    ];
    expect(resolveLeavePolicy(candidates, context).policyId).toBe("entity-location");
    expect(() => resolveLeavePolicy([{ id: "a", priority: 0, explicitEmployee: false }, { id: "b", priority: 0, explicitEmployee: false }], context)).toThrow(/ambiguous/);
  });

  it("validates non-overlapping weekly schedule intervals", () => {
    expect(validateWeeklyPattern([{ weekday: 1, start: "09:00", end: "17:00" }])).toHaveLength(1);
    expect(() => validateWeeklyPattern([{ weekday: 1, start: "09:00", end: "13:00" }, { weekday: 1, start: "12:00", end: "17:00" }])).toThrow(/overlap/);
  });

  it("reconstructs spendable balance without double charging consumption", () => {
    const entries = [{ kind: "GRANT", amount: 20 }, { kind: "RESERVATION", amount: 5 }, { kind: "RESERVATION_RELEASE", amount: 5 }, { kind: "CONSUMPTION", amount: 5 }];
    expect(reconstructUnit5Balance(entries)).toBe(15);
    expect(projectedPeriodBalance({ granted: 20, accrued: 0, carriedOver: 0, adjusted: 0, reserved: 0, consumed: 5, expired: 0 })).toBe(15);
    expect(reconstructUnit5Balance([{ kind: "ADJUSTMENT", amount: 2, impactSign: -1 }, { kind: "CORRECTION", amount: 1, impactSign: 1 }])).toBe(-1);
    expect(reconstructUnit5Balance([{ kind: "GRANT", amount: 20 }, { kind: "RESERVATION", amount: 4 }, { kind: "CARRYOVER_OUT", amount: 10 }])).toBe(6);
    expect(projectedPeriodBalance({ granted: 20, accrued: 0, carriedOver: 0, carriedOut: 10, adjusted: 0, reserved: 4, consumed: 0, expired: 0 })).toBe(6);
  });

  it("enforces state, version and separation-of-duties rules", () => {
    expect(() => assertUnit5RequestTransition("UNDER_REVIEW", "APPROVED")).not.toThrow();
    expect(() => assertUnit5RequestTransition("COMPLETED", "DRAFT")).toThrow(/Invalid/);
    expect(() => assertIndependentLeaveApproval("u1", "u1")).toThrow(/cannot approve/);
    expect(() => assertCurrentRequestVersion(1, 2)).toThrow(/changed/);
  });

  it("shows usage rather than a fake unlimited balance", () => {
    expect(usageLabel("UNLIMITED", 8, "DAYS")).toBe("Unlimited policy · 8 days used this year");
  });

  it("stores an explainable schedule and holiday calculation", () => {
    const segments = calculateUnit5Segments({ startDate: new Date("2026-08-10"), endDate: new Date("2026-08-12"), unit: "DAYS", weeklyPattern: [{ weekday: 1, start: "09:00", end: "17:00" }, { weekday: 2, start: "09:00", end: "17:00" }, { weekday: 3, start: "09:00", end: "17:00" }], holidays: [{ localDate: new Date("2026-08-11"), name: "Public holiday" }] });
    expect(segments.map(({ chargeableAmount }) => chargeableAmount)).toEqual([1, 0, 1]);
    expect(segments.every(({ scheduledMinutes }) => scheduledMinutes === 480)).toBe(true);
    expect(segments[1]).toMatchObject({ excludedMinutes: 480, exclusionReason: "Public holiday" });
  });

  it("routes effective-dated leave and long absence through governed workers", () => {
    const accounting = fs.readFileSync(path.join(process.cwd(), "src/lib/hr/leave/unit5-accounting.ts"), "utf8");
    const worker = fs.readFileSync(path.join(process.cwd(), "src/app/api/internal/hr/leave/route.ts"), "utf8");
    const operations = fs.readFileSync(path.join(process.cwd(), "src/lib/hr/leave/unit5-operations.ts"), "utf8");
    const longAbsence = fs.readFileSync(path.join(process.cwd(), "src/lib/hr/leave/unit5-long-absence.ts"), "utf8");
    const workforceCommands = fs.readFileSync(path.join(process.cwd(), "src/lib/hr/workforce/commands.ts"), "utf8");
    expect(accounting).toContain("unit5-start-transition");
    expect(accounting).toContain("unit5-complete-transition");
    expect(accounting).toContain('type: "LEAVE_OF_ABSENCE"');
    expect(worker).toContain("authorizeInternalRequest");
    expect(worker).toContain("runUnit5OperationalWindow");
    expect(operations).toContain('const jobTypes = ["LIFECYCLE", "ACCRUAL", "CARRYOVER_EXPIRY", "RECONCILIATION", "REMINDERS"]');
    expect(operations).toContain('status: "PROCESSING", startedAt: { lt: staleBefore }');
    expect(operations).toContain('run.attemptCount >= 5 ? "ABANDONED" : "FAILED"');
    expect(operations).toContain("organizations = await prisma.hrOrganization.findMany");
    expect(accounting).toContain("organizationId?: string");
    expect(longAbsence).toContain('type: "RETURN_FROM_LEAVE"');
    expect(longAbsence).toContain('employmentStatus: "ACTIVE"');
    expect(longAbsence).toContain('unit5-long-absence-return:${absence.correlationId}');
    expect(longAbsence).toContain("returnCorrelationId");
    expect(longAbsence).toContain("correlationId: returnCorrelationId");
    expect(workforceCommands).toContain('event.type === "LEAVE_OF_ABSENCE"');
    expect(workforceCommands).toContain('event.type === "RETURN_FROM_LEAVE"');
    expect(workforceCommands).toContain('nextAbsenceStatus = event.type === "RETURN_FROM_LEAVE" ? "COMPLETED" : "ON_LEAVE"');
    expect(workforceCommands).toContain('correlationId: linkedAbsence.correlationId');
    const employeeAction = fs.readFileSync(path.join(process.cwd(), "src/app/hr/employee/leave/actions.ts"), "utf8");
    expect(employeeAction.match(/Long-term absence requires an active primary employment assignment/g)).toHaveLength(2);
    expect(employeeAction).toContain('status: "ACTIVE", isPrimary: true');
  });

  it("uses the authoritative idempotent carryover ledger and protects reservations from expiry", () => {
    const accounting = fs.readFileSync(path.join(process.cwd(), "src/lib/hr/leave/unit5-accounting.ts"), "utf8");
    const action = fs.readFileSync(path.join(process.cwd(), "src/app/hr/admin/leave/actions.ts"), "utf8");
    expect(accounting).toContain('kind: "CARRYOVER_OUT"');
    expect(accounting).toContain('kind: "CARRYOVER_IN"');
    expect(expirableCarryover(10, 0, 4)).toBe(4);
    expect(expirableCarryover(10, 4, 6)).toBe(6);
    expect(expirableCarryover(10, 10, 3)).toBe(0);
    expect(accounting).toContain('protectedReservation: Number(period.reserved)');
    expect(accounting).toContain('const expiryWindow = input.effectiveAt.toISOString().slice(0, 10)');
    expect(action).toContain("processUnit5CarryOver");
    expect(action).not.toContain("leave-carry-over-expiry:");
  });

  it("attaches configured multi-stage workflows with scoped delegation and stale-version protection", () => {
    const workflow = fs.readFileSync(path.join(process.cwd(), "src/lib/hr/leave/unit5-workflow.ts"), "utf8");
    const employeeAction = fs.readFileSync(path.join(process.cwd(), "src/app/hr/employee/leave/actions.ts"), "utf8");
    const managerAction = fs.readFileSync(path.join(process.cwd(), "src/app/hr/supervisor/leave/actions.ts"), "utf8");
    expect(employeeAction).toContain("startConfiguredLeaveWorkflow");
    expect(workflow).toContain('subjectType: "HrLeaveRequestVersion"');
    expect(workflow).toContain("delegationAllowsLeave");
    expect(workflow).toContain("effectiveTo: { gt: effectiveAt }");
    expect(workflow).toContain("latest._max.version !== input.expectedRequestVersion");
    expect(workflow).toContain("reserveUnit5RequestInTransaction(tx");
    expect(workflow).toContain("withUnit5SerializableRetry");
    expect(workflow).toContain('FOR UPDATE`');
    expect(managerAction).toContain("expectedRequestVersion");
  });

  it("ships a staging-only real PostgreSQL concurrency gate", () => {
    const script = fs.readFileSync(path.join(process.cwd(), "scripts/hr-unit5-staging-concurrency.mjs"), "utf8");
    expect(script).toContain('HR_UNIT5_STAGING_CONCURRENCY_CONFIRM !== "staging-only"');
    expect(script).toContain('databaseUrl.pathname.slice(1) !== "zentric_analytics_staging"');
    expect(script).toContain('FOR UPDATE`');
    expect(script).toContain('isolationLevel: "Serializable"');
    expect(script).toContain('code: "UNIT5_CONCURRENCY"');
    expect(script).toContain('error?.code === "P2034"');
    expect(script).toContain('error?.code === "P2010" && error?.meta?.code === "40001"');
    expect(script).not.toContain("hrLeaveLedgerEntry.deleteMany");
    expect(script).toContain("winners !== 1 || losers !== 1");
    expect(script).toContain("competing.length - winners");
    expect(script).toContain("duplicateEntries !== 1");
    expect(script).toContain("Approval versus cancellation did not produce one winner and one stale loser");
    expect(script).toContain("Approval versus adjustment diverged");
    expect(script).toContain("Accrual versus approval diverged");
    expect(script).toContain("Carryover expiry failed to protect an approved reservation");
  });

  it("permits only isolated Unit 4 or Unit 5 restore targets", () => {
    const script = fs.readFileSync(path.join(process.cwd(), "scripts/hr-unit4-restore-correlation.mjs"), "utf8");
    expect(script).toContain("zentric_unit(?:4_restore_|5_restore(?:_|$))");
    expect(script).toContain('DR_RESTORE_CONFIRM !== "isolated-restore"');
    expect(script).toContain("temporary plaintext cleanup");
  });

  it("ships a staging-only effective-date boundary and replay gate", () => {
    const boundary = fs.readFileSync(path.join(process.cwd(), "scripts/hr-unit5-staging-boundary.ts"), "utf8");
    const runnerConfig = fs.readFileSync(path.join(process.cwd(), "scripts/vite.staging.config.ts"), "utf8");
    expect(boundary).toContain('HR_UNIT5_BOUNDARY_CONFIRM !== "staging-only"');
    expect(boundary).toContain('HR_ENVIRONMENT ?? ""');
    expect(boundary).toContain("applyWorkforceEvent");
    expect(boundary).toContain("runUnit5OperationalWindow");
    expect(boundary.match(/applyWorkforceEvent/g)?.length).toBeGreaterThanOrEqual(3);
    expect(boundary.match(/runUnit5OperationalWindow/g)?.length).toBeGreaterThanOrEqual(3);
    expect(runnerConfig).toContain('new URL("../src", import.meta.url)');
  });
});
