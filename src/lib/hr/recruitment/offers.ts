import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { appendHrAudit } from "../audit";
import { enqueueHrEmail } from "../notifications/outbox";
import { initializeHandoverRequirements } from "./handover";

type Client = Prisma.TransactionClient;

export const offerVersionInput = z.object({
  positionId: z.string().cuid().optional(),
  positionTitle: z.string().trim().min(2).max(160),
  departmentId: z.string().cuid(),
  managerId: z.string().cuid().optional(),
  legalEntityId: z.string().cuid(),
  employmentType: z.string().trim().min(1).max(40),
  gradeId: z.string().cuid().optional(),
  salary: z.coerce.number().positive(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  payFrequency: z.string().trim().min(1).max(40),
  allowances: z.record(z.string(), z.unknown()).default({}),
  benefits: z.record(z.string(), z.unknown()).default({}),
  location: z.string().trim().max(160).optional(),
  workMode: z.string().trim().min(1).max(40),
  startDate: z.coerce.date(),
  probationPeriod: z.string().trim().max(80).optional(),
  contractType: z.string().trim().min(1).max(80),
  expiresAt: z.coerce.date(),
  terms: z.record(z.string(), z.unknown()).default({}),
}).refine((value) => value.expiresAt > new Date(), { path: ["expiresAt"], message: "Offer expiry must be in the future." });

export async function createOffer(
  tx: Client,
  input: z.input<typeof offerVersionInput> & {
    organizationId: string;
    applicationId: string;
    actorUserId: string;
    actorRole?: string;
  },
) {
  const terms = offerVersionInput.parse(input);
  const application = await tx.jobApplication.findFirstOrThrow({
    where: { id: input.applicationId, organizationId: input.organizationId },
  });
  if (!["FINAL_REVIEW", "OFFER_DRAFT"].includes(application.recruitmentStatus ?? "")) {
    throw new Error("An offer may only be created during final review.");
  }
  const existing = await tx.hrRecruitmentOffer.findUnique({ where: { applicationId: application.id } });
  const nextVersion = existing ? (await tx.hrRecruitmentOfferVersion.count({ where: { offerId: existing.id } })) + 1 : 1;
  if (existing && ["ISSUED", "ACCEPTED"].includes(existing.status)) {
    throw new Error("Issued or accepted offers cannot be edited. Supersede the offer first.");
  }
  const offer = existing ?? await tx.hrRecruitmentOffer.create({
    data: { organizationId: input.organizationId, applicationId: application.id, createdById: input.actorUserId, updatedById: input.actorUserId },
  });
  const version = await tx.hrRecruitmentOfferVersion.create({
    data: {
      offerId: offer.id,
      version: nextVersion,
      ...terms,
      salary: terms.salary,
      allowances: terms.allowances as Prisma.InputJsonValue,
      benefits: terms.benefits as Prisma.InputJsonValue,
      terms: terms.terms as Prisma.InputJsonValue,
      createdById: input.actorUserId,
    },
  });
  await tx.hrRecruitmentOffer.update({
    where: { id: offer.id },
    data: { activeVersionId: version.id, status: "DRAFT", updatedById: input.actorUserId, version: { increment: existing ? 1 : 0 } },
  });
  if (application.recruitmentStatus !== "OFFER_DRAFT") {
    await tx.jobApplication.update({
      where: { id: application.id },
      data: { recruitmentStatus: "OFFER_DRAFT", version: { increment: 1 } },
    });
  }
  await appendHrAudit(tx, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    entityType: "HrRecruitmentOffer",
    entityId: offer.id,
    action: "hr.recruitment.offer.version_created",
    newValues: { offerVersionId: version.id, version: nextVersion },
    reason: "Offer version created",
    correlationId: crypto.randomUUID(),
  });
  return { offer, version };
}

