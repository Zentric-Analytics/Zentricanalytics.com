import crypto from "node:crypto";
import type { HrProbationRecommendation, HrSeparationType, Prisma } from "@prisma/client";
import { appendHrAudit } from "@/lib/hr/audit";
import { enqueueHrEmail } from "@/lib/hr/notifications/outbox";
import { assertContractActivation, assertContractVersionDecision, assertProbationDecision, assertRehire, assertSeparationExecution, assertSeparationTransition } from "./employment-lifecycles";

type Context = { organizationId: string; actorUserId: string; actorRole?: string };

async function notifyEmployee(tx: Prisma.TransactionClient, context: Context, employeeId: string, input: { template: string; subject: string; href: string; idempotencyKey: string }) {
  const employee = await tx.hrEmployee.findFirstOrThrow({ where: { id: employeeId, organizationId: context.organizationId } });
  const recipient = employee.preferredNotificationEmail ?? employee.companyEmail ?? employee.personalEmail;
  if (recipient) await enqueueHrEmail(tx, { organizationId: context.organizationId, recipient, template: input.template, subject: input.subject, payload: { recipientName: employee.preferredName ?? employee.legalFirstName, href: input.href }, idempotencyKey: input.idempotencyKey });
}

export async function createProbationCase(tx: Prisma.TransactionClient, context: Context, input: { employeeId: string; startedAt: Date; scheduledEndAt: Date; objectives: Prisma.InputJsonValue }) {
  await tx.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: context.organizationId, employmentStatus: { in: ["ACTIVE", "ONBOARDING"] } } });
  if (input.scheduledEndAt <= input.startedAt) throw new Error("Probation must end after it starts.");
  const existing = await tx.hrProbationCase.findFirst({ where: { organizationId: context.organizationId, employeeId: input.employeeId, status: { in: ["ACTIVE", "UNDER_REVIEW", "EXTENDED"] } } });
  if (existing) return existing;
  const configuredDurationDays = Math.ceil((input.scheduledEndAt.getTime() - input.startedAt.getTime()) / 86_400_000);
  const probation = await tx.hrProbationCase.create({ data: { organizationId: context.organizationId, employeeId: input.employeeId, startedAt: input.startedAt, scheduledEndAt: input.scheduledEndAt, configuredDurationDays, objectives: input.objectives, createdById: context.actorUserId } });
  await appendHrAudit(tx, { ...context, entityType: "HrProbationCase", entityId: probation.id, action: "hr.probation.created", newValues: { status: probation.status, scheduledEndAt: probation.scheduledEndAt, configuredDurationDays } });
  return probation;
}

export async function submitProbationReview(tx: Prisma.TransactionClient, context: Context, input: { probationCaseId: string; type: "CHECKPOINT" | "FINAL"; checkpointAt: Date; employeeComment?: string; managerComment: string; recommendation: HrProbationRecommendation }) {
  const probation = await tx.hrProbationCase.findFirstOrThrow({ where: { id: input.probationCaseId, organizationId: context.organizationId, status: { in: ["ACTIVE", "UNDER_REVIEW", "EXTENDED"] } } });
  const review = await tx.hrProbationReview.create({ data: { probationCaseId: probation.id, type: input.type, checkpointAt: input.checkpointAt, employeeComment: input.employeeComment, managerComment: input.managerComment, recommendation: input.recommendation, managerUserId: context.actorUserId, submittedAt: new Date() } });
  if (input.type === "FINAL") await tx.hrProbationCase.update({ where: { id: probation.id }, data: { status: "UNDER_REVIEW", version: { increment: 1 } } });
  await appendHrAudit(tx, { ...context, entityType: "HrProbationReview", entityId: review.id, action: "hr.probation.review_submitted", newValues: { probationCaseId: probation.id, type: review.type, recommendation: review.recommendation, checkpointAt: review.checkpointAt } });
  return review;
}

