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

export function hrEmailBody(template: string, payload: unknown, applicationBaseUrl = process.env.APPLICATION_BASE_URL ?? "") {
  const baseUrl = String(applicationBaseUrl).replace(/\/+$/, "");
  if (template !== "hr-account-invitation" && template !== "hr-password-reset") {
    return "You have a new HRMS notification. Sign in to the secure Zentric HR portal to review it. Do not reply with confidential information.";
  }
  if (!/^https:\/\//.test(baseUrl)) throw new Error("APPLICATION_BASE_URL must be HTTPS for credential email delivery.");
  const credentialEnvelope = (payload as { credentialEnvelope?: unknown } | null)?.credentialEnvelope;
  if (typeof credentialEnvelope !== "string") throw new Error("Credential email payload is invalid.");
  const token = unsealHrCredential(credentialEnvelope);
  const destination = template === "hr-account-invitation" ? "invitation" : "password-reset";
  return `Use the secure one-time link below to ${destination === "invitation" ? "set up your HR account" : "reset your HR password"}.\n\n${baseUrl}/hr/${destination}/redeem#token=${encodeURIComponent(token)}\n\nThis link is time-limited and single-use. Do not forward it.`;
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
  const body = hrEmailBody(item.template, item.payload);
  const result = await sendHiringEmail({
    applicationId: item.id,
    to: item.recipient,
    template: item.template,
    subject: item.subject,
    body,
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
