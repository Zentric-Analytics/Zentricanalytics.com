"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";
import { appendHrAudit } from "@/lib/hr/audit";
import { renderMailboxWelcome } from "@/lib/hr/recruitment/mailbox-welcome";
import { sendAndRecordEmail } from "@/lib/email";
import { createLinkedEmployeeInvitation } from "@/lib/hr/recruitment/employee-access";
import { reconcileRecruitmentEmployment } from "@/lib/hr/recruitment/employment-handover";
import { completeReviewedRecruitment } from "@/lib/hr/recruitment/reviewed-completion";
import { reconcileApprovedStageEvidence } from "@/lib/hr/recruitment/stage-evidence";

export async function reconcileReviewedFlowAction(_previous: { message: string }, formData: FormData) {
  const auth = await requireAuthenticatedUser();
  const applicationId = z.string().cuid().parse(formData.get("applicationId"));
  try {
    const evidenceOnly = formData.get("operation") === "EVIDENCE";
    await prisma.$transaction(async tx => { await (evidenceOnly ? reconcileApprovedStageEvidence(tx, {
      organizationId: auth.user.organizationId, actorUserId: auth.user.id, applicationId,
    }) : completeReviewedRecruitment(tx, {
      organizationId: auth.user.organizationId, actorUserId: auth.user.id, applicationId,
    })); }, { isolationLevel: "Serializable", timeout: 15000 });
    revalidatePath(`/hr/recruitment/${applicationId}/access`);
    revalidatePath("/hr/admin/recruitment");
    revalidatePath("/hr/admin/handovers", "layout");
    revalidatePath("/hr/admin/employees", "layout");
    return { message: evidenceOnly ? "Matching approved evidence connected. Unsupported checks remain pending." : "Reviewed onboarding connected. No new invitation or activation was performed." };
  } catch {
    return { message: "Reconciliation blocked. Check unresolved handover requirements, exact document reviews, reviewer ownership or existing lifecycle conflicts. No partial completion was saved." };
  }
}

export async function reconcileEmploymentAction(formData: FormData) {
  const auth = await requireAuthenticatedUser();
  const applicationId = z.string().cuid().parse(formData.get("applicationId"));
  await prisma.$transaction(tx => reconcileRecruitmentEmployment(tx, {
    organizationId: auth.user.organizationId, actorUserId: auth.user.id, applicationId,
  }), { isolationLevel: "Serializable" });
  revalidatePath(`/hr/recruitment/${applicationId}/access`);
  revalidatePath("/hr/employee/profile");
  revalidatePath("/hr/admin/employees", "layout");
}

export async function sendLinkedInvitationAction(formData: FormData) {
  const auth = await requireAuthenticatedUser();
  const employeeId = z.string().cuid().parse(formData.get("employeeId"));
  await createLinkedEmployeeInvitation({ employeeId, organizationId: auth.user.organizationId, actorUserId: auth.user.id });
  revalidatePath("/hr/recruitment");
}

