import crypto from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

const sensitivePattern = /password|token|secret|bank|accountnumber|salary|identity|identifier|passport|nationalid|pension|taxid|documentcontent/i;

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sensitivePattern.test(key) ? "[REDACTED]" : sanitize(child)]));
  return value;
}

export function safeAuditValues(values: Record<string, unknown> | undefined) {
  if (!values) return undefined;
  return sanitize(values) as Record<string, unknown>;
}

type AuditClient = PrismaClient | Prisma.TransactionClient;
export async function appendHrAudit(client: AuditClient, input: {
  organizationId: string; actorUserId?: string; actorRole?: string; entityType: string; entityId?: string;
  action: string; previousValues?: Record<string, unknown>; newValues?: Record<string, unknown>; reason?: string;
  ipHash?: string; userAgent?: string; requestId?: string; correlationId?: string;
}) {
  // Callers can carry extra command-context fields at runtime despite TypeScript's
  // structural typing. Persist only audit columns, never spread that context.
  return client.hrAuditEvent.create({ data: {
    organizationId: input.organizationId, actorUserId: input.actorUserId,
    actorRole: input.actorRole, entityType: input.entityType, entityId: input.entityId,
    action: input.action, reason: input.reason, ipHash: input.ipHash,
    userAgent: input.userAgent, requestId: input.requestId,
    previousValues: safeAuditValues(input.previousValues) as Prisma.InputJsonValue | undefined,
    newValues: safeAuditValues(input.newValues) as Prisma.InputJsonValue | undefined,
    correlationId: input.correlationId ?? crypto.randomUUID(),
  } });
}
