import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { appendHrAudit } from "../audit";
import { enqueueHrEmail } from "../notifications/outbox";
import { initializeHandoverRequirements } from "./handover";
import { assertVacancyCreatorOrDelegate } from "./delegation";

type Client = Prisma.TransactionClient;

export const offerVersionInput = z.object({
  positionId: z.string().cuid(),
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
  const application = await tx.jobApplication.findFirstOrThrow({ where: { id: offer.applicationId, organizationId: input.organizationId } });
  if (!application.vacancyId) throw new Error("Offer must belong to a vacancy before approval.");
  await assertVacancyCreatorOrDelegate(tx, { ...input, vacancyId: application.vacancyId });
  if (!["DRAFT", "PENDING_APPROVAL"].includes(offer.status)) throw new Error("Offer is not awaiting approval.");
  const changed = await tx.hrRecruitmentOffer.updateMany({ where: { id: offer.id, organizationId: input.organizationId, version: offer.version, activeVersionId: offer.activeVersionId, status: offer.status }, data: { status: "APPROVED", updatedById: input.actorUserId, version: { increment: 1 } } });
  if (changed.count !== 1) throw new Error("Offer changed concurrently. Reload and try again.");
  await tx.hrRecruitmentOfferApproval.upsert({
    where: { offerVersionId_step: { offerVersionId: offer.activeVersionId, step: 1 } },
    update: {},
    create: { offerId: offer.id, offerVersionId: offer.activeVersionId, step: 1, decision: "APPROVED", approverId: input.actorUserId, comments: input.comments },
  });
  const approved = { ...offer, status: "APPROVED" as const, version: offer.version + 1, updatedById: input.actorUserId };
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
  input: { organizationId: string; offerId: string; actorUserId: string; actorRole?: string; recipient: string; expectedVersion: number },
) {
  const offer = await tx.hrRecruitmentOffer.findFirstOrThrow({
    where: { id: input.offerId, organizationId: input.organizationId, status: "APPROVED" },
    include: { activeVersion: true, approvals: true },
  });
  if (offer.version !== input.expectedVersion) throw new Error("Offer changed. Reload and review the current offer before sending.");
  if (!offer.activeVersion || !offer.approvals.some((approval) => approval.offerVersionId === offer.activeVersionId && approval.decision === "APPROVED")) {
    throw new Error("The active offer version is not approved.");
  }
  const activeVersionId = offer.activeVersion.id;
  if (offer.activeVersion.expiresAt <= new Date()) throw new Error("The offer has expired.");
  // Claim the exact reviewed version before creating any delivery or outbox entry.
  const changed = await tx.hrRecruitmentOffer.updateMany({
    where: { id: offer.id, organizationId: input.organizationId, status: "APPROVED", version: input.expectedVersion, activeVersionId },
    data: { status: "ISSUED", updatedById: input.actorUserId, version: { increment: 1 } },
  });
  if (changed.count !== 1) throw new Error("Offer changed. Reload and review the current offer before sending.");
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
  const issued = { ...offer, status: "ISSUED", updatedById: input.actorUserId, version: offer.version + 1 };
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
  // Preserve the applicant's existing stage journey using the approved exact version,
  // never a second independently authored offer.
  const stages = await tx.hiringStage.findMany({ where: { applicationId: application.id } });
  if (stages.length) {
    if (![1, 2, 3].every((order) => stages.some((stage) => stage.stageOrder === order && ["Approved", "Completed"].includes(stage.status)))) {
      throw new Error("Complete the initial application, identity and screening stages before accepting the offer.");
    }
    const version = offer.activeVersion;
    const source = `Governed offer version: ${version.id}`;
    const prior = await tx.offer.findUnique({ where: { applicationId: application.id } });
    if (prior && (prior.specialConditions !== source || prior.status !== "Accepted")) throw new Error("A conflicting legacy offer exists. Reconcile it before accepting this offer.");
    if (!prior) await tx.offer.create({ data: {
      applicationId: application.id, roleOffered: version.positionTitle,
      salary: `${version.salary.toString()} ${version.currency}`, startDate: version.startDate,
      workMode: version.workMode, probationPeriod: version.probationPeriod,
      offerExpiryDate: version.expiresAt, specialConditions: source,
      status: "Accepted", candidateDecisionAt: now,
    } });
    await tx.hiringStage.updateMany({ where: { applicationId: application.id, stageOrder: 4, status: { notIn: ["Approved", "Completed"] } }, data: { status: "Approved", approvedAt: now } });
    await tx.hiringStage.updateMany({ where: { applicationId: application.id, stageOrder: 5, status: "Locked" }, data: { status: "Available", unlockedAt: now } });
    // Keep the legacy summary in sync with the accepted exact offer. Include
    // stage five so a replay can correct previously accepted, stale summaries,
    // but never regress later stages or overwrite terminal/review decisions.
    await tx.jobApplication.updateMany({
      where: {
        id: application.id,
        organizationId: input.organizationId,
        currentStageOrder: { lte: 5 },
        status: { in: ["Offer Pending", "Offer Sent", "Agreement Pending"] },
      },
      data: { status: "Agreement Pending", currentStageOrder: 5 },
    });
  }
  if (offer.status !== "ACCEPTED") {
    // Only the transaction that claims this issued version records acceptance history.
    const changed = await tx.hrRecruitmentOffer.updateMany({
      where: { id: offer.id, organizationId: input.organizationId, status: "ISSUED", activeVersionId: input.offerVersionId, version: offer.version },
      data: { status: "ACCEPTED", acceptedVersionId: input.offerVersionId, version: { increment: 1 } },
    });
    if (changed.count !== 1) {
      await tx.hrRecruitmentOffer.findFirstOrThrow({ where: {
        id: offer.id, organizationId: input.organizationId, status: "ACCEPTED",
        activeVersionId: input.offerVersionId, acceptedVersionId: input.offerVersionId,
      } });
    } else {
      await tx.jobApplication.update({ where: { id: application.id }, data: { recruitmentStatus: "OFFER_ACCEPTED", version: { increment: 1 } } });
      await appendHrAudit(tx, {
        organizationId: input.organizationId,
        entityType: "HrRecruitmentOffer",
        entityId: offer.id,
        action: "hr.recruitment.offer.accepted",
        previousValues: { status: "ISSUED" },
        newValues: { status: "ACCEPTED" },
        reason: "Applicant accepted the active offer version",
      });
    }
  }
  await enqueueHrEmail(tx, {
    organizationId: input.organizationId,
    recipient: application.applicant.email,
    template: "hr-offer-accepted",
    subject: "Your offer acceptance is confirmed",
    payload: { offerId: offer.id, recipientName: application.applicant.fullName, href: `/track?applicationId=${encodeURIComponent(application.applicationId)}&email=${encodeURIComponent(application.applicant.email)}` },
    idempotencyKey: `offer-accepted:${offer.id}:${input.offerVersionId}`,
  });
  return { ...acceptance, handover: null };
}

/** Internal creator decision only. Hiring team communicates rejection separately. */
export async function rejectOfferApproval(tx: Client, input: { organizationId: string; offerId: string; actorUserId: string; actorRole?: string; expectedVersion: number; reason: string }) {
  const reason = input.reason.trim();
  if (!reason) throw new Error("An internal rejection reason is required.");
  const offer = await tx.hrRecruitmentOffer.findFirstOrThrow({ where: { id: input.offerId, organizationId: input.organizationId } });
  if (offer.status !== "PENDING_APPROVAL" || !offer.activeVersionId || offer.version !== input.expectedVersion) throw new Error("Offer is not awaiting approval or changed concurrently.");
  const application = await tx.jobApplication.findFirstOrThrow({ where: { id: offer.applicationId, organizationId: input.organizationId, deletedAt: null } });
  if (!application.vacancyId) throw new Error("Offer must belong to a vacancy.");
  const vacancy = await assertVacancyCreatorOrDelegate(tx, { ...input, vacancyId: application.vacancyId });
  const result = await tx.hrRecruitmentOffer.updateMany({ where: { id: offer.id, organizationId: input.organizationId, version: input.expectedVersion, activeVersionId: offer.activeVersionId, status: "PENDING_APPROVAL" }, data: { status: "REJECTED", version: { increment: 1 }, updatedById: input.actorUserId } });
  if (result.count !== 1) throw new Error("Offer changed concurrently. Reload and try again.");
  await tx.hrRecruitmentOfferApproval.create({ data: { offerId: offer.id, offerVersionId: offer.activeVersionId, step: 1, decision: "REJECTED", approverId: input.actorUserId, comments: reason } });
  const now = new Date();
  const members = await tx.hrHiringTeamMember.findMany({ where: { hiringTeamId: vacancy.hiringTeamId, status: "ACTIVE", effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }], user: { organizationId: input.organizationId, status: "ACTIVE" } }, include: { user: true } });
  for (const member of members) await enqueueHrEmail(tx, { organizationId: input.organizationId, recipient: member.user.email, template: "hr-offer-approval-rejected", subject: "Candidate recommendation declined: hiring team action required", payload: { offerId: offer.id, applicationId: application.id, href: `/hr/recruitment/${application.id}` }, idempotencyKey: `offer-approval-rejected:${offer.id}:${offer.activeVersionId}:${member.userId}` });
  await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, actorRole: input.actorRole, entityType: "HrRecruitmentOffer", entityId: offer.id, action: "hr.recruitment.offer.approval_rejected", previousValues: { status: offer.status }, newValues: { status: "REJECTED", offerVersionId: offer.activeVersionId }, reason });
}

