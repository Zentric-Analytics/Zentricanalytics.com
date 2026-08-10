import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { appendHrAudit } from "../audit";
import { enqueueHrEmail } from "../notifications/outbox";

type Client = Prisma.TransactionClient;

export const interviewInput = z.object({
  organizationId: z.string().cuid(),
  applicationId: z.string().cuid(),
  title: z.string().trim().min(2).max(160),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  timeZone: z.string().trim().min(1).max(80),
  location: z.string().trim().max(300).optional(),
  meetingUrl: z.string().url().max(2048).optional(),
  participantUserIds: z.array(z.string().cuid()).min(1).max(30),
}).refine((value) => value.endsAt > value.startsAt, { path: ["endsAt"], message: "Interview must end after it starts." });

export async function scheduleInterview(
  tx: Client,
  raw: z.input<typeof interviewInput> & { actorUserId: string; actorRole?: string },
) {
  const input = interviewInput.parse(raw);
  const application = await tx.jobApplication.findFirstOrThrow({
    where: { id: input.applicationId, organizationId: input.organizationId },
  });
  const applicant = await tx.applicant.findUniqueOrThrow({ where: { id: application.applicantId } });
  const participants = await tx.hrUser.findMany({
    where: { id: { in: [...new Set(input.participantUserIds)] }, organizationId: input.organizationId, status: "ACTIVE" },
  });
  if (participants.length !== new Set(input.participantUserIds).size) throw new Error("Every interviewer must be an active user in this organization.");
  const interview = await tx.hrInterview.create({
    data: {
      organizationId: input.organizationId,
      applicationId: application.id,
      title: input.title,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timeZone: input.timeZone,
      location: input.location,
      meetingUrl: input.meetingUrl,
      createdById: raw.actorUserId,
      participants: { create: participants.map((user) => ({ userId: user.id, role: "INTERVIEWER" })) },
    },
  });
  if (application.recruitmentStatus === "INTERVIEW_PENDING") {
    await tx.jobApplication.update({
      where: { id: application.id },
      data: { recruitmentStatus: "INTERVIEW_SCHEDULED", version: { increment: 1 } },
    });
  }
  for (const user of participants) {
    await enqueueHrEmail(tx, {
      organizationId: input.organizationId,
      recipient: user.email,
      template: "hr-interview-invitation",
      subject: `Interview assigned: ${input.title}`,
      payload: { interviewId: interview.id, href: `/hr/admin/interviews/${interview.id}` },
      idempotencyKey: `interview-invitation:${interview.id}:${user.id}:${interview.version}`,
    });
  }
  await enqueueHrEmail(tx, {
    organizationId: input.organizationId,
    recipient: applicant.email,
    template: "hr-interview-invitation",
    subject: `Interview invitation: ${input.title}`,
    payload: { interviewId: interview.id, recipientName: applicant.fullName, href: `/track?applicationId=${encodeURIComponent(application.applicationId)}&email=${encodeURIComponent(applicant.email)}` },
    idempotencyKey: `candidate-interview-invitation:${interview.id}:${interview.version}`,
  });
  await appendHrAudit(tx, {
    organizationId: input.organizationId,
    actorUserId: raw.actorUserId,
    actorRole: raw.actorRole,
    entityType: "HrInterview",
    entityId: interview.id,
    action: "hr.recruitment.interview.scheduled",
    newValues: { applicationId: application.id, startsAt: input.startsAt, timeZone: input.timeZone },
    reason: "Interview scheduled",
    correlationId: crypto.randomUUID(),
  });
  return interview;
}

export async function submitInterviewFeedback(
  tx: Client,
  input: {
    organizationId: string;
    interviewId: string;
    interviewerId: string;
    scores: Prisma.InputJsonValue;
    recommendation: string;
    comments?: string;
  },
) {
  const assigned = await tx.hrInterviewParticipant.findFirst({
    where: {
      interviewId: input.interviewId,
      userId: input.interviewerId,
      interview: { organizationId: input.organizationId, status: { in: ["SCHEDULED", "COMPLETED"] } },
    },
  });
  if (!assigned) throw new Error("You are not assigned to this interview.");
  const existing = await tx.hrInterviewFeedback.findUnique({
    where: { interviewId_interviewerId: { interviewId: input.interviewId, interviewerId: input.interviewerId } },
  });
  if (existing?.status === "SUBMITTED") throw new Error("Submitted interview feedback is locked.");
  return tx.hrInterviewFeedback.upsert({
    where: { interviewId_interviewerId: { interviewId: input.interviewId, interviewerId: input.interviewerId } },
    create: { interviewId: input.interviewId, interviewerId: input.interviewerId, scores: input.scores, recommendation: input.recommendation, comments: input.comments, status: "SUBMITTED", submittedAt: new Date() },
    update: { scores: input.scores, recommendation: input.recommendation, comments: input.comments, status: "SUBMITTED", submittedAt: new Date(), version: { increment: 1 } },
  });
}

