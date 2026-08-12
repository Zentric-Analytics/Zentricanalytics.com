import type { HrEmailOutbox } from "@prisma/client";
import { prisma } from "../../prisma";
import { sendHiringEmail } from "../../email";
import { unsealHrCredential } from "../auth/crypto";

const MAX_ATTEMPTS = 5;
const PROCESSING_TIMEOUT_MS = 15 * 60 * 1000;

export function retryAt(attempt: number, now = new Date()) {
  const delayMinutes = Math.min(24 * 60, 2 ** Math.max(0, attempt - 1) * 5);
  return new Date(now.getTime() + delayMinutes * 60_000);
}

export function safeWorkerError(value: unknown) {
  const message = value instanceof Error ? value.message : String(value ?? "Unknown delivery error");
  const secrets = [process.env.RESEND_API_KEY, process.env.EMAIL_WORKER_SECRET].filter((item): item is string => Boolean(item));
  return secrets.reduce((safe, secret) => safe.replaceAll(secret, "[redacted]"), message).replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 500);
}

type HrEmailPayload = { credentialEnvelope?: unknown; href?: unknown; recipientName?: unknown } | null;
type HrEmailContent = { body: string; html: string };

type NotificationTemplate = {
  title: string;
  body: string;
  ctaLabel: string;
  defaultHref: string;
};

