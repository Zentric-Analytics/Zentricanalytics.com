import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  latest: null as null | { id: string; status: string; usedAt: Date | null; expiresAt: Date },
  target: { status: 'INVITED', passwordHash: null as string | null, email: 'test@example.test', employee: null },
  lock: vi.fn(), revoke: vi.fn(), create: vi.fn(), enqueue: vi.fn(), audit: vi.fn(), process: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: m.transaction } }));
vi.mock('@/lib/hr/audit', () => ({ appendHrAudit: m.audit }));
vi.mock('@/lib/hr/notifications/outbox', () => ({ enqueueHrEmail: m.enqueue }));
vi.mock('@/lib/hr/notifications/worker', () => ({ processHrOutboxItem: m.process }));
vi.mock('@/lib/hr/auth/crypto', () => ({ createOpaqueToken: () => 'test-secret', hashOpaqueToken: () => 'hashed', sealHrCredential: () => 'sealed', hashHrPassword: vi.fn(), passwordMeetsPolicy: vi.fn() }));
vi.mock('@/lib/hr/auth/totp', () => ({ generateTotpSecret: vi.fn() }));
import { createHrInvitation } from '../src/lib/hr/auth/invitations';

const input = { organizationId: 'org', userId: 'user', createdById: 'admin', recipient: 'test@example.test' };
describe('invitation send retry preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks(); m.latest = null;
    m.target = { status: 'INVITED', passwordHash: null, email: input.recipient, employee: null };
    m.create.mockImplementation(async () => (m.latest = { id: `invite-${m.create.mock.calls.length}`, status: 'ACTIVE', usedAt: null, expiresAt: new Date(Date.now() + 100000) }));
    m.enqueue.mockResolvedValue({ id: 'outbox' });
    m.process.mockResolvedValue(undefined);
    m.transaction.mockImplementation(async (fn) => fn({
      $queryRaw: m.lock,
      hrUser: { findFirstOrThrow: async () => m.target },
      hrAccountInvitation: { findFirst: async () => m.latest, create: m.create, updateMany: m.revoke },
    }));
  });
  it('reuses the first invitation without another email, token rotation or audit', async () => {
    const first = await createHrInvitation(input);
    const second = await createHrInvitation(input);
    expect(second.invitation.id).toBe(first.invitation.id);
    expect(second.reused).toBe(true);
    for (const fn of [m.create, m.enqueue, m.revoke, m.audit, m.process]) expect(fn).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveProperty('rawToken');
  });
  it('takes a scoped user lock before reading invitation state', async () => {
    await createHrInvitation(input);
    expect(m.lock.mock.calls[0].slice(1)).toEqual(['user', 'org']);
    expect(m.lock.mock.calls[0][0].join('?')).toContain('FOR UPDATE');
    expect(m.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'ReadCommitted' });
  });
  it('rejects lost contextual authority before invitation or outbox writes', async () => {
    const authorize = vi.fn().mockRejectedValue(new Error('Authority revoked'));
    await expect(createHrInvitation(input, authorize)).rejects.toThrow('Authority revoked');
    expect(authorize).toHaveBeenCalledOnce();
    for (const fn of [m.lock, m.create, m.enqueue, m.audit, m.process]) expect(fn).not.toHaveBeenCalled();
  });
  it('an explicit resend replaces only the expected invitation once', async () => {
    const original = await createHrInvitation(input);
    const resend = { ...input, replaceInvitationId: original.invitation.id };
    const replacement = await createHrInvitation(resend);
    expect(replacement.invitation.id).not.toBe(original.invitation.id);
    await expect(createHrInvitation(resend)).rejects.toThrow('Invitation changed');
    expect(m.create).toHaveBeenCalledTimes(2);
    expect(m.enqueue).toHaveBeenCalledTimes(2);
  });
  it('delivery failure leaves the same invitation and durable queue item for retry', async () => {
    m.process.mockRejectedValue(new Error('delivery failure'));
    const first = await createHrInvitation(input);
    expect((await createHrInvitation(input)).invitation.id).toBe(first.invitation.id);
    expect(m.enqueue).toHaveBeenCalledTimes(1);
  });
  it.each(['REVOKED', 'USED'])('does not revive a %s invitation on ordinary retry', async (status) => {
    m.latest = { id: 'old', status, usedAt: null, expiresAt: new Date(Date.now() + 100000) };
    await expect(createHrInvitation(input)).rejects.toThrow('explicit resend');
    expect(m.create).not.toHaveBeenCalled();
  });
  it('requires explicit resend for an expired invitation', async () => {
    m.latest = { id: 'old', status: 'ACTIVE', usedAt: null, expiresAt: new Date(0) };
    await expect(createHrInvitation(input)).rejects.toThrow('explicit resend');
    expect((await createHrInvitation({ ...input, replaceInvitationId: 'old' })).reused).toBe(false);
  });
  it.each(['ACTIVE', 'SUSPENDED', 'DISABLED', 'DELETED'])('rejects %s accounts without sending', async (status) => {
    m.target.status = status;
    await expect(createHrInvitation(input)).rejects.toThrow('not eligible');
    expect(m.create).not.toHaveBeenCalled();
  });
  it('rejects accounts with a password and mismatched recipients', async () => {
    m.target.passwordHash = 'hash';
    await expect(createHrInvitation(input)).rejects.toThrow('not eligible');
    m.target.passwordHash = null;
    await expect(createHrInvitation({ ...input, recipient: 'other@example.test' })).rejects.toThrow('does not match');
    expect(m.enqueue).not.toHaveBeenCalled();
  });
});