export async function changeInterview(
  tx: Client,
  input: {
    organizationId: string;
    interviewId: string;
    actorUserId: string;
    actorRole?: string;
    expectedVersion: number;
    action: "RESCHEDULE" | "CANCEL" | "COMPLETE";
    reason: string;
    startsAt?: Date;
    endsAt?: Date;
    timeZone?: string;
  },
) {
  const interview = await tx.hrInterview.findFirstOrThrow({
    where: { id: input.interviewId, organizationId: input.organizationId },
    include: { participants: true },
  });
  const application = await tx.jobApplication.findFirstOrThrow({ where: { id: interview.applicationId, organizationId: input.organizationId } });
  const applicant = await tx.applicant.findUniqueOrThrow({ where: { id: application.applicantId } });
  if (interview.status === "CANCELLED") throw new Error("A cancelled interview cannot be changed.");
  if (interview.status === "COMPLETED") throw new Error("A completed interview is locked.");
  if (input.action === "RESCHEDULE") {
    if (!input.startsAt || !input.endsAt || input.endsAt <= input.startsAt) {
      throw new Error("Rescheduling requires a valid start and end time.");
    }
  }
  const status = input.action === "CANCEL" ? "CANCELLED" : input.action === "COMPLETE" ? "COMPLETED" : interview.status;
  const result = await tx.hrInterview.updateMany({
    where: { id: interview.id, organizationId: input.organizationId, version: input.expectedVersion },
    data: {
      status,
      startsAt: input.startsAt ?? interview.startsAt,
      endsAt: input.endsAt ?? interview.endsAt,
      timeZone: input.timeZone ?? interview.timeZone,
      version: { increment: 1 },
    },
  });
  if (result.count !== 1) throw new Error("Interview changed concurrently. Reload and try again.");
  if (input.action === "RESCHEDULE" || input.action === "CANCEL") {
    const template = input.action === "RESCHEDULE" ? "hr-interview-rescheduled" : "hr-interview-cancelled";
    await enqueueHrEmail(tx, {
      organizationId: input.organizationId,
      recipient: applicant.email,
      template,
      subject: input.action === "RESCHEDULE" ? `Interview rescheduled: ${interview.title}` : `Interview cancelled: ${interview.title}`,
      payload: { interviewId: interview.id, recipientName: applicant.fullName, href: `/track?applicationId=${encodeURIComponent(application.applicationId)}&email=${encodeURIComponent(applicant.email)}` },
      idempotencyKey: `candidate-interview-${input.action.toLowerCase()}:${interview.id}:${interview.version + 1}`,
    });
  }
  if (input.action === "COMPLETE") {
    await tx.jobApplication.updateMany({
      where: {
        id: interview.applicationId,
        organizationId: input.organizationId,
        recruitmentStatus: { in: ["INTERVIEW_SCHEDULED", "INTERVIEW_PENDING"] },
      },
      data: { recruitmentStatus: "INTERVIEW_COMPLETED", version: { increment: 1 } },
    });
  }
  await appendHrAudit(tx, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    entityType: "HrInterview",
    entityId: interview.id,
    action: `hr.recruitment.interview.${input.action.toLowerCase()}`,
    previousValues: { status: interview.status, startsAt: interview.startsAt, version: interview.version },
    newValues: { status, startsAt: input.startsAt ?? interview.startsAt, version: interview.version + 1 },
    reason: input.reason,
    correlationId: crypto.randomUUID(),
  });
}

export async function saveInterviewFeedback(
  tx: Client,
  input: {
    organizationId: string;
    interviewId: string;
    interviewerId: string;
    scores: Prisma.InputJsonValue;
    recommendation?: string;
    comments?: string;
  },
) {
  const assigned = await tx.hrInterviewParticipant.findFirst({
    where: {
      interviewId: input.interviewId,
      userId: input.interviewerId,
      interview: { organizationId: input.organizationId, status: "SCHEDULED" },
    },
  });
  if (!assigned) throw new Error("You are not assigned to this active interview.");
  const existing = await tx.hrInterviewFeedback.findUnique({
    where: { interviewId_interviewerId: { interviewId: input.interviewId, interviewerId: input.interviewerId } },
  });
  if (existing?.status === "SUBMITTED") throw new Error("Submitted interview feedback is locked.");
  return tx.hrInterviewFeedback.upsert({
    where: { interviewId_interviewerId: { interviewId: input.interviewId, interviewerId: input.interviewerId } },
    create: { interviewId: input.interviewId, interviewerId: input.interviewerId, scores: input.scores, recommendation: input.recommendation, comments: input.comments, status: "DRAFT" },
    update: { scores: input.scores, recommendation: input.recommendation, comments: input.comments, version: { increment: 1 } },
  });
}
