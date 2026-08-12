"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { createPerformanceFeedback, recordPerformanceCheckIn, submitPerformanceReview, transitionGoalStatus } from "@/lib/hr/performance/commands";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

async function managerContext(employeeId: string) {
  const auth = await requirePermission("supervisor.review_assigned");
  if (!auth.user.employee) throw new Error("A manager employee profile is required.");
  await prisma.hrSupervisorAssignment.findFirstOrThrow({ where: { organizationId: auth.user.organizationId, supervisorEmployeeId: auth.user.employee.id, assignedEmployeeId: employeeId, status: "ACTIVE", effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] } });
  return auth;
}

export async function approveTeamGoalAction(form: FormData) {
  const employeeId = text(form, "employeeId");
  const auth = await managerContext(employeeId);
  const goal = await prisma.hrPerformanceGoal.findFirstOrThrow({ where: { id: text(form, "goalId"), organizationId: auth.user.organizationId, employeeId } });
  if (goal.ownerUserId === auth.user.id) throw new Error("A goal owner cannot approve their own goal.");
  await prisma.$transaction((tx) => transitionGoalStatus(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "MANAGER" }, { goalId: goal.id, expectedVersion: Number(text(form, "expectedVersion")), to: "ACTIVE", reason: text(form, "reason") || "Manager approved" }));
  revalidatePath("/hr/supervisor/performance");
}

export async function addTeamFeedbackAction(form: FormData) {
  const employeeId = text(form, "employeeId");
  const auth = await managerContext(employeeId);
  await prisma.$transaction((tx) => createPerformanceFeedback(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "MANAGER" }, { employeeId, kind: text(form, "kind") || "COACHING", visibility: text(form, "visibility") as "EMPLOYEE_VISIBLE" | "MANAGER_EMPLOYEE" | "HR_CONFIDENTIAL", content: { summary: text(form, "summary") } }));
  revalidatePath("/hr/supervisor/performance");
}

export async function recordTeamCheckInAction(form: FormData) {
  const employeeId = text(form, "employeeId");
  const auth = await managerContext(employeeId);
  await prisma.$transaction((tx) => recordPerformanceCheckIn(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "MANAGER" }, { employeeId, managerEmployeeId: auth.user.employee!.id, occurredAt: new Date(), cadence: text(form, "cadence") || "CONTINUOUS", topics: { summary: text(form, "topics") }, blockers: { summary: text(form, "blockers") }, agreedActions: { summary: text(form, "agreedActions") }, followUpAt: text(form, "followUpAt") ? new Date(`${text(form, "followUpAt")}T12:00:00Z`) : undefined }));
  revalidatePath("/hr/supervisor/performance");
}

export async function submitManagerReviewAction(form: FormData) {
  const employeeId = text(form, "employeeId");
  const auth = await managerContext(employeeId);
  await prisma.$transaction((tx) => submitPerformanceReview(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "MANAGER" }, { reviewId: text(form, "reviewId"), expectedVersion: Number(text(form, "expectedVersion")), submissionType: "MANAGER", answers: { results: text(form, "results"), behaviors: text(form, "behaviors"), development: text(form, "development") }, ratingItemId: text(form, "ratingItemId"), rationale: text(form, "rationale") }));
  revalidatePath("/hr/supervisor/performance");
}
