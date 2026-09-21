import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(), jar: { get: vi.fn(), set: vi.fn() }, access: { findFirst: vi.fn(), updateMany: vi.fn() },
  application: { findFirst: vi.fn() }, audit: vi.fn(), rate: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: async () => mocks.jar, headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: mocks.transaction, applicationAccessCode: mocks.access, jobApplication: mocks.application, auditLog: { create: mocks.audit } } }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.rate }));
import { verifyAccessCode, signOutCandidate } from '@/app/track/actions';
import { candidateSessionToken, CANDIDATE_SESSION_COOKIE } from '@/lib/candidate-session';
beforeEach(() => {
  vi.resetAllMocks(); mocks.transaction.mockImplementation(async run => run({ applicationAccessCode: mocks.access, auditLog: { create: mocks.audit } })); mocks.rate.mockResolvedValue({ allowed: true });
  mocks.application.findFirst.mockResolvedValue({ id: 'app', applicant: { email: 'synthetic@example.invalid' } });
  mocks.access.findFirst.mockResolvedValue({ id: 'code' }); mocks.access.updateMany.mockResolvedValue({ count: 1 });
});
function form() { const f = new FormData(); f.set('applicationId', 'SYNTHETIC'); f.set('email', 'synthetic@example.invalid'); f.set('code', '123456'); return f; }
it('consumes only an unused unexpired passcode and sets an HttpOnly cookie before a clean redirect', async () => {
  await expect(verifyAccessCode(form())).rejects.toThrow('redirect:/track/portal');
  expect(mocks.access.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'code', usedAt: null, expiresAt: { gt: expect.any(Date) } }) }));
  expect(mocks.jar.set).toHaveBeenCalledWith(CANDIDATE_SESSION_COOKIE, expect.any(String), expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/track', maxAge: 1800 }));
});
it('allows exactly one winner when two verifications compete for the same code', async () => {
  let used = false;
  mocks.access.updateMany.mockImplementation(async () => { if (used) return { count: 0 }; used = true; return { count: 1 }; });
  const results = await Promise.allSettled([verifyAccessCode(form()), verifyAccessCode(form())]);
  const messages = results.map(result => result.status === 'rejected' ? String(result.reason) : '');
  expect(messages.filter(message => message === 'Error: redirect:/track/portal')).toHaveLength(1);
  expect(messages.filter(message => message.includes('/track/verify'))).toHaveLength(1);
  expect(mocks.jar.set).toHaveBeenCalledTimes(1); expect(mocks.audit).toHaveBeenCalledTimes(1);
});
it('does not set a session when the code expires or was consumed before the update', async () => {
  mocks.access.updateMany.mockResolvedValue({ count: 0 });
  await expect(verifyAccessCode(form())).rejects.toThrow('/track/verify');
  expect(mocks.jar.set).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled();
});
it('reads authentication exclusively from the candidate cookie', async () => {
  mocks.jar.get.mockReturnValue({ value: 'cookie-token' }); expect(await candidateSessionToken()).toBe('cookie-token');
  expect(mocks.jar.get).toHaveBeenCalledWith(CANDIDATE_SESSION_COOKIE);
});
it('revokes the server session and clears the cookie on sign out', async () => {
  mocks.jar.get.mockReturnValue({ value: 'cookie-token' });
  await expect(signOutCandidate()).rejects.toThrow('redirect:/track');
  expect(mocks.access.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { sessionExpiresAt: new Date(0) } }));
  expect(mocks.jar.set).toHaveBeenCalledWith(CANDIDATE_SESSION_COOKIE, '', expect.objectContaining({ maxAge: 0, httpOnly: true }));
});

it('does not issue a cookie if the audit transaction fails', async () => {
  mocks.audit.mockRejectedValue(new Error('audit write failed'));
  await expect(verifyAccessCode(form())).rejects.toThrow('audit write failed');
  expect(mocks.jar.set).not.toHaveBeenCalled();
});