const notificationTemplates: Record<string, NotificationTemplate> = {
  "hr-application-confirmation": { title: "We received your application", body: "Your application has been received and is now in our review queue.", ctaLabel: "Track Application", defaultHref: "/track" },
  "hr-new-application": { title: "New application received", body: "A new candidate application is ready for secure review.", ctaLabel: "Review Application", defaultHref: "/hr/admin/recruitment" },
  "hr-interview-invitation": { title: "Interview invitation", body: "An interview has been scheduled. Review the secure workspace for the confirmed time and details.", ctaLabel: "Review Interview", defaultHref: "/hr/admin/recruitment" },
  "hr-interview-reminder": { title: "Interview reminder", body: "This is a reminder for your upcoming interview. Review the confirmed details in the secure workspace.", ctaLabel: "Review Interview", defaultHref: "/hr/admin/recruitment" },
  "hr-interview-rescheduled": { title: "Interview rescheduled", body: "Your interview schedule has changed. Review the new confirmed time and details.", ctaLabel: "Review New Schedule", defaultHref: "/hr/admin/recruitment" },
  "hr-interview-cancelled": { title: "Interview cancelled", body: "The scheduled interview has been cancelled. Review the secure workspace for any next steps.", ctaLabel: "Review Update", defaultHref: "/hr/admin/recruitment" },
  "hr-assessment-assigned": { title: "Assessment invitation", body: "An assessment is ready for secure review and completion.", ctaLabel: "Review Assessment", defaultHref: "/hr/admin/recruitment" },
  "hr-offer-reminder": { title: "Employment offer reminder", body: "Your employment offer is still awaiting your response. Review the exact approved version before its deadline.", ctaLabel: "Review Offer", defaultHref: "/track" },
  "hr-offer-accepted": { title: "Offer acceptance confirmed", body: "Your acceptance of the exact approved employment offer has been recorded.", ctaLabel: "Review Application", defaultHref: "/track" },
  "hr-offer-declined": { title: "Offer decision confirmed", body: "Your decision to decline the employment offer has been recorded.", ctaLabel: "Review Application", defaultHref: "/track" },
  "hr-document-requested": { title: "Document requested", body: "HR has requested a document. Upload it only through the secure HR workspace.", ctaLabel: "Review Request", defaultHref: "/hr/employee/documents" },
  "hr-document-available": { title: "Document approved", body: "An HR document has passed verification and is available in your secure workspace.", ctaLabel: "View Document", defaultHref: "/hr/employee/documents" },
  "hr-document-rejected": { title: "Document needs attention", body: "An HR document could not be approved. Review the reason and required next step securely.", ctaLabel: "Review Document", defaultHref: "/hr/employee/documents" },
  "hr-document-scan-attention": { title: "Document needs attention", body: "A document upload needs secure review before it can be made available.", ctaLabel: "Review Document", defaultHref: "/hr/employee/documents" },
  "hr-document-scan-result": { title: "Employee document scan completed", body: "A document malware scan completed and is ready for authorized HR review.", ctaLabel: "Review Document", defaultHref: "/hr/admin/documents" },
  "hr-document-expiring": { title: "Document expiration reminder", body: "An HR document is approaching its expiration date. Review it securely and update it if required.", ctaLabel: "Review Document", defaultHref: "/hr/employee/documents" },
  "hr-lifecycle-started": { title: "Onboarding started", body: "Your onboarding checklist is ready. Complete each assigned task in the secure HR workspace.", ctaLabel: "Start Onboarding", defaultHref: "/hr/employee/tasks" },
  "hr-lifecycle-task-due": { title: "Onboarding reminder", body: "An assigned onboarding task is due. Review and complete it in the secure HR workspace.", ctaLabel: "Review Task", defaultHref: "/hr/employee/tasks" },
  "hr-employee-activated": { title: "Employee account activated", body: "Your employee record is active and your HR self-service workspace is ready.", ctaLabel: "Open HR Workspace", defaultHref: "/hr/employee" },
  "hr-mfa-enrollment": { title: "MFA enrollment required", body: "Multi-factor authentication is required before you can enter the HR workspace.", ctaLabel: "Complete Security Setup", defaultHref: "/hr/security" },
  "hr-asset-assigned": { title: "Asset assigned", body: "An asset has been assigned to you. Review the assignment details securely.", ctaLabel: "View Assets", defaultHref: "/hr/employee/assets" },
  "hr-asset-return-recorded": { title: "Asset return recorded", body: "Your asset return has been recorded in the HR workspace.", ctaLabel: "View Assets", defaultHref: "/hr/employee/assets" },
  "hr-asset-return-reminder": { title: "Asset return reminder", body: "An assigned asset is due for return. Review the return requirements securely.", ctaLabel: "View Assets", defaultHref: "/hr/employee/assets" },
  "hr-leave-submitted": { title: "Leave request submitted", body: "Your leave request was submitted for governed review.", ctaLabel: "View Leave", defaultHref: "/hr/employee/leave" },
  "hr-leave-review-requested": { title: "Leave request awaiting review", body: "A leave request is ready for your secure review.", ctaLabel: "Review Leave", defaultHref: "/hr/supervisor/leave" },
  "hr-leave-approved": { title: "Leave request approved", body: "Your leave request has been approved.", ctaLabel: "View Leave", defaultHref: "/hr/employee/leave" },
  "hr-leave-rejected": { title: "Leave request update", body: "Your leave request was not approved. Review the decision securely.", ctaLabel: "View Decision", defaultHref: "/hr/employee/leave" },
  "hr-leave-returned": { title: "Leave request returned", body: "Your leave request needs changes before it can continue through approval.", ctaLabel: "Update Request", defaultHref: "/hr/employee/leave" },
  "hr-leave-cancelled": { title: "Approved leave cancelled", body: "A previously approved leave request has been cancelled.", ctaLabel: "View Leave", defaultHref: "/hr/employee/leave" },
  "hr-leave-upcoming": { title: "Upcoming leave reminder", body: "Approved leave is approaching. Review the dates and status securely.", ctaLabel: "View Leave", defaultHref: "/hr/employee/leave" },
  "hr-leave-evidence-required": { title: "Leave evidence required", body: "Your leave request requires confidential evidence. Upload it through the secure HR workspace.", ctaLabel: "Provide Evidence", defaultHref: "/hr/employee/leave" },
  "hr-leave-expiring-entitlement": { title: "Leave entitlement expiring", body: "Some unreserved leave entitlement is approaching expiry. Review your leave account securely.", ctaLabel: "View Balance", defaultHref: "/hr/employee/leave" },
  "hr-leave-return-to-work": { title: "Return-to-work action", body: "A return-to-work action is due for a long-term absence.", ctaLabel: "Review Absence", defaultHref: "/hr/admin/leave" },
  "hr-payroll-review-ready": { title: "Payroll ready for review", body: "A payroll run is awaiting authorized review.", ctaLabel: "Review Payroll", defaultHref: "/hr/admin/payroll" },
  "hr-payroll-approval-ready": { title: "Payroll ready for approval", body: "A reviewed payroll run is awaiting independent approval.", ctaLabel: "Approve Payroll", defaultHref: "/hr/admin/payroll" },
  "hr-payroll-approved": { title: "Payroll run approved", body: "The payroll run has completed its approval gate.", ctaLabel: "View Payroll", defaultHref: "/hr/admin/payroll" },
  "hr-payslip-ready": { title: "Payslip ready", body: "Your payslip is available in the secure HR workspace.", ctaLabel: "View Payslip", defaultHref: "/hr/employee/payslips" },
  "hr-workflow-approval": { title: "Workflow approval requested", body: "A governed workflow stage is awaiting your decision.", ctaLabel: "Review Approval", defaultHref: "/hr/employee/approvals" },
  "hr-employment-exit": { title: "Employment exit information", body: "Employment exit information is available in the secure HR workspace.", ctaLabel: "Review Information", defaultHref: "/hr/employee" },
  "hr-workforce-event-submitted": { title: "Workforce change submitted", body: "A governed workforce change is awaiting review.", ctaLabel: "Review Workforce Change", defaultHref: "/hr/admin/workforce-events" },
  "hr-workforce-event-approved": { title: "Workforce change approved", body: "Your workforce change has completed approval and is scheduled for its effective date.", ctaLabel: "View Change", defaultHref: "/hr/employee/profile" },
  "hr-workforce-event-applied": { title: "Workforce change effective", body: "An approved workforce change is now effective and recorded in your employment history.", ctaLabel: "View Employment History", defaultHref: "/hr/employee/profile" },
  "hr-probation-review-due": { title: "Probation review due", body: "A probation checkpoint or final review requires action.", ctaLabel: "Review Probation", defaultHref: "/hr/admin/workforce-events" },
  "hr-probation-confirmed": { title: "Employment confirmed", body: "Your probation outcome has been approved and your employment is confirmed.", ctaLabel: "View Employment Profile", defaultHref: "/hr/employee/profile" },
  "hr-probation-extended": { title: "Probation period updated", body: "Your probation period has been extended through a governed review.", ctaLabel: "View Updated Timeline", defaultHref: "/hr/employee/profile" },
  "hr-contract-review": { title: "Employment contract requires review", body: "A versioned employment contract is ready for secure review.", ctaLabel: "Review Contract", defaultHref: "/hr/employee/documents" },
  "hr-contract-active": { title: "Employment contract active", body: "The exact approved and signed contract version is now active.", ctaLabel: "View Contract", defaultHref: "/hr/employee/documents" },
  "hr-contract-expiring": { title: "Employment contract expiring", body: "An employment contract is approaching its expiry date and requires review.", ctaLabel: "Review Contract", defaultHref: "/hr/admin/workforce-events" },
  "hr-separation-submitted": { title: "Separation submitted", body: "A governed separation case is awaiting independent review.", ctaLabel: "Review Separation", defaultHref: "/hr/admin/workforce-events" },
  "hr-separation-approved": { title: "Separation approved", body: "The separation plan is approved and scheduled for the final working date.", ctaLabel: "Review Offboarding", defaultHref: "/hr/employee/tasks" },
  "hr-separation-completed": { title: "Employment separation completed", body: "The approved separation and required offboarding steps are complete.", ctaLabel: "Review Employment History", defaultHref: "/hr/employee/profile" },
  "hr-rehire-started": { title: "Rehire onboarding started", body: "A new work relationship has been created and onboarding is ready.", ctaLabel: "Start Onboarding", defaultHref: "/hr/employee/tasks" },
  "hr-time-schedule-published": { title: "Work schedule published", body: "Your effective work schedule is available in the secure HR workspace.", ctaLabel: "View Schedule", defaultHref: "/hr/employee/time" },
  "hr-time-schedule-changed": { title: "Work schedule changed", body: "A new version of your work schedule has been published.", ctaLabel: "Review Schedule", defaultHref: "/hr/employee/time" },
  "hr-time-missed-clock-out": { title: "Clock-out needs attention", body: "A clock session needs a governed correction before attendance can be approved.", ctaLabel: "Review Time", defaultHref: "/hr/employee/time" },
  "hr-time-correction-required": { title: "Time correction required", body: "An attendance record requires a correction or explanation.", ctaLabel: "Review Correction", defaultHref: "/hr/employee/time" },
  "hr-time-timesheet-due": { title: "Timesheet due", body: "Your current timesheet is due for submission.", ctaLabel: "Open Timesheet", defaultHref: "/hr/employee/time" },
  "hr-time-timesheet-submitted": { title: "Timesheet submitted", body: "A timesheet is ready for governed review.", ctaLabel: "Review Timesheet", defaultHref: "/hr/supervisor/time" },
  "hr-time-approval-required": { title: "Time approval required", body: "A time exception, correction, or overtime candidate requires review.", ctaLabel: "Review Time", defaultHref: "/hr/supervisor/time" },
  "hr-time-returned": { title: "Time record returned", body: "A time record was returned for changes. Review the decision securely.", ctaLabel: "Update Time", defaultHref: "/hr/employee/time" },
  "hr-time-rejected": { title: "Time record decision", body: "A submitted time record was not approved. Review the reason securely.", ctaLabel: "View Decision", defaultHref: "/hr/employee/time" },
  "hr-time-overtime-decided": { title: "Overtime decision recorded", body: "A governed overtime decision has been recorded.", ctaLabel: "View Attendance", defaultHref: "/hr/employee/time" },
  "hr-time-period-closing": { title: "Attendance period closing", body: "An attendance period is approaching its governed close.", ctaLabel: "Review Period", defaultHref: "/hr/admin/time" },
  "hr-time-period-locked": { title: "Attendance period locked", body: "An approved attendance period has been locked and is ready for authorized downstream use.", ctaLabel: "View Period", defaultHref: "/hr/admin/time" },
};