export async function decideProbationCase(tx: Prisma.TransactionClient, context: Context, input: { probationCaseId: string; expectedVersion: number; outcome: "CONFIRM" | "EXTEND" | "END_EMPLOYMENT"; reason: string; extensionEndAt?: Date }) {
  const probation = await tx.hrProbationCase.findFirstOrThrow({ where: { id: input.probationCaseId, organizationId: context.organizationId }, include: { employee: { include: { user: true } }, reviews: { where: { type: "FINAL", submittedAt: { not: null } }, orderBy: { submittedAt: "desc" }, take: 1 } } });
  if (probation.version !== input.expectedVersion) throw new Error("This probation case changed while it was being decided.");
  const finalReview = probation.reviews[0];
  assertProbationDecision({ actorUserId: context.actorUserId, employeeUserId: probation.employee.userId, finalReviewSubmitted: Boolean(finalReview), finalReviewSubmittedById: finalReview?.managerUserId, recommendation: finalReview?.recommendation, outcome: input.outcome, currentEndAt: probation.scheduledEndAt, extensionEndAt: input.extensionEndAt, extensionCount: probation.extensionCount });
  const status = input.outcome === "CONFIRM" ? "CONFIRMED" : input.outcome === "EXTEND" ? "EXTENDED" : "UNSUCCESSFUL";
  const result = await tx.hrProbationCase.updateMany({ where: { id: probation.id, organizationId: context.organizationId, version: input.expectedVersion }, data: { status, version: { increment: 1 }, scheduledEndAt: input.extensionEndAt ?? probation.scheduledEndAt, extensionCount: input.outcome === "EXTEND" ? { increment: 1 } : undefined, confirmedAt: input.outcome === "CONFIRM" ? new Date() : null, unsuccessfulAt: input.outcome === "END_EMPLOYMENT" ? new Date() : null, decisionReason: input.reason, decidedById: context.actorUserId } });
  if (result.count !== 1) throw new Error("Another reviewer already decided this probation case.");
  if (input.outcome === "CONFIRM") await tx.hrEmployee.update({ where: { id: probation.employeeId }, data: { confirmationDate: new Date() } });
  await appendHrAudit(tx, { ...context, entityType: "HrProbationCase", entityId: probation.id, action: `hr.probation.${status.toLowerCase()}`, previousValues: { status: probation.status, version: probation.version }, newValues: { status, version: probation.version + 1, scheduledEndAt: input.extensionEndAt ?? probation.scheduledEndAt }, reason: input.reason });
  if (input.outcome !== "END_EMPLOYMENT") await notifyEmployee(tx, context, probation.employeeId, { template: input.outcome === "CONFIRM" ? "hr-probation-confirmed" : "hr-probation-extended", subject: input.outcome === "CONFIRM" ? "Employment confirmed" : "Probation period updated", href: "/hr/employee/profile", idempotencyKey: `probation-decision:${probation.id}:v${probation.version + 1}` });
}

