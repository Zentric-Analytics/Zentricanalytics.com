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

type HrEmailPayload = { credentialEnvelope?: unknown; href?: unknown } | null;
type HrEmailContent = { body: string; html: string };

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
  if (template === "hr-account-invitation" || template === "hr-password-reset") {
    if (!/^https:\/\//.test(baseUrl)) throw new Error("APPLICATION_BASE_URL must be HTTPS for credential email delivery.");
    const credentialEnvelope = emailPayload?.credentialEnvelope;
    if (typeof credentialEnvelope !== "string") throw new Error("Credential email payload is invalid.");
    const token = unsealHrCredential(credentialEnvelope);
    const destination = template === "hr-account-invitation" ? "invitation" : "password-reset";
    const action = destination === "invitation" ? "set up your HR account" : "reset your HR password";
    const href = `${baseUrl}/hr/${destination}/redeem#token=${encodeURIComponent(token)}`;
    return brandedHrEmail(`Zentric HR: ${destination === "invitation" ? "Account setup" : "Password reset"}`, `Use the secure one-time link below to ${action}.\n\nThis link is time-limited and single-use. Do not forward it.`, { label: destination === "invitation" ? "Set Up Account" : "Reset Password", href });
  }

  if (template === "hr-offer-issued") {
    const href = secureHrEmailLink(emailPayload, baseUrl);
    return brandedHrEmail("Your employment offer is ready", "Your employment offer is ready for review.\n\nReview the exact approved offer and accept or decline it securely.", { label: "Review & Accept Offer", href });
  }

  if (template === "hr-handover-created") {
    const href = secureHrEmailLink(emailPayload, baseUrl);
    return brandedHrEmail("HR handover requires review", "A candidate has accepted an employment offer and requires HR review.", { label: "Review HR Handover", href });
  }

  return brandedHrEmail("Zentric HRMS notification", "You have a new HRMS notification. Sign in to the secure Zentric HR portal to review it. Do not reply with confidential information.");
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