export async function sendMailboxWelcomeAction(formData: FormData) {
  const auth = await requireAuthenticatedUser();
  if (!auth.roles.some(role => role === "ADMIN" || role === "HR_ADMIN")) throw new Error("An active HR or admin role is required.");
  const input = z.object({
    applicationId: z.string().cuid(),
    companyEmail: z.string().trim().email().transform(s => s.toLowerCase()).refine(s => s.endsWith("@zentricanalytics.com")),
    temporaryPassword: z.string().min(1).max(256),
    replyTo: z.string().trim().email().transform(s => s.toLowerCase()),
  }).parse(Object.fromEntries(formData));
  const app = await prisma.jobApplication.findFirstOrThrow({ where: {
    id: input.applicationId, organizationId: auth.user.organizationId, deletedAt: null, status: "Hired",
    stages: { some: { stageOrder: 8, status: "Approved" } },
  }, include: { applicant: true, hrEmployee: true } });
  if (!app.vacancyId || !app.hrEmployee) throw new Error("A linked completed employee record is required.");
  const vacancy = await prisma.hrVacancy.findFirstOrThrow({ where: { id: app.vacancyId, organizationId: auth.user.organizationId } });
  if (vacancy.responsibleHrUserId !== auth.user.id && !auth.user.isPrimaryAdmin) throw new Error("Only the assigned HR person or primary administrator may send mailbox details.");
  const replyUser = await prisma.hrUser.findFirst({ where: { organizationId: auth.user.organizationId, email: input.replyTo, status: "ACTIVE", id: { in: [auth.user.id, vacancy.responsibleHrUserId ?? ""] } } });
  if (!replyUser) throw new Error("Reply-To must be your or the assigned HR person's active work email.");
  const verified = await prisma.applicationAccessCode.findFirst({ where: { applicationId: app.id, usedAt: { not: null } } });
  if (!verified) throw new Error("The applicant's personal email has not been verified through the portal.");
  if (app.hrEmployee.userId) throw new Error("This employee already has an HRMS account. Use the governed account-management flow.");
  const message = renderMailboxWelcome(input);
  await prisma.$transaction(async tx => {
    const completed = await tx.jobApplication.findFirstOrThrow({ where: {
      id: app.id, organizationId: auth.user.organizationId, deletedAt: null, status: "Hired",
      stages: { some: { stageOrder: 8, status: "Approved" } },
    }, include: { applicant: true } });
    if (completed.vacancyId !== app.vacancyId || completed.applicant.email !== app.applicant.email) throw new Error("Application details changed. Reload before sending.");
    const currentVerification = await tx.applicationAccessCode.findFirst({ where: { applicationId: app.id, usedAt: { not: null } } });
    if (!currentVerification) throw new Error("The applicant's personal email verification is no longer available.");
    const current = await tx.hrVacancy.findFirstOrThrow({ where: { id: app.vacancyId!, organizationId: auth.user.organizationId } });
    if (current.responsibleHrUserId !== auth.user.id && !(auth.user.isPrimaryAdmin && auth.roles.includes("ADMIN"))) throw new Error("The assigned HR person changed. Reload before sending.");
    const employee = await tx.hrEmployee.findFirstOrThrow({ where: { id: app.hrEmployee!.id, organizationId: auth.user.organizationId } });
    if (employee.userId) throw new Error("This employee already has an HRMS account.");
    if (employee.recruitmentApplicationId !== app.id || !["DRAFT", "PRE_HIRE", "ONBOARDING", "ACTIVE"].includes(employee.employmentStatus)) throw new Error("Employee linkage or employment status no longer permits setup.");
    await tx.hrEmployee.update({ where: { id: app.hrEmployee!.id }, data: { companyEmail: input.companyEmail } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id,
      entityType: "HrEmployee", entityId: app.hrEmployee!.id, action: "hr.employee.mailbox_welcome.requested",
      newValues: { applicationId: app.id, companyEmail: input.companyEmail, recipient: app.applicant.email, replyTo: input.replyTo, templateVersion: 1 },
    });
  }, { isolationLevel: "Serializable" });
  // The credential-bearing body exists only for delivery, never in notes/outbox/audit history.
  const result = await sendAndRecordEmail({ to: app.applicant.email, applicationId: app.id,
    template: "hr-mailbox-welcome", subject: message.subject, body: message.text, html: message.html,
    replyTo: input.replyTo, sensitiveBody: true,
  });
  await appendHrAudit(prisma, { organizationId: auth.user.organizationId, actorUserId: auth.user.id,
    entityType: "HrEmployee", entityId: app.hrEmployee.id, action: "hr.employee.mailbox_welcome.result",
    newValues: { applicationId: app.id, status: result.status, notificationId: result.id },
  });
  if (result.status !== "sent") throw new Error("Mailbox message was not sent. Check the email configuration before retrying.");
  revalidatePath(`/hr/recruitment/${app.id}/access`);
}
