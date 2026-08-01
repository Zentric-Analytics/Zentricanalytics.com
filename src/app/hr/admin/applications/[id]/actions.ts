"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { createAssessment, updateAssessment } from "@/lib/hr/recruitment/assessments";
import { changeInterview, saveInterviewFeedback, scheduleInterview, submitInterviewFeedback } from "@/lib/hr/recruitment/interviews";
import { approveOffer, createOffer, issueOffer, submitOfferForApproval } from "@/lib/hr/recruitment/offers";
import { transitionApplication } from "@/lib/hr/recruitment/applications";
import { prisma } from "@/lib/prisma";

export type RecruitmentActionState = { status: "idle" | "success" | "error"; message?: string };
const success = (message: string): RecruitmentActionState => ({ status: "success", message });
const failure = (error: unknown): RecruitmentActionState => ({
  status: "error",
  message: error instanceof Error && error.message ? error.message : "The action could not be completed.",
});

const transitionPermission = {
  UNDER_REVIEW: "application.review",
  INFORMATION_REQUESTED: "application.request_information",
  SHORTLISTED: "application.shortlist",
  ON_HOLD: "application.hold",
  REJECTED: "application.reject",
  INTERVIEW_PENDING: "interview.schedule",
  FINAL_REVIEW: "application.review",
  WITHDRAWN: "application.review",
} as const;

export async function transitionApplicationAction(formData: FormData) {
  const input = z.object({
    applicationId: z.string().cuid(),
    expectedVersion: z.coerce.number().int().positive(),
    to: z.enum(["UNDER_REVIEW","INFORMATION_REQUESTED","SHORTLISTED","ON_HOLD","REJECTED","INTERVIEW_PENDING","FINAL_REVIEW","WITHDRAWN"]),
    reason: z.string().trim().min(3).max(1000),
  }).parse(Object.fromEntries(formData));
  const auth = await requirePermission(transitionPermission[input.to]);
  await prisma.$transaction((tx) => transitionApplication(tx, {
    ...input,
    organizationId: auth.user.organizationId,
    actorUserId: auth.user.id,
    actorRole: auth.roles[0],
  }));
  revalidatePath(`/hr/admin/applications/${input.applicationId}`);
  revalidatePath("/hr/admin/recruitment");
}

export async function transitionApplicationWithStateAction(
  _state: RecruitmentActionState,
  formData: FormData,
): Promise<RecruitmentActionState> {
  try {
    await transitionApplicationAction(formData);
    return success("Application updated.");
  } catch (error) {
    return failure(error);
  }
}

export async function scheduleInterviewAction(formData: FormData) {
  const input = z.object({
    applicationId: z.string().cuid(),
    title: z.string().trim().min(2),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    timeZone: z.string().trim().min(1),
    location: z.string().trim().optional(),
    meetingUrl: z.string().trim().optional(),
    participantUserIds: z.array(z.string().cuid()).min(1),
  }).parse({ ...Object.fromEntries(formData), participantUserIds: formData.getAll("participantUserIds") });
  const auth = await requirePermission("interview.schedule");
  await prisma.$transaction((tx) => scheduleInterview(tx, {
    ...input,
    meetingUrl: input.meetingUrl || undefined,
    organizationId: auth.user.organizationId,
    actorUserId: auth.user.id,
    actorRole: auth.roles[0],
  }));
  revalidatePath(`/hr/admin/applications/${input.applicationId}`);
}

export async function scheduleInterviewWithStateAction(
  _state: RecruitmentActionState,
  formData: FormData,
): Promise<RecruitmentActionState> {
  try {
    await scheduleInterviewAction(formData);
    return success("Interview scheduled and invitations queued.");
  } catch (error) {
    return failure(error);
  }
}

