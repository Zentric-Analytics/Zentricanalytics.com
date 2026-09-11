import { describe, expect, it, vi } from 'vitest';
import { lockNamedHrEligibility } from '@/lib/hr/recruitment/hr-authority-lock';
import { StageAuthorityError } from '@/lib/hr/recruitment/stage-authority-error';

describe('named HR eligibility locks', () => {
  it('locks scoped vacancy, account and role grants in order', async () => {
    const query = vi.fn().mockResolvedValue([{ id: 'row' }]);
    await lockNamedHrEligibility({ $queryRaw: query } as never, 'org', 'vacancy', 'actor');
    const sql = query.mock.calls.map(([parts]) => Array.from(parts as TemplateStringsArray).join('?'));
    expect(sql).toHaveLength(3);
    expect(sql[0]).toContain('"HrVacancy"');
    expect(sql[1]).toContain('"HrUser"');
    expect(sql[2]).toContain('FOR SHARE OF ur');
    expect(sql[2]).toContain("r.key IN ('ADMIN', 'HR_ADMIN')");
    expect(query.mock.calls[2].slice(1)).toEqual(['actor', 'org', 'org']);
  });
  it.each(['40001', '40P01', '55P03'])('safely rejects conflict %s without retry', async code => {
    const query = vi.fn().mockResolvedValueOnce([{ id: 'vacancy' }]).mockRejectedValue({ code: 'P2010', meta: { code } });
    await expect(lockNamedHrEligibility({ $queryRaw: query } as never, 'org', 'vacancy', 'actor')).rejects.toBeInstanceOf(StageAuthorityError);
    expect(query).toHaveBeenCalledTimes(2);
  });
  it('preserves unrelated failures', async () => {
    const error = new Error('connection unavailable');
    await expect(lockNamedHrEligibility({ $queryRaw: vi.fn().mockRejectedValue(error) } as never, 'org', 'vacancy', 'actor')).rejects.toBe(error);
  });
});
