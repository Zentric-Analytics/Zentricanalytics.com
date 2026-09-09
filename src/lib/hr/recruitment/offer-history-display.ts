type GovernedHistory = {
  activeVersionId: string | null;
  acceptedVersionId: string | null;
  approvals: { offerVersionId: string; decision: string; decidedAt: Date }[];
  deliveries: { offerVersionId: string; createdAt: Date }[];
  acceptance: { offerVersionId: string; acceptedAt: Date } | null;
};

/** Keep approval, issue/queue and candidate acceptance as distinct events. */
export function offerHistoryDisplay(governed: GovernedHistory | null, legacy: {
  approvedAt?: Date | null; releasedAt?: Date | null; candidateDecisionAt?: Date | null;
}) {
  if (!governed) return {
    approvedAt: legacy.approvedAt ?? null,
    issuedAt: legacy.releasedAt ?? null,
    candidateDecisionAt: legacy.candidateDecisionAt ?? null,
    issueLabel: 'Released',
  };
  const versionId = governed.acceptedVersionId ?? governed.activeVersionId;
  const approvals = governed.approvals.filter(a => versionId && a.offerVersionId === versionId && a.decision === 'APPROVED');
  const deliveries = governed.deliveries.filter(d => versionId && d.offerVersionId === versionId);
  return {
    approvedAt: approvals.sort((a, b) => b.decidedAt.getTime() - a.decidedAt.getTime())[0]?.decidedAt ?? null,
    issuedAt: deliveries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]?.createdAt ?? null,
    candidateDecisionAt: versionId && governed.acceptance?.offerVersionId === versionId ? governed.acceptance.acceptedAt : null,
    issueLabel: 'Issued (email queued)',
  };
}
