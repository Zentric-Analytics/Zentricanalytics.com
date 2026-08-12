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
  it("maps every Unit 7 template to the HR sender and fails closed for unknown templates", () => {
    for (const template of unit7Templates) {
      expect(emailTemplateSenderRegistry[template]).toBe("hr");
      expect(senderCategoryForTemplate(template)).toBe("hr");
      expect(resolveEmailSender(template, { NODE_ENV: "test" })).toMatchObject({ category: "hr", from: "Zentric HR <hr@zentricanalytics.com>", replyTo: "hr@zentricanalytics.com" });
    }
    expect(() => senderCategoryForTemplate("hr-performance-unknown")).toThrow(/Unknown or unmapped/);
  });

  it("keeps employee, HR, payroll, and auditor performance powers separated", () => {
    expect(permissionsForRole("EMPLOYEE")).toEqual(expect.arrayContaining(["performance.goal.manage_self", "performance.review.submit_self", "performance.career.manage_self"]));
    expect(permissionsForRole("EMPLOYEE")).not.toContain("performance.calibration.admin");
    expect(permissionsForRole("HR_ADMIN")).toEqual(expect.arrayContaining(["performance.framework.manage", "performance.promotion.review", "performance.calibration.admin"]));
    expect(permissionsForRole("PAYROLL_ADMIN")).not.toContain("performance.readiness.assess");
    expect(permissionsForRole("AUDITOR")).toEqual(["audit.read", "report.read", "performance.audit.read"]);
  });
});
