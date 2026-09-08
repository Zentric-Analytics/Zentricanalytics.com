import type { Prisma } from '@prisma/client';

// Candidate-facing allowlist: never load participants, feedback or internal notes.
export const candidateInterviewSelect = {
  id: true, title: true, status: true, startsAt: true, endsAt: true,
  timeZone: true, location: true, meetingUrl: true,
} satisfies Prisma.HrInterviewSelect;

export type CandidateInterview = Prisma.HrInterviewGetPayload<{ select: typeof candidateInterviewSelect }>;

// The caller must obtain this application from a verified, unexpired portal session.
export async function loadCandidateInterviews(
  db: Pick<Prisma.TransactionClient, 'hrInterview'>,
  application: { id: string; organizationId: string | null; deletedAt: Date | null },
) {
  if (!application.organizationId || application.deletedAt) return [];
  return db.hrInterview.findMany({
    where: { applicationId: application.id, organizationId: application.organizationId,
      status: { in: ['SCHEDULED', 'CANCELLED', 'COMPLETED'] } },
    select: candidateInterviewSelect,
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
  });
}

export function candidateMeetingUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export { formatInterviewTime as candidateInterviewTime } from './interview-time';
