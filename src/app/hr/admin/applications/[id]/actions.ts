"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { scheduleInterview } from "@/lib/hr/recruitment/interviews";
import { transitionApplication } from "@/lib/hr/recruitment/applications";
import { prisma } from "@/lib/prisma";

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
