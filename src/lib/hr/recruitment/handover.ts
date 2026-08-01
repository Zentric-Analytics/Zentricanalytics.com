import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { appendHrAudit } from "../audit";
import { enqueueHrEmail } from "../notifications/outbox";
import { assertHandoverTransition, evaluatePreHireEligibility, type HandoverStatus } from "./states";

type Client = Prisma.TransactionClient;

export async function initializeHandoverRequirements(tx: Client, organizationId: string, handoverId: string) {
  let definitions = await tx.hrRecruitmentRequirementDefinition.findMany({
    where: { organizationId, active: true },
    orderBy: { key: "asc" },
  });
  if (!definitions.length) {
    await tx.hrRecruitmentRequirementDefinition.createMany({
      data: [
        { organizationId, key: "IDENTITY", name: "Identity verification", blocking: true, evidenceType: "DOCUMENT" },
        { organizationId, key: "RIGHT_TO_WORK", name: "Right-to-work verification", blocking: true, evidenceType: "DOCUMENT" },
        { organizationId, key: "PAYROLL_DETAILS", name: "Payroll details", blocking: true, evidenceType: "FORM" },
      ],
      skipDuplicates: true,
    });
    definitions = await tx.hrRecruitmentRequirementDefinition.findMany({
      where: { organizationId, active: true },
      orderBy: { key: "asc" },
    });
  }
  await tx.hrRecruitmentRequirement.createMany({
    data: definitions.map((definition) => ({
      handoverId,
      definitionId: definition.id,
      blocking: definition.blocking,
    })),
    skipDuplicates: true,
  });
  return tx.hrRecruitmentRequirement.findMany({ where: { handoverId } });
}

export async function reviewRecruitmentDocument(
  tx: Client,
  input: {
    organizationId: string;
    handoverId: string;
    uploadedDocumentId: string;
    documentVersion: number;
    reviewScope: "HIRING_TEAM" | "HR";
    decision: "VERIFIED" | "REJECTED" | "REPLACEMENT_REQUESTED";
    actorUserId: string;
    reason?: string;
  },
) {
  const handover = await tx.hrRecruitmentHandover.findFirstOrThrow({
    where: { id: input.handoverId, organizationId: input.organizationId },
  });
  await tx.uploadedDocument.findFirstOrThrow({
    where: { id: input.uploadedDocumentId, applicationId: handover.applicationId },
  });
  if (input.decision !== "VERIFIED" && !input.reason?.trim()) throw new Error("A reason is required when a document is not verified.");
  const existingReview = await tx.hrRecruitmentDocumentReview.findUnique({
    where: {
      handoverId_uploadedDocumentId_documentVersion_reviewScope: {
        handoverId: handover.id,
        uploadedDocumentId: input.uploadedDocumentId,
        documentVersion: input.documentVersion,
        reviewScope: input.reviewScope,
      },
    },
  });
  if (existingReview?.replacedById) throw new Error("A newer document version was submitted. Review the latest version.");
  const review = await tx.hrRecruitmentDocumentReview.upsert({
    where: {
      handoverId_uploadedDocumentId_documentVersion_reviewScope: {
        handoverId: handover.id,
        uploadedDocumentId: input.uploadedDocumentId,
        documentVersion: input.documentVersion,
        reviewScope: input.reviewScope,
      },
    },
    create: {
      handoverId: handover.id,
      uploadedDocumentId: input.uploadedDocumentId,
      documentVersion: input.documentVersion,
      reviewScope: input.reviewScope,
      status: input.decision,
      reviewedById: input.actorUserId,
      reason: input.reason,
      reviewedAt: new Date(),
    },
    update: {
      status: input.decision,
      reviewedById: input.actorUserId,
      reason: input.reason,
      reviewedAt: new Date(),
    },
  });
  await appendHrAudit(tx, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    entityType: "HrRecruitmentDocumentReview",
    entityId: review.id,
    action: `hr.recruitment.document.${input.decision.toLowerCase()}`,
    newValues: { reviewScope: input.reviewScope, status: input.decision, documentVersion: input.documentVersion },
    reason: input.reason ?? "Document verified",
    correlationId: crypto.randomUUID(),
  });
  const application = await tx.jobApplication.findFirstOrThrow({ where: { id: handover.applicationId, organizationId: input.organizationId }, include: { applicant: true } });
  const template = input.decision === "VERIFIED" ? "hr-document-available" : input.decision === "REJECTED" ? "hr-document-rejected" : "hr-document-requested";
  await enqueueHrEmail(tx, {
    organizationId: input.organizationId,
    recipient: application.applicant.email,
    template,
    subject: input.decision === "VERIFIED" ? "Your document was approved" : input.decision === "REJECTED" ? "Your document was rejected" : "A replacement document is requested",
    payload: { uploadedDocumentId: input.uploadedDocumentId, documentVersion: input.documentVersion, recipientName: application.applicant.fullName, href: `/track?applicationId=${encodeURIComponent(application.applicationId)}&email=${encodeURIComponent(application.applicant.email)}` },
    idempotencyKey: `recruitment-document-${input.decision.toLowerCase()}:${review.id}:${input.documentVersion}`,
  });
  return review;
}

