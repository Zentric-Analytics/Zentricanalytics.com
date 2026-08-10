import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { availableLeaveBalance, capAccrual, countWorkingDays, leavePolicyInput, leaveRequestInput, scheduledAccrualAmount, validateLeaveEligibility, workingDayNumbers } from "../src/lib/hr/leave/engine";

describe("HRMS leave engine", () => {
  it("counts configured working days inclusively and excludes holidays", () => {
    expect(countWorkingDays(new Date("2026-08-03"), new Date("2026-08-07"))).toBe(5);
    expect(countWorkingDays(new Date("2026-08-03"), new Date("2026-08-09"), [1, 2, 3, 4, 5], [new Date("2026-08-05")])).toBe(4);
  });
  it("supports organization-specific work weeks", () => {
    expect(workingDayNumbers(["MONDAY", "TUESDAY", "SATURDAY"])).toEqual([1, 2, 6]);
    expect(workingDayNumbers(null)).toEqual([1, 2, 3, 4, 5]);
  });
  it("derives available balance from immutable ledger aggregates", () => {
    expect(availableLeaveBalance({ opening: 10, accrued: 5, carriedOver: 2, adjusted: -1, reserved: 3, used: 4, expired: 1 })).toBe(8);
  });
  it("enforces balance, notice, consecutive, and probation constraints", () => {
    const issues = validateLeaveEligibility({ amount: 6, available: 5, allowNegativeBalance: false, maximumConsecutive: 5, minimumNoticeDays: 7, startDate: new Date("2026-08-05"), now: new Date("2026-08-01"), hireDate: new Date("2026-07-01"), probationMonths: 3 });
    expect(issues).toHaveLength(4);
  });
  it("allows configured negative balances and valid requests", () => {
    expect(validateLeaveEligibility({ amount: 6, available: 0, allowNegativeBalance: true, minimumNoticeDays: 0, startDate: new Date("2026-08-05"), now: new Date("2026-08-01"), probationMonths: 0 })).toEqual([]);
  });
  it("calculates scheduled accruals and enforces maximum balances", () => {
    expect(scheduledAccrualAmount({ entitlement: 24, accrualFrequency: "MONTHLY" })).toBe(2);
    expect(scheduledAccrualAmount({ entitlement: 20, accrualFrequency: "QUARTERLY" })).toBe(5);
    expect(scheduledAccrualAmount({ entitlement: 20, accrualFrequency: "ANNUALLY" })).toBe(0);
    expect(capAccrual(2, 9, 10)).toBe(1);
  });
  it("validates policy and request date ranges", () => {
    expect(() => leavePolicyInput.parse({ leaveTypeId: "cm12345678901234567890123", name: "Annual", entitlement: 20, accrualFrequency: "ANNUALLY", minimumNoticeDays: 0, probationMonths: 0, effectiveFrom: "2026-01-01", allowNegativeBalance: false, requiresApproval: true })).not.toThrow();
    expect(() => leaveRequestInput.parse({ leaveTypeId: "cm12345678901234567890123", startDate: "2026-08-10", endDate: "2026-08-01", reason: "Holiday" })).toThrow("end date");
    expect(leaveRequestInput.parse({ leaveTypeId: "cm12345678901234567890123", startDate: "2026-08-10", endDate: "2026-08-10", hours: "4.5", reason: "Medical appointment" }).hours).toBe(4.5);
  });
  it("defines versioned policies, an immutable ledger, approvals, holidays, and attachments", () => {
    const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const migration = fs.readFileSync(path.join(process.cwd(), "prisma/migrations/20260730010000_hrms_leave_management/migration.sql"), "utf8");
    for (const model of ["HrLeaveType", "HrLeavePolicy", "HrEmployeeLeavePolicy", "HrLeaveBalance", "HrLeaveLedger", "HrLeaveRequest", "HrLeaveApproval", "HrLeaveAttachment", "HrPublicHoliday"]) expect(schema).toContain(`model ${model}`);
    expect(schema).toContain("idempotencyKey String");
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(migration).toContain("HrLeaveRequest_dates_check");
    expect(migration).toContain('"HrLeaveLedger_immutable"');
    expect(migration).toContain('"HrAuditEvent_immutable"');
  });
  it("uses private S3-compatible attachment storage and permission-bound downloads", () => {
    const storage = fs.readFileSync(path.join(process.cwd(), "src/lib/hr/storage/index.ts"), "utf8");
    const download = fs.readFileSync(path.join(process.cwd(), "src/app/api/hr/leave/attachments/[id]/route.ts"), "utf8");
    expect(storage).toContain("S3Client");
    expect(storage).toContain("PutObjectCommand");
    expect(download).toContain('"Cache-Control": "private, no-store"');
    expect(download).toContain('auth.permissions.has("leave.read_all")');
  });
  it("reserves only at final approval and releases authoritative accounting on terminal paths", () => {
    const requestActions = fs.readFileSync(path.join(process.cwd(), "src/app/hr/employee/leave/actions.ts"), "utf8");
    const reviewActions = fs.readFileSync(path.join(process.cwd(), "src/app/hr/supervisor/leave/actions.ts"), "utf8");
    const accounting = fs.readFileSync(path.join(process.cwd(), "src/lib/hr/leave/unit5-accounting.ts"), "utf8");
    expect(requestActions).toContain('isolationLevel: "Serializable"');
    expect(requestActions.indexOf("const overlap = await tx.hrLeaveRequest")).toBeGreaterThan(requestActions.indexOf("prisma.$transaction"));
    expect(requestActions).toContain("update: { leavePolicyId: policy.id }");
    expect(requestActions).toContain("UNIT5_NO_SUBMISSION_RESERVATION");
    expect(reviewActions).toContain("reserveUnit5Request");
    expect(accounting).toContain('kind: "RESERVATION"');
    expect(accounting).toContain('kind: "RESERVATION_RELEASE"');
    expect(accounting).toContain('kind: "CONSUMPTION"');
    expect(accounting).toContain('kind: "REVERSAL"');
    expect(accounting).toContain('isolationLevel: "Serializable"');
  });
  it("keeps policy versions date-effective and records annual opening balances during carry-over", () => {
    const adminActions = fs.readFileSync(path.join(process.cwd(), "src/app/hr/admin/leave/actions.ts"), "utf8");
    expect(adminActions).toContain('data: { effectiveTo: input.effectiveFrom }');
    expect(adminActions).not.toContain('data: { status: "ARCHIVED", effectiveTo: input.effectiveFrom }');
    expect(adminActions).toContain("Policy assignment must begin within the policy's effective dates.");
    const accounting = fs.readFileSync(path.join(process.cwd(), "src/lib/hr/leave/unit5-accounting.ts"), "utf8");
    expect(accounting).toContain('reason: `Opening entitlement for ${targetYear}`');
    expect(accounting).toContain('idempotencyKey: `unit5-grant:${target.id}`');
  });
});
