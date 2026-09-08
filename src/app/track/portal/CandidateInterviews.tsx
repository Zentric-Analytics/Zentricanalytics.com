import React from 'react';
import { candidateInterviewTime, candidateMeetingUrl, type CandidateInterview } from '@/lib/hr/recruitment/candidate-interviews';

export function CandidateInterviews({ interviews }: { interviews: CandidateInterview[] }) {
  if (!interviews.length) return null;
  return <section aria-label="Your interviews" className="mt-6 space-y-4">
    <h3 className="text-lg font-bold text-ink">Your interviews</h3>
    {interviews.map(interview => {
      const meetingUrl = interview.status === 'SCHEDULED' ? candidateMeetingUrl(interview.meetingUrl) : null;
      return <article key={interview.id} className="space-y-2 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
        <h4 className="font-bold text-ink">{interview.title}</h4>
        <p><strong>Status:</strong> {interview.status === 'CANCELLED' ? 'Cancelled' : interview.status === 'COMPLETED' ? 'Completed' : 'Scheduled'}</p>
        <p><strong>Starts:</strong> {candidateInterviewTime(interview.startsAt, interview.timeZone)}</p>
        <p><strong>Ends:</strong> {candidateInterviewTime(interview.endsAt, interview.timeZone)}</p>
        {interview.status === 'CANCELLED' ? <p>This interview has been cancelled. Do not attend this slot.</p> : <>
          {interview.location && <p><strong>Location:</strong> {interview.location}</p>}
          {meetingUrl && <a className="text-brand underline" href={meetingUrl} target="_blank" rel="noopener noreferrer">Join interview</a>}
        </>}
      </article>;
    })}
  </section>;
}
