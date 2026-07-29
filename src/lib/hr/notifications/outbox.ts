import type { Prisma, PrismaClient } from "@prisma/client";

type OutboxClient = PrismaClient | Prisma.TransactionClient;
const forbiddenPayloadKey = /password|token|salary|bank|account|identity/i;

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
  return client.hrEmailOutbox.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    update: {},
    create: { ...input, payload: input.payload as Prisma.InputJsonValue },
  });
}
