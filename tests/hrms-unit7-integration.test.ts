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
