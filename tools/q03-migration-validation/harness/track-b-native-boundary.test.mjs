import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { dockerTrackBProfile as profile } from './track-b-docker-gate.mjs';
import { fingerprintNativeBoundarySource, rehearseNativeTrackBBoundary, verifyNativeCancellation, verifyNativeInputs, verifyNativeResources } from './track-b-native-boundary.mjs';

const labels = { 'zentric.q03.replacement': 'true' };
const fingerprint = digit => digit.repeat(64);
const evidenceDirectory = process.env.Q03_TRACK_B_TEST_EVIDENCE;
const sourceFingerprint = await fingerprintNativeBoundarySource();

function fixture(seed) {
  const binding = {
    runId: fingerprint(seed), engineFingerprint: fingerprint('1'), containerId: fingerprint('2'),
    networkId: fingerprint('3'), volumeFingerprint: fingerprint('4'),
    imageId: 'sha256:8bca9649e52d948114ccc8164b55b7ab26b64e729893e420114bb5c87bf7c7cc',
    sourceFingerprint, baselineRole: 'q03_baseline_role', targetRole: 'q03_target_role',
  };
  const resources = {
    engine: { backend: 'docker-engine-wsl2', platform: 'linux/amd64', engineFingerprint: binding.engineFingerprint },
    container: {
      Id: binding.containerId, Name: '/' + profile.container, Image: binding.imageId,
      State: { Running: true, Status: 'running' }, Config: { Labels: labels },
      HostConfig: { RestartPolicy: { Name: 'no' }, Privileged: false, PublishAllPorts: false },
      Mounts: [{ Name: profile.volume, Type: 'volume', Destination: profile.mount, RW: true }],
      NetworkSettings: { Networks: { [profile.network]: { NetworkID: binding.networkId } }, Ports: { '5432/tcp': null } },
    },
    network: {
      Id: binding.networkId, Name: profile.network, Driver: 'bridge', Internal: true, Labels: labels,
      Containers: { [binding.containerId]: {} },
    },
    volume: { Name: profile.volume, Driver: 'local', Labels: labels, fingerprint: binding.volumeFingerprint },
    image: { Id: binding.imageId, Os: 'linux', Architecture: 'amd64', RepoDigests: ['postgres@' + profile.postgresManifest] },
    egressVerified: true, storageVerified: true, runnerMountIsolationVerified: true, syntheticCredentialsVerified: true,
  };
  const steps = [];
  const ledger = [];
  const transport = {
    mode: 'offline-fixture',
    step(stage, migrations) {
      steps.push([stage, migrations.length]);
      ledger.push(...migrations.map(row => ({ ...row, finished: true, rolledBack: null, steps: 1, logs: null })));
      return {
        verified: true, runId: binding.runId, resources, targetExists: false,
        baseline: profile.baseline, baselineReadOnly: true, baselinePublicObjects: 0,
        baselineRole: binding.baselineRole, targetPrivilegesScoped: true,
        target: profile.target, createdOnce: true, owner: binding.targetRole, publicObjects: 0,
        ledger: structuredClone(ledger),
      };
    },
  };
  return { binding, resources, transport, steps, evidenceDirectory };
}

test('verifies all pinned inputs before reserving a run', async () => {
  const migrations = await verifyNativeInputs();
  assert.equal(migrations.length, 68);
  assert.equal(migrations[66].name, '20261029000100_email_queue_held_enum');
  assert.equal(migrations[67].name, '20261029000200_email_queue_safety_contract');
});

for (const [name, mutate] of [
  ['wrong engine', r => { r.engine.engineFingerprint = fingerprint('9'); }],
  ['wrong image repository digest', r => { r.image.RepoDigests = ['postgres@sha256:' + fingerprint('9')]; }],
  ['published port', r => { r.container.NetworkSettings.Ports['5432/tcp'] = [{ HostPort: '5432' }]; }],
  ['extra mount', r => { r.container.Mounts.push({ Type: 'bind', Destination: '/run/docker.sock' }); }],
  ['unverified egress', r => { r.egressVerified = false; }],
  ['unverified storage', r => { r.storageVerified = false; }],
  ['extra network peer', r => { r.network.Containers[fingerprint('9')] = {}; }],
]) {
  test('rejects ' + name, () => {
    const { binding, resources } = fixture('a');
    assert.doesNotThrow(() => verifyNativeResources(binding, resources));
    mutate(resources);
    assert.throws(() => verifyNativeResources(binding, resources), /NATIVE_RESOURCE_/);
  });
}

