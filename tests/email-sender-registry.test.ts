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
    "hr-leave-submitted", "hr-leave-review-requested", "hr-leave-approved", "hr-leave-rejected", "hr-leave-returned", "hr-leave-cancelled", "hr-leave-upcoming", "hr-leave-evidence-required", "hr-leave-expiring-entitlement", "hr-leave-return-to-work",
    "hr-payroll-review-ready", "hr-payroll-approval-ready", "hr-payroll-approved", "hr-payslip-ready",
    "hr-workflow-approval", "hr-employment-exit",
    "hr-workforce-event-submitted", "hr-workforce-event-approved", "hr-workforce-event-applied",
    "hr-probation-review-due", "hr-probation-confirmed", "hr-probation-extended",
    "hr-contract-review", "hr-contract-active", "hr-contract-expiring",
    "hr-separation-submitted", "hr-separation-approved", "hr-separation-completed", "hr-rehire-started",
    "hr-time-schedule-published", "hr-time-schedule-changed", "hr-time-missed-clock-out", "hr-time-correction-required",
    "hr-time-timesheet-due", "hr-time-timesheet-submitted", "hr-time-approval-required", "hr-time-returned", "hr-time-rejected",
    "hr-time-overtime-decided", "hr-time-period-closing", "hr-time-period-locked",
  ],
  "account-security": ["hr-account-invitation", "hr-password-reset", "hr-password-reset-complete", "hr-mfa-enrollment", "hr-employee-activated"],
} as const;

const senderByCategory = {
  recruitment: { from: "Zentric Careers <careers@zentricanalytics.com>", replyTo: "careers@zentricanalytics.com" },
  offers: { from: "Zentric Offers <offers@zentricanalytics.com>", replyTo: "offers@zentricanalytics.com" },
  hr: { from: "Zentric HR <hr@zentricanalytics.com>", replyTo: "hr@zentricanalytics.com" },
  "account-security": { from: "Zentric Account Security <accounts@zentricanalytics.com>", replyTo: "support@zentricanalytics.com" },
} as const;
const registeredTemplateEntries = Object.entries(expected).flatMap(([category, templates]) =>
  templates.map((template) => [template, category] as const),
);

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
    const flattened = registeredTemplateEntries;
    expect(new Set(flattened.map(([template]) => template))).toHaveLength(flattened.length);
    expect(emailTemplateSenderRegistry).toEqual(Object.fromEntries(flattened));
  });

  it.each(registeredTemplateEntries)("maps %s to %s with the correct display name and Reply-To", (template, category) => {
    const sender = resolveEmailSender(template);
    const expectedSender = senderByCategory[category as keyof typeof senderByCategory];
    expect(sender.category).toBe(category);
    expect(sender.from).toBe(expectedSender.from);
    expect(sender.replyTo).toBe(expectedSender.replyTo);
  });

  it("keeps security templates out of recruitment and offers out of security categories", () => {
    expect(resolveEmailSender("hr-password-reset").from).toBe("Zentric Account Security <accounts@zentricanalytics.com>");
    expect(resolveEmailSender("hr-password-reset").from).not.toContain("careers@");
    expect(resolveEmailSender("hr-offer-issued").from).toBe("Zentric Offers <offers@zentricanalytics.com>");
    expect(resolveEmailSender("hr-offer-issued").from).not.toContain("accounts@");
    expect(resolveEmailSender("hr-offer-issued").from).not.toContain("support@");
    expect(resolveEmailSender("hr-account-invitation").from).toBe("Zentric Account Security <accounts@zentricanalytics.com>");
    expect(resolveEmailSender("hr-account-invitation").from).not.toContain("careers@");
  });

  it("hard-enforces complete security and offer sender boundaries", () => {
    const accountSecurityTemplates = expected["account-security"];
    const offerTemplates = expected.offers;

    accountSecurityTemplates.forEach((template) => {
      const from = resolveEmailSender(template).from;
      expect(from).toContain("Account Security");
      expect(from).toContain("accounts@zentricanalytics.com");
      expect(from).not.toContain("careers@");
      expect(from).not.toContain("offers@");
      expect(from).not.toContain("hr@");
    });

    offerTemplates.forEach((template) => {
      const from = resolveEmailSender(template).from;
      expect(from).toContain("Offers");
      expect(from).toContain("offers@zentricanalytics.com");
      expect(from).not.toContain("accounts@");
      expect(from).not.toContain("careers@");
      expect(from).not.toContain("hr@");
    });
  });

  it("supports separately configured Reply-To addresses", () => {
    process.env.EMAIL_REPLY_TO_OFFERS = "support@zentricanalytics.com";
    expect(resolveEmailSender("hr-offer-issued")).toMatchObject({
      address: "offers@zentricanalytics.com",
      replyTo: "support@zentricanalytics.com",
    });
  });

  it("enforces approved sender domain and configured reply-to domain for all templates", () => {
    const senderTemplates = {
      recruitment: new Set(expected.recruitment),
      offers: new Set(expected.offers),
      hr: new Set(expected.hr),
      "account-security": new Set(expected["account-security"]),
    };

    for (const [template] of Object.entries(emailTemplateSenderRegistry)) {
      const { address, replyTo, category } = resolveEmailSender(template);
      expect(address).toMatch(/^[^@\s]+@zentricanalytics\.com$/);
      expect(replyTo).toMatch(/^[^@\s]+@zentricanalytics\.com$/);
      expect(senderTemplates[category]).toContain(template);
      expect(address).not.toContain(" ");
    }
  });

  it("fails closed for unknown templates and untrusted From domains", () => {
    expect(() => senderCategoryForTemplate("hr-unknown-template")).toThrow("Unknown or unmapped");
    process.env.EMAIL_FROM_ACCOUNTS = "accounts@example.com";
    expect(() => resolveEmailSender("hr-password-reset")).toThrow("must be a zentricanalytics.com email address");
  });
});
