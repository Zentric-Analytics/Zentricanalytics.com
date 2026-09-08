/** Only allowlisted classifications leave the server error object. Never log
 * messages, stacks, Prisma metadata, form values, or applicant identifiers. */
export function finalizationFailure(error: unknown) {
  const value = error && typeof error === 'object' ? error as { code?: unknown; message?: unknown } : {};
  const databaseCode = typeof value.code === 'string' && /^P\d{4}$/.test(value.code) ? value.code : undefined;
  const message = typeof value.message === 'string' ? value.message : '';
  const reasons: Record<string, string> = {
    'Current final HR approval evidence is required.': 'FINAL_APPROVAL_EVIDENCE',
    'The final HR reviewer must reconcile their own checklist evidence.': 'FINAL_REVIEWER_MISMATCH',
    'An exact HR document review remains unresolved.': 'DOCUMENT_REVIEW_PENDING',
    'The accepted position is not open.': 'POSITION_NOT_OPEN',
    'The accepted position has insufficient capacity.': 'POSITION_CAPACITY',
    'Conflicting candidate identity link.': 'CANDIDATE_LINK_CONFLICT',
    'All eight recruitment stages must be complete.': 'STAGES_INCOMPLETE',
    'Existing onboarding requires reconciliation; it will not be duplicated or overwritten.': 'EXISTING_ONBOARDING',
    'Handover is not open for evidence reconciliation.': 'HANDOVER_NOT_OPEN',
    'Only the assigned HR person may review this stage.': 'HR_AUTHORITY',
    'Accepted start date is required.': 'START_DATE_MISSING',
  };
  const reason = Object.prototype.hasOwnProperty.call(reasons, message) ? reasons[message]
    : message.startsWith('Final HR approval requires review of:') ? 'REQUIREMENTS_PENDING'
    : databaseCode ? 'DATABASE_ERROR' : 'UNCLASSIFIED';
  return { reason, ...(databaseCode ? { databaseCode } : {}) };
}
