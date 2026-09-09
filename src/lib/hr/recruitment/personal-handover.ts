import type { Prisma } from "@prisma/client";
import { appendHrAudit } from "../audit";
import { assertRecruitmentStageAccess } from "./stage-access";

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

/** Called in the finalization Serializable transaction. Fill only absent profile
 * data from the current signed, approved Stage Six; never replace HR edits. */
export async function transferApprovedOnboardingProfile(tx: Prisma.TransactionClient, input: {
  organizationId: string; applicationId: string; actorUserId: string;
}) {
  await assertRecruitmentStageAccess(tx, { ...input, stage: 8 });
  const application = await tx.jobApplication.findFirstOrThrow({
    where: { id: input.applicationId, organizationId: input.organizationId, deletedAt: null, status: "Hired" },
    include: { stages: { where: { stageOrder: 6 }, include: {
      approvals: { orderBy: { createdAt: "desc" }, take: 1 },
      submissions: { orderBy: { version: "desc" }, take: 1, include: { signature: true } },
    } } },
  });
  const stage = application.stages[0];
  const submission = stage?.submissions[0];
  const approval = stage?.approvals[0];
  if (stage?.status !== "Approved" || !submission?.signature?.confirmed ||
      approval?.action !== "Approved" || approval.createdAt < submission.createdAt) {
    throw new Error("Current signed and approved onboarding is required for profile transfer.");
  }
  const employee = await tx.hrEmployee.findFirstOrThrow({
    where: { organizationId: input.organizationId, recruitmentApplicationId: input.applicationId },
    include: { addresses: true, emergencyContacts: true },
  });
  const action = "hr.recruitment.personal_profile_transferred";
  // A subsequent HR deletion must not cause a retry to recreate old details.
  if (await tx.hrAuditEvent.findFirst({ where: { organizationId: input.organizationId,
    entityType: "HrEmployee", entityId: employee.id, action } })) return;
  if (!["DRAFT", "PRE_HIRE", "ONBOARDING"].includes(employee.employmentStatus)) {
    throw new Error("Personal onboarding transfer requires an unactivated employee.");
  }
  const payload = object(submission.payload);
  const fields: string[] = [];
  const preferredName = text(payload.preferredName);
  if (!employee.preferredName && preferredName) {
    await tx.hrEmployee.update({ where: { id: employee.id }, data: { preferredName } });
    fields.push("preferredName");
  }
  const line1 = text(payload.residentialAddress), city = text(payload.currentCity);
  if (!employee.addresses.some(address => address.type === "HOME") && line1 && city) {
    await tx.hrEmployeeAddress.create({ data: { employeeId: employee.id, type: "HOME", line1, city,
      state: text(payload.stateOfResidence) || null,
      // Stage Six does not collect residence country. Do not infer nationality
      // or a country from free-text city; empty means not supplied.
      country: "", isPrimary: !employee.addresses.some(address => address.isPrimary) } });
    fields.push("homeAddress");
  }
  const fullName = text(payload.emergencyContactName), relationship = text(payload.emergencyContactRelationship), phone = text(payload.emergencyContactPhone);
  if (!employee.emergencyContacts.length && fullName && relationship && phone) {
    await tx.hrEmergencyContact.create({ data: { employeeId: employee.id, fullName, relationship, phone, isPrimary: true } });
    fields.push("emergencyContact");
  }
  await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId,
    entityType: "HrEmployee", entityId: employee.id, action,
    newValues: { applicationId: application.id, submissionId: submission.id, submissionVersion: submission.version, stageApprovalId: approval.id, fields },
    reason: "Absent personal profile fields filled from approved onboarding; existing HR data preserved. Residence country was not collected." });
}
