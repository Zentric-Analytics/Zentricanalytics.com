import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { id, queue } from './fixtures.mjs';

export async function verifyDispatchContracts(client, createQueueDispatcher, verifySession, record) {
  const run = 'm19_' + randomUUID().replaceAll('-', '');
  const organizationId = id('org_aurora');
  const otherOrganization = id('org_cobalt');
  const userId = id('user_aurora');
  const now = new Date();
  const rollback = new Error('NATIVE_M19_INTENTIONAL_ROLLBACK');
  const fixtureIds = [];
  const credentialId = id(run + '_invite');
  let fakeCalls = 0;
  try {
    await client.$transaction(async tx => {
      await verifySession(tx);
      function fixture(name, overrides = {}) {
        const row = queue(run + '_' + name);
        fixtureIds.push(row.id);
        return tx.hrEmailOutbox.create({ data: {
          ...row, payload: JSON.parse(row.payload), nextAttemptAt: now, ...overrides,
        } });
      }
      function dispatcher(send, candidates = []) {
        return createQueueDispatcher({
          client: {
            $transaction: fn => fn(tx),
            hrEmailOutbox: {
              findFirst: args => tx.hrEmailOutbox.findFirst(args),
              findMany: ({ where, ...args }) => tx.hrEmailOutbox.findMany({
                ...args, where: { ...where, organizationId, id: { in: candidates } },
              }),
            },
          },
          now: () => now,
          policy: () => ({ decision: 'ALLOW' }),
          providerConfigured: () => true,
          render: () => ({ body: 'Fictional Track B message', html: '' }),
          send: async event => {
            assert.match(event.to, /@example\.invalid$/);
            fakeCalls++;
            return send(event);
          },
        });
      }
      const failSend = () => assert.fail('Unexpected fake provider invocation');
      const row = await fixture('delivery');
      assert.equal(row.version, 0n);
      assert.equal((await dispatcher(failSend).processItem(row.id, otherOrganization)).claimed, 0);
      let invocationVerified = false;
      const delivery = dispatcher(async () => {
        const claimed = await tx.hrEmailOutbox.findUniqueOrThrow({ where: { id: row.id } });
        assert.equal(claimed.organizationId, organizationId);
        assert.equal(claimed.version, 4n);
        assert.equal(claimed.status, 'PROCESSING');
        assert.ok(claimed.claimId && claimed.claimExpiresAt > now);
        const [attempt] = await tx.hrEmailDeliveryAttempt.findMany({ where: { outboxId: row.id } });
        assert.equal(attempt.attemptNumber, 1);
        assert.equal(attempt.status, 'PROCESSING');
        const events = await tx.hrEmailDispatchEvent.findMany({
          where: { outboxId: row.id }, orderBy: { transitionVersion: 'asc' }, include: { auditEvent: true },
        });
        assert.deepEqual(events.map(entry => [entry.transitionVersion, entry.kind]), [
          [1n, 'CLAIMED'], [2n, 'INTENT_RECORDED'], [3n, 'RESERVED'], [4n, 'INVOCATION_BOUNDARY'],
        ]);
        assert.ok(events.every(entry => entry.auditEvent?.organizationId === organizationId
          && entry.auditEvent.entityId === row.id));
        const stale = await tx.hrEmailOutbox.updateMany({
          where: { id: row.id, organizationId, version: row.version, claimId: 'stale' },
          data: { version: { increment: 1 } },
        });
        assert.equal(stale.count, 0);
        invocationVerified = true;
        return { provider: 'resend', status: 'sent', invoked: true, providerMessageId: run };
      });
      const expired = await fixture('expired', {
        status: 'PROCESSING', dispatchPhase: 'ATTEMPTED', dispatchId: run + '_dispatch',
        claimId: run + '_owner', claimedAt: new Date(0), claimExpiresAt: new Date(1), attemptCount: 1,
      });
      const recoveredAttempt = await tx.hrEmailDeliveryAttempt.create({
        data: { outboxId: expired.id, attemptNumber: 1, status: 'PROCESSING' },
      });
      await dispatcher(failSend, [expired.id]).processBatch();
      assert.deepEqual(await tx.hrEmailDeliveryAttempt.findUnique({
        where: { id: recoveredAttempt.id },
      }), recoveredAttempt);
      const held = await tx.hrEmailOutbox.findUniqueOrThrow({ where: { id: expired.id } });
      assert.equal(held.status, 'HELD');
      assert.equal(held.holdReason, 'PROVIDER_OUTCOME_UNCERTAIN');
      assert.equal(held.version, 1n);
      assert.equal(held.claimId, null);
      assert.equal(held.attemptCount, 1);
      const recovery = await tx.hrEmailDispatchEvent.findFirstOrThrow({
        where: { outboxId: expired.id, transitionVersion: 1n }, include: { auditEvent: true },
      });
      assert.equal(recovery.kind, 'HELD');
      assert.equal(recovery.auditEvent?.entityId, expired.id);
      assert.equal((await dispatcher(failSend).processItem(expired.id, organizationId)).claimed, 0);

      await tx.hrAccountInvitation.create({ data: {
        id: credentialId, organizationId, userId, createdById: userId,
        tokenHash: run, expiresAt: new Date(now.getTime() + 600_000),
      } });
      const credential = await fixture('credential', {
        recipient: 'aurora@example.invalid', template: 'hr-account-invitation',
        invitationId: credentialId, messageExpiresAt: new Date(now.getTime() + 600_000),
      });
      assert.equal((await tx.hrAccountInvitation.updateMany({
        where: { id: credentialId, organizationId, status: 'ACTIVE' }, data: { status: 'REVOKED' },
      })).count, 1);
      assert.equal((await dispatcher(failSend).processItem(credential.id, organizationId)).held, 1);
      assert.equal((await tx.hrEmailOutbox.findUniqueOrThrow({ where: { id: credential.id } })).holdReason,
        'CREDENTIAL_EXPIRED_OR_UNUSABLE');
      assert.equal(fakeCalls, 0);
      assert.equal((await delivery.processItem(row.id, organizationId)).delivered, 1);
      assert.equal(invocationVerified, true);
      assert.equal((await delivery.processItem(row.id, organizationId)).claimed, 0);
      assert.equal(fakeCalls, 1);
      const delivered = await tx.hrEmailOutbox.findUniqueOrThrow({ where: { id: row.id } });
      assert.equal(delivered.version, 5n);
      assert.equal(delivered.attemptCount, 1);
      assert.equal(delivered.claimId, null);
      const outcome = await tx.hrEmailDispatchEvent.findFirstOrThrow({
        where: { outboxId: row.id, transitionVersion: 5n }, include: { auditEvent: true },
      });
      assert.equal(outcome.kind, 'PROVIDER_ACCEPTED');
      assert.equal(outcome.dispatchId, delivered.dispatchId);
      assert.equal(outcome.auditEvent?.entityId, row.id);
      const attempts = await tx.hrEmailDeliveryAttempt.findMany({ where: { outboxId: row.id } });
      assert.deepEqual(attempts.map(attempt => attempt.status), ['PROCESSING']);
      try {
        await tx.hrEmailDeliveryAttempt.create({
          data: { outboxId: row.id, attemptNumber: 1, status: 'PROCESSING' },
        });
      } catch (error) {
        if (error.code !== 'P2002') throw error;
        throw rollback;
      }
      throw Error('NATIVE_M20_DUPLICATE_ATTEMPT_ACCEPTED');
    }, { maxWait: 3000, timeout: 20_000 });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  await client.$transaction(async tx => {
    await verifySession(tx);
    const outbox = { in: fixtureIds };
    assert.equal(await tx.hrEmailOutbox.count({ where: { id: outbox } }), 0);
    assert.equal(await tx.hrEmailDeliveryAttempt.count({ where: { outboxId: outbox } }), 0);
    assert.equal(await tx.hrEmailDispatchEvent.count({ where: { outboxId: outbox } }), 0);
    assert.equal(await tx.hrAuditEvent.count({ where: { entityId: outbox } }), 0);
    assert.equal(await tx.hrAccountInvitation.count({ where: { id: credentialId } }), 0);
  }, { maxWait: 3000, timeout: 5000 });
  await record({ claim: true, cas: true, staleRejected: true, attemptCreated: true, attemptClosure: 'APPEND_ONLY_JOURNAL', duplicateRejected: true, replayPrevented: true,
    auditAndJournal: true, expiredClaimHeld: true, revokedInvitationHeld: true,
    rollback: true, fakeCalls });
}
