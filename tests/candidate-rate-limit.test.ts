import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), lock: vi.fn(), count: vi.fn(), create: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: mocks.transaction } }));
import { checkRateLimit } from '@/lib/rate-limit';
const rule = { scope: 'access-code-verify', key: 'synthetic', limit: 1, windowMs: 60000 };
beforeEach(() => {
  vi.resetAllMocks(); mocks.count.mockResolvedValue(0);
  mocks.transaction.mockImplementation(async run => run({ $queryRaw: mocks.lock, rateLimitEvent: { count: mocks.count, create: mocks.create } }));
});
it('takes a transaction-scoped key lock before counting and inserting', async () => {
  expect((await checkRateLimit(rule)).allowed).toBe(true);
  expect(mocks.lock.mock.calls[0][0].join('')).toContain('pg_advisory_xact_lock');
  expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.count.mock.invocationCallOrder[0]);
  expect(mocks.count.mock.invocationCallOrder[0]).toBeLessThan(mocks.create.mock.invocationCallOrder[0]);
});
it('rejects a request when the locked count has reached the limit', async () => {
  mocks.count.mockResolvedValue(1);
  expect(await checkRateLimit(rule)).toMatchObject({ allowed: false, remaining: 0 });
  expect(mocks.create).not.toHaveBeenCalled();
});
it('does not fall back to an unlocked path on database failure', async () => {
  mocks.lock.mockRejectedValue(new Error('database unavailable'));
  await expect(checkRateLimit(rule)).rejects.toThrow('database unavailable'); expect(mocks.count).not.toHaveBeenCalled();
});
