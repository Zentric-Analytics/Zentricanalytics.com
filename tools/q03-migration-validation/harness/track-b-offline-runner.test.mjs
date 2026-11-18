import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { B1 } from './b1-contract.mjs';
import { RACE_CASES } from './db-tests.mjs';
import { HISTORICAL_ATTEMPT, HISTORICAL_AUDIT, HISTORICAL_OUTBOX } from './evidence-rules.mjs';
import { id } from './fixtures.mjs';
import { runTrackBOffline } from './track-b-offline-runner.mjs';

const sequence = [
  'preflight', 'create-target', 'apply-historical', 'seed-and-capture-legacy',
  'apply-upgrade', 'verify-upgrade', 'verify-behavior',
];
const projection = (fields, values) => Object.assign(Object.fromEntries(fields.map(field => [field, null])), values);

function fixture() {
  const snapshot = { outbox: [], attempts: [], audit: [] };
  for (const [index, status] of ['PENDING', 'PROCESSING', 'FAILED', 'DELIVERED', 'ABANDONED'].entries()) {
    const outboxId = id('legacy_' + status.toLowerCase());
    snapshot.outbox.push(projection(HISTORICAL_OUTBOX, {
      id: outboxId, status, recipient: 'legacy-' + index + '@example.invalid', attemptCount: index,
    }));
    for (let number = 1; number <= index; number++) {
      snapshot.attempts.push(projection(HISTORICAL_ATTEMPT, {
        id: id('legacy_attempt_' + index + '_' + number), status, outboxId, attemptNumber: number,
      }));
    }
  }
  for (const name of ['audit_aurora', 'audit_cobalt']) {
    snapshot.audit.push(projection(HISTORICAL_AUDIT, { id: id(name) }));
  }
  return snapshot;
}

function adapter(transform = (_, receipt) => receipt) {
  const calls = [];
  const snapshot = fixture();
  const ledger = [];
  const fake = {
    mode: 'offline-fixture',
    step(name, options, signal) {
      calls.push(name);
      assert.equal(options.target, 'q03_1960147fab_track_b');
      const replies = {
        preflight: () => ({
          resources: { ...options.resources }, runtime: { ...options.runtime },
          database: B1.baseline, role: B1.role, readOnly: true, publicObjects: 0, syntheticOnly: true, targetExists: false,
        }),
        'create-target': () => ({ database: options.target, owner: B1.role, publicObjects: 0, created: true }),
        'apply-historical': () => addMigrations(66),
        'seed-and-capture-legacy': () => ({
          snapshot: structuredClone(snapshot), safetyMetadataAbsent: true,
          baseHash: options.fixtureHashes.base, legacyHash: options.fixtureHashes.legacy,
        }),
        'apply-upgrade': () => {
          assert.deepEqual(options.migrations.map(row => row.name), [
            '20261029000100_email_queue_held_enum', '20261029000200_email_queue_safety_contract',
          ]);
          return addMigrations(2);
        },
        'verify-upgrade': () => ({ snapshot: structuredClone(snapshot), catalogVerified: true, safetyShapeVerified: true }),
        'verify-behavior': () => ({
          constraintsVerified: true,
          journalVerified: true, rollbackVerified: true, syntheticSessionsClosed: true,
          races: RACE_CASES.map(([name, , left]) => {
            const interrupted = name === 'interrupted_lock';
            return {
              name, interrupted, leader: interrupted ? null : 1, follower: interrupted ? 1 : 0,
              version: 1, events: 1, eventVersion: 1, counter: left === 'INVOCATION_BOUNDARY' ? 1 : 0,
              proof: { q03Overlap: true, chain: true, controller: 11, leader: 12, follower: 13 },
            };
          }),
        }),
      };
      function addMigrations(count) {
        assert.equal(options.migrations.length, count);
        ledger.push(...options.migrations.map(row => ({ ...row, finished: true, rolledBack: null, steps: 1, logs: null })));
        return structuredClone(ledger);
      }
      return transform(name, replies[name](), signal);
    },
  };
  return { fake, calls };
}

async function evidencePath() {
  assert.ok(process.env.Q03_TRACK_B_TEST_EVIDENCE, 'Supply an external writable Q03_TRACK_B_TEST_EVIDENCE directory');
  const dir = await mkdtemp(join(process.env.Q03_TRACK_B_TEST_EVIDENCE, 'track-b-'));
  return join(dir, 'track-b-proof.jsonl');
}

const events = async path => (await readFile(path, 'utf8')).trim().split('\n').map(line => JSON.parse(line));