export async function evaluateHandoverEligibility(tx: Client, organizationId: string, handoverId: string) {
  const handover = await tx.hrRecruitmentHandover.findFirstOrThrow({
    where: { id: handoverId, organizationId },
    include: {
      offerAcceptance: { include: { offer: { include: { acceptedVersion: true } } } },
      requirements: true,
      documentReviews: true,
      conversion: true,
    },
  });
  const acceptedVersion = handover.offerAcceptance.offer.acceptedVersion;
  const documentBlockers = handover.documentReviews.filter((review) =>
    review.reviewScope === "HR" && review.status !== "VERIFIED" && !review.replacedById,
  );
  const base = evaluatePreHireEligibility({
    handoverStatus: handover.status as HandoverStatus,
    acceptedOfferValid: Boolean(acceptedVersion),
    employmentDetailsComplete: Boolean(
      acceptedVersion?.departmentId && acceptedVersion.legalEntityId && acceptedVersion.startDate,
    ),
    employeeAlreadyLinked: Boolean(handover.conversion),
    requiredApprovalsComplete: handover.status === "APPROVED",
    requirements: handover.requirements.map((requirement) => ({
      key: requirement.definitionId,
      blocking: requirement.blocking,
      status: requirement.status as "NOT_STARTED" | "PENDING_SUBMISSION" | "SUBMITTED" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED" | "WAIVED" | "EXPIRED",
    })),
  });
  return {
    eligible: base.eligible && documentBlockers.length === 0,
    blockers: [...base.blockers, ...documentBlockers.map((review) => `document:${review.uploadedDocumentId}:${review.status.toLowerCase()}`)],
  };
}

export async function transitionHandover(
  tx: Client,
  input: {
    organizationId: string;
    handoverId: string;
    actorUserId: string;
    expectedVersion: number;
    to: HandoverStatus;
    reason: string;
  },
) {
  const handover = await tx.hrRecruitmentHandover.findFirstOrThrow({
    where: { id: input.handoverId, organizationId: input.organizationId },
  });
  assertHandoverTransition(handover.status as HandoverStatus, input.to);
  if (input.to === "APPROVED") {
    const requirements = await tx.hrRecruitmentRequirement.findMany({ where: { handoverId: handover.id } });
    const incomplete = requirements.filter((item) => item.blocking && !["VERIFIED", "WAIVED"].includes(item.status));
    if (incomplete.length) throw new Error(`Handover has ${incomplete.length} incomplete blocking requirement(s).`);
    const rejectedDocuments = await tx.hrRecruitmentDocumentReview.count({
      where: { handoverId: handover.id, reviewScope: "HR", status: { not: "VERIFIED" } },
    });
    if (rejectedDocuments) throw new Error("All HR document reviews must be verified before approval.");
  }
  const result = await tx.hrRecruitmentHandover.updateMany({
    where: { id: handover.id, organizationId: input.organizationId, version: input.expectedVersion },
    data: {
      status: input.to,
      version: { increment: 1 },
      approvedAt: input.to === "APPROVED" ? new Date() : handover.approvedAt,
      approvedById: input.to === "APPROVED" ? input.actorUserId : handover.approvedById,
      cancellationReason: input.to === "CANCELLED" ? input.reason : handover.cancellationReason,
    },
  });
  if (result.count !== 1) throw new Error("Handover changed concurrently. Reload and try again.");
  await appendHrAudit(tx, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    entityType: "HrRecruitmentHandover",
    entityId: handover.id,
    action: `hr.recruitment.handover.${input.to.toLowerCase()}`,
    previousValues: { status: handover.status, version: handover.version },
    newValues: { status: input.to, version: handover.version + 1 },
    reason: input.reason,
  });
  return { ...handover, status: input.to, version: handover.version + 1 };
}

export async function updateRecruitmentRequirement(
  tx: Client,
  input: {
    organizationId: string;
    requirementId: string;
    actorUserId: string;
    expectedVersion: number;
    to: "PENDING_SUBMISSION" | "SUBMITTED" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED" | "WAIVED";
    reason: string;
  },
) {
  const requirement = await tx.hrRecruitmentRequirement.findFirstOrThrow({
    where: { id: input.requirementId, handover: { organizationId: input.organizationId } },
  });
  if (input.to === "WAIVED" && !input.reason.trim()) throw new Error("A waiver requires a reason.");
  const result = await tx.hrRecruitmentRequirement.updateMany({
    where: { id: requirement.id, version: input.expectedVersion },
    data: {
      status: input.to,
      evaluatedAt: new Date(),
      evaluatedById: input.actorUserId,
      overrideReason: input.to === "WAIVED" ? input.reason : null,
      version: { increment: 1 },
    },
  });
  if (result.count !== 1) throw new Error("Requirement changed concurrently. Reload and try again.");
  await appendHrAudit(tx, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    entityType: "HrRecruitmentRequirement",
    entityId: requirement.id,
    action: `hr.recruitment.requirement.${input.to.toLowerCase()}`,
    previousValues: { status: requirement.status, version: requirement.version },
    newValues: { status: input.to, version: requirement.version + 1 },
    reason: input.reason,
    correlationId: crypto.randomUUID(),
  });
}

export async function reassignHandoverOwner(
  tx: Client,
  input: {
    organizationId: string;
    handoverId: string;
    actorUserId: string;
    ownerUserId: string;
    expectedVersion: number;
    reason: string;
  },
) {
  await tx.hrUser.findFirstOrThrow({
    where: { id: input.ownerUserId, organizationId: input.organizationId, status: "ACTIVE" },
  });
  const result = await tx.hrRecruitmentHandover.updateMany({
    where: { id: input.handoverId, organizationId: input.organizationId, version: input.expectedVersion },
    data: { ownerUserId: input.ownerUserId, version: { increment: 1 } },
  });
  if (result.count !== 1) throw new Error("Handover changed concurrently. Reload and try again.");
  await appendHrAudit(tx, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    entityType: "HrRecruitmentHandover",
    entityId: input.handoverId,
    action: "hr.recruitment.handover.reassigned",
    newValues: { ownerUserId: input.ownerUserId },
    reason: input.reason,
    correlationId: crypto.randomUUID(),
  });
}
