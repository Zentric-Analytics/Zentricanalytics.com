import type { Prisma } from "@prisma/client";
import { appendHrAudit } from "../audit";
import { reconcileRecruitmentEmployment } from "./employment-handover";
import { reconcileApprovedStageEvidence } from "./stage-evidence";
import { assertRecruitmentStageAccess } from "./stage-access";

/** Completes the reviewed eight-stage journey, not a second onboarding checklist.
 * Caller must use Serializable; any missing evidence rolls final approval back. */
export async function completeReviewedRecruitment(tx: Prisma.TransactionClient, input: {
  organizationId: string; applicationId: string; actorUserId: string;
}, checkpoint: (step: string) => void = () => {}) {
  checkpoint('completion_authority');
  await assertRecruitmentStageAccess(tx, { ...input, stage: 8 });
  const employee = await tx.hrEmployee.findFirstOrThrow({ where: {
    organizationId: input.organizationId, recruitmentApplicationId: input.applicationId,
  } });
  const previous = await tx.hrPreHireConversion.findUnique({ where: { employeeId: employee.id } });
  if (previous) {
    if (previous.organizationId !== input.organizationId || previous.applicationId !== input.applicationId) throw new Error("Conflicting employee conversion.");
    return previous;
  }
  checkpoint('stage_evidence');
  await reconcileApprovedStageEvidence(tx, input);
  checkpoint('handover_requirements');
  const handover = await tx.hrRecruitmentHandover.findFirstOrThrow({
    where: { organizationId: input.organizationId, applicationId: input.applicationId },
    include: { requirements: true, documentReviews: true },
  });
  const definitions = await tx.hrRecruitmentRequirementDefinition.findMany({ where: { organizationId: input.organizationId } });
  const missing = handover.requirements.filter(item => item.blocking &&
    (!["VERIFIED", "WAIVED"].includes(item.status) || (item.expiresAt && item.expiresAt <= new Date())));
  if (missing.length) throw new Error(`Final HR approval requires review of: ${missing.map(item => definitions.find(def => def.id === item.definitionId)?.name ?? "additional requirement").join(", ")}. Complete these within HR review; completed stage reviews need not be repeated.`);
  if (handover.documentReviews.some(item => item.reviewScope === "HR" && !item.replacedById && item.status !== "VERIFIED")) throw new Error("An exact HR document review remains unresolved.");
  checkpoint('completed_stages');
  const application = await tx.jobApplication.findFirstOrThrow({ where: { id: input.applicationId, organizationId: input.organizationId, status: "Hired" },
    include: { stages: { include: { approvals: { orderBy: { createdAt: "desc" }, take: 1 } } } } });
  if (Array.from({ length: 8 }, (_, index) => index + 1).some(order => !application.stages.some(stage => stage.stageOrder === order && ["Approved", "Completed"].includes(stage.status)))) throw new Error("All eight recruitment stages must be complete.");
  const final = application.stages.find(stage => stage.stageOrder === 8)!;
  const completedAt = final.approvedAt;
  if (!completedAt) throw new Error("Final approval timestamp is missing.");
  if (await tx.hrLifecycleInstance.findFirst({ where: { employeeId: employee.id, organizationId: input.organizationId, type: "ONBOARDING" } })) throw new Error("Existing onboarding requires reconciliation; it will not be duplicated or overwritten.");
  checkpoint('employment_recheck');
  await reconcileRecruitmentEmployment(tx, input);
  const repaired = await tx.hrEmployee.findUniqueOrThrow({ where: { id: employee.id } });
  if (!repaired.startDate) throw new Error("Accepted start date is required.");
  checkpoint('lifecycle_template');
  const template = await tx.hrLifecycleTemplate.upsert({ where: { organizationId_name_type_version: {
    organizationId: input.organizationId, name: "Reviewed eight-stage recruitment", type: "ONBOARDING", version: 1,
  } }, update: {}, create: { organizationId: input.organizationId, name: "Reviewed eight-stage recruitment", type: "ONBOARDING", version: 1,
    description: "Completed recruitment stages retained as the employee onboarding record; no duplicate tasks." } });
  checkpoint('lifecycle_create');
  const lifecycle = await tx.hrLifecycleInstance.create({ data: {
    organizationId: input.organizationId, employeeId: employee.id, templateId: template.id,
    type: "ONBOARDING", status: "COMPLETED", effectiveDate: repaired.startDate, startedAt: application.createdAt,
    completedAt, createdById: input.actorUserId, reason: "Completed through the reviewed eight-stage recruitment flow",
    tasks: { create: application.stages.filter(stage => stage.stageOrder >= 1 && stage.stageOrder <= 8).map(stage => ({
      organizationId: input.organizationId, templateTaskKey: `recruitment-stage-${stage.stageOrder}`,
      title: stage.title, ownerType: "HR" as const, dueAt: repaired.startDate!, required: true,
      status: "COMPLETED" as const, completedAt: stage.approvedAt ?? completedAt,
      evidenceReference: `recruitment-stage:${stage.id}`, completionNotes: "Source approval history retained on the linked application; this is not a new approval.",
    })) },
  } });
  checkpoint('candidate_link');
  const link = await tx.hrCandidateEmployeeLink.findUnique({ where: { applicantId: application.applicantId } });
  if (link && (link.employeeId !== employee.id || link.applicationId !== application.id || link.organizationId !== input.organizationId)) throw new Error("Conflicting candidate identity link.");
  if (!link) await tx.hrCandidateEmployeeLink.create({ data: { organizationId: input.organizationId, applicantId: application.applicantId, employeeId: employee.id, applicationId: application.id } });
  checkpoint('conversion_create');
  const conversion = await tx.hrPreHireConversion.create({ data: { organizationId: input.organizationId, handoverId: handover.id,
    applicantId: application.applicantId, applicationId: application.id, employeeId: employee.id,
    lifecycleInstanceId: lifecycle.id, idempotencyKey: `reviewed-completion:${application.id}`, convertedById: input.actorUserId } });
  checkpoint('handover_complete');
  await tx.hrRecruitmentHandover.update({ where: { id: handover.id }, data: { status: "CONVERTED_TO_PRE_HIRE", approvedById: input.actorUserId, approvedAt: completedAt, version: { increment: 1 } } });
  await tx.jobApplication.update({ where: { id: application.id }, data: { recruitmentStatus: "TRANSFERRED_TO_HR", version: { increment: 1 } } });
  checkpoint('prehire_status');
  if (employee.employmentStatus === "DRAFT") {
    await tx.hrEmployee.update({ where: { id: employee.id }, data: { employmentStatus: "PRE_HIRE" } });
    await tx.hrEmployeeStatusHistory.create({ data: { organizationId: input.organizationId, employeeId: employee.id,
      previousStatus: "DRAFT", newStatus: "PRE_HIRE", effectiveAt: new Date(), reason: "Reviewed recruitment completed", changedById: input.actorUserId } });
  }
  await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, entityType: "HrEmployee", entityId: employee.id,
    action: "hr.recruitment.reviewed_flow.completed", newValues: { applicationId: application.id, lifecycleInstanceId: lifecycle.id, conversionId: conversion.id },
    reason: "Existing approvals connected to employee onboarding without new tasks, email or activation" });
  return conversion;
}