/** Call after the signed agreement is approved, inside that approval transaction. */
export async function createApprovedAgreementHandover(tx: Client, input: { organizationId: string; applicationId: string; actorUserId: string; actorRole?: string }) {
  const application = await tx.jobApplication.findFirstOrThrow({ where: { id: input.applicationId, organizationId: input.organizationId } });
  const stage = await tx.hiringStage.findFirst({ where: { applicationId: application.id, stageOrder: 5, status: "Approved" } });
  const agreement = await tx.employmentAgreement.findUnique({ where: { applicationId: application.id } });
  if (!stage || agreement?.status !== "Approved" || !agreement.candidateSubmittedAt) throw new Error("A signed and approved employment agreement is required before HR handover.");
  const offer = await tx.hrRecruitmentOffer.findFirstOrThrow({ where: { applicationId: application.id, organizationId: input.organizationId, status: "ACCEPTED" } });
  const acceptance = await tx.hrRecruitmentOfferAcceptance.findUniqueOrThrow({ where: { offerId: offer.id } });
  if (acceptance.applicantId !== application.applicantId || acceptance.offerVersionId !== offer.acceptedVersionId) throw new Error("Accepted offer version does not match the candidate.");
  const vacancy = application.vacancyId ? await tx.hrVacancy.findFirst({ where: { id: application.vacancyId, organizationId: input.organizationId } }) : null;
  if (!vacancy?.responsibleHrUserId) throw new Error("Assign a named responsible HR person before handover.");
  const hr = await tx.hrUser.findFirstOrThrow({ where: { id: vacancy.responsibleHrUserId, organizationId: input.organizationId, status: "ACTIVE" } });
  const handover = await tx.hrRecruitmentHandover.upsert({ where: { offerAcceptanceId: acceptance.id }, update: {}, create: {
    organizationId: input.organizationId, applicationId: application.id, offerAcceptanceId: acceptance.id,
    assignedHrTeamId: vacancy.responsibleHrTeamId, ownerUserId: hr.id,
  } });
  await initializeHandoverRequirements(tx, input.organizationId, handover.id);
  await enqueueHrEmail(tx, { organizationId: input.organizationId, recipient: hr.email, template: "hr-handover-created", subject: "Approved employment agreement requires onboarding", payload: { handoverId: handover.id, href: `/hr/admin/handovers/${handover.id}` }, idempotencyKey: `handover-created:${handover.id}:${hr.id}` });
  await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, actorRole: input.actorRole, entityType: "HrRecruitmentHandover", entityId: handover.id, action: "hr.recruitment.handover.agreement_approved", reason: "Signed employment agreement approved before onboarding handover", newValues: { applicationId: application.id, ownerUserId: hr.id } });
  return handover;
}
