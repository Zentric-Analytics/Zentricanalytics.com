"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { createGoal, recordGoalProgress, submitPerformanceReview, transitionGoalStatus } from "@/lib/hr/performance/commands";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function createEmployeeGoalAction(form: FormData) {
  const auth = await requirePermission("performance.goal.manage_self");
  if (!auth.user.employee) throw new Error("An employee profile is required.");
  const dueAt = new Date(`${text(form, "dueAt")}T23:59:59.999Z`);
  if (Number.isNaN(dueAt.getTime())) throw new Error("A valid goal due date is required.");
  const goal = await prisma.$transaction((tx) => createGoal(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "EMPLOYEE" }, { employeeId: auth.user.employee!.id, ownerUserId: auth.user.id, scopeType: "INDIVIDUAL", goalType: text(form, "goalType") || "OPERATIONAL", title: text(form, "title"), outcomeDescription: text(form, "outcomeDescription"), measure: { description: text(form, "measure") }, dueAt, changeReason: "Employee-created goal", idempotencyKey: text(form, "idempotencyKey") || crypto.randomUUID() }));
  await prisma.$transaction((tx) => transitionGoalStatus(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "EMPLOYEE" }, { goalId: goal.id, expectedVersion: goal.currentVersion, to: "PROPOSED", reason: "Submitted for manager review" }));
  revalidatePath("/hr/employee/performance");
}

export async function recordEmployeeGoalProgressAction(form: FormData) {
  const auth = await requirePermission("performance.goal.manage_self");
  if (!auth.user.employee) throw new Error("An employee profile is required.");
  await prisma.$transaction((tx) => recordGoalProgress(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "EMPLOYEE" }, { goalId: text(form, "goalId"), expectedGoalVersion: Number(text(form, "expectedVersion")), progress: Number(text(form, "progress")), note: text(form, "note") || undefined }));
  revalidatePath("/hr/employee/performance");
}

export async function submitSelfReviewAction(form: FormData) {
  const auth = await requirePermission("performance.review.submit_self");
  if (!auth.user.employee) throw new Error("An employee profile is required.");
  await prisma.$transaction((tx) => submitPerformanceReview(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "EMPLOYEE" }, { reviewId: text(form, "reviewId"), expectedVersion: Number(text(form, "expectedVersion")), submissionType: "SELF", answers: { achievements: text(form, "achievements"), goalReflection: text(form, "goalReflection"), challenges: text(form, "challenges"), development: text(form, "development"), careerInterest: text(form, "careerInterest") } }));
  revalidatePath("/hr/employee/performance");
}
