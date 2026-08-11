"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { prisma } from "@/lib/prisma";
import { approveAttendancePeriod, createOrSubmitAttendancePeriod, lockAttendancePeriod, recoverDeadLetterTimeRun, reviewTimeCorrection } from "@/lib/hr/time/commands";
import { assignTimePolicy, createTimePolicyVersion } from "@/lib/hr/time/policy-commands";
import { assignPublishedShift, createShiftTemplateVersion } from "@/lib/hr/time/shift-commands";

export async function createTimePolicyAction(formData: FormData) {
  const auth = await requirePermission("time.policy.manage");
  await prisma.$transaction(async (tx) => {
    const policy = await tx.hrTimePolicy.create({ data: { organizationId: auth.user.organizationId, code: String(formData.get("code")).trim().toUpperCase(), name: String(formData.get("name")).trim() } });
    await createTimePolicyVersion(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "HR" }, { policyId: policy.id, trackingMode: String(formData.get("trackingMode")) as "NONE" | "EXCEPTION_BASED" | "CLOCK" | "TIMESHEET", timezone: String(formData.get("timezone")), graceBeforeMinutes: Number(formData.get("graceBeforeMinutes") || 0), graceAfterMinutes: Number(formData.get("graceAfterMinutes") || 0), maximumOfflineDelayMin: Number(formData.get("maximumOfflineDelayMin") || 1440), maximumFutureSkewMin: Number(formData.get("maximumFutureSkewMin") || 5), effectiveFrom: new Date(String(formData.get("effectiveFrom"))) });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/time");
}

export async function assignTimePolicyAction(formData: FormData) {
  const auth = await requirePermission("time.policy.manage");
  await prisma.$transaction((tx) => assignTimePolicy(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "HR" }, { employeeId: String(formData.get("employeeId")), timePolicyVersionId: String(formData.get("timePolicyVersionId")), effectiveFrom: new Date(String(formData.get("effectiveFrom"))), reason: String(formData.get("reason")).trim() }), { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/time");
}

export async function createShiftTemplateAction(formData: FormData) {
  const auth = await requirePermission("time.policy.manage");
  await prisma.$transaction((tx) => createShiftTemplateVersion(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "HR" }, { code: String(formData.get("code")), name: String(formData.get("name")), timezone: String(formData.get("timezone")), startsAt: new Date(String(formData.get("startsAt"))), endsAt: new Date(String(formData.get("endsAt"))), effectiveFrom: new Date(String(formData.get("effectiveFrom"))) }), { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/time");
}

export async function assignShiftAction(formData: FormData) {
  const auth = await requirePermission("time.policy.manage");
  await prisma.$transaction((tx) => assignPublishedShift(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "HR" }, { employeeId: String(formData.get("employeeId")), shiftTemplateVersionId: String(formData.get("shiftTemplateVersionId")), businessDate: new Date(String(formData.get("businessDate"))), startsAt: new Date(String(formData.get("startsAt"))), endsAt: new Date(String(formData.get("endsAt"))), reason: String(formData.get("reason")) }), { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/time");
}

export async function createAttendancePeriodAction(formData: FormData) {
  const auth = await requirePermission("time.policy.manage");
  await createOrSubmitAttendancePeriod({ organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "HR" }, { timezone: String(formData.get("timezone")), startsOn: new Date(String(formData.get("startsOn"))), endsOn: new Date(String(formData.get("endsOn"))) });
  revalidatePath("/hr/admin/time");
}

export async function transitionAttendancePeriodAction(formData: FormData) {
  const auth = await requirePermission("time.period.lock");
  const input = { periodId: String(formData.get("periodId")), expectedVersion: Number(formData.get("expectedVersion")) };
  const decision = String(formData.get("decision"));
  if (decision === "SUBMIT") await createOrSubmitAttendancePeriod({ organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "HR" }, input);
  else if (decision === "APPROVE") await approveAttendancePeriod({ organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "HR" }, input);
  else if (decision === "LOCK") await lockAttendancePeriod({ organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "HR" }, { ...input, actorHasLockPermission: true });
  else throw new Error("Unsupported attendance-period decision.");
  revalidatePath("/hr/admin/time");
}

export async function reviewTimeCorrectionAction(formData: FormData) {
  const auth = await requirePermission("time.correction.review");
  await reviewTimeCorrection({ organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "HR" }, { correctionId: String(formData.get("correctionId")), expectedVersion: Number(formData.get("expectedVersion")), decision: String(formData.get("decision")) as "APPROVED" | "RETURNED" | "REJECTED", reason: String(formData.get("reason")) });
  revalidatePath("/hr/admin/time");
}

export async function recoverTimeWorkerAction(formData: FormData) {
  const auth = await requirePermission("time.policy.manage");
  await recoverDeadLetterTimeRun({ organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: "HR" }, { runId: String(formData.get("runId")), expectedAttemptCount: Number(formData.get("expectedAttemptCount")), reason: String(formData.get("reason")) });
  revalidatePath("/hr/admin/time");
}
