"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { createCalibrationSession, createPerformanceCycle, openPerformanceCycle, recordCalibrationDecision, seedPerformanceFramework, transitionCalibrationSession } from "@/lib/hr/performance/commands";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function initializePerformanceFrameworkAction() {
  const auth = await requirePermission("performance.framework.manage");
  await prisma.$transaction((tx) => seedPerformanceFramework(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "TALENT_ADMIN" }), { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/performance");
}

export async function createPerformanceCycleAction(form: FormData) {
  const auth = await requirePermission("performance.review.admin");
  const startsAt = new Date(`${text(form, "startsAt")}T00:00:00Z`);
  const endsAt = new Date(`${text(form, "endsAt")}T23:59:59Z`);
  await prisma.$transaction((tx) => createPerformanceCycle(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "TALENT_ADMIN" }, { code: text(form, "code"), name: text(form, "name"), cycleType: text(form, "cycleType") as "ANNUAL" | "MID_YEAR" | "PROBATION" | "AD_HOC" | "PROMOTION", startsAt, selfReviewOpensAt: startsAt, managerReviewOpensAt: startsAt, calibrationOpensAt: startsAt, endsAt, population: { type: "ALL_ACTIVE" }, reviewTemplateVersionId: text(form, "reviewTemplateVersionId") }));
  revalidatePath("/hr/admin/performance");
}

export async function openPerformanceCycleAction(form: FormData) {
  const auth = await requirePermission("performance.review.admin");
  await prisma.$transaction((tx) => openPerformanceCycle(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "TALENT_ADMIN" }, { cycleId: text(form, "cycleId"), expectedVersion: Number(text(form, "expectedVersion")) }), { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/performance");
}

export async function createCalibrationSessionAction(form: FormData) {
  const auth = await requirePermission("performance.calibration.admin");
  await prisma.$transaction((tx) => createCalibrationSession(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "TALENT_ADMIN" }, { cycleId: text(form, "cycleId"), name: text(form, "name"), participantUserIds: [auth.user.id] }), { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/performance");
}

export async function transitionCalibrationSessionAction(form: FormData) {
  const auth = await requirePermission("performance.calibration.admin");
  await prisma.$transaction((tx) => transitionCalibrationSession(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "TALENT_ADMIN" }, { sessionId: text(form, "sessionId"), expectedVersion: Number(text(form, "expectedVersion")), to: text(form, "to") as "POPULATION_LOCKED" | "IN_SESSION" | "DECISIONS_PENDING" | "FINALIZED" | "CANCELLED", reason: text(form, "reason") }), { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/performance");
}

export async function recordCalibrationDecisionAction(form: FormData) {
  const auth = await requirePermission("performance.calibration.participate");
  await prisma.$transaction((tx) => recordCalibrationDecision(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "CALIBRATION_PARTICIPANT" }, { sessionId: text(form, "sessionId"), reviewId: text(form, "reviewId"), reviewVersion: Number(text(form, "reviewVersion")), managerRatingItemId: text(form, "managerRatingItemId"), calibratedRatingItemId: text(form, "calibratedRatingItemId"), rationale: text(form, "rationale") }), { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/performance");
}