export async function createContractVersion(tx: Prisma.TransactionClient, context: Context, input: { employeeId: string; workRelationshipId: string; contractId?: string; effectiveFrom: Date; effectiveTo?: Date; termsSnapshot: Prisma.InputJsonValue; documentVersionId: string }) {
  await tx.hrWorkRelationship.findFirstOrThrow({ where: { id: input.workRelationshipId, organizationId: context.organizationId, employeeId: input.employeeId } });
  if (input.contractId) {
    const contract = await tx.hrEmploymentContract.findFirstOrThrow({ where: { id: input.contractId, organizationId: context.organizationId, employeeId: input.employeeId } });
    const nextVersion = contract.currentVersion + 1;
    const version = await tx.hrEmploymentContractVersion.create({ data: { contractId: contract.id, version: nextVersion, termsSnapshot: input.termsSnapshot, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo, documentVersionId: input.documentVersionId, createdById: context.actorUserId } });
    await tx.hrEmploymentContract.update({ where: { id: contract.id }, data: { currentVersion: nextVersion, status: "PENDING_APPROVAL", effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo } });
    await appendHrAudit(tx, { ...context, entityType: "HrEmploymentContract", entityId: contract.id, action: "hr.contract.version_created", newValues: { version: nextVersion, documentVersionId: input.documentVersionId, effectiveFrom: input.effectiveFrom } });
    return version;
  }
  const contractRef = `CON-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const contract = await tx.hrEmploymentContract.create({ data: { organizationId: context.organizationId, employeeId: input.employeeId, workRelationshipId: input.workRelationshipId, contractRef, status: "PENDING_APPROVAL", effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo, createdById: context.actorUserId, versions: { create: { version: 1, termsSnapshot: input.termsSnapshot, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo, documentVersionId: input.documentVersionId, createdById: context.actorUserId } } } });
  await appendHrAudit(tx, { ...context, entityType: "HrEmploymentContract", entityId: contract.id, action: "hr.contract.created", newValues: { contractRef, version: 1, documentVersionId: input.documentVersionId, effectiveFrom: input.effectiveFrom } });
  await notifyEmployee(tx, context, input.employeeId, { template: "hr-contract-review", subject: "Employment contract ready for review", href: "/hr/employee/documents", idempotencyKey: `contract-review:${contract.id}:v1` });
  return contract;
}

export async function approveContractVersion(tx: Prisma.TransactionClient, context: Context, input: { contractId: string; expectedVersion: number }) {
  const contract = await tx.hrEmploymentContract.findFirstOrThrow({ where: { id: input.contractId, organizationId: context.organizationId }, include: { versions: { where: { version: input.expectedVersion }, take: 1 } } }); const version = contract.versions[0]; if (!version) throw new Error("The contract version does not exist.");
  assertContractVersionDecision({ expectedVersion: input.expectedVersion, actualVersion: contract.currentVersion, createdById: version.createdById, approverId: context.actorUserId, documentVersionId: version.documentVersionId });
  await tx.hrEmploymentContractVersion.update({ where: { contractId_version: { contractId: contract.id, version: input.expectedVersion } }, data: { approvedById: context.actorUserId, approvedAt: new Date() } }); await tx.hrEmploymentContract.update({ where: { id: contract.id }, data: { status: "APPROVED" } });
  await appendHrAudit(tx, { ...context, entityType: "HrEmploymentContract", entityId: contract.id, action: "hr.contract.approved", newValues: { version: input.expectedVersion, documentVersionId: version.documentVersionId } });
}

export async function signContractVersion(tx: Prisma.TransactionClient, context: Context, input: { contractId: string; expectedVersion: number }) { const contract = await tx.hrEmploymentContract.findFirstOrThrow({ where: { id: input.contractId, organizationId: context.organizationId, currentVersion: input.expectedVersion, status: "APPROVED" } }); await tx.hrEmploymentContractVersion.update({ where: { contractId_version: { contractId: contract.id, version: input.expectedVersion } }, data: { signedAt: new Date() } }); await tx.hrEmploymentContract.update({ where: { id: contract.id }, data: { status: contract.effectiveFrom > new Date() ? "SCHEDULED" : "SIGNED" } }); await appendHrAudit(tx, { ...context, entityType: "HrEmploymentContract", entityId: contract.id, action: "hr.contract.signed", newValues: { version: input.expectedVersion } }); }

export async function activateContractVersion(tx: Prisma.TransactionClient, context: Context, contractId: string, now = new Date()) { const contract = await tx.hrEmploymentContract.findFirstOrThrow({ where: { id: contractId, organizationId: context.organizationId } }); const version = await tx.hrEmploymentContractVersion.findUniqueOrThrow({ where: { contractId_version: { contractId: contract.id, version: contract.currentVersion } } }); assertContractActivation({ effectiveFrom: version.effectiveFrom, now, approved: Boolean(version.approvedAt), signed: Boolean(version.signedAt) }); await tx.hrEmploymentContract.updateMany({ where: { organizationId: context.organizationId, employeeId: contract.employeeId, status: "ACTIVE", id: { not: contract.id } }, data: { status: "SUPERSEDED" } }); await tx.hrEmploymentContractVersion.updateMany({ where: { contract: { organizationId: context.organizationId, employeeId: contract.employeeId, status: "SUPERSEDED" }, supersededAt: null }, data: { supersededAt: now } }); await tx.hrEmploymentContract.update({ where: { id: contract.id }, data: { status: "ACTIVE" } }); await appendHrAudit(tx, { ...context, entityType: "HrEmploymentContract", entityId: contract.id, action: "hr.contract.activated", newValues: { version: contract.currentVersion, effectiveFrom: version.effectiveFrom } }); await notifyEmployee(tx, context, contract.employeeId, { template: "hr-contract-active", subject: "Employment contract active", href: "/hr/employee/documents", idempotencyKey: `contract-active:${contract.id}:v${contract.currentVersion}` }); }

export async function rehireEmployee(tx: Prisma.TransactionClient, context: Context, input: { employeeId: string; priorRelationshipId: string; startedAt: Date; reason: string }) { const employee = await tx.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: context.organizationId, employmentStatus: { in: ["TERMINATED", "ARCHIVED"] } } }); const prior = await tx.hrWorkRelationship.findFirstOrThrow({ where: { id: input.priorRelationshipId, organizationId: context.organizationId, employeeId: employee.id } }); const activeRelationshipCount = await tx.hrWorkRelationship.count({ where: { organizationId: context.organizationId, personId: prior.personId, status: { in: ["ACTIVE", "NOTICE_PERIOD", "SUSPENDED"] } } }); assertRehire({ personId: prior.personId, priorRelationshipStatus: prior.status, activeRelationshipCount, rehireOfId: prior.id }); const relationship = await tx.hrWorkRelationship.create({ data: { organizationId: context.organizationId, personId: prior.personId, employeeId: employee.id, relationshipRef: `WR-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, status: "ACTIVE", startedAt: input.startedAt, rehireOfId: prior.id } }); await tx.hrEmployee.update({ where: { id: employee.id }, data: { employmentStatus: "ONBOARDING", hireDate: input.startedAt, startDate: input.startedAt, terminationDate: null, terminationReason: null, archivedAt: null, companyEmailStatus: "PENDING" } }); await tx.hrEmployeeStatusHistory.create({ data: { organizationId: context.organizationId, employeeId: employee.id, previousStatus: employee.employmentStatus, newStatus: "ONBOARDING", effectiveAt: input.startedAt, reason: input.reason, changedById: context.actorUserId } }); await appendHrAudit(tx, { ...context, entityType: "HrWorkRelationship", entityId: relationship.id, action: "hr.employee.rehired", newValues: { personId: prior.personId, priorRelationshipId: prior.id, workRelationshipId: relationship.id, startedAt: input.startedAt }, reason: input.reason }); return relationship; }

