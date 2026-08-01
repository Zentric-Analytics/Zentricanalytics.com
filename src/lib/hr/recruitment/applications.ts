import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { appendHrAudit } from "../audit";
import { enqueueHrEmail } from "../notifications/outbox";
import { assertApplicationTransition, isVacancyAcceptingApplications, type RecruitmentApplicationStatus } from "./states";

export const applicationSubmissionInput = z.object({
  organizationId: z.string().cuid(),
  vacancyId: z.string().cuid(),
  idempotencyKey: z.string().trim().min(16).max(160),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  middleInitial: z.string().trim().max(4).optional(),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(7).max(32).optional(),
  location: z.string().trim().max(160).optional(),
  workModePreference: z.string().trim().max(32).optional(),
  experienceLevel: z.string().trim().max(80).optional(),
  skills: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
  portfolioUrl: z.string().url().max(2048).optional(),
  message: z.string().trim().max(10_000).optional(),
  answers: z.record(z.string().min(1).max(120), z.unknown()).default({}),
  documentIds: z.array(z.string().cuid()).max(30).default([]),
  privacyConsent: z.literal(true),
});

type RecruitmentClient = Prisma.TransactionClient;

function normalizePhone(value?: string) {
  return value?.replace(/[^\d+]/g, "") || null;
}

