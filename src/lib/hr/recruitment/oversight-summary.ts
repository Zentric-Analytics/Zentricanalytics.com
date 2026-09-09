import { applicationStatuses, stages } from '@/lib/hiring';

export const oversightStageOptions = stages.map((stage) => stage.order);
export const oversightStatusOptions: readonly string[] = [...new Set([
  ...applicationStatuses, 'Submitted', 'Under Review', 'Correction Requested', 'Approved',
])];

type SummaryApplication = {
  status: string;
  currentStageOrder: number;
  offer: { status: string } | null;
  stages: { stageOrder: number; status: string }[];
};

/** Counts describe the displayed, permission-scoped result set, not global totals. */
export function summarizeRecruitment(applications: SummaryApplication[]) {
  const result = { underReview: 0, actionNeeded: 0, offersPending: 0, hired: 0 };
  for (const app of applications) {
    if (app.status === 'Hired') { result.hired++; continue; }
    if (['Enrollment Completed', 'Withdrawn', 'Cancelled'].includes(app.status)) continue;
    const current = app.stages.find((stage) => stage.stageOrder === app.currentStageOrder);
    if (['Submitted', 'Under Review', 'Application Submitted'].includes(app.status) || current?.status === 'Under Review') result.underReview++;
    if (['Correction Requested', 'Rejected'].includes(app.status) || ['Correction Requested', 'Rejected'].includes(current?.status ?? '')) result.actionNeeded++;
    if (app.status === 'Rejected') continue;
    if (app.currentStageOrder === 4 && app.offer?.status === 'Released'
      || app.currentStageOrder === 5 && app.offer?.status === 'Accepted' && current && !['Approved', 'Completed', 'Rejected'].includes(current.status)) result.offersPending++;
  }
  return result;
}