const vacancyTemplate: NotificationTemplate = { title: "Vacancy workflow update", body: "A vacancy has changed state and is ready for secure review.", ctaLabel: "Review Vacancy", defaultHref: "/hr/admin/vacancies" };

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function brandedHrEmail(title: string, body: string, cta?: { label: string; href: string }): HrEmailContent {
  const paragraphs = body.split("\n\n").filter(Boolean);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;"><tr><td style="background:#0f172a;padding:24px 28px;color:#ffffff;font-size:20px;font-weight:700;">Zentric Analytics</td></tr><tr><td style="padding:32px 28px;"><h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;">${escapeHtml(title)}</h1>${paragraphs.map((paragraph) => `<p style="margin:0 0 16px;color:#334155;font-size:16px;line-height:1.6;">${escapeHtml(paragraph)}</p>`).join("")}${cta ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(cta.href)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 18px;font-weight:700;">${escapeHtml(cta.label)}</a></p>` : ""}</td></tr><tr><td style="border-top:1px solid #e2e8f0;padding:18px 28px;color:#64748b;font-size:13px;line-height:1.5;">This message was sent by Zentric Analytics. Do not reply with confidential information.</td></tr></table></td></tr></table></body></html>`;
  return { body: cta ? `${body}\n\n${cta.label}: ${cta.href}` : body, html };
}

