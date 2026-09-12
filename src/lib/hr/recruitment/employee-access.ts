import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { createHrInvitation } from "@/lib/hr/auth/invitations";
import { lockHrAccountEligibility, lockNamedHrEligibility } from "./hr-authority-lock";

/** Called after HR has received mailbox confirmation. This function does not
 * claim to verify Microsoft login/MFA and does not activate employment.
 */
type LinkedInvitationInput = {
  organizationId: string; actorUserId: string; employeeId: string;
};
async function authorizeLinkedSetup(tx: Prisma.TransactionClient, input: LinkedInvitationInput) {
    const employee = await tx.hrEmployee.findFirstOrThrow({ where: { id: input.employeeId, organizationId: input.organizationId }, include: { recruitmentApplication: { include: { stages: true } } } });
    const application = employee.recruitmentApplication;
    if (application?.vacancyId) {
      await lockNamedHrEligibility(tx, input.organizationId, application.vacancyId, input.actorUserId);
    } else {
      await lockHrAccountEligibility(tx, input.organizationId, input.actorUserId);
    }
    const actor = await tx.hrUser.findFirstOrThrow({ where: { id: input.actorUserId, organizationId: input.organizationId, status: "ACTIVE" }, include: { roles: { where: { revokedAt: null }, include: { role: true } } } });
    if (!["DRAFT", "PRE_HIRE", "ONBOARDING", "ACTIVE"].includes(employee.employmentStatus)) {
      throw new Error("This employee's employment status does not permit new account setup.");
    }
    if (!application || application.organizationId !== input.organizationId || application.deletedAt || application.status !== "Hired" || !application.stages.some((stage) => stage.stageOrder === 8 && stage.status === "Approved")) {
      throw new Error("Completed final HR approval and a linked hired application are required.");
    }
    const roles = actor.roles.map((assignment) => assignment.role.key);
    const primary = actor.isPrimaryAdmin && roles.includes("ADMIN");
    const vacancy = application.vacancyId ? await tx.hrVacancy.findFirst({ where: { id: application.vacancyId, organizationId: input.organizationId } }) : null;
    if (!primary && !(vacancy?.responsibleHrUserId === actor.id && (roles.includes("HR_ADMIN") || roles.includes("ADMIN")))) {
      throw new Error("Only the assigned HR person or primary administrator can invite this employee.");
    }
    const parsed = z.string().email().max(180).safeParse(employee.companyEmail?.trim().toLowerCase());
    if (!parsed.success || !parsed.data.endsWith("@zentricanalytics.com")) throw new Error("Assign a valid company email before sending the invitation.");
    const email = parsed.data;
    return { employee, application, actor, email };
}

export async function createLinkedEmployeeInvitation(input: LinkedInvitationInput) {
  const provisioned = await prisma.$transaction(async (tx) => {
    const { employee, application, actor, email } = await authorizeLinkedSetup(tx, input);
    const existing = await tx.hrUser.findUnique({ where: { organizationId_email: { organizationId: input.organizationId, email } }, include: { employee: true } });
    if (existing && (existing.employee?.id !== employee.id || (employee.userId && employee.userId !== existing.id))) {
      throw new Error("Company email belongs to another account; resolve the identity link first.");
    }
    if (employee.userId && (!existing || existing.id !== employee.userId)) {
      throw new Error("The linked account does not match the assigned company email.");
    }
    if (existing && (existing.status !== "INVITED" || existing.passwordHash)) {
      throw new Error("This account is already set up or is not eligible for an invitation.");
    }
    const user = existing ?? await tx.hrUser.create({ data: { organizationId: input.organizationId, email, status: "INVITED" } });
    const role = await tx.hrRole.findUniqueOrThrow({ where: { organizationId_key: { organizationId: input.organizationId, key: "EMPLOYEE" } } });
    await tx.hrUserRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, update: { revokedAt: null, assignedById: actor.id }, create: { userId: user.id, roleId: role.id, assignedById: actor.id } });
    if (employee.userId !== user.id) {
      await tx.hrEmployee.update({ where: { id: employee.id }, data: { userId: user.id } });
      await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: actor.id, entityType: "HrEmployee", entityId: employee.id, action: "hr.employee.account_linked", newValues: { applicationId: application.id, userId: user.id } });
    }
    return { userId: user.id, email };
  }, { isolationLevel: "Serializable" });
  // Retry after a delivery failure reuses the same stable employee/account link.
  const result = await createHrInvitation({ organizationId: input.organizationId, userId: provisioned.userId, createdById: input.actorUserId, recipient: provisioned.email }, async tx => {
    const current = await authorizeLinkedSetup(tx, input);
    if (current.employee.userId !== provisioned.userId || current.email !== provisioned.email) {
      throw new Error("Employee account linkage changed. Reload before sending the invitation.");
    }
  });
  return { userId: provisioned.userId, invitationId: result.invitation.id };
}
