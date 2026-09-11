import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/hr/permissions/authorize', () => ({ requireAuthenticatedUser: vi.fn() }));
import { assertRecruitmentStageAccess } from '@/lib/hr/recruitment/stage-access';
import { reassignHandoverOwner } from '@/lib/hr/recruitment/handover';
import { lockHrAuthority } from '@/lib/hr/recruitment/hr-authority-lock';

function signal() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }
function fixture() {
  let owner = 'old';
  let tail = Promise.resolve();
  const attempted = vi.fn();
  const scopes: unknown[][] = [];
  async function transaction(run: (tx: Prisma.TransactionClient) => Promise<void>) {
    let unlock: (() => void) | undefined;
    const tx = {
      $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
        // This model serializes only vacancy reassignment; eligibility row locks
        // have independent regression and real-database ordering coverage.
        if (!strings.join('?').includes('"HrVacancy"')) return [{ id: 'eligibility' }];
        attempted(strings.join('?')); scopes.push(values);
        const previous = tail; const next = signal(); tail = next.promise; unlock = next.resolve;
        await previous; return [{ id: 'vacancy' }];
      },
      jobApplication: { findFirstOrThrow: async () => ({ id: 'app', vacancyId: 'vacancy' }) },
      hrVacancy: { findFirstOrThrow: async () => ({ id: 'vacancy', createdById: 'admin', responsibleHrUserId: owner }), update: async ({ data }: { data: { responsibleHrUserId: string } }) => { owner = data.responsibleHrUserId; } },
      hrUser: { findFirstOrThrow: async ({ where }: { where: { id: string } }) => ({ id: where.id, isPrimaryAdmin: true, roles: [{ role: { key: 'ADMIN' } }] }) },
      hrUserRole: { findFirst: async () => ({ role: { key: 'HR_ADMIN' } }) },
      hrRecruitmentHandover: { findFirstOrThrow: async () => ({ id: 'handover', applicationId: 'app', ownerUserId: owner }), updateMany: async () => ({ count: 1 }) },
      hrAuditEvent: { create: vi.fn() },
    };
    try { await run(tx as unknown as Prisma.TransactionClient); } finally { unlock?.(); }
  }
  const reassign = (tx: Prisma.TransactionClient) => reassignHandoverOwner(tx, { organizationId: 'org', handoverId: 'handover', actorUserId: 'admin', ownerUserId: 'new', expectedVersion: 1, reason: 'Synthetic ordering check' });
  const check = (tx: Prisma.TransactionClient, stage: number) => assertRecruitmentStageAccess(tx, { organizationId: 'org', applicationId: 'app', actorUserId: 'old', stage });
  return { transaction, reassign, check, attempted, scopes, owner: () => owner };
}

describe('HR reassignment transaction ordering (controlled lock model, not PostgreSQL)', () => {
  it.each([6, 7, 8])('Stage %i decision holds authority until its transaction ends', async stage => {
    const f = fixture(), checked = signal(), finish = signal();
    let approved = false;
    const decision = f.transaction(async tx => { await f.check(tx, stage); checked.resolve(); await finish.promise; expect(f.owner()).toBe('old'); approved = true; });
    await checked.promise;
    const change = f.transaction(async tx => { await f.reassign(tx); expect(approved).toBe(true); });
    await vi.waitFor(() => expect(f.attempted).toHaveBeenCalledTimes(2));
    expect(f.owner()).toBe('old'); finish.resolve(); await Promise.all([decision, change]);
    expect(f.owner()).toBe('new');
    expect(f.attempted.mock.calls[0][0]).toContain('FOR SHARE');
    expect(f.attempted.mock.calls[1][0]).toContain('FOR UPDATE');
    expect(f.scopes).toEqual([['vacancy', 'org'], ['vacancy', 'org']]);
  });
  it.each([6, 7, 8])('Stage %i waits for reassignment then denies the former reviewer', async stage => {
    const f = fixture(), changed = signal(), finish = signal();
    const change = f.transaction(async tx => { await f.reassign(tx); changed.resolve(); await finish.promise; });
    await changed.promise;
    let wrote = false;
    const decision = f.transaction(async tx => { await f.check(tx, stage); wrote = true; });
    const rejection = expect(decision).rejects.toThrow('assigned HR');
    await vi.waitFor(() => expect(f.attempted).toHaveBeenCalledTimes(2));
    finish.resolve(); await change; await rejection; expect(wrote).toBe(false);
  });
  it('fails closed when the scoped vacancy lock finds no row', async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]) };
    await expect(lockHrAuthority(tx as never, 'org', 'vacancy')).rejects.toThrow('Scoped vacancy');
  });
});
