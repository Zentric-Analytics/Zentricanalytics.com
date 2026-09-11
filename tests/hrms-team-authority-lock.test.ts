import { describe, expect, it, vi } from 'vitest';
import { lockHiringTeamAuthority } from '@/lib/hr/recruitment/team-authority-lock';
import { StageAuthorityError } from '@/lib/hr/recruitment/stage-authority-error';

describe('team decision authority locking', () => {
  it('locks scoped vacancy, team, actor membership and actor before returning', async () => {
    const query = vi.fn().mockResolvedValue([{ id: 'vacancy' }]);
    await lockHiringTeamAuthority({ $queryRaw: query } as never, 'org', 'vacancy', 'actor');
    expect(query).toHaveBeenCalledTimes(4);
    const sql = query.mock.calls.map(([parts]) => Array.from(parts).join('?'));
    expect(sql[0]).toContain('"HrVacancy"');
    expect(sql[1]).toContain('"HrHiringTeam"');
    expect(sql[2]).toContain('"HrHiringTeamMember"');
    expect(sql[3]).toContain('"HrUser"');
    for (const statement of sql) {
      expect(statement).toContain('FOR SHARE');
      expect(statement).toContain('"organizationId"');
      expect(statement).not.toContain('KEY SHARE');
    }
    expect(query.mock.calls[2].slice(1)).toEqual(['vacancy', 'org', 'actor']);
  });
  it.each(['40001', '40P01', '55P03'])('turns %s into a safe authority rejection', async code => {
    const query = vi.fn().mockRejectedValue({ code: 'P2010', meta: { code } });
    await expect(lockHiringTeamAuthority({ $queryRaw: query } as never, 'org', 'vacancy', 'actor')).rejects.toBeInstanceOf(StageAuthorityError);
  });
  it('does not hide an unrelated database outage', async () => {
    const error = new Error('database unavailable');
    await expect(lockHiringTeamAuthority({ $queryRaw: vi.fn().mockRejectedValue(error) } as never, 'org', 'vacancy', 'actor')).rejects.toBe(error);
  });
});
