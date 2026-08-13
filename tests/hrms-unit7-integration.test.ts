import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emailTemplateSenderRegistry, resolveEmailSender, senderCategoryForTemplate } from "../src/lib/email-senders";
import { permissionsForRole } from "../src/lib/hr/permissions/catalog";

const unit7Templates = [
  "hr-performance-goal-action", "hr-performance-goal-due", "hr-performance-feedback-received",
  "hr-performance-checkin-due", "hr-performance-self-review-open", "hr-performance-self-review-due",
  "hr-performance-manager-review-due", "hr-performance-calibration-action", "hr-performance-development-action-due",
  "hr-promotion-submitted", "hr-promotion-approved", "hr-promotion-deferred", "hr-promotion-rejected",
  "hr-performance-review-finalized",
];

describe("Unit 7 integration contracts", () => {
  it("records governed historical check-in dates without permitting future evidence", () => {
    const page = readFileSync("src/app/hr/supervisor/performance/page.tsx", "utf8");
    const actions = readFileSync("src/app/hr/supervisor/performance/actions.ts", "utf8");
    expect(page).toContain('name="occurredAt"');
    expect(page).toContain('max={new Date().toISOString().slice(0, 10)}');
    expect(actions).toContain('occurredAt.getTime() > Date.now()');
    expect(actions).toContain("Check-in date must be a valid current or historical date.");
  });
  it("backfills Unit 7 permissions for initialized installations", () => {
    const migration = readFileSync("prisma/migrations/20260812175500_hrms_unit7_permission_backfill/migration.sql", "utf8");
    const bootstrap = readFileSync("scripts/hr-bootstrap-lib.mjs", "utf8");
    expect(migration).toContain("performance.framework.manage");
    expect(migration).toContain("performance.audit.read");
    expect(migration).toContain("ON CONFLICT");
    expect(bootstrap).toContain("performance.review.submit_self");
    expect(bootstrap).toContain('AUDITOR: ["audit.read", "report.read", "performance.audit.read"]');
  });
  it("fails closed instead of opening an empty review cycle", () => {
    const commands = readFileSync("src/lib/hr/performance/commands.ts", "utf8");
    const administration = readFileSync("src/app/hr/admin/performance/page.tsx", "utf8");
    expect(commands).toContain('if (created === 0) throw new Error("This cycle has no eligible employees.');
    expect(administration).toContain("snapshotted review");
    expect(commands).toContain("Date.UTC(effectiveFrom.getUTCFullYear()");
  });
  it("derives manager performance authority from the effective reporting line", () => {
    const page = readFileSync("src/app/hr/supervisor/performance/page.tsx", "utf8");
    const actions = readFileSync("src/app/hr/supervisor/performance/actions.ts", "utf8");
    expect(page).toContain("requireAuthenticatedUser");
    expect(actions).toContain("requireAuthenticatedUser");
    expect(page).toContain("supervisorEmployeeId: auth.user.employee.id");
    expect(actions).toContain("assignedEmployeeId: employeeId");
    expect(page).not.toContain('requirePermission("supervisor.review_assigned")');
  });
  it("requires scoped calibration grants and complete version-bound decisions", () => {
    const commands = readFileSync("src/lib/hr/performance/commands.ts", "utf8");
    const page = readFileSync("src/app/hr/admin/performance/page.tsx", "utf8");
    expect(commands).toContain("Every calibration participant must be an active user in this organization.");
    expect(commands).toContain("A current session-specific calibration grant is required.");
    expect(commands).toContain("Every snapshotted review requires a calibration decision before finalization.");
    expect(commands).toContain('status: "FINALIZED"');
    expect(commands).toContain('action: "hr.performance.review.finalized"');
    expect(commands).toContain('employeeFacingRationale: "Finalized through the governed review and calibration process."');
    expect(commands).not.toContain("employeeFacingRationale: decision.rationale");
    expect(page).toContain("Record version-bound decision");
    expect(page).toContain("Finalize calibrated reviews");
    expect(page).toContain('role="alert"');
    expect(readFileSync("src/app/hr/admin/performance/actions.ts", "utf8")).toContain("calibrationError=");
    const remediation = readFileSync("prisma/migrations/20260812181000_hrms_unit7_calibration_finalization_audit/migration.sql", "utf8");
    expect(remediation).toContain("hr.performance.review.finalized");
    expect(remediation).toContain("remediatedAudit");
    expect(remediation).toContain("r.\"employeeFacingRationale\" = d.\"rationale\"");
  });
  it("maps every Unit 7 template to the HR sender and fails closed for unknown templates", () => {
    for (const template of unit7Templates) {
      expect(emailTemplateSenderRegistry[template]).toBe("hr");
      expect(senderCategoryForTemplate(template)).toBe("hr");
      expect(resolveEmailSender(template, { NODE_ENV: "test" })).toMatchObject({ category: "hr", from: "Zentric HR <hr@zentricanalytics.com>", replyTo: "hr@zentricanalytics.com" });
    }
    expect(() => senderCategoryForTemplate("hr-performance-unknown")).toThrow(/Unknown or unmapped/);
  });

  it("offers a cycle-scoped calibration session when historical sessions already exist", () => {
    const page = readFileSync("src/app/hr/admin/performance/page.tsx", "utf8");
    expect(page).toContain("calibrationCyclesWithoutSession");
    expect(page).toContain("!calibrationSessions.some((session) => session.cycleId === cycle.id)");
    expect(page).toContain("A completed historical calibration does not block a new cycle");
    expect(page).toContain("calibrationSessions.length > 0 && calibrationCyclesWithoutSession.length > 0");
  });

  it("requires an available position mapped to the exact target profile for Unit 4 handoff", () => {
    const page = readFileSync("src/app/hr/admin/performance/page.tsx", "utf8");
    const actions = readFileSync("src/app/hr/admin/performance/actions.ts", "utf8");
    expect(page).toContain('name="targetPositionId"');
    expect(page).toContain("position.jobProfileId === targetProfile?.jobProfileId");
    expect(page).toContain("exact target job profile before handoff");
    expect(actions).toContain('id: text(form, "targetPositionId")');
    expect(actions).toContain('jobProfileId: target.jobProfileId');
    expect(actions).toContain('lifecycleStatus: { in: ["OPEN", "PARTIALLY_FILLED"] }');
    expect(actions).toContain('positionId: targetPosition.id');
  });

  it("keeps employee, HR, payroll, and auditor performance powers separated", () => {
    expect(permissionsForRole("EMPLOYEE")).toEqual(expect.arrayContaining(["performance.goal.manage_self", "performance.review.submit_self", "performance.career.manage_self"]));
    expect(permissionsForRole("EMPLOYEE")).not.toContain("performance.calibration.admin");
    expect(permissionsForRole("HR_ADMIN")).toEqual(expect.arrayContaining(["performance.framework.manage", "performance.promotion.review", "performance.calibration.admin"]));
    expect(permissionsForRole("PAYROLL_ADMIN")).not.toContain("performance.readiness.assess");
    expect(permissionsForRole("AUDITOR")).toEqual(["audit.read", "report.read", "performance.audit.read"]);
  });

  it("exposes only employee-facing development and readiness narratives", () => {
    const page = readFileSync("src/app/hr/employee/performance/page.tsx", "utf8");
    expect(page).toContain("Exact target expectations");
    expect(page).toContain("employeeFacingRationale");
    expect(page).not.toContain("item.rationale");
    expect(page).not.toContain("HrCalibrationDecision");
    expect(page).toContain("Restricted calibration discussion");
  });

  it("runs idempotent goal, review, check-in, development, and calibration reminders", () => {
    const worker = readFileSync("src/lib/hr/performance/worker.ts", "utf8");
    expect(worker).toContain("sendDueDevelopmentReminders");
    expect(worker).toContain("sendDueCheckInReminders");
    expect(worker).toContain("sendReviewActionReminders");
    expect(worker).toContain("unit7-development-due:");
    expect(worker).toContain("unit7-checkin-due:");
    expect(worker).toContain("unit7-self-review-due:");
    expect(worker).toContain("unit7-manager-review-due:");
    expect(worker).toContain("unit7-calibration-action:");
  });
});
