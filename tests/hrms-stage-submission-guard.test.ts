import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { assertStageSubmissionSnapshot, StageSubmissionChangedError } from '@/lib/hr/recruitment/stage-submission-guard';

describe('decision submission snapshot', () => {
  it.each([1, 2, 3, 5, 6, 7, 8])('locks Stage %i and rejects a newer submission', async stage => {
    const order: string[] = [];
    const tx = { $queryRaw: vi.fn(async () => { order.push('lock'); return [{ id: 'stage' }]; }), stageSubmission: { findFirst: vi.fn(async () => { order.push('read'); return { id: 'new' }; }) } };
    await expect(assertStageSubmissionSnapshot(tx as unknown as Prisma.TransactionClient, { applicationId: 'app', organizationId: 'org', stage, expectedSubmissionId: 'old' })).rejects.toBeInstanceOf(StageSubmissionChangedError);
    expect(order).toEqual(['lock', 'read']);
    const [sql, ...values] = tx.$queryRaw.mock.calls[0] as unknown as [TemplateStringsArray, ...unknown[]];
    expect(sql.join('?')).toContain('FOR SHARE OF s');
    expect(values).toEqual(['app', 'org', stage]);
  });
  it.each([['same', 'same'], ['', null]])('permits a matching snapshot %s', async (expectedSubmissionId, latest) => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{ id: 'stage' }]), stageSubmission: { findFirst: vi.fn().mockResolvedValue(latest ? { id: latest } : null) } };
    await expect(assertStageSubmissionSnapshot(tx as unknown as Prisma.TransactionClient, { applicationId: 'app', organizationId: 'org', stage: 6, expectedSubmissionId })).resolves.toBeUndefined();
  });
  it('rejects a missing form field without database access', async () => {
    await expect(assertStageSubmissionSnapshot({} as Prisma.TransactionClient, { applicationId: 'app', organizationId: 'org', stage: 6, expectedSubmissionId: null })).rejects.toBeInstanceOf(StageSubmissionChangedError);
  });
});
