import type { Prisma } from "@prisma/client";
import { appendHrAudit } from "../audit";
import { assertRecruitmentStageAccess } from "./stage-access";

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Run inside a serializable transaction. Only explicitly reviewed, versioned
 * evidence can satisfy a matching requirement; this never approves a handover. */
export async function reconcileApprovedStageEvidence(tx: Prisma.TransactionClient, input: {
  organizationId: string; applicationId: string; actorUserId: string;
}) {
  await assertRecruitmentStageAccess(tx, { ...input, stage: 8 });
  const application = await tx.jobApplication.findFirstOrThrow({
    where: { id: input.applicationId, organizationId: input.organizationId, deletedAt: null, status: "Hired" },
    include: { stages: { include: {
      approvals: { orderBy: { createdAt: "desc" } },
      submissions: { orderBy: { version: "desc" }, take: 1, include: { signature: true, documents: { include: { uploadedDocument: true } } } },
    } } },
  });
  const handover = await tx.hrRecruitmentHandover.findFirstOrThrow({
    where: { applicationId: application.id, organizationId: input.organizationId },
    include: { requirements: true },
  });
  if (!["PENDING_HR_REVIEW", "IN_REVIEW", "APPROVED"].includes(handover.status)) throw new Error("Handover is not open for evidence reconciliation.");
  const final = application.stages.find(stage => stage.stageOrder === 8);
  const finalSubmission = final?.submissions[0];
  const finalApproval = final?.approvals[0];
  if (final?.status !== "Approved" || !finalSubmission || finalApproval?.action !== "Approved" ||
      finalApproval.createdAt < finalSubmission.createdAt) throw new Error("Current final HR approval evidence is required.");
  const finalReviewer = await tx.hrUser.findFirst({ where: {
    organizationId: input.organizationId, email: finalApproval.adminEmail, status: "ACTIVE",
  } });
  if (!finalReviewer || finalReviewer.id !== input.actorUserId) throw new Error("The final HR reviewer must reconcile their own checklist evidence.");
  const confirmed = object(object(finalSubmission.payload).confirmed);
  const definitions = await tx.hrRecruitmentRequirementDefinition.findMany({ where: { organizationId: input.organizationId, active: true } });
  const updated: string[] = [];
  for (const requirement of handover.requirements) {
    const key = definitions.find(definition => definition.id === requirement.definitionId)?.key;
    // No explicit right-to-work verification exists in the eight-stage checklist.
    // A candidate's declaration is not an HR verification. Leave it for review.
    const order = key === "IDENTITY" ? 2 : key === "PAYROLL_DETAILS" ? 6 : null;
    if (!order || !["NOT_STARTED", "PENDING_SUBMISSION"].includes(requirement.status) || requirement.evidence || requirement.evaluatedAt || requirement.expiresAt) continue;
    if (confirmed[key === "IDENTITY" ? "candidateIdentityReviewed" : "payrollStatutoryHandlingReviewed"] !== true) continue;
    const stage = application.stages.find(item => item.stageOrder === order);
    const submission = stage?.submissions[0];
    const approval = stage?.approvals[0];
    if (stage?.status !== "Approved" || !submission?.signature?.confirmed || approval?.action !== "Approved" ||
        approval.createdAt < submission.createdAt || approval.createdAt > finalApproval.createdAt) continue;
    const payload = object(submission.payload);
    const documents = submission.documents.filter(doc => doc.uploadedDocument.applicationId === application.id);
    if (key === "IDENTITY") {
      if (!payload.primaryIdType || !payload.primaryIdNumber || !documents.some(doc => /primary.*id|id.*primary/i.test(doc.uploadedDocument.kind))) continue;
      if (payload.primaryIdExpiryDate && (!Number.isFinite(Date.parse(String(payload.primaryIdExpiryDate))) || Date.parse(String(payload.primaryIdExpiryDate)) < Date.now())) continue;
    } else if (!payload.bankName || !payload.accountName || !payload.accountNumber || object(payload.declarations).payrollProcessingConsent !== true) continue;
    const evidence = { source: "APPROVED_RECRUITMENT_STAGES", applicationId: application.id,
      stageId: stage.id, submissionId: submission.id, submissionVersion: submission.version,
      stageApprovalId: approval.id, finalSubmissionId: finalSubmission.id, finalApprovalId: finalApproval.id,
      documentIds: documents.map(doc => doc.uploadedDocumentId) };
    const result = await tx.hrRecruitmentRequirement.updateMany({ where: { id: requirement.id, version: requirement.version, status: requirement.status },
      data: { status: "VERIFIED", evidence, evaluatedById: finalReviewer.id, evaluatedAt: finalApproval.createdAt, version: { increment: 1 } } });
    if (result.count !== 1) throw new Error("Requirement changed concurrently. Reload before reconciling.");
    await appendHrAudit(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId,
      entityType: "HrRecruitmentRequirement", entityId: requirement.id, action: "hr.recruitment.requirement.evidence_reconciled",
      previousValues: { status: requirement.status }, newValues: { status: "VERIFIED", ...evidence },
      reason: "Matching signed submission and explicit final HR checklist review carried forward" });
    updated.push(key!);
  }
  return { updated, handoverId: handover.id };
}
