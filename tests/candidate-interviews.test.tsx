import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import type { Prisma } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { candidateInterviewSelect, candidateInterviewTime, candidateMeetingUrl, loadCandidateInterviews } from '@/lib/hr/recruitment/candidate-interviews';
import { CandidateInterviews } from '@/app/track/portal/CandidateInterviews';

it('scopes the allowlisted query to the verified application and organization', async () => {
  const findMany = vi.fn().mockResolvedValue([]);
  await loadCandidateInterviews({ hrInterview: { findMany } } as unknown as Prisma.TransactionClient,
    { id: 'application', organizationId: 'organization', deletedAt: null });
  expect(findMany).toHaveBeenCalledWith({ where: { applicationId: 'application', organizationId: 'organization',
    status: { in: ['SCHEDULED', 'CANCELLED', 'COMPLETED'] } }, select: candidateInterviewSelect,
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }] });
  expect(Object.keys(candidateInterviewSelect).sort()).toEqual(['id', 'title', 'status', 'startsAt', 'endsAt', 'timeZone', 'location', 'meetingUrl'].sort());
});
it.each([{ organizationId: null, deletedAt: null }, { organizationId: 'org', deletedAt: new Date() }])('does not query unscoped/deleted applications', async scope => {
  const findMany = vi.fn();
  expect(await loadCandidateInterviews({ hrInterview: { findMany } } as unknown as Prisma.TransactionClient, { id: 'app', ...scope })).toEqual([]);
  expect(findMany).not.toHaveBeenCalled();
});
it.each(['javascript:alert(1)', 'data:text/html,test', '/relative', 'https://user:password@example.test', 'not a url'])('rejects unsafe meeting URL %s', value => {
  expect(candidateMeetingUrl(value)).toBeNull();
});
it('allows a normal meeting link and uses the stored timezone with UTC fallback', () => {
  expect(candidateMeetingUrl('https://example.test/meeting')).toBe('https://example.test/meeting');
  expect(candidateInterviewTime(new Date('2030-01-01T18:00:00Z'), 'America/Los_Angeles')).toContain('10:00 AM');
  expect(candidateInterviewTime(new Date('2030-01-01T18:00:00Z'), 'invalid')).toContain('(UTC)');
});
const interview = { id: 'test', title: 'Candidate interview', status: 'SCHEDULED', startsAt: new Date('2030-01-01T18:00:00Z'),
  endsAt: new Date('2030-01-01T18:30:00Z'), timeZone: 'UTC', location: 'Test office', meetingUrl: 'https://example.test/meeting' };
it('renders current scheduled details and rescheduled times', () => {
  const html = renderToStaticMarkup(createElement(CandidateInterviews, { interviews: [interview] }));
  expect(html).toContain('Join interview'); expect(html).toContain('Test office'); expect(html).toContain('6:00 PM');
  const updated = renderToStaticMarkup(createElement(CandidateInterviews, { interviews: [{ ...interview, startsAt: new Date('2030-01-01T19:00:00Z') }] }));
  expect(updated).toContain('7:00 PM'); expect(updated).not.toContain('6:00 PM');
});
it.each(['CANCELLED', 'COMPLETED'])('does not offer a join link for %s', status => {
  const html = renderToStaticMarkup(createElement(CandidateInterviews, { interviews: [{ ...interview, status }] }));
  expect(html).not.toContain('Join interview');
  if (status === 'CANCELLED') expect(html).toContain('Do not attend');
});
it('keeps the query behind portal access validation and stage visibility', () => {
  const source = readFileSync('src/app/track/portal/page.tsx', 'utf8');
  expect(source.indexOf('if (!access)')).toBeLessThan(source.indexOf('await loadCandidateInterviews'));
  expect(source).toContain('sessionExpiresAt: { gt: new Date() }');
  expect(source).toContain('application: { deletedAt: null }');
  expect(source).toContain('selectedStage?.order === 3 && !selectedStageIsLocked');
});
