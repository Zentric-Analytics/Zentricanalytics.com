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
