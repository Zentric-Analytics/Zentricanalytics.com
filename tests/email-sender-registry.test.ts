import { afterEach, describe, expect, it } from "vitest";
import {
  emailTemplateSenderRegistry,
  resolveEmailSender,
  senderCategoryForTemplate,
} from "../src/lib/email-senders";

const expected = {
  recruitment: [
    "application-received", "access-code", "application-rejected", "correction-requested",
    "stage-2-unlocked", "stage-2-rejected", "stage-2-correction-requested", "stage-2-submitted-admin",
    "stage-3-unlocked", "stage-3-rejected", "stage-3-correction-requested", "stage-3-instructions-available", "stage-3-submitted-admin",
    "stage-4-unlocked", "stage-5-submitted-admin", "stage-6-submitted-admin", "stage-7-submitted-admin",
    "hr-application-confirmation", "hr-new-application", "hr-interview-invitation", "hr-interview-reminder",
    "hr-interview-rescheduled", "hr-interview-cancelled", "hr-assessment-assigned",
    "hr-vacancy-draft", "hr-vacancy-pending_approval", "hr-vacancy-returned_for_correction",
    "hr-vacancy-approved", "hr-vacancy-scheduled", "hr-vacancy-open", "hr-vacancy-paused",
    "hr-vacancy-closed", "hr-vacancy-filled", "hr-vacancy-cancelled",
  ],
  offers: [
    "offer-ready", "offer-accepted", "stage-5-agreement-released", "hr-offer-issued",
    "hr-offer-reminder", "hr-offer-accepted", "hr-offer-declined", "stage-5-correction-requested",
    "stage-5-rejected",
  ],
  hr: [
    "stage-6-unlocked", "stage-6-correction-requested", "stage-6-rejected", "stage-7-unlocked",
    "stage-7-correction-requested", "stage-7-rejected", "stage-8-unlocked",
    "stage-8-correction-requested", "stage-8-rejected", "hiring-workflow-completed",
    "hr-handover-created", "hr-document-requested", "hr-document-available", "hr-document-rejected",
    "hr-document-scan-attention", "hr-document-scan-result", "hr-document-expiring", "hr-lifecycle-started",
    "hr-lifecycle-task-due", "hr-asset-assigned", "hr-asset-return-recorded", "hr-asset-return-reminder",
    "hr-leave-review-requested", "hr-leave-approved", "hr-leave-rejected", "hr-leave-cancelled",
    "hr-payroll-review-ready", "hr-payroll-approval-ready", "hr-payroll-approved", "hr-payslip-ready",
    "hr-workflow-approval", "hr-employment-exit",
  ],
  "account-security": ["hr-account-invitation", "hr-password-reset", "hr-mfa-enrollment", "hr-employee-activated"],
} as const;

const senderByCategory = {
  recruitment: { from: "Zentric Careers <careers@zentricanalytics.com>", replyTo: "careers@zentricanalytics.com" },
  offers: { from: "Zentric Offers <offers@zentricanalytics.com>", replyTo: "offers@zentricanalytics.com" },
  hr: { from: "Zentric HR <hr@zentricanalytics.com>", replyTo: "hr@zentricanalytics.com" },
  "account-security": { from: "Zentric Account Security <accounts@zentricanalytics.com>", replyTo: "support@zentricanalytics.com" },
} as const;

describe("intent-based email sender registry", () => {
  afterEach(() => {
    delete process.env.EMAIL_FROM_CAREERS;
    delete process.env.EMAIL_FROM_OFFERS;
    delete process.env.EMAIL_FROM_HR;
    delete process.env.EMAIL_FROM_ACCOUNTS;
    delete process.env.EMAIL_REPLY_TO_CAREERS;
    delete process.env.EMAIL_REPLY_TO_OFFERS;
    delete process.env.EMAIL_REPLY_TO_HR;
    delete process.env.EMAIL_REPLY_TO_ACCOUNTS;
  });

  it("assigns every registered template to exactly one sender category", () => {
    const flattened = Object.entries(expected).flatMap(([category, templates]) =>
      templates.map((template) => [template, category]),
    );
    expect(new Set(flattened.map(([template]) => template))).toHaveLength(flattened.length);
    expect(emailTemplateSenderRegistry).toEqual(Object.fromEntries(flattened));
  });

  it.each(Object.entries(expected).flatMap(([category, templates]) =>
    templates.map((template) => [template, category] as const),
  ))("maps %s to %s with the correct display name and Reply-To", (template, category) => {
    const sender = resolveEmailSender(template);
    const expectedSender = senderByCategory[category as keyof typeof senderByCategory];
    expect(sender.category).toBe(category);
    expect(sender.from).toBe(expectedSender.from);
    expect(sender.replyTo).toBe(expectedSender.replyTo);
  });

  it("keeps password resets out of Careers and offers out of Account Security", () => {
    expect(resolveEmailSender("hr-password-reset").from).toBe("Zentric Account Security <accounts@zentricanalytics.com>");
    expect(resolveEmailSender("hr-password-reset").from).not.toContain("careers@");
    expect(resolveEmailSender("hr-offer-issued").from).toBe("Zentric Offers <offers@zentricanalytics.com>");
    expect(resolveEmailSender("hr-offer-issued").from).not.toContain("accounts@");
  });

  it("supports separately configured Reply-To addresses", () => {
    process.env.EMAIL_REPLY_TO_OFFERS = "support@zentricanalytics.com";
    expect(resolveEmailSender("hr-offer-issued")).toMatchObject({
      address: "offers@zentricanalytics.com",
      replyTo: "support@zentricanalytics.com",
    });
  });

  it("fails closed for unknown templates and untrusted From domains", () => {
    expect(() => senderCategoryForTemplate("hr-unknown-template")).toThrow("Unknown or unmapped");
    process.env.EMAIL_FROM_ACCOUNTS = "accounts@example.com";
    expect(() => resolveEmailSender("hr-password-reset")).toThrow("must be a zentricanalytics.com email address");
  });
});
