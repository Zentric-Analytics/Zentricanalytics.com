import type { Prisma, PrismaClient } from "@prisma/client";

type OutboxClient = PrismaClient | Prisma.TransactionClient;
const forbiddenPayloadKey = /password|token|salary|bank|account|identity/i;
const mandatoryEmailTemplates = new Set(["hr-account-invitation", "hr-password-reset"]);

export function assertSafeOutboxPayload(payload: Record<string, unknown>) {
  const keys = (value: unknown): string[] => value && typeof value === "object" ? Object.entries(value).flatMap(([key, child]) => [key, ...keys(child)]) : [];
  const forbidden = keys(payload).find((key) => forbiddenPayloadKey.test(key));
  if (forbidden) throw new Error(`Sensitive outbox payload key is not allowed: ${forbidden}`);
}

export async function enqueueHrEmail(client: OutboxClient, input: {
  organizationId: string; recipient: string; template: string; subject: string;
  payload: Record<string, unknown>; idempotencyKey: string;
}) {
  assertSafeOutboxPayload(input.payload);
  const recipientUser = await client.hrUser.findFirst({
    where: { organizationId: input.organizationId, email: input.recipient.toLowerCase() },
    select: { id: true },
  });
  const preference = recipientUser ? await client.hrNotificationPreference.findUnique({
    where: { userId_category: { userId: recipientUser.id, category: input.template } },
  }) : null;
  const email = preference?.emailEnabled === false && !mandatoryEmailTemplates.has(input.template) ? null : await client.hrEmailOutbox.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    update: {},
    create: { ...input, payload: input.payload as Prisma.InputJsonValue },
  });
  if (recipientUser && preference?.inAppEnabled !== false) {
    await client.hrNotification.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      update: {},
      create: {
        organizationId: input.organizationId,
        userId: recipientUser.id,
        category: input.template,
        title: input.subject,
        body: "Sign in to the HR workspace to review this update securely.",
        idempotencyKey: input.idempotencyKey,
      },
    });
  }
  return email;
}