export async function createSeparationCase(tx: Prisma.TransactionClient, context: Context, input: { employeeId: string; type: HrSeparationType; reason: string; finalWorkingDate: Date }) {
  const employee = await tx.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: context.organizationId, employmentStatus: { notIn: ["TERMINATED", "ARCHIVED"] } } });
  const relationship = await tx.hrWorkRelationship.findFirstOrThrow({ where: { organizationId: context.organizationId, employeeId: employee.id, status: { in: ["ACTIVE", "NOTICE_PERIOD", "SUSPENDED"] } }, orderBy: { startedAt: "desc" } });
  const open = await tx.hrSeparationCase.findFirst({ where: { organizationId: context.organizationId, employeeId: employee.id, status: { in: ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "SCHEDULED", "FAILED"] } } });
  if (open) throw new Error(`An open separation case (${open.id}) already exists for this employee.`);
  const correlationId = crypto.randomUUID();
  const separation = await tx.hrSeparationCase.create({ data: { organizationId: context.organizationId, employeeId: employee.id, workRelationshipId: relationship.id, type: input.type, status: "SUBMITTED", reason: input.reason, initiatedById: context.actorUserId, noticeDate: new Date(), finalWorkingDate: input.finalWorkingDate, correlationId } });
  await appendHrAudit(tx, { ...context, entityType: "HrSeparationCase", entityId: separation.id, action: "hr.separation.submitted", newValues: { type: separation.type, status: separation.status, finalWorkingDate: separation.finalWorkingDate, workRelationshipId: relationship.id }, reason: input.reason, correlationId });
  await notifyEmployee(tx, context, employee.id, { template: "hr-separation-submitted", subject: "Employment separation submitted", href: "/hr/employee/profile", idempotencyKey: `separation-submitted:${separation.id}` });
  return separation;
}

export async function reviewSeparationCase(tx: Prisma.TransactionClient, context: Context, input: { separationId: string; expectedVersion: number; decision: "APPROVED" | "REJECTED"; reason: string }) {
  const separation = await tx.hrSeparationCase.findFirstOrThrow({ where: { id: input.separationId, organizationId: context.organizationId } });
  if (separation.initiatedById === context.actorUserId) throw new Error("A separation case requires independent review.");
  if (separation.version !== input.expectedVersion) throw new Error("This separation case changed while it was being reviewed.");
  const reviewStatus = separation.status === "SUBMITTED" ? "UNDER_REVIEW" : separation.status;
  if (separation.status === "SUBMITTED") assertSeparationTransition("SUBMITTED", "UNDER_REVIEW");
  assertSeparationTransition(reviewStatus, input.decision);
  const nextStatus = input.decision === "APPROVED" ? "SCHEDULED" : input.decision;
  const result = await tx.hrSeparationCase.updateMany({ where: { id: separation.id, organizationId: context.organizationId, version: input.expectedVersion, status: separation.status }, data: { status: nextStatus, version: { increment: 1 }, approvedById: input.decision === "APPROVED" ? context.actorUserId : null, approvedAt: input.decision === "APPROVED" ? new Date() : null } });
  if (result.count !== 1) throw new Error("This separation case was decided by another reviewer.");
  await appendHrAudit(tx, { ...context, entityType: "HrSeparationCase", entityId: separation.id, action: `hr.separation.${nextStatus.toLowerCase()}`, previousValues: { status: separation.status, version: separation.version }, newValues: { status: nextStatus, version: separation.version + 1 }, reason: input.reason, correlationId: separation.correlationId });
  if (input.decision === "APPROVED") await notifyEmployee(tx, context, separation.employeeId, { template: "hr-separation-approved", subject: "Employment separation approved", href: "/hr/employee/tasks", idempotencyKey: `separation-approved:${separation.id}:v${separation.version + 1}` });
}