async function nextPublicNumber(
  tx: RecruitmentClient,
  organizationId: string,
  kind: "APPLICANT" | "APPLICATION",
  prefix: "APP" | "APL",
  now: Date,
) {
  const year = now.getUTCFullYear();
  const sequence = await tx.hrRecruitmentNumberSequence.upsert({
    where: { organizationId_kind_year: { organizationId, kind, year } },
    create: { organizationId, kind, year, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });
  return `${prefix}-${year}-${String(sequence.lastValue).padStart(6, "0")}`;
}

export async function submitApplication(
  tx: RecruitmentClient,
  rawInput: z.input<typeof applicationSubmissionInput>,
  now = new Date(),
) {
  const input = applicationSubmissionInput.parse(rawInput);
  const existing = await tx.jobApplication.findUnique({ where: { submissionKey: input.idempotencyKey } });
  if (existing) return existing;

  const vacancy = await tx.hrVacancy.findFirstOrThrow({
    where: { id: input.vacancyId, organizationId: input.organizationId },
    include: {
      hiringTeam: { include: { members: { where: { status: "ACTIVE" }, include: { user: true } } } },
      responsibleHrTeam: { include: { members: { where: { status: "ACTIVE" }, include: { user: true } } } },
    },
  });
  if (!isVacancyAcceptingApplications({
    status: vacancy.status,
    opensAt: vacancy.opensAt,
    closesAt: vacancy.applicationDeadline,
    now,
  })) throw new Error("This vacancy is not accepting applications.");
  if (vacancy.filledOpenings >= vacancy.numberOfOpenings) throw new Error("This vacancy has no remaining openings.");

  const normalizedPhone = normalizePhone(input.phone);
  let applicant = await tx.applicant.findFirst({
    where: {
      organizationId: input.organizationId,
      OR: [
        { normalizedEmail: input.email },
        ...(normalizedPhone ? [{ normalizedPhone }] : []),
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  if (!applicant) {
    const applicantNumber = await nextPublicNumber(tx, input.organizationId, "APPLICANT", "APP", now);
    applicant = await tx.applicant.create({
      data: {
        applicantNumber,
        organizationId: input.organizationId,
        normalizedEmail: input.email,
        normalizedPhone,
        fullName: `${input.firstName} ${input.lastName}`,
        firstName: input.firstName,
        middleInitial: input.middleInitial,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        location: input.location,
      },
    });
  } else {
    applicant = await tx.applicant.update({
      where: { id: applicant.id },
      data: {
        normalizedEmail: input.email,
        normalizedPhone,
        fullName: `${input.firstName} ${input.lastName}`,
        firstName: input.firstName,
        middleInitial: input.middleInitial,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        location: input.location,
      },
    });
  }

  const applicationReference = await nextPublicNumber(tx, input.organizationId, "APPLICATION", "APL", now);
  const owner = vacancy.hiringTeam.members.find((member) => member.user.status === "ACTIVE")?.user
    ?? vacancy.responsibleHrTeam.members.find((member) => member.user.status === "ACTIVE")?.user;
  const application = await tx.jobApplication.create({
    data: {
      organizationId: input.organizationId,
      vacancyId: vacancy.id,
      applicationId: applicationReference,
      applicationReference,
      submissionKey: input.idempotencyKey,
      applicantId: applicant.id,
      roleAppliedFor: vacancy.title,
      workModePreference: input.workModePreference,
      experienceLevel: input.experienceLevel,
      skills: input.skills.join(", "),
      portfolioUrl: input.portfolioUrl,
      message: input.message,
      privacyConsent: true,
      status: "Pending Review",
      recruitmentStatus: "PENDING_REVIEW",
      assignedHiringTeamId: vacancy.hiringTeamId,
      applicationOwnerId: owner?.id,
    },
  });
  if (Object.keys(input.answers).length) {
    await tx.hrApplicationAnswer.createMany({
      data: Object.entries(input.answers).map(([questionKey, answer]) => ({
        applicationId: application.id,
        questionKey,
        answer: answer as Prisma.InputJsonValue,
      })),
    });
  }
  const correlationId = crypto.randomUUID();
  await tx.hrApplicationStageHistory.create({
    data: {
      organizationId: input.organizationId,
      applicationId: application.id,
      newState: "PENDING_REVIEW",
      actorType: "APPLICANT",
      reason: "Application submitted",
      source: "PUBLIC_PORTAL",
      correlationId,
    },
  });
  await tx.hrApplicationReviewTask.create({
    data: {
      organizationId: input.organizationId,
      applicationId: application.id,
      hiringTeamId: vacancy.hiringTeamId,
      ownerUserId: owner?.id,
      idempotencyKey: `application-review:${application.id}`,
    },
  });
  await appendHrAudit(tx, {
    organizationId: input.organizationId,
    entityType: "JobApplication",
    entityId: application.id,
    action: "hr.recruitment.application.submitted",
    newValues: { applicationReference, vacancyNumber: vacancy.vacancyNumber, status: "PENDING_REVIEW" },
    reason: "Applicant submitted an application",
    correlationId,
  });
  await enqueueHrEmail(tx, {
    organizationId: input.organizationId,
    recipient: input.email,
    template: "hr-application-confirmation",
    subject: `Application received: ${vacancy.title}`,
    payload: { applicationReference, vacancyNumber: vacancy.vacancyNumber, recipientName: applicant.fullName, href: `/track?applicationId=${encodeURIComponent(application.applicationId)}&email=${encodeURIComponent(input.email)}` },
    idempotencyKey: `application-confirmation:${application.id}`,
  });

  const recipients = [...new Map(
    [...vacancy.hiringTeam.members, ...vacancy.responsibleHrTeam.members]
      .filter((member) => member.user.status === "ACTIVE")
      .map((member) => [member.user.email, member.user]),
  ).values()];
  for (const recipient of recipients) {
    await enqueueHrEmail(tx, {
      organizationId: input.organizationId,
      recipient: recipient.email,
      template: "hr-new-application",
      subject: `New application: ${applicationReference}`,
      payload: { applicationReference, vacancyNumber: vacancy.vacancyNumber, href: `/hr/admin/applications/${application.id}` },
      idempotencyKey: `new-application:${application.id}:${recipient.id}`,
    });
  }
  return application;
}

export async function transitionApplication(
  tx: RecruitmentClient,
  input: {
    organizationId: string;
    applicationId: string;
    actorUserId: string;
    actorRole?: string;
    expectedVersion: number;
    to: RecruitmentApplicationStatus;
    reason: string;
  },
) {
  const application = await tx.jobApplication.findFirstOrThrow({
    where: { id: input.applicationId, organizationId: input.organizationId },
  });
  const from = application.recruitmentStatus as RecruitmentApplicationStatus;
  assertApplicationTransition(from, input.to);
  const result = await tx.jobApplication.updateMany({
    where: { id: application.id, organizationId: input.organizationId, version: input.expectedVersion },
    data: { recruitmentStatus: input.to, version: { increment: 1 } },
  });
  if (result.count !== 1) throw new Error("Application changed concurrently. Reload and try again.");
  const correlationId = crypto.randomUUID();
  await tx.hrApplicationStageHistory.create({
    data: {
      organizationId: input.organizationId,
      applicationId: application.id,
      previousState: from,
      newState: input.to,
      actorId: input.actorUserId,
      actorType: "HR_USER",
      reason: input.reason,
      source: "USER",
      correlationId,
    },
  });
  await appendHrAudit(tx, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    entityType: "JobApplication",
    entityId: application.id,
    action: `hr.recruitment.application.${input.to.toLowerCase()}`,
    previousValues: { status: from, version: application.version },
    newValues: { status: input.to, version: application.version + 1 },
    reason: input.reason,
    correlationId,
  });
  return { ...application, recruitmentStatus: input.to, version: application.version + 1 };
}
