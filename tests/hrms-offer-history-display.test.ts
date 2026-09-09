import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { offerHistoryDisplay } from '../src/lib/hr/recruitment/offer-history-display';

const approved = new Date('2026-01-01T10:00:00Z');
const issued = new Date('2026-01-01T11:00:00Z');
const accepted = new Date('2026-01-01T12:00:00Z');
const fixture = () => ({ activeVersionId: 'v1', acceptedVersionId: 'v1',
  approvals: [{ offerVersionId: 'v1', decision: 'APPROVED', decidedAt: approved }],
  deliveries: [{ offerVersionId: 'v1', createdAt: issued }],
  acceptance: { offerVersionId: 'v1', acceptedAt: accepted },
});
describe('offer history source mapping', () => {
  it('shows distinct exact-version approval, issue and acceptance dates', () => {
    expect(offerHistoryDisplay(fixture(), {})).toEqual({ approvedAt: approved, issuedAt: issued,
      candidateDecisionAt: accepted, issueLabel: 'Issued (email queued)' });
  });
  it('retains legacy dates when no governed offer exists', () => {
    expect(offerHistoryDisplay(null, { approvedAt: approved, releasedAt: issued, candidateDecisionAt: accepted }))
      .toEqual({ approvedAt: approved, issuedAt: issued, candidateDecisionAt: accepted, issueLabel: 'Released' });
  });
  it('does not borrow stale-version approvals, issue or acceptance dates', () => {
    const data = fixture(); data.acceptedVersionId = ''; data.activeVersionId = 'v2';
    // No accepted version: render the current version, not the previously approved one.
    const result = offerHistoryDisplay({ ...data, acceptedVersionId: null }, { approvedAt: approved, releasedAt: issued });
    expect(result.approvedAt).toBeNull(); expect(result.issuedAt).toBeNull(); expect(result.candidateDecisionAt).toBeNull();
  });
  it('prefers the accepted version when present', () => {
    expect(offerHistoryDisplay({ ...fixture(), activeVersionId: 'v2' }, {}).approvedAt).toEqual(approved);
  });
  it('does not treat rejection as approval or acceptance as approval', () => {
    const data = fixture(); data.approvals[0].decision = 'REJECTED';
    expect(offerHistoryDisplay(data, {}).approvedAt).toBeNull();
  });
  it('preserves missing evidence rather than manufacturing dates', () => {
    expect(offerHistoryDisplay({ activeVersionId: null, acceptedVersionId: null, approvals: [], deliveries: [], acceptance: null }, {}))
      .toMatchObject({ approvedAt: null, issuedAt: null, candidateDecisionAt: null });
  });
  it('uses earliest issue and latest approval without mutating source arrays', () => {
    const data = fixture(); data.deliveries.unshift({ offerVersionId: 'v1', createdAt: accepted });
    const before = structuredClone(data);
    expect(offerHistoryDisplay(data, {}).issuedAt).toEqual(issued); expect(data).toEqual(before);
  });
  it('integrates minimized organization-scoped event fields into the shared page', () => {
    const page = readFileSync('src/app/admin/applications/[id]/RecruitmentDetail.tsx', 'utf8');
    expect(page).toContain('applicationId: application.id, organizationId: adminSession.organizationId');
    expect(page).toContain('approvals: { select: { offerVersionId: true, decision: true, decidedAt: true } }');
    expect(page).toContain('offerHistory.approvedAt'); expect(page).toContain('offerHistory.issueLabel');
  });
});