test('offline runner records the exact stage order and will not reuse an evidence marker', async () => {
  const path = await evidencePath();
  const { fake, calls } = adapter();
  assert.equal(await runTrackBOffline({ fake, evidencePath: path }), 'OFFLINE_PASS');
  assert.deepEqual(calls, sequence);
  const recorded = await events(path);
  assert.deepEqual(recorded.filter(event => event.event === 'verified').map(event => event.stage), sequence);
  assert.deepEqual(recorded.filter(event => event.migrationCount).map(event => event.migrationCount), [66, 68]);
  assert.equal(recorded.find(event => event.raceCount).raceCount, 7);
  assert.equal(recorded.at(-1).event, 'offline-pass');
  await assert.rejects(runTrackBOffline({ fake, evidencePath: path }), { code: 'EEXIST' });
  assert.deepEqual(calls, sequence);
  assert.deepEqual(await events(path), recorded);
});

test('an absent or real-mode adapter fails before evidence or any operation', async () => {
  const path = await evidencePath();
  await assert.rejects(runTrackBOffline({ evidencePath: path }), /OFFLINE_ADAPTER_REQUIRED/);
  await assert.rejects(runTrackBOffline({
    evidencePath: path, fake: { mode: 'real', step: () => assert.fail('real step called') },
  }), /OFFLINE_ADAPTER_REQUIRED/);
  await assert.rejects(readFile(path), { code: 'ENOENT' });
});

for (const [name, stage, change, failure] of [
  ['resource mismatch', 'preflight', receipt => { receipt.resources.publishedPorts = 1; }, 'RESOURCE_MISMATCH'],
  ['unverified collision result', 'preflight', receipt => { delete receipt.targetExists; }, 'TARGET_COLLISION_OR_UNKNOWN'],
  ['known collision', 'preflight', receipt => { receipt.targetExists = true; }, 'TARGET_COLLISION_OR_UNKNOWN'],
  ['wrong created database', 'create-target', receipt => { receipt.database = B1.database; }, 'TARGET_CREATION_UNVERIFIED'],
  ['migration checksum mismatch', 'apply-historical', receipt => { receipt[0].checksum = 'invalid'; }, 'STEP_OR_EVIDENCE_REJECTED'],
  ['wrong fixture hash', 'seed-and-capture-legacy', receipt => { receipt.legacyHash = 'invalid'; }, 'FIXTURE_HASH_MISMATCH'],
  ['nonfixture recipient', 'seed-and-capture-legacy', receipt => { receipt.snapshot.outbox[0].recipient = 'other@example.invalid'; }, 'SYNTHETIC_SNAPSHOT_REQUIRED'],
  ['historical mutation', 'verify-upgrade', receipt => { receipt.snapshot.outbox[0].subject = 'changed'; }, 'STEP_OR_EVIDENCE_REJECTED'],
  ['missing race', 'verify-behavior', receipt => { receipt.races.pop(); }, 'RACE_SET_INCOMPLETE'],
  ['wrong race winner', 'verify-behavior', receipt => { receipt.races[0].follower = 1; }, 'RACE_OUTCOME_MISMATCH'],
  ['incomplete overlap proof', 'verify-behavior', receipt => { receipt.races[0].proof.chain = false; }, 'STEP_OR_EVIDENCE_REJECTED'],
]) {
  test('stops and preserves evidence for ' + name, async () => {
    const path = await evidencePath();
    const { fake, calls } = adapter((operation, receipt) => {
      if (operation === stage) change(receipt);
      return receipt;
    });
    await assert.rejects(runTrackBOffline({ fake, evidencePath: path }), { message: failure });
    assert.deepEqual(calls, sequence.slice(0, sequence.indexOf(stage) + 1));
    assert.deepEqual((await events(path)).at(-1), { mode: 'offline-fixture', event: 'stop-preserve', stage, reason: failure });
  });
}

test('adapter rejection is redacted from both the caller and durable evidence', async () => {
  const path = await evidencePath();
  const secret = 'synthetic-sensitive-credential';
  const { fake } = adapter(() => { throw Error(secret); });
  await assert.rejects(runTrackBOffline({ fake, evidencePath: path }), { message: 'STEP_OR_EVIDENCE_REJECTED' });
  assert.ok(!(await readFile(path, 'utf8')).includes(secret));
});

for (const cancelled of [false, true]) {
  test(cancelled ? 'caller cancellation interrupts a stage' : 'deadline bounds a noncooperative fake stage', async () => {
    const path = await evidencePath();
    const controller = new AbortController();
    let observedSignal;
    const { fake, calls } = adapter((name, receipt, signal) => {
      if (name !== 'apply-historical') return receipt;
      observedSignal = signal;
      if (cancelled) controller.abort();
      return new Promise(() => {});
    });
    const reason = cancelled ? 'CANCELLED' : 'TIMEOUT';
    await assert.rejects(runTrackBOffline({ fake, evidencePath: path, signal: controller.signal, timeoutMs: 25 }), { message: reason });
    assert.equal(observedSignal.aborted, true);
    assert.deepEqual(calls, sequence.slice(0, 3));
    assert.equal((await events(path)).at(-1).reason, reason);
  });
}