export async function approveOffer(
  tx: Client,
  input: { organizationId: string; offerId: string; actorUserId: string; actorRole?: string; comments?: string; expectedVersion?: number },
) {
  const offer = await tx.hrRecruitmentOffer.findFirstOrThrow({
    where: { id: input.offerId, organizationId: input.organizationId },
  });
  if (!offer.activeVersionId) throw new Error("Offer has no active version.");
  if (input.expectedVersion !== undefined && offer.version !== input.expectedVersion) throw new Error("Offer changed concurrently. Reload and try again.");
  if (offer.createdById === input.actorUserId) throw new Error("Offer creators cannot approve their own offer.");
  if (!["DRAFT", "PENDING_APPROVAL"].includes(offer.status)) throw new Error("Offer is not awaiting approval.");
  await tx.hrRecruitmentOfferApproval.upsert({
    where: { offerVersionId_step: { offerVersionId: offer.activeVersionId, step: 1 } },
    update: {},
    create: { offerId: offer.id, offerVersionId: offer.activeVersionId, step: 1, decision: "APPROVED", approverId: input.actorUserId, comments: input.comments },
  });
  const approved = await tx.hrRecruitmentOffer.update({ where: { id: offer.id }, data: { status: "APPROVED", updatedById: input.actorUserId, version: { increment: 1 } } });
  await appendHrAudit(tx, {
    organizationId: input.organizationId, actorUserId: input.actorUserId, actorRole: input.actorRole,
    entityType: "HrRecruitmentOffer", entityId: offer.id, action: "hr.recruitment.offer.approved",
    previousValues: { status: offer.status }, newValues: { status: "APPROVED", offerVersionId: offer.activeVersionId },
    reason: input.comments ?? "Offer approved", correlationId: crypto.randomUUID(),
  });
  return approved;
}

export async function submitOfferForApproval(
  tx: Client,
  input: { organizationId: string; offerId: string; actorUserId: string; actorRole?: string; reason: string; expectedVersion: number },
) {
  const result = await tx.hrRecruitmentOffer.updateMany({
    where: { id: input.offerId, organizationId: input.organizationId, status: "DRAFT", version: input.expectedVersion, activeVersionId: { not: null } },
    data: { status: "PENDING_APPROVAL", updatedById: input.actorUserId, version: { increment: 1 } },
  });
  if (result.count !== 1) throw new Error("Offer is not a current draft or changed concurrently.");
  const offer = await tx.hrRecruitmentOffer.findUniqueOrThrow({ where: { id: input.offerId } });
  await tx.jobApplication.updateMany({
    where: { id: offer.applicationId, organizationId: input.organizationId },
    data: { recruitmentStatus: "OFFER_PENDING_APPROVAL", version: { increment: 1 } },
  });
  await appendHrAudit(tx, {
    organizationId: input.organizationId, actorUserId: input.actorUserId, actorRole: input.actorRole,
    entityType: "HrRecruitmentOffer", entityId: input.offerId, action: "hr.recruitment.offer.submitted",
    previousValues: { status: "DRAFT", version: input.expectedVersion },
    newValues: { status: "PENDING_APPROVAL", version: input.expectedVersion + 1 },
    reason: input.reason, correlationId: crypto.randomUUID(),
  });
}

export async function issueOffer(
  tx: Client,
  input: { organizationId: string; offerId: string; actorUserId: string; actorRole?: string; recipient: string },
) {
  const offer = await tx.hrRecruitmentOffer.findFirstOrThrow({
    where: { id: input.offerId, organizationId: input.organizationId, status: "APPROVED" },
    include: { activeVersion: true, approvals: true },
  });
  if (!offer.activeVersion || !offer.approvals.some((approval) => approval.offerVersionId === offer.activeVersionId && approval.decision === "APPROVED")) {
    throw new Error("The active offer version is not approved.");
  }
  const activeVersionId = offer.activeVersion.id;
  if (offer.activeVersion.expiresAt <= new Date()) throw new Error("The offer has expired.");
  const application = await tx.jobApplication.findFirstOrThrow({
    where: { id: offer.applicationId, organizationId: input.organizationId },
    select: { applicationId: true, applicant: { select: { fullName: true } } },
  });
  const reviewHref = `/track?applicationId=${encodeURIComponent(application.applicationId)}&email=${encodeURIComponent(input.recipient)}`;
  await tx.hrRecruitmentOfferDelivery.upsert({
    where: { idempotencyKey: `offer-delivery:${offer.id}:${activeVersionId}` },
    update: {},
    create: { offerId: offer.id, offerVersionId: activeVersionId, channel: "EMAIL", idempotencyKey: `offer-delivery:${offer.id}:${activeVersionId}` },
  });
  await enqueueHrEmail(tx, {
    organizationId: input.organizationId,
    recipient: input.recipient,
    template: "hr-offer-issued",
    subject: `Your employment offer: ${offer.activeVersion.positionTitle}`,
    payload: { offerId: offer.id, href: reviewHref, recipientName: application.applicant.fullName },
    idempotencyKey: `offer-issued:${offer.id}:${activeVersionId}`,
  });
  const issued = await tx.hrRecruitmentOffer.update({ where: { id: offer.id }, data: { status: "ISSUED", updatedById: input.actorUserId, version: { increment: 1 } } });
  await tx.jobApplication.updateMany({
    where: { id: offer.applicationId, organizationId: input.organizationId },
    data: { recruitmentStatus: "OFFER_ISSUED", version: { increment: 1 } },
  });
  await appendHrAudit(tx, {
    organizationId: input.organizationId, actorUserId: input.actorUserId, actorRole: input.actorRole,
    entityType: "HrRecruitmentOffer", entityId: offer.id, action: "hr.recruitment.offer.issued",
    previousValues: { status: "APPROVED" }, newValues: { status: "ISSUED", offerVersionId: activeVersionId },
    reason: "Approved exact offer version issued", correlationId: crypto.randomUUID(),
  });
  return issued;
}