function secureHrEmailLink(payload: HrEmailPayload, baseUrl: string) {
  const href = payload?.href;
  if (typeof href !== "string" || !href.startsWith("/") || href.startsWith("//")) {
    throw new Error("HR email payload must contain a safe relative link.");
  }
  if (!/^https:\/\//.test(baseUrl)) throw new Error("APPLICATION_BASE_URL must be HTTPS for HR email delivery.");
  return `${baseUrl}${href}`;
}

export function hrEmailContent(template: string, payload: unknown, applicationBaseUrl = process.env.APPLICATION_BASE_URL ?? ""): HrEmailContent {
  const baseUrl = String(applicationBaseUrl).replace(/\/+$/, "");
  const emailPayload = (payload && typeof payload === "object" ? payload : null) as HrEmailPayload;
  const recipientName = typeof emailPayload?.recipientName === "string" && emailPayload.recipientName.trim()
    ? emailPayload.recipientName.trim()
    : null;
  const greeting = recipientName ? `Hello ${recipientName},\n\n` : "";
  if (template === "hr-account-invitation") {
    if (!/^https:\/\//.test(baseUrl)) throw new Error("APPLICATION_BASE_URL must be HTTPS for credential email delivery.");
    const credentialEnvelope = emailPayload?.credentialEnvelope;
    if (typeof credentialEnvelope !== "string") throw new Error("Credential email payload is invalid.");
    const token = unsealHrCredential(credentialEnvelope);
    const destination = template === "hr-account-invitation" ? "invitation" : "password-reset";
    const action = destination === "invitation" ? "set up your HR account" : "reset your HR password";
    const href = `${baseUrl}/hr/${destination}/redeem#token=${encodeURIComponent(token)}`;
    return brandedHrEmail(`Zentric HR: ${destination === "invitation" ? "Account setup" : "Password reset"}`, `${greeting}Use the secure one-time link below to ${action}.\n\nThis link is time-limited and single-use. Do not forward it.`, { label: destination === "invitation" ? "Set Up Account" : "Reset Password", href });
  }

  if (template === "hr-offer-issued") {
    const href = secureHrEmailLink(emailPayload, baseUrl);
    return brandedHrEmail("Your employment offer is ready", `${greeting}Your employment offer is ready for review.\n\nReview the exact approved offer and accept or decline it securely.`, { label: "Review & Accept Offer", href });
  }

  if (template === "hr-handover-created") {
    const href = secureHrEmailLink(emailPayload, baseUrl);
    return brandedHrEmail("HR handover requires review", `${greeting}A candidate has accepted an employment offer and requires HR review.`, { label: "Review HR Handover", href });
  }

  if (template === "hr-password-reset") {
    const credentialEnvelope = emailPayload?.credentialEnvelope;
    if (typeof credentialEnvelope !== "string") throw new Error("Password reset code payload is invalid.");
    const code = unsealHrCredential(credentialEnvelope);
    if (!/^\d{6}$/.test(code)) throw new Error("Password reset code payload is invalid.");
    return brandedHrEmail("Your Zentric HR password reset code", `${greeting}Use this verification code to reset your Zentric HR password:\n\n${code}\n\nThis code expires in 10 minutes and can only be used once. If you did not request a password reset, ignore this message.`, { label: "Return to Password Reset", href: `${baseUrl}/hr/password-reset` });
  }

  if (template === "hr-password-reset-complete") {
    const href = secureHrEmailLink({ href: "/hr/login" }, baseUrl);
    return brandedHrEmail("Your Zentric HR password was changed", `${greeting}Your HR password was successfully changed and all existing HR sessions were signed out.\n\nIf you did not make this change, contact Zentric Analytics HR or Security immediately.`, { label: "Sign In to Zentric HR", href });
  }
  const definition = notificationTemplates[template] ?? (template.startsWith("hr-vacancy-") ? vacancyTemplate : null);
  if (!definition) throw new Error(`Unknown HR email template: ${template}`);
  const href = secureHrEmailLink({ href: typeof emailPayload?.href === "string" ? emailPayload.href : definition.defaultHref }, baseUrl);
  return brandedHrEmail(definition.title, `${greeting}${definition.body}`, { label: definition.ctaLabel, href });
}

export function hrEmailBody(template: string, payload: unknown, applicationBaseUrl = process.env.APPLICATION_BASE_URL ?? "") {
  return hrEmailContent(template, payload, applicationBaseUrl).body;
}

async function claimBatch(limit: number, now: Date) {
  return prisma.$transaction(async (tx) => {
    await tx.hrEmailOutbox.updateMany({ where: { status: "PROCESSING", lastAttemptedAt: { lt: new Date(now.getTime() - PROCESSING_TIMEOUT_MS) } }, data: { status: "PENDING", nextAttemptAt: now, lastError: "Recovered after processing timeout." } });
    const candidates = await tx.hrEmailOutbox.findMany({ where: { status: { in: ["PENDING", "FAILED"] }, nextAttemptAt: { lte: now }, attemptCount: { lt: MAX_ATTEMPTS } }, orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }], take: limit });
    const claimed: HrEmailOutbox[] = [];
    for (const candidate of candidates) {
      const result = await tx.hrEmailOutbox.updateMany({ where: { id: candidate.id, status: candidate.status, attemptCount: candidate.attemptCount }, data: { status: "PROCESSING", attemptCount: { increment: 1 }, lastAttemptedAt: now } });
      if (result.count) claimed.push({ ...candidate, status: "PROCESSING", attemptCount: candidate.attemptCount + 1, lastAttemptedAt: now });
    }
    return claimed;
  });
}

