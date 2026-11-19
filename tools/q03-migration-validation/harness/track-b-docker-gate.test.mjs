import assert from 'node:assert/strict';
import { test } from 'node:test';
import { B1 } from './b1-contract.mjs';
import { createDockerTrackBOfflineGate, dockerTrackBBindingDigest, dockerTrackBProfile, matchesDockerCancellation } from './track-b-docker-gate.mjs';

const binding = Object.freeze({
  hostFingerprint: '1'.repeat(64), engineFingerprint: '2'.repeat(64), containerId: '3'.repeat(64),
  networkId: '4'.repeat(64), postgresImageId: '5'.repeat(64), runnerImageId: '6'.repeat(64),
  volumeFingerprint: '7'.repeat(64), sourceFingerprint: '8'.repeat(64), runId: '9'.repeat(64),
  baselineRole: 'q03_baseline_reader', targetRole: 'q03_target_owner',
});
const approval = {
  scope: 'DOCKER_REPLACEMENT_TRACK_B_OFFLINE_FIXTURE',
  bindingDigest: dockerTrackBBindingDigest(binding),
  expiresAt: 2000,
};
const gate = () => createDockerTrackBOfflineGate({ mode: 'offline-fixture', binding, approval, now: 1000 });
const receipt = { runId: binding.runId, markerSynced: true, outcome: 'verified' };
const preflight = {
  ...receipt, markerCreatedExclusively: true,
  observation: {
    profile: dockerTrackBProfile, identity: binding, baselineRole: binding.baselineRole, targetRole: binding.targetRole,
    baselineReadOnly: true, baselinePublicObjects: 0, targetPrivilegesScoped: true,
    internalNetwork: true, publishedPorts: 0, databaseOnlyPeer: true, runnerVolumeMount: false,
    runnerSocketMount: false, externalEgressDenied: true, offlineAcquisitionClosed: true,
    restartDisabled: true, targetExists: false,
  },
};
const created = { ...receipt, createdOnce: true, target: dockerTrackBProfile.target, ownerRole: binding.targetRole, publicObjects: 0 };

test('only the ordered replacement track is admitted in fixture mode', () => {
  const run = gate();
  assert.equal(run.accept('preflight', preflight, 1001), 'create-target');
  assert.equal(run.accept('create-target', created, 1002), 'apply-historical');
  const remaining = ['apply-historical', 'seed-and-capture-legacy', 'apply-upgrade', 'verify-upgrade', 'verify-behavior'];
  for (const [index, stage] of remaining.entries()) {
    assert.equal(run.accept(stage, receipt, 1003 + index), remaining[index + 1] ?? 'offline-complete');
  }
  assert.throws(() => run.accept('preflight', preflight, 1010), /DOCKER_STAGE_ORDER_REJECTED/);
  assert.throws(() => run.accept('preflight', preflight, 1010), /DOCKER_STOP_PRESERVE/);
});

test('blocks live mode, unbound or expired approvals, extra binding data and original resources', () => {
  assert.throws(() => createDockerTrackBOfflineGate({ mode: 'live', binding, approval, now: 1000 }), /DOCKER_LIVE_EXECUTION_UNAVAILABLE/);
  assert.throws(() => createDockerTrackBOfflineGate({ mode: 'offline-fixture', binding, now: 1000 }), /DOCKER_APPROVAL_INVALID/);
  assert.throws(() => createDockerTrackBOfflineGate({ mode: 'offline-fixture', binding, approval, now: 2000 }), /DOCKER_APPROVAL_INVALID/);
  assert.throws(() => createDockerTrackBOfflineGate({
    mode: 'offline-fixture', binding: { ...binding, networkId: 'a'.repeat(64) }, approval, now: 1000,
  }), /DOCKER_APPROVAL_INVALID/);
  assert.throws(() => dockerTrackBBindingDigest({ ...binding, unexpected: 'synthetic' }), /DOCKER_BINDING_MISSING_OR_INVALID/);
  assert.throws(() => dockerTrackBBindingDigest({ ...binding, containerId: B1.container }), /ORIGINAL_TARGET_FORBIDDEN/);
});

for (const [key, value, reason] of [
  ['targetExists', true, 'DOCKER_TARGET_EXISTS_OR_UNKNOWN'],
  ['targetExists', undefined, 'DOCKER_TARGET_EXISTS_OR_UNKNOWN'],
  ['publishedPorts', 1, 'DOCKER_ISOLATION_UNVERIFIED'],
  ['externalEgressDenied', undefined, 'DOCKER_ISOLATION_UNVERIFIED'],
  ['runnerSocketMount', true, 'DOCKER_ISOLATION_UNVERIFIED'],
  ['offlineAcquisitionClosed', false, 'DOCKER_ISOLATION_UNVERIFIED'],
  ['identity', { ...binding, networkId: 'a'.repeat(64) }, 'DOCKER_IDENTITY_MISMATCH'],
  ['baselinePublicObjects', 1, 'DOCKER_DATABASE_SCOPE_MISMATCH'],
]) {
  test('stops on preflight mismatch for ' + key + ' ' + reason, () => {
    const run = gate();
    assert.throws(() => run.accept('preflight', {
      ...preflight, observation: { ...preflight.observation, [key]: value },
    }, 1001), { message: reason });
    assert.throws(() => run.accept('create-target', created, 1002), /DOCKER_STOP_PRESERVE/);
  });
}

test('rejects a reused marker and an ambiguous or misdirected create without permitting replay', () => {
  const stale = gate();
  assert.throws(() => stale.accept('preflight', { ...preflight, markerCreatedExclusively: false }, 1001), /DOCKER_RUN_MARKER_REUSED_OR_UNKNOWN/);
  for (const result of [{ ...created, outcome: 'unknown' }, { ...created, target: B1.database }, { ...created, markerSynced: false }]) {
    const run = gate();
    run.accept('preflight', preflight, 1001);
    assert.throws(() => run.accept('create-target', result, 1002), /DOCKER_(OUTCOME|CREATE)_UNVERIFIED/);
    assert.throws(() => run.accept('create-target', created, 1003), /DOCKER_STOP_PRESERVE/);
  }
});

test('cancellation and expiry prevent further stage admission', () => {
  const cancelled = gate();
  cancelled.cancel();
  assert.throws(() => cancelled.accept('preflight', preflight, 1001), /DOCKER_STOP_PRESERVE/);
  const expired = gate();
  expired.accept('preflight', preflight, 1001);
  assert.throws(() => expired.accept('create-target', created, 2000), /DOCKER_APPROVAL_EXPIRED_OR_CLOCK_REGRESSED/);
  assert.throws(() => expired.accept('create-target', created, 1002), /DOCKER_STOP_PRESERVE/);
});

test('only an exact freshly observed synthetic backend matches a cancellation request', () => {
  const expected = {
    runId: binding.runId, pid: 120, backendStart: '2026-11-18T19:00:00Z',
    database: dockerTrackBProfile.target, role: binding.targetRole, tag: 'q03b_' + binding.runId.slice(0, 24),
  };
  assert.equal(matchesDockerCancellation(expected, { ...expected }), true);
  for (const change of [{ backendStart: '2026-11-18T19:00:01Z' }, { pid: 121 }, { role: 'q03_other' },
    { database: B1.database }, { tag: 'wrong' }, { runId: '0'.repeat(64) }]) {
    assert.equal(matchesDockerCancellation(expected, { ...expected, ...change }), false);
  }
  assert.equal(matchesDockerCancellation(expected, null), false);
});