export async function manageInterviewWithStateAction(
  _state: RecruitmentActionState,
  formData: FormData,
): Promise<RecruitmentActionState> {
  try {
    const input = z.object({
      interviewId: z.string().cuid(),
      applicationId: z.string().cuid(),
      expectedVersion: z.coerce.number().int().positive(),
      action: z.enum(["RESCHEDULE", "CANCEL", "COMPLETE"]),
      reason: z.string().trim().min(3).max(1000),
      startsAt: z.string().optional(),
      endsAt: z.string().optional(),
      timeZone: z.string().optional(),
    }).parse(Object.fromEntries(formData));
    const permission = input.action === "RESCHEDULE" ? "interview.reschedule" : input.action === "CANCEL" ? "interview.cancel" : "interview.schedule";
    const auth = await requirePermission(permission);
    await prisma.$transaction((tx) => changeInterview(tx, {
      ...input,
      startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
      endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      organizationId: auth.user.organizationId,
      actorUserId: auth.user.id,
      actorRole: auth.roles[0],
    }));
    revalidatePath(`/hr/admin/applications/${input.applicationId}`);
    return success(`Interview ${input.action.toLowerCase()} completed.`);
  } catch (error) {
    return failure(error);
  }
}

export async function feedbackWithStateAction(
  _state: RecruitmentActionState,
  formData: FormData,
): Promise<RecruitmentActionState> {
  try {
    const input = z.object({
      interviewId: z.string().cuid(),
      applicationId: z.string().cuid(),
      mode: z.enum(["DRAFT", "SUBMIT"]),
      score: z.coerce.number().min(0).max(100),
      recommendation: z.string().trim().min(2).max(160),
      comments: z.string().trim().max(5000).optional(),
    }).parse(Object.fromEntries(formData));
    const auth = await requirePermission("interview.feedback.submit");
    const payload = {
      organizationId: auth.user.organizationId,
      interviewId: input.interviewId,
      interviewerId: auth.user.id,
      scores: { overall: input.score },
      recommendation: input.recommendation,
      comments: input.comments,
    };
    await prisma.$transaction((tx) => input.mode === "SUBMIT"
      ? submitInterviewFeedback(tx, payload)
      : saveInterviewFeedback(tx, payload));
    revalidatePath(`/hr/admin/applications/${input.applicationId}`);
    return success(input.mode === "SUBMIT" ? "Feedback submitted and locked." : "Feedback draft saved.");
  } catch (error) {
    return failure(error);
  }
}

export async function createAssessmentWithStateAction(
  _state: RecruitmentActionState,
  formData: FormData,
): Promise<RecruitmentActionState> {
  try {
    const input = z.object({
      applicationId: z.string().cuid(),
      assessmentType: z.string().trim().min(2),
      instructions: z.string().trim().min(3),
      evaluatorId: z.string().cuid(),
      dueAt: z.string().optional(),
    }).parse(Object.fromEntries(formData));
    const auth = await requirePermission("assessment.create");
    await prisma.$transaction((tx) => createAssessment(tx, {
      ...input,
      dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
      organizationId: auth.user.organizationId,
      actorUserId: auth.user.id,
      actorRole: auth.roles[0],
    }));
    revalidatePath(`/hr/admin/applications/${input.applicationId}`);
    return success("Assessment created and evaluator notified.");
  } catch (error) {
    return failure(error);
  }
}

export async function evaluateAssessmentWithStateAction(
  _state: RecruitmentActionState,
  formData: FormData,
): Promise<RecruitmentActionState> {
  try {
    const input = z.object({
      assessmentId: z.string().cuid(),
      applicationId: z.string().cuid(),
      expectedVersion: z.coerce.number().int().positive(),
      to: z.enum(["IN_PROGRESS", "COMPLETED", "CANCELLED"]),
      score: z.coerce.number().min(0).max(100).optional(),
      outcome: z.string().trim().max(160).optional(),
      comments: z.string().trim().max(5000).optional(),
    }).parse(Object.fromEntries(formData));
    const auth = await requirePermission("assessment.evaluate");
    await prisma.$transaction((tx) => updateAssessment(tx, {
      ...input,
      organizationId: auth.user.organizationId,
      actorUserId: auth.user.id,
      actorRole: auth.roles[0],
    }));
    revalidatePath(`/hr/admin/applications/${input.applicationId}`);
    return success("Assessment updated.");
  } catch (error) {
    return failure(error);
  }
}

