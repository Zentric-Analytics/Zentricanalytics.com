import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { B1, digest } from './b1-contract.mjs';
import { nativeAuthorityMessage } from './track-b-native-postgres.mjs';
import { buildNativeMaintenanceScript } from './track-b-native-creation-host.mjs';
import { assertNativeCreationConfirmed, reconcileNativeCreation, runNativeCreationReservation } from './track-b-native-reservation.mjs';

const journalName = 'q03_replacement_track_b.creation.jsonl';
const now = Date.now();
const { publicKey: authorityKey, privateKey } = generateKeyPairSync('ed25519');
const hex = n => String(n).repeat(64);

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'zentric-creation-test-'));
  const binding = {
    target: 'q03_replacement_track_b', clusterId: '1234567890123456789',
    runId: hex(1), containerId: hex(2), engineFingerprint: hex(3), sourceFingerprint: hex(4),
    inputManifest: B1.manifest, provisioningReceipt: hex(5), runnerImageId: 'sha256:' + hex(6),
    operationSet: 'Q03_NATIVE_TRACK_B_66_PLUS_2_V1',
  };
  const approval = { scope: 'Q03_NATIVE_TRACK_B_WRITE', issuedAt: now - 1000, expiresAt: now + 120_000,
    bindingDigest: digest(JSON.stringify(binding)), provisioningReceipt: binding.provisioningReceipt };
  approval.signature = sign(null, nativeAuthorityMessage(approval), privateKey).toString('base64url');
  const preflight = () => ({ targetAbsent: true, clusterId: binding.clusterId });
  const reconcile = () => ({ clusterId: binding.clusterId, database: binding.target,
    owner: 'q03_replacement_owner', empty: true, restricted: true, baselineUnchanged: true });
  return { directory, binding, approval, authorityKey, preflight, create: () => {}, reconcile };
}

const linux = { skip: process.platform !== 'linux' };
const states = async dir => (await readFile(join(dir, journalName), 'utf8')).trim().split('\n')
  .map(line => JSON.parse(line).state);

test('compiled maintenance program parses and restores the exact socket-only HBA', linux, async () => {
  const { binding } = await fixture();
  const script = buildNativeMaintenanceScript({ ...binding, serverMarker: hex(9) });
  assert.equal(spawnSync('/bin/bash', ['-n'], { input: script }).status, 0);
  assert.match(script, /trap restore_hba EXIT/);
  assert.match(script, /local postgres postgres peer/);
  assert.match(script, /REVOKE ALL ON DATABASE "q03_replacement_track_b" FROM PUBLIC/);
  assert.match(script, /test "\$original" = "\$expected"/);
  assert.throws(() => buildNativeMaintenanceScript({ ...binding, serverMarker: 'bad' }), /MARKER_REJECTED/);
});

test('only one competing controller gets to creation; restart refuses replay', linux, async () => {
  const options = await fixture();
  let count = 0;
  options.create = () => { count++; };
  const results = await Promise.allSettled([runNativeCreationReservation(options), runNativeCreationReservation(options)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 'EEXIST');
  assert.deepEqual(await states(options.directory), ['RESERVED', 'STARTED', 'CONFIRMED']);
  await assertNativeCreationConfirmed(options.directory, options.binding);
  await assert.rejects(runNativeCreationReservation(options), { code: 'EEXIST' });
  assert.equal(count, 1);
});

test('an unknown result stays consumed and is reconciled read-only', linux, async () => {
  const p = await fixture();
  p.create = () => { throw Error('sensitive subprocess diagnostic'); };
  await assert.rejects(runNativeCreationReservation(p), /UNCERTAIN_PRESERVE/);
  assert.deepEqual(await states(p.directory), ['RESERVED', 'STARTED', 'UNCERTAIN']);
  await assert.rejects(runNativeCreationReservation(p), { code: 'EEXIST' });
  await assert.rejects(assertNativeCreationConfirmed(p.directory, p.binding), /CONFIRMATION_REQUIRED/);
  const result = await reconcileNativeCreation({ ...p, observe: p.preflight });
  assert.equal(result.confirmed, false);
  assert.equal(result.observed.targetAbsent, true);
});

test('a process crash after STARTED blocks a fresh controller', linux, async () => {
  const p = await fixture();
  const moduleUrl = new URL('./track-b-native-reservation.mjs', import.meta.url).href;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { readFileSync } from 'node:fs';
    import { createPublicKey } from 'node:crypto';
    import { runNativeCreationReservation } from ${JSON.stringify(moduleUrl)};
    const input = JSON.parse(readFileSync(0, 'utf8'));
    await runNativeCreationReservation({
      ...input, authorityKey: createPublicKey(input.pem),
      preflight: () => ({ targetAbsent: true, clusterId: input.binding.clusterId }),
      create: () => process.exit(31),
    });
  `], {
    input: JSON.stringify({ ...p, pem: authorityKey.export({ type: 'spki', format: 'pem' }) }),
    timeout: 10000,
  });
  assert.equal(child.status, 31, child.stderr?.toString());
  assert.deepEqual(await states(p.directory), ['RESERVED', 'STARTED']);
  await assert.rejects(runNativeCreationReservation(p), { code: 'EEXIST' });
  await assert.rejects(assertNativeCreationConfirmed(p.directory, p.binding), /CONFIRMATION_REQUIRED/);
});

test('signature, expiry, collision, manifest, alias, and empty reservation fail closed', linux, async () => {
  const p = await fixture();
  const trap = () => assert.fail('database operation was reached');
  await assert.rejects(runNativeCreationReservation({ ...p, approval: {}, create: trap }), /AUTHORITY_REJECTED/);
  await assert.rejects(runNativeCreationReservation({ ...p, now: () => p.approval.expiresAt, create: trap }), /AUTHORITY_REJECTED/);
  await assert.rejects(runNativeCreationReservation({ ...p, binding: { ...p.binding, inputManifest: hex(0) }, create: trap }),
    /BINDING_REJECTED/);
  await assert.rejects(runNativeCreationReservation({ ...p, preflight: () => ({ targetAbsent: false }), create: trap }),
    /PREFLIGHT_REJECTED/);
  const alias = p.directory + '-alias';
  await symlink(p.directory, alias);
  await assert.rejects(runNativeCreationReservation({ ...p, directory: alias, create: trap }), /DIRECTORY_REJECTED/);
  await writeFile(join(p.directory, journalName), '', { flag: 'wx', mode: 0o600 });
  await assert.rejects(runNativeCreationReservation({ ...p, create: trap }), { code: 'EEXIST' });
  await assert.rejects(reconcileNativeCreation({ ...p, observe: trap }), /JOURNAL_INCOMPLETE/);
});
