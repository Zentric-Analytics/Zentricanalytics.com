import { describe, expect, it } from 'vitest';
import { oversightStageOptions, oversightStatusOptions, summarizeRecruitment } from '../src/lib/hr/recruitment/oversight-summary';

const application = (order: number, status: string, offerStatus = 'Accepted', stageStatus = 'Under Review') => ({
  status, currentStageOrder: order, offer: { status: offerStatus },
  stages: [{ stageOrder: order, status: stageStatus }],
});
describe('recruitment oversight summary', () => {
  it('offers all eight stages and late-stage application statuses', () => {
    expect(oversightStageOptions).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const status of ['Onboarding Pending', 'Final Review', 'Hired', 'Enrollment Completed', 'Submitted']) expect(oversightStatusOptions).toContain(status);
    expect(new Set(oversightStatusOptions).size).toBe(oversightStatusOptions.length);
  });
  it('counts hired separately despite retained offers or obsolete stage states', () => {
    expect(summarizeRecruitment([application(8, 'Hired', 'Accepted', 'Correction Requested')])).toEqual({ hired: 1, underReview: 0, actionNeeded: 0, offersPending: 0 });
  });
  it('counts only released stage-four offers and unfinished accepted agreements', () => {
    expect(summarizeRecruitment([application(4, 'Offer Pending', 'Released'), application(5, 'Agreement Pending')]).offersPending).toBe(2);
  });
  it.each([6, 7, 8])('excludes retained offers after agreement at stage %s', (order) => {
    expect(summarizeRecruitment([application(order, 'Final Review')]).offersPending).toBe(0);
  });
  it.each(['Approved', 'Completed', 'Rejected'])('excludes %s agreements', (status) => {
    expect(summarizeRecruitment([application(5, 'Agreement Pending', 'Accepted', status)]).offersPending).toBe(0);
  });
  it('ignores past corrections once the current stage has progressed', () => {
    const app = application(6, 'Onboarding Pending', 'Accepted', 'Available');
    app.stages.push({ stageOrder: 2, status: 'Correction Requested' });
    expect(summarizeRecruitment([app]).actionNeeded).toBe(0);
  });
  it('handles empty results, missing offers and rejected applications', () => {
    expect(summarizeRecruitment([])).toEqual({ hired: 0, underReview: 0, actionNeeded: 0, offersPending: 0 });
    expect(summarizeRecruitment([{ ...application(4, 'Offer Pending'), offer: null }]).offersPending).toBe(0);
    expect(summarizeRecruitment([application(4, 'Rejected', 'Released', 'Rejected')]).offersPending).toBe(0);
  });
});
