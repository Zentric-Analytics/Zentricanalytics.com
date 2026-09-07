/** GoDaddy's documented Microsoft 365 sign-in entry point (verified 2026-09-05).
 * https://www.godaddy.com/help/sign-in-to-my-microsoft-365-account-24539
 */
export const MICROSOFT_365_MAILBOX_LOGIN_URL = "https://sso.godaddy.com/?app=o365&realm=pass";

export type MailboxWelcomeInput = {
  companyEmail: string;
  temporaryPassword: string;
  replyTo: string;
};

function email(value: string, label: string): string {
  const normalized = value.trim();
  if (/[\r\n]/.test(value) || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(normalized)) {
    throw new Error(`A valid ${label} is required.`);
  }
  return normalized;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Render only: no sending, logging, persistence, or account activation.
 * Returned bodies contain a secret. The caller must deliver them only to the
 * linked applicant's verified personal email, without persisting bodies in
 * audit history, an ordinary outbox, logs, or analytics. Authorize the sender
 * and replyTo against the responsible HR identity before calling this function.
 */
export function renderMailboxWelcome(input: MailboxWelcomeInput): { subject: string; text: string; html: string } {
  const companyEmail = email(input.companyEmail, "company email");
  const replyTo = email(input.replyTo, "HR reply-to email");
  if (!input.temporaryPassword.trim() || input.temporaryPassword.length > 1024 || [...input.temporaryPassword].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
    throw new Error("A valid temporary mailbox password is required.");
  }
  const paragraphs = [
    "Your Zentric Analytics company mailbox is ready for you to sign in.",
    `Company email: ${companyEmail}`,
    `Temporary mailbox password: ${input.temporaryPassword}`,
    "Use your company email and temporary mailbox password to sign in to Microsoft 365, then open Outlook. Choose Work or school account if prompted.",
    "Change the temporary password immediately on your first sign-in. Set up Microsoft Authenticator for multi-factor authentication (MFA). If you cannot complete these steps, contact HR before continuing.",
    `After successfully accessing Outlook, send a NEW email FROM your company mailbox (${companyEmail}) TO ${replyTo}, confirming that you can access your company email. Do not simply reply from your personal inbox. Do not include any password in your confirmation.`,
    "This message is for mailbox setup only, not an HRMS invitation. After HR receives your confirmation, HR will send a separate HRMS account invitation to your company mailbox. You will choose your HRMS password through that invitation.",
    "Keep your password private. Do not forward this message or share it with anyone.",
  ];
  return {
    subject: "Zentric Analytics — Your company mailbox setup",
    text: [paragraphs[0], `Microsoft 365 / Outlook sign-in: ${MICROSOFT_365_MAILBOX_LOGIN_URL}`, ...paragraphs.slice(1)].join("\n\n"),
    html: `<p>${escapeHtml(paragraphs[0])}</p><p><a href="${escapeHtml(MICROSOFT_365_MAILBOX_LOGIN_URL)}">Sign in to Microsoft 365 / Outlook</a></p>${paragraphs.slice(1).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}`,
  };
}