async function deliver(item: HrEmailOutbox, now: Date) {
  const content = hrEmailContent(item.template, item.payload);
  const result = await sendHiringEmail({
    applicationId: item.id,
    to: item.recipient,
    template: item.template,
    subject: item.subject,
    body: content.body,
    html: content.html,
  });
  const delivered = result.status === "sent";
  const terminal = !delivered && item.attemptCount >= MAX_ATTEMPTS;
  const status = delivered ? "DELIVERED" : terminal ? "ABANDONED" : "FAILED";
  const safeError = delivered ? null : safeWorkerError(result.failureReason);
  await prisma.$transaction(async (tx) => {
    await tx.hrEmailOutbox.update({ where: { id: item.id }, data: {
      status, deliveredAt: delivered ? now : null, nextAttemptAt: delivered || terminal ? now : retryAt(item.attemptCount, now),
      lastError: safeError, provider: result.provider, providerMessageId: result.providerMessageId,
    } });
    await tx.hrEmailDeliveryAttempt.create({ data: { outboxId: item.id, attemptNumber: item.attemptCount, status, provider: result.provider, providerMessageId: result.providerMessageId, safeError: safeError } });
  });
  return status;
}

export async function processHrOutbox(limit = 25, now = new Date()) {
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const claimed = await claimBatch(boundedLimit, now);
  const outcomes = { claimed: claimed.length, delivered: 0, failed: 0, abandoned: 0 };
  for (const item of claimed) {
    try {
      const status = await deliver(item, now);
      if (status === "DELIVERED") outcomes.delivered += 1;
      else if (status === "ABANDONED") outcomes.abandoned += 1;
      else outcomes.failed += 1;
    } catch (error) {
      const terminal = item.attemptCount >= MAX_ATTEMPTS;
      await prisma.$transaction(async (tx) => {
        await tx.hrEmailOutbox.update({ where: { id: item.id }, data: { status: terminal ? "ABANDONED" : "FAILED", nextAttemptAt: terminal ? now : retryAt(item.attemptCount, now), lastError: safeWorkerError(error) } });
        await tx.hrEmailDeliveryAttempt.create({ data: { outboxId: item.id, attemptNumber: item.attemptCount, status: terminal ? "ABANDONED" : "FAILED", safeError: safeWorkerError(error) } });
      });
      if (terminal) outcomes.abandoned += 1; else outcomes.failed += 1;
    }
  }
  return outcomes;
}

