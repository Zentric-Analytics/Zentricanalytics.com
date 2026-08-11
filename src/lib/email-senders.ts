export type EmailSenderCategory = "recruitment" | "offers" | "hr" | "account-security";

type SenderDefinition = {
  displayName: string;
  addressEnv: string;
  defaultAddress: string;
  replyToEnv: string;
  defaultReplyTo: string;
};

const senderDefinitions: Record<EmailSenderCategory, SenderDefinition> = {
  recruitment: { displayName: "Zentric Careers", addressEnv: "EMAIL_FROM_CAREERS", defaultAddress: "careers@zentricanalytics.com", replyToEnv: "EMAIL_REPLY_TO_CAREERS", defaultReplyTo: "careers@zentricanalytics.com" },
  offers: { displayName: "Zentric Offers", addressEnv: "EMAIL_FROM_OFFERS", defaultAddress: "offers@zentricanalytics.com", replyToEnv: "EMAIL_REPLY_TO_OFFERS", defaultReplyTo: "offers@zentricanalytics.com" },
  hr: { displayName: "Zentric HR", addressEnv: "EMAIL_FROM_HR", defaultAddress: "hr@zentricanalytics.com", replyToEnv: "EMAIL_REPLY_TO_HR", defaultReplyTo: "hr@zentricanalytics.com" },
  "account-security": { displayName: "Zentric Account Security", addressEnv: "EMAIL_FROM_ACCOUNTS", defaultAddress: "accounts@zentricanalytics.com", replyToEnv: "EMAIL_REPLY_TO_ACCOUNTS", defaultReplyTo: "support@zentricanalytics.com" },
};

const recruitmentTemplates = [
  "application-received", "access-code", "application-rejected", "correction-requested",
  "stage-2-unlocked", "stage-2-rejected", "stage-2-correction-requested", "stage-2-submitted-admin",
  "stage-3-unlocked", "stage-3-rejected", "stage-3-correction-requested", "stage-3-instructions-available", "stage-3-submitted-admin",
  "stage-4-unlocked", "stage-5-submitted-admin", "stage-6-submitted-admin", "stage-7-submitted-admin",
  "hr-application-confirmation", "hr-new-application", "hr-interview-invitation", "hr-interview-reminder",
  "hr-interview-rescheduled", "hr-interview-cancelled", "hr-assessment-assigned",
  "hr-vacancy-draft", "hr-vacancy-pending_approval", "hr-vacancy-returned_for_correction",
  "hr-vacancy-approved", "hr-vacancy-scheduled", "hr-vacancy-open", "hr-vacancy-paused",
  "hr-vacancy-closed", "hr-vacancy-filled", "hr-vacancy-cancelled",
] as const;

const offerTemplates = [
  "offer-ready", "offer-accepted", "stage-5-agreement-released", "hr-offer-issued",
  "hr-offer-reminder", "hr-offer-accepted", "hr-offer-declined", "stage-5-correction-requested",
  "stage-5-rejected",
] as const;

const hrTemplates = [
  "stage-6-unlocked", "stage-6-correction-requested", "stage-6-rejected", "stage-7-unlocked",
  "stage-7-correction-requested", "stage-7-rejected", "stage-8-unlocked",
  "stage-8-correction-requested", "stage-8-rejected", "hiring-workflow-completed",
  "hr-handover-created", "hr-document-requested", "hr-document-available", "hr-document-rejected",
  "hr-document-scan-attention", "hr-document-scan-result", "hr-document-expiring", "hr-lifecycle-started",
  "hr-lifecycle-task-due", "hr-asset-assigned", "hr-asset-return-recorded",
  "hr-asset-return-reminder", "hr-leave-submitted", "hr-leave-review-requested", "hr-leave-approved", "hr-leave-rejected",
  "hr-leave-returned", "hr-leave-cancelled", "hr-leave-upcoming", "hr-leave-evidence-required", "hr-leave-expiring-entitlement", "hr-leave-return-to-work", "hr-payroll-review-ready", "hr-payroll-approval-ready", "hr-payroll-approved",
  "hr-payslip-ready", "hr-workflow-approval", "hr-employment-exit",
  "hr-workforce-event-submitted", "hr-workforce-event-approved", "hr-workforce-event-applied",
  "hr-probation-review-due", "hr-probation-confirmed", "hr-probation-extended",
  "hr-contract-review", "hr-contract-active", "hr-contract-expiring",
  "hr-separation-submitted", "hr-separation-approved", "hr-separation-completed", "hr-rehire-started",
] as const;

const accountSecurityTemplates = ["hr-account-invitation", "hr-password-reset", "hr-password-reset-complete", "hr-mfa-enrollment", "hr-employee-activated"] as const;

export const emailTemplateSenderRegistry: Readonly<Record<string, EmailSenderCategory>> = Object.freeze({
  ...Object.fromEntries(recruitmentTemplates.map((template) => [template, "recruitment"])),
  ...Object.fromEntries(offerTemplates.map((template) => [template, "offers"])),
  ...Object.fromEntries(hrTemplates.map((template) => [template, "hr"])),
  ...Object.fromEntries(accountSecurityTemplates.map((template) => [template, "account-security"])),
} as Record<string, EmailSenderCategory>);

function configuredEmail(env: NodeJS.ProcessEnv, key: string, fallback: string) {
  const value = String(env[key] ?? fallback).trim().toLowerCase();
  if (!/^[^\s@]+@zentricanalytics\.com$/.test(value)) throw new Error(`${key} must be a zentricanalytics.com email address.`);
  return value;
}

export function senderCategoryForTemplate(template: string): EmailSenderCategory {
  const category = emailTemplateSenderRegistry[template];
  if (!category) throw new Error(`Unknown or unmapped email sender template: ${template}`);
  return category;
}

export function resolveEmailSender(template: string, env: NodeJS.ProcessEnv = process.env) {
  const category = senderCategoryForTemplate(template);
  const definition = senderDefinitions[category];
  const address = configuredEmail(env, definition.addressEnv, definition.defaultAddress);
  const replyTo = configuredEmail(env, definition.replyToEnv, definition.defaultReplyTo);
  return { category, from: `${definition.displayName} <${address}>`, displayName: definition.displayName, address, replyTo };
}