export async function createOfferWithStateAction(
  _state: RecruitmentActionState,
  formData: FormData,
): Promise<RecruitmentActionState> {
  try {
    const raw = Object.fromEntries(formData);
    const input = z.object({
      applicationId: z.string().cuid(),
      positionId: z.string().cuid().optional().or(z.literal("")),
      positionTitle: z.string().trim().min(2),
      departmentId: z.string().cuid(),
      managerId: z.string().cuid().optional().or(z.literal("")),
      legalEntityId: z.string().cuid(),
      employmentType: z.string().trim().min(1),
      gradeId: z.string().cuid().optional().or(z.literal("")),
      salary: z.coerce.number().positive(),
      currency: z.string().trim().length(3),
      payFrequency: z.string().trim().min(1),
      location: z.string().trim().optional(),
      workMode: z.string().trim().min(1),
      startDate: z.coerce.date(),
      probationPeriod: z.string().trim().optional(),
      contractType: z.string().trim().min(1),
      expiresAt: z.coerce.date(),
      terms: z.string().trim().min(3),
    }).parse(raw);
    const auth = await requirePermission("offer.create");
    await prisma.$transaction((tx) => createOffer(tx, {
      ...input,
      positionId: input.positionId || undefined,
      managerId: input.managerId || undefined,
      gradeId: input.gradeId || undefined,
      allowances: {},
      benefits: {},
      terms: { text: input.terms },
      organizationId: auth.user.organizationId,
      actorUserId: auth.user.id,
      actorRole: auth.roles[0],
    }));
    revalidatePath(`/hr/admin/applications/${input.applicationId}`);
    return success("Immutable offer version created.");
  } catch (error) {
    return failure(error);
  }
}

export async function manageOfferWithStateAction(
  _state: RecruitmentActionState,
  formData: FormData,
): Promise<RecruitmentActionState> {
  try {
    const input = z.object({
      offerId: z.string().cuid(),
      applicationId: z.string().cuid(),
      expectedVersion: z.coerce.number().int().positive(),
      operation: z.enum(["SUBMIT", "APPROVE", "ISSUE"]),
      reason: z.string().trim().min(3).max(1000),
    }).parse(Object.fromEntries(formData));
    const permission = input.operation === "SUBMIT" ? "offer.submit" : input.operation === "APPROVE" ? "offer.approve" : "offer.issue";
    const auth = await requirePermission(permission);
    await prisma.$transaction(async (tx) => {
      if (input.operation === "SUBMIT") {
        await submitOfferForApproval(tx, {
          ...input, organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0],
        });
      } else if (input.operation === "APPROVE") {
        await approveOffer(tx, {
          organizationId: auth.user.organizationId, offerId: input.offerId, actorUserId: auth.user.id,
          actorRole: auth.roles[0], comments: input.reason, expectedVersion: input.expectedVersion,
        });
      } else {
        const application = await tx.jobApplication.findFirstOrThrow({
          where: { id: input.applicationId, organizationId: auth.user.organizationId },
          include: { applicant: true },
        });
        await issueOffer(tx, {
          organizationId: auth.user.organizationId, offerId: input.offerId, actorUserId: auth.user.id,
          actorRole: auth.roles[0], recipient: application.applicant.email,
        });
      }
    });
    revalidatePath(`/hr/admin/applications/${input.applicationId}`);
    return success(`Offer ${input.operation.toLowerCase()} completed.`);
  } catch (error) {
    return failure(error);
  }
}
