import type { Prisma } from "@prisma/client";
import { appendHrAudit } from "../audit";
import { assertRecruitmentStageAccess } from "./stage-access";
import { reconcilePositionOccupancy } from "../organization/position-commands";

/** Reconcile accepted terms into the existing identity. Call in a serializable
 * transaction. This is not an employment-activation or account-creation action. */
export async function reconcileRecruitmentEmployment(tx: Prisma.TransactionClient, input: {
  organizationId: string; applicationId: string; actorUserId: string;
}) {
  await assertRecruitmentStageAccess(tx, { ...input, stage: 8 });
  const application = await tx.jobApplication.findFirstOrThrow({
    where: { id: input.applicationId, organizationId: input.organizationId, deletedAt: null, status: "Hired",
      stages: { some: { stageOrder: 8, status: "Approved" } } },
  });
  const employee = await tx.hrEmployee.findFirstOrThrow({
    where: { recruitmentApplicationId: application.id, organizationId: input.organizationId },
    include: { employmentAssignments: true },
  });
  const offer = await tx.hrRecruitmentOffer.findFirstOrThrow({
    where: { applicationId: application.id, organizationId: input.organizationId, status: "ACCEPTED" },
    include: { acceptedVersion: true, acceptance: true, approvals: true },
  });
  const terms = offer.acceptedVersion;
  if (!terms?.positionId || offer.acceptance?.offerVersionId !== terms.id ||
      offer.acceptance.applicantId !== application.applicantId ||
      !offer.approvals.some(approval => approval.offerVersionId === terms.id && approval.decision === "APPROVED")) {
    throw new Error("An approved, accepted offer version for this applicant is required.");
  }
  if (!["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "TEMPORARY"].includes(terms.employmentType) ||
      !["ONSITE", "HYBRID", "REMOTE"].includes(terms.workMode)) throw new Error("Unsupported accepted employment terms.");
  const position = await tx.hrPosition.findFirstOrThrow({ where: {
    id: terms.positionId, organizationId: input.organizationId, departmentId: terms.departmentId, status: "ACTIVE",
  } });
  await tx.hrLegalEntity.findFirstOrThrow({ where: { id: terms.legalEntityId, organizationId: input.organizationId } });
  const reason = `Accepted recruitment offer version ${terms.id}`;
  const conversion = await tx.hrPreHireConversion.findUnique({ where: { employeeId: employee.id }, include: { handover: { include: { offerAcceptance: true } } } });
  const convertedFromTheseTerms = conversion?.organizationId === input.organizationId && conversion.applicationId === application.id && conversion.handover.offerAcceptance.offerVersionId === terms.id;
  const assignment = employee.employmentAssignments.find(item => item.reason === reason || (convertedFromTheseTerms && item.reason === "Accepted recruitment offer"));
  // Never overwrite subsequent employment decisions or adopt unrelated assignments.
  if (employee.employmentAssignments.some(item => item.id !== assignment?.id) ||
      (employee.hireDate && employee.hireDate.getTime() !== terms.startDate.getTime()) ||
      (employee.startDate && employee.startDate.getTime() !== terms.startDate.getTime()) ||
      (employee.workMode && employee.workMode !== terms.workMode)) {
    throw new Error("Existing employment details conflict with the accepted offer. Use governed HR review.");
  }
  if (assignment && (assignment.positionId !== position.id || assignment.departmentId !== terms.departmentId ||
      assignment.legalEntityId !== terms.legalEntityId || assignment.employmentType !== terms.employmentType ||
      assignment.location !== terms.location ||
      assignment.effectiveFrom.getTime() !== terms.startDate.getTime() || assignment.status !== "ACTIVE")) {
    throw new Error("The recruitment assignment has changed. Use governed HR review.");
  }
  if (assignment && employee.hireDate && employee.startDate && employee.workMode) return employee;
  if (!["DRAFT", "PRE_HIRE", "ONBOARDING"].includes(employee.employmentStatus)) {
    throw new Error("Only an unactivated employee may have missing recruitment details reconciled.");
  }
  if (!assignment) {
    if (!["OPEN", "PARTIALLY_FILLED"].includes(position.lifecycleStatus)) throw new Error("The accepted position is not open.");
    const occupants = await tx.hrEmployeeAssignment.findMany({ where: {
      organizationId: input.organizationId, positionId: position.id, status: "ACTIVE",
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: terms.startDate } }],
    } });
    if (occupants.length >= position.headcountLimit || occupants.reduce((total, item) => total + Number(item.fte), 0) + 1 > Number(position.fullTimeEquivalent)) {
      throw new Error("The accepted position has insufficient capacity.");
    }
    await tx.hrEmployeeAssignment.create({ data: {
      organizationId: input.organizationId, employeeId: employee.id, departmentId: terms.departmentId,
      teamId: position.teamId, positionId: position.id, legalEntityId: terms.legalEntityId,
      employmentType: terms.employmentType as "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN" | "TEMPORARY",
      location: terms.location, effectiveFrom: terms.startDate, status: "ACTIVE", fte: 1,
      reason, createdById: input.actorUserId,
    } });
    await reconcilePositionOccupancy(tx, input, position.id);
  }
  const updated = await tx.hrEmployee.update({ where: { id: employee.id }, data: {
    hireDate: terms.startDate, startDate: terms.startDate, workMode: terms.workMode as "ONSITE" | "HYBRID" | "REMOTE",
  } });
  await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, entityType: "HrEmployee", entityId: employee.id,
    action: "hr.recruitment.employment_reconciled", newValues: { applicationId: application.id, offerVersionId: terms.id },
    reason: "Accepted employment terms linked without changing account or activation state",
  });
  return updated;
}
