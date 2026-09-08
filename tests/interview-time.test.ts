import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { interviewLocalRange, interviewLocalTime, formatInterviewTime } from '@/lib/hr/recruitment/interview-time';
import { candidateInterviewTime } from '@/lib/hr/recruitment/candidate-interviews';

describe('interview wall time conversion', () => {
  it.each([
    ['2026-09-08T14:15', 'America/Los_Angeles', '2026-09-08T21:15:00.000Z'],
    ['2026-01-08T14:15', 'America/Los_Angeles', '2026-01-08T22:15:00.000Z'],
    ['2026-09-08T14:15', 'UTC', '2026-09-08T14:15:00.000Z'],
    ['2026-09-08T00:15', 'Asia/Kathmandu', '2026-09-07T18:30:00.000Z'],
    ['2026-09-08T14:15:30', 'Asia/Kolkata', '2026-09-08T08:45:30.000Z'],
    ['2028-02-29T00:00', 'UTC', '2028-02-29T00:00:00.000Z'],
  ])('converts %s in %s without server-local parsing', (local, zone, expected) => {
    expect(interviewLocalTime(local, zone).toISOString()).toBe(expected);
  });
  it.each(['', '2026-02-30T14:00', '2026-13-08T14:00', '2026-09-08T24:00',
    '2026-09-08T14:60', '2026-09-08T14:15Z', '2026-09-08T14:15-07:00', 'not-a-date'])('rejects invalid local input %s', value => {
    expect(() => interviewLocalTime(value, 'UTC')).toThrow('valid local');
  });
  it.each(['', 'not/a-zone'])('rejects invalid zone %s', zone => {
    expect(() => interviewLocalTime('2026-09-08T14:15', zone)).toThrow('valid interview time zone');
  });
  it('rejects the spring-forward gap', () => {
    expect(() => interviewLocalTime('2026-03-08T02:30', 'America/Los_Angeles')).toThrow('does not exist');
  });
  it('rejects the repeated fall-back time instead of guessing', () => {
    expect(() => interviewLocalTime('2026-11-01T01:30', 'America/Los_Angeles')).toThrow('occurs twice');
  });
  it('handles a half-hour DST transition', () => {
    expect(() => interviewLocalTime('2026-10-04T02:15', 'Australia/Lord_Howe')).toThrow('does not exist');
  });
  it('rejects a skipped calendar day', () => {
    expect(() => interviewLocalTime('2011-12-30T12:00', 'Pacific/Apia')).toThrow('does not exist');
  });
  it('validates interval order and supports crossing midnight', () => {
    expect(() => interviewLocalRange('2026-09-08T14:15', '2026-09-08T14:15', 'UTC')).toThrow('after');
    expect(() => interviewLocalRange('2026-09-08T14:15', '2026-09-08T14:00', 'UTC')).toThrow('after');
    const result = interviewLocalRange('2026-09-08T23:45', '2026-09-09T00:15', 'America/Los_Angeles');
    expect(result.endsAt.getTime() - result.startsAt.getTime()).toBe(30 * 60_000);
  });
  it('uses the identical formatter for admin and applicant', () => {
    const instant = interviewLocalTime('2026-09-08T14:15', 'America/Los_Angeles');
    expect(candidateInterviewTime).toBe(formatInterviewTime);
    expect(formatInterviewTime(instant, 'America/Los_Angeles')).toContain('2:15 PM');
    expect(formatInterviewTime(instant, 'invalid')).toContain('(UTC)');
  });
  it('wires creation and rescheduling to local range conversion and shared admin formatting', () => {
    const actions = readFileSync('src/app/hr/admin/applications/[id]/actions.ts', 'utf8');
    const page = readFileSync('src/app/hr/admin/applications/[id]/page.tsx', 'utf8');
    expect(actions).toContain('interviewLocalRange(input.startsAt, input.endsAt, input.timeZone)');
    expect(actions).toContain("input.action === 'RESCHEDULE'");
    expect(actions).toContain("interviewLocalRange(input.startsAt ?? '', input.endsAt ?? '', input.timeZone ?? '')");
    expect(actions).not.toContain('new Date(input.startsAt)');
    expect(page).toContain('formatInterviewTime(interview.startsAt, interview.timeZone)');
    expect(page).not.toContain('interview.startsAt.toLocaleString()');
  });
});