export async function processHrOutboxItem(outboxId: string, now = new Date()) {
  const candidate = await prisma.hrEmailOutbox.findFirst({
    where: {
      id: outboxId,
      status: { in: ["PENDING", "FAILED"] },
      nextAttemptAt: { lte: now },
      attemptCount: { lt: MAX_ATTEMPTS },
    },
  });
  if (!candidate) return { claimed: 0, delivered: 0, failed: 0, abandoned: 0 };

  const claimed = await prisma.hrEmailOutbox.updateMany({
    where: {
      id: candidate.id,
      status: candidate.status,
      attemptCount: candidate.attemptCount,
    },
    data: {
      status: "PROCESSING",
      attemptCount: { increment: 1 },
      lastAttemptedAt: now,
    },
  });
  if (claimed.count !== 1) return { claimed: 0, delivered: 0, failed: 0, abandoned: 0 };

  const item = {
    ...candidate,
    status: "PROCESSING" as const,
    attemptCount: candidate.attemptCount + 1,
    lastAttemptedAt: now,
  };
  const outcomes = { claimed: 1, delivered: 0, failed: 0, abandoned: 0 };
  try {
    const status = await deliver(item, now);
    if (status === "DELIVERED") outcomes.delivered = 1;
    else if (status === "ABANDONED") outcomes.abandoned = 1;
    else outcomes.failed = 1;
  } catch (error) {
    const terminal = item.attemptCount >= MAX_ATTEMPTS;
    await prisma.$transaction(async (tx) => {
      await tx.hrEmailOutbox.update({
        where: { id: item.id },
        data: {
          status: terminal ? "ABANDONED" : "FAILED",
          nextAttemptAt: terminal ? now : retryAt(item.attemptCount, now),
          lastError: safeWorkerError(error),
        },
      });
      await tx.hrEmailDeliveryAttempt.create({
        data: {
          outboxId: item.id,
          attemptNumber: item.attemptCount,
          status: terminal ? "ABANDONED" : "FAILED",
          safeError: safeWorkerError(error),
        },
      });
    });
    if (terminal) outcomes.abandoned = 1;
    else outcomes.failed = 1;
  }
  return outcomes;
}
