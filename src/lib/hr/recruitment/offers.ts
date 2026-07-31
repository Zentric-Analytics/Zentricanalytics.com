import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { appendHrAudit } from "../audit";
import { enqueueHrEmail } from "../notifications/outbox";

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
  input: { organizationId: string; offerId: string; actorUserId: string; actorRole?: string; comments?: string },
) {
  const offer = await tx.hrRecruitmentOffer.findFirstOrThrow({
    where: { id: input.offerId, organizationId: input.organizationId },
  });
  if (!offer.activeVersionId) throw new Error("Offer has no active version.");
  if (offer.createdById === input.actorUserId) throw new Error("Offer creators cannot approve their own offer.");
  if (!["DRAFT", "PENDING_APPROVAL"].includes(offer.status)) throw new Error("Offer is not awaiting approval.");
  await tx.hrRecruitmentOfferApproval.upsert({
    where: { offerVersionId_step: { offerVersionId: offer.activeVersionId, step: 1 } },
    update: {},
    create: { offerId: offer.id, offerVersionId: offer.activeVersionId, step: 1, decision: "APPROVED", approverId: input.actorUserId, comments: input.comments },
  });
  return tx.hrRecruitmentOffer.update({ where: { id: offer.id }, data: { status: "APPROVED", updatedById: input.actorUserId, version: { increment: 1 } } });
}

export async function issueOffer(
  tx: Client,
  input: { organizationId: string; offerId: string; actorUserId: string; recipient: string },
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
    payload: { offerId: offer.id, href: `/careers/offers/${offer.id}` },
    idempotencyKey: `offer-issued:${offer.id}:${activeVersionId}`,
  });
  return tx.hrRecruitmentOffer.update({ where: { id: offer.id }, data: { status: "ISSUED", updatedById: input.actorUserId, version: { increment: 1 } } });
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
  const application = await tx.jobApplication.findFirstOrThrow({ where: { id: offer.applicationId, applicantId: input.applicantId, organizationId: input.organizationId } });
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
  return { ...acceptance, handover };
}
