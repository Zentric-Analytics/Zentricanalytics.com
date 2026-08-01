import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { appendHrAudit } from "../audit";
import { enqueueHrEmail } from "../notifications/outbox";

type Client = Prisma.TransactionClient;

export const assessmentInput = z.object({
  organizationId: z.string().cuid(),
  applicationId: z.string().cuid(),
  assessmentType: z.string().trim().min(2).max(120),
  instructions: z.string().trim().min(3).max(10_000),
  evaluatorId: z.string().cuid(),
  dueAt: z.coerce.date().optional(),
});

export async function createAssessment(
  tx: Client,
  raw: z.input<typeof assessmentInput> & { actorUserId: string; actorRole?: string },
) {
  const input = assessmentInput.parse(raw);
  const [application, evaluator] = await Promise.all([
    tx.jobApplication.findFirstOrThrow({
      where: {
        id: input.applicationId,
        organizationId: input.organizationId,
        recruitmentStatus: { in: ["SHORTLISTED", "INTERVIEW_COMPLETED", "ASSESSMENT_PENDING"] },
      },
    }),
    tx.hrUser.findFirstOrThrow({
      where: { id: input.evaluatorId, organizationId: input.organizationId, status: "ACTIVE" },
    }),
  ]);
  const assessment = await tx.hrAssessment.create({
    data: {
      organizationId: input.organizationId,
      applicationId: application.id,
      assessmentType: input.assessmentType,
      instructions: input.instructions,
      evaluatorId: evaluator.id,
      dueAt: input.dueAt,
      createdById: raw.actorUserId,
    },
  });
  const applicant = await tx.applicant.findUniqueOrThrow({ where: { id: application.applicantId } });
  if (application.recruitmentStatus !== "ASSESSMENT_PENDING") {
    await tx.jobApplication.update({
      where: { id: application.id },
      data: { recruitmentStatus: "ASSESSMENT_PENDING", version: { increment: 1 } },
    });
  }
  await enqueueHrEmail(tx, {
    organizationId: input.organizationId,
    recipient: evaluator.email,
    template: "hr-assessment-assigned",
    subject: `Assessment assigned: ${input.assessmentType}`,
    payload: { assessmentId: assessment.id, href: `/hr/admin/applications/${application.id}` },
    idempotencyKey: `assessment-assigned:${assessment.id}:${evaluator.id}`,
  });
  await enqueueHrEmail(tx, {
    organizationId: input.organizationId,
    recipient: applicant.email,
    template: "hr-assessment-assigned",
    subject: `Assessment invitation: ${input.assessmentType}`,
    payload: { assessmentId: assessment.id, recipientName: applicant.fullName, href: `/track?applicationId=${encodeURIComponent(application.applicationId)}&email=${encodeURIComponent(applicant.email)}` },
    idempotencyKey: `candidate-assessment-assigned:${assessment.id}`,
  });
  await appendHrAudit(tx, {
    organizationId: input.organizationId,
    actorUserId: raw.actorUserId,
    actorRole: raw.actorRole,
    entityType: "HrAssessment",
    entityId: assessment.id,
    action: "hr.recruitment.assessment.created",
    newValues: { applicationId: application.id, evaluatorId: evaluator.id, status: "PENDING" },
    reason: "Assessment created",
    correlationId: crypto.randomUUID(),
  });
  return assessment;
}

export async function updateAssessment(
  tx: Client,
  input: {
    organizationId: string;
    assessmentId: string;
    actorUserId: string;
    actorRole?: string;
    expectedVersion: number;
    to: "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    score?: number;
    outcome?: string;
    comments?: string;
  },
) {
  const assessment = await tx.hrAssessment.findFirstOrThrow({
    where: { id: input.assessmentId, organizationId: input.organizationId },
  });
  const allowed: Record<string, string[]> = {
    PENDING: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
    IN_PROGRESS: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
  };
  if (!allowed[assessment.status]?.includes(input.to)) {
    throw new Error(`Assessment cannot transition from ${assessment.status} to ${input.to}.`);
  }
  if (input.to === "COMPLETED") {
    if (input.score === undefined || input.score < 0 || input.score > 100) {
      throw new Error("A completed assessment requires a score between 0 and 100.");
    }
    if (!input.outcome?.trim()) throw new Error("A completed assessment requires an outcome.");
  }
  const result = await tx.hrAssessment.updateMany({
    where: { id: assessment.id, organizationId: input.organizationId, version: input.expectedVersion },
    data: {
      status: input.to,
      score: input.score,
      outcome: input.outcome,
      evidenceKey: input.comments,
      completedAt: input.to === "COMPLETED" ? new Date() : null,
      version: { increment: 1 },
    },
  });
  if (result.count !== 1) throw new Error("Assessment changed concurrently. Reload and try again.");
  if (input.to === "COMPLETED") {
    const remaining = await tx.hrAssessment.count({
      where: { applicationId: assessment.applicationId, status: { notIn: ["COMPLETED", "CANCELLED"] } },
    });
    if (!remaining) {
      await tx.jobApplication.update({
        where: { id: assessment.applicationId },
        data: { recruitmentStatus: "ASSESSMENT_COMPLETED", version: { increment: 1 } },
      });
    }
  }
  await appendHrAudit(tx, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    entityType: "HrAssessment",
    entityId: assessment.id,
    action: `hr.recruitment.assessment.${input.to.toLowerCase()}`,
    previousValues: { status: assessment.status, version: assessment.version },
    newValues: { status: input.to, score: input.score, outcome: input.outcome, version: assessment.version + 1 },
    reason: input.comments ?? input.outcome ?? input.to,
    correlationId: crypto.randomUUID(),
  });
}
