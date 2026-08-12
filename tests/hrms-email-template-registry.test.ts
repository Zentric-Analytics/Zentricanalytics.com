import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sealHrCredential } from "../src/lib/hr/auth/crypto";
import { hrEmailContent } from "../src/lib/hr/notifications/worker";

const baseUrl = "https://staging.zentricanalytics.com";
const namedTemplates = [
  "hr-application-confirmation", "hr-new-application", "hr-interview-invitation", "hr-interview-reminder",
  "hr-interview-rescheduled", "hr-interview-cancelled", "hr-assessment-assigned", "hr-offer-issued",
  "hr-offer-reminder", "hr-offer-accepted", "hr-offer-declined", "hr-handover-created",
  "hr-document-requested", "hr-document-available", "hr-document-rejected", "hr-document-scan-attention",
  "hr-document-expiring", "hr-lifecycle-started", "hr-lifecycle-task-due", "hr-employee-activated",
  "hr-mfa-enrollment", "hr-asset-assigned", "hr-asset-return-recorded", "hr-asset-return-reminder",
  "hr-leave-submitted", "hr-leave-review-requested", "hr-leave-approved", "hr-leave-rejected", "hr-leave-returned", "hr-leave-cancelled", "hr-leave-upcoming", "hr-leave-evidence-required", "hr-leave-expiring-entitlement", "hr-leave-return-to-work",
  "hr-payroll-review-ready", "hr-payroll-approval-ready", "hr-payroll-approved", "hr-payslip-ready",
  "hr-workflow-approval", "hr-employment-exit", "hr-vacancy-open", "hr-vacancy-approved",
  "hr-time-schedule-published", "hr-time-schedule-changed", "hr-time-missed-clock-out", "hr-time-correction-required",
  "hr-time-timesheet-due", "hr-time-timesheet-submitted", "hr-time-approval-required", "hr-time-returned", "hr-time-rejected",
  "hr-time-overtime-decided", "hr-time-period-closing", "hr-time-period-locked",
];

describe("HR outbound email template registry", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(namedTemplates)("renders %s as branded, personalized HTML and plain text with an HTTPS CTA", (template) => {
    const result = hrEmailContent(template, { href: "/hr", recipientName: "Working Email Validation" }, baseUrl);
    expect(result.html).toContain("Zentric Analytics");
    expect(result.html).toContain('name="viewport"');
    expect(result.html).toContain("Hello Working Email Validation,");
    expect(result.html).toContain('href="https://staging.zentricanalytics.com/hr"');
    expect(result.body).toContain("Hello Working Email Validation,");
    expect(result.body).toContain("https://staging.zentricanalytics.com/hr");
    expect(result.body).not.toContain("You have a new HRMS notification");
  });

  it("renders invitation fragment links and password-reset verification codes", () => {
    vi.stubEnv("AUTH_SECRET", "email-template-registry-secret-with-at-least-thirty-two-characters");
    const invitation = hrEmailContent("hr-account-invitation", { credentialEnvelope: sealHrCredential("single-use-opaque-token"), recipientName: "Working Email Validation" }, baseUrl);
    expect(invitation.body).toContain("#token=");
    const reset = hrEmailContent("hr-password-reset", { credentialEnvelope: sealHrCredential("123456"), recipientName: "Working Email Validation" }, baseUrl);
    expect(reset.body).toContain("Hello Working Email Validation,");
    expect(reset.body).toContain("123456");
    expect(reset.body).not.toContain("#token=");
  });

  it("fails closed for unknown identifiers and insecure origins", () => {
    expect(() => hrEmailContent("hr-unregistered-template", {}, baseUrl)).toThrow("Unknown HR email template");
    expect(() => hrEmailContent("hr-employee-activated", {}, "http://staging.example.test")).toThrow("HTTPS");
  });

  it("auto-provisions recruitment employee accounts and uses an explicit 403 boundary", () => {
    const activation = readFileSync("src/lib/hr/recruitment/prehire.ts", "utf8");
    expect(activation).toContain('key: "EMPLOYEE"');
    expect(activation).toContain('template: "hr-account-invitation"');
    expect(activation).toContain('action: "hr.recruitment.employee_account.provisioned"');
    expect(activation).toContain("userActivatedAt: userActivated ? now : null");
    expect(activation).toContain('userActivated ? "/hr/employee" : "/hr/login"');
    expect(activation).not.toContain('userActivated ? "/hr/employee" : "/hr/invitation"');
    const authorization = readFileSync("src/lib/hr/permissions/authorize.ts", "utf8");
    expect(authorization).toContain("forbidden()");
    expect(readFileSync("src/app/forbidden.tsx", "utf8")).toContain("Access denied · 403");
    expect(readFileSync("next.config.mjs", "utf8")).toContain("authInterrupts: true");
  });
});
