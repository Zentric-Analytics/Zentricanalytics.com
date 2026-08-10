"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import {
  reassignHandoverOwner,
  reviewRecruitmentDocument,
  transitionHandover,
  updateRecruitmentRequirement,
} from "@/lib/hr/recruitment/handover";
import { convertApprovedHandoverToPreHire } from "@/lib/hr/recruitment/prehire";
import { prisma } from "@/lib/prisma";

export type HandoverActionState = { status: "idle" | "success" | "error"; message?: string };
const fail = (error: unknown): HandoverActionState => ({ status: "error", message: error instanceof Error ? error.message : "The handover action failed." });

export async function handoverAction(
  _state: HandoverActionState,
  formData: FormData,
): Promise<HandoverActionState> {
  try {
    const operation = z.enum(["TRANSITION", "REQUIREMENT", "DOCUMENT", "REASSIGN", "CONVERT"]).parse(formData.get("operation"));
    const handoverId = z.string().cuid().parse(formData.get("handoverId"));
    if (operation === "TRANSITION") {
      const input = z.object({
        expectedVersion: z.coerce.number().int().positive(),
        to: z.enum(["IN_REVIEW", "INFORMATION_REQUESTED", "RETURNED_TO_HIRING_TEAM", "APPROVED", "CANCELLED"]),
        reason: z.string().trim().min(3).max(1000),
      }).parse(Object.fromEntries(formData));
      const permission = input.to === "APPROVED" ? "handover.approve" : input.to === "CANCELLED" ? "handover.cancel" : input.to === "RETURNED_TO_HIRING_TEAM" ? "handover.return" : input.to === "INFORMATION_REQUESTED" ? "handover.request_information" : "handover.review";
      const auth = await requirePermission(permission);
      await prisma.$transaction((tx) => transitionHandover(tx, {
        ...input, handoverId, organizationId: auth.user.organizationId, actorUserId: auth.user.id,
      }), { isolationLevel: "Serializable" });
    } else if (operation === "REQUIREMENT") {
      const input = z.object({
        requirementId: z.string().cuid(),
        expectedVersion: z.coerce.number().int().positive(),
        to: z.enum(["PENDING_SUBMISSION", "SUBMITTED", "UNDER_REVIEW", "VERIFIED", "REJECTED", "WAIVED"]),
        reason: z.string().trim().min(3).max(1000),
      }).parse(Object.fromEntries(formData));
      const auth = await requirePermission(input.to === "WAIVED" ? "onboarding.override" : "handover.review");
      await prisma.$transaction((tx) => updateRecruitmentRequirement(tx, {
        ...input, organizationId: auth.user.organizationId, actorUserId: auth.user.id,
      }), { isolationLevel: "Serializable" });
    } else if (operation === "DOCUMENT") {
      const input = z.object({
        uploadedDocumentId: z.string().cuid(),
        documentVersion: z.coerce.number().int().positive(),
        decision: z.enum(["VERIFIED", "REJECTED", "REPLACEMENT_REQUESTED"]),
        reason: z.string().trim().max(1000).optional(),
      }).parse(Object.fromEntries(formData));
      const permission = input.decision === "VERIFIED" ? "document.verify" : input.decision === "REJECTED" ? "document.reject" : "document.request_replacement";
      const auth = await requirePermission(permission);
      await prisma.$transaction((tx) => reviewRecruitmentDocument(tx, {
        ...input, handoverId, reviewScope: "HR", organizationId: auth.user.organizationId, actorUserId: auth.user.id,
      }), { isolationLevel: "Serializable" });
    } else if (operation === "REASSIGN") {
      const input = z.object({
        ownerUserId: z.string().cuid(),
        expectedVersion: z.coerce.number().int().positive(),
        reason: z.string().trim().min(3).max(1000),
      }).parse(Object.fromEntries(formData));
      const auth = await requirePermission("handover.review");
      await prisma.$transaction((tx) => reassignHandoverOwner(tx, {
        ...input, handoverId, organizationId: auth.user.organizationId, actorUserId: auth.user.id,
      }), { isolationLevel: "Serializable" });
    } else {
      const auth = await requirePermission("employee.prehire.create");
      await prisma.$transaction((tx) => convertApprovedHandoverToPreHire(tx, {
        handoverId,
        organizationId: auth.user.organizationId,
        actorUserId: auth.user.id,
        actorRole: auth.roles[0],
        idempotencyKey: `prehire-conversion:${handoverId}`,
      }), { isolationLevel: "Serializable" });
    }
    revalidatePath(`/hr/admin/handovers/${handoverId}`);
    revalidatePath("/hr/admin/recruitment");
    return { status: "success", message: "Handover workflow updated." };
  } catch (error) {
    return fail(error);
  }
}