export async function acceptOffer(
  tx: Client,
  input: { organizationId: string; offerId: string; applicantId: string; offerVersionId: string; method: string; evidence?: Prisma.InputJsonValue },
  now = new Date(),
) {
  const offer = await tx.hrRecruitmentOffer.findFirstOrThrow({
    where: { id: input.offerId, organizationId: input.organizationId, status: { in: ["ISSUED", "ACCEPTED"] }, activeVersionId: input.offerVersionId },
    include: { activeVersion: true },
  });
  if (!offer.activeVersion || offer.activeVersion.expiresAt <= now) throw new Error("This offer is expired or no longer active.");
  const application = await tx.jobApplication.findFirstOrThrow({ where: { id: offer.applicationId, applicantId: input.applicantId, organizationId: input.organizationId }, include: { applicant: true } });
  const acceptance = await tx.hrRecruitmentOfferAcceptance.upsert({
    where: { offerId: offer.id },
    update: {},
    create: { offerId: offer.id, offerVersionId: input.offerVersionId, applicantId: input.applicantId, method: input.method, evidence: input.evidence },
  });
  if (acceptance.applicantId !== input.applicantId || acceptance.offerVersionId !== input.offerVersionId) {
    throw new Error("This offer was already accepted by a different candidate or version.");
  }
  const vacancy = application.vacancyId ? await tx.hrVacancy.findUnique({ where: { id: application.vacancyId } }) : null;
  if (!vacancy) throw new Error("The application is not linked to a valid vacancy.");
  const handover = await tx.hrRecruitmentHandover.upsert({
    where: { offerAcceptanceId: acceptance.id },
    update: {},
    create: {
      organizationId: input.organizationId,
      applicationId: application.id,
      offerAcceptanceId: acceptance.id,
      assignedHrTeamId: vacancy.responsibleHrTeamId,
      ownerUserId: application.applicationOwnerId,
    },
  });
  await initializeHandoverRequirements(tx, input.organizationId, handover.id);
  if (offer.status !== "ACCEPTED") {
    await tx.hrRecruitmentOffer.update({ where: { id: offer.id }, data: { status: "ACCEPTED", acceptedVersionId: input.offerVersionId, version: { increment: 1 } } });
    await tx.jobApplication.update({ where: { id: application.id }, data: { recruitmentStatus: "OFFER_ACCEPTED", version: { increment: 1 } } });
  }
  await appendHrAudit(tx, {
    organizationId: input.organizationId,
    entityType: "HrRecruitmentOffer",
    entityId: offer.id,
    action: "hr.recruitment.offer.accepted",
    previousValues: { status: "ISSUED" },
    newValues: { status: "ACCEPTED", handoverId: handover.id },
    reason: "Applicant accepted the active offer version",
  });
  await enqueueHrEmail(tx, {
    organizationId: input.organizationId,
    recipient: application.applicant.email,
    template: "hr-offer-accepted",
    subject: "Your offer acceptance is confirmed",
    payload: { offerId: offer.id, recipientName: application.applicant.fullName, href: `/track?applicationId=${encodeURIComponent(application.applicationId)}&email=${encodeURIComponent(application.applicant.email)}` },
    idempotencyKey: `offer-accepted:${offer.id}:${input.offerVersionId}`,
  });
  const hrRecipients = await tx.hrHiringTeamMember.findMany({
    where: { hiringTeamId: handover.assignedHrTeamId, status: "ACTIVE", user: { status: "ACTIVE" } },
    include: { user: true },
  });
  for (const member of hrRecipients) {
    await enqueueHrEmail(tx, {
      organizationId: input.organizationId,
      recipient: member.user.email,
      template: "hr-handover-created",
      subject: "New accepted offer requires HR review",
      payload: { handoverId: handover.id, href: `/hr/admin/handovers/${handover.id}` },
      idempotencyKey: `handover-created:${handover.id}:${member.userId}`,
    });
  }
  return { ...acceptance, handover };
}