export async function applySeparationCase(tx: Prisma.TransactionClient, context: Context, separationId: string, now = new Date()) {
  const separation = await tx.hrSeparationCase.findFirstOrThrow({ where: { id: separationId, organizationId: context.organizationId }, include: { employee: { include: { user: true } } } });
  const lifecycle = await tx.hrLifecycleInstance.findFirst({ where: { organizationId: context.organizationId, employeeId: separation.employeeId, type: "OFFBOARDING", effectiveDate: separation.finalWorkingDate }, include: { tasks: true } });
  const requiredTasksOpen = lifecycle?.tasks.filter((task) => task.required && !["COMPLETED", "SKIPPED"].includes(task.status)).length ?? 1;
  assertSeparationExecution({ finalWorkingDate: separation.finalWorkingDate, now, requiredTasksOpen, status: separation.status });
  const claim = await tx.hrSeparationCase.updateMany({ where: { id: separation.id, version: separation.version, status: separation.status }, data: { status: "APPLIED", version: { increment: 1 }, appliedAt: now, failureReason: null } });
  if (claim.count !== 1) throw new Error("Another worker already applied this separation case.");
  await tx.hrEmployee.update({ where: { id: separation.employeeId }, data: { employmentStatus: "TERMINATED", terminationDate: separation.finalWorkingDate, terminationReason: separation.reason, companyEmailStatus: "DISABLED" } });
  if (lifecycle) await tx.hrLifecycleInstance.update({ where: { id: lifecycle.id }, data: { companyEmailDisabledAt: now } });
  await tx.hrEmployeeStatusHistory.create({ data: { organizationId: context.organizationId, employeeId: separation.employeeId, previousStatus: separation.employee.employmentStatus, newStatus: "TERMINATED", effectiveAt: separation.finalWorkingDate, reason: separation.reason, changedById: context.actorUserId } });
  await tx.hrWorkRelationship.update({ where: { id: separation.workRelationshipId }, data: { status: "ENDED", endedAt: separation.finalWorkingDate, endReason: separation.reason } });
  await tx.hrEmployeeAssignment.updateMany({ where: { employeeId: separation.employeeId, status: "ACTIVE" }, data: { status: "ENDED", effectiveTo: separation.finalWorkingDate, endedAt: now, endedById: context.actorUserId, version: { increment: 1 } } });
  await tx.hrSystemAccessAssignment.updateMany({ where: { employeeId: separation.employeeId, status: { in: ["REQUESTED", "ACTIVE", "SUSPENDED"] } }, data: { status: "REVOKED", endedAt: separation.finalWorkingDate, endedById: context.actorUserId, endReason: `Employment ended: ${separation.reason}` } });
  if (separation.employee.userId) {
    await tx.hrSession.updateMany({ where: { userId: separation.employee.userId, revokedAt: null }, data: { revokedAt: now } });
    await tx.hrUser.update({ where: { id: separation.employee.userId }, data: { status: "SUSPENDED", suspendedAt: now } });
  }
  await appendHrAudit(tx, { ...context, entityType: "HrSeparationCase", entityId: separation.id, action: "hr.separation.applied", previousValues: { status: separation.status, employeeStatus: separation.employee.employmentStatus }, newValues: { status: "APPLIED", employeeStatus: "TERMINATED", workRelationshipStatus: "ENDED" }, reason: separation.reason, correlationId: separation.correlationId });
  await notifyEmployee(tx, context, separation.employeeId, { template: "hr-separation-completed", subject: "Employment separation completed", href: "/hr/employee/profile", idempotencyKey: `separation-completed:${separation.id}` });
}