test('uses only fixed stages and the exact 66 plus 2 migration groups', async () => {
  const run = fixture('a');
  await rehearseNativeTrackBBoundary(run);
  assert.deepEqual(run.steps, [
    ['preflight', 0], ['create-target', 0], ['apply-historical', 66],
    ['seed-and-capture-legacy', 0], ['apply-upgrade', 2], ['verify-upgrade', 0], ['verify-behavior', 0],
  ]);
  await assert.rejects(rehearseNativeTrackBBoundary(run), { code: 'EEXIST' });
  assert.equal(run.steps.length, 7);
});

test('collision or ambiguity cannot advance; marker records only fixed fields', async () => {
  const run = fixture('b');
  const step = run.transport.step;
  run.transport.step = (...args) => ({ ...step(...args), targetExists: null, secret: 'omit-this' });
  await assert.rejects(rehearseNativeTrackBBoundary(run), /STOPPED_PRESERVE/);
  assert.deepEqual(run.steps, [['preflight', 0]]);
  const evidence = await readFile(join(evidenceDirectory, 'native-track-b-' + run.binding.runId + '.jsonl'), 'utf8');
  assert.match(evidence, /stop-preserve/);
  assert.doesNotMatch(evidence, /omit-this/);
});

test('timeout during create preserves evidence and prevents replay and migration', async () => {
  const run = fixture('c');
  const step = run.transport.step;
  let aborted = false;
  run.timeoutMs = 50;
  run.transport.step = (stage, migrations, signal) => {
    const receipt = step(stage, migrations);
    if (stage !== 'create-target') return receipt;
    return new Promise(resolve => signal.addEventListener('abort', () => { aborted = true; resolve(receipt); }, { once: true }));
  };
  const keepAlive = setInterval(() => {}, 25);
  try {
    await assert.rejects(rehearseNativeTrackBBoundary(run), /STOPPED_PRESERVE/);
    assert.equal(aborted, true);
    assert.deepEqual(run.steps, [['preflight', 0], ['create-target', 0]]);
    await assert.rejects(rehearseNativeTrackBBoundary(run), { code: 'EEXIST' });
  } finally {
    clearInterval(keepAlive);
  }
});

test('refuses live mode before invoking a transport', async () => {
  const run = fixture('d');
  run.transport.mode = 'live';
  await assert.rejects(rehearseNativeTrackBBoundary(run), /LIVE_ENTRY_DISABLED/);
  assert.deepEqual(run.steps, []);
});

test('refuses a changed source binding before invoking a transport', async () => {
  const run = fixture('f');
  run.binding.sourceFingerprint = fingerprint('0');
  await assert.rejects(rehearseNativeTrackBBoundary(run), /SOURCE_FINGERPRINT_MISMATCH/);
  assert.deepEqual(run.steps, []);
});

test('halts before seeding if a historical ledger checksum differs', async () => {
  const run = fixture('e');
  const step = run.transport.step;
  run.transport.step = (...args) => {
    const receipt = step(...args);
    if (args[0] === 'apply-historical') receipt.ledger[0].checksum = fingerprint('0');
    return receipt;
  };
  await assert.rejects(rehearseNativeTrackBBoundary(run), /STOPPED_PRESERVE/);
  assert.deepEqual(run.steps.map(([stage]) => stage), ['preflight', 'create-target', 'apply-historical']);
});

test('cancellation rejects a reused backend PID with a different start time', () => {
  const runId = fingerprint('e');
  const expected = {
    runId, pid: 130, backendStart: '2026-01-01T00:00:00Z', database: profile.target,
    role: 'q03_target_role', tag: 'q03b_' + runId.slice(0, 24),
  };
  assert.doesNotThrow(() => verifyNativeCancellation(expected, { ...expected }));
  assert.throws(() => verifyNativeCancellation(expected, { ...expected, backendStart: '2026-01-01T00:01:00Z' }),
    /CANCELLATION_IDENTITY_REJECTED/);
});
