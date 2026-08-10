import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { appendHrAudit } from "@/lib/hr/audit";
import { sealHrCredential } from "@/lib/hr/auth/crypto";
import { assertEmployeeMayInitiateProfileChange, profileFieldPolicy } from "./profile-fields";

type Context = { organizationId: string; actorUserId: string; actorRole?: string };

export async function requestProfileChange(tx: Prisma.TransactionClient, context: Context, input: { employeeId: string; fieldKey: string; proposedValue: string; expectedEmployeeUpdatedAt: Date; effectiveAt?: Date; evidenceVersionIds?: string[] }) {
  const policy = assertEmployeeMayInitiateProfileChange(input.fieldKey, false);
  const employee = await tx.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: context.organizationId } });
  if (employee.updatedAt.getTime() !== input.expectedEmployeeUpdatedAt.getTime()) throw new Error("Your employee profile changed. Refresh before submitting this request.");
  if (!input.proposedValue.trim()) throw new Error("A proposed value is required.");
  if (policy.verificationRequired && !input.evidenceVersionIds?.length) throw new Error("Supporting evidence is required for this change.");
  const correlationId = crypto.randomUUID();
  const protectedValue = policy.encrypted || policy.payrollSensitive || policy.securitySensitive;
  const request = await tx.hrProfileChangeRequest.create({ data: {
    organizationId: context.organizationId,
    employeeId: employee.id,
    status: "SUBMITTED",
    fieldKey: input.fieldKey,
    currentValueRedacted: { value: "[CURRENT VALUE RETAINED IN AUTHORITATIVE PROFILE]" },
    proposedValueEncrypted: protectedValue ? sealHrCredential(input.proposedValue.trim()) : null,
    proposedValueRedacted: { value: protectedValue ? "[PROTECTED]" : input.proposedValue.trim() },
    effectiveAt: input.effectiveAt,
    evidenceVersionIds: input.evidenceVersionIds ?? [],
    requestedById: context.actorUserId,
    submittedAt: new Date(),
    correlationId,
  } });
  await appendHrAudit(tx, { ...context, entityType: "HrProfileChangeRequest", entityId: request.id, action: "hr.profile_change.submitted", newValues: { fieldKey: request.fieldKey, version: request.version, effectiveAt: request.effectiveAt, evidenceVersionIds: request.evidenceVersionIds }, reason: "Employee self-service change request", correlationId });
  return request;
}

export async function decideProfileChange(tx: Prisma.TransactionClient, context: Context, input: { requestId: string; expectedVersion: number; decision: "APPROVE" | "REJECT" | "MORE_INFORMATION"; reason: string }) {
  const request = await tx.hrProfileChangeRequest.findFirstOrThrow({ where: { id: input.requestId, organizationId: context.organizationId, status: "SUBMITTED" } });
  if (request.version !== input.expectedVersion) throw new Error("This profile request changed while you were reviewing it. Refresh and review the latest version.");
  if (request.requestedById === context.actorUserId) throw new Error("The requester cannot review their own profile change.");
  const policy = profileFieldPolicy(request.fieldKey);
  if (policy.verificationRequired && !request.evidenceVersionIds.length) throw new Error("The required exact-version evidence is missing.");
  const status = input.decision === "APPROVE" ? "APPROVED" : input.decision === "REJECT" ? "REJECTED" : "MORE_INFORMATION_REQUIRED";
  const updated = await tx.hrProfileChangeRequest.updateMany({ where: { id: request.id, version: input.expectedVersion, status: "SUBMITTED" }, data: { status, reviewedById: context.actorUserId, reviewReason: input.reason, reviewedAt: new Date(), version: { increment: 1 } } });
  if (updated.count !== 1) throw new Error("This profile request changed while the decision was being recorded.");
  await appendHrAudit(tx, { ...context, entityType: "HrProfileChangeRequest", entityId: request.id, action: `hr.profile_change.${status.toLowerCase()}`, previousValues: { status: request.status, version: request.version }, newValues: { status, version: request.version + 1, fieldKey: request.fieldKey, evidenceVersionIds: request.evidenceVersionIds }, reason: input.reason, correlationId: request.correlationId });
}
