import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { test } from 'node:test';
import { B1, digest } from './b1-contract.mjs';
import { confirmLocalOperator, localMode, verifyLocalHostApproval } from './track-b-native-local-authority.mjs';
import { nativeAuthorityMessage, verifyNativeRuntimeApproval, verifyNativeSignedAuthority } from './track-b-native-postgres.mjs';

const hex = n => String(n).repeat(64);
const binding = {
  authorizationMode: localMode, environment: 'local-synthetic', target: 'q03_replacement_track_b',
  baseline: 'q03_replacement_baseline', targetRole: 'q03_replacement_runner', ownerRole: 'q03_replacement_owner',
  context: { name: 'default', endpoint: 'unix:///var/run/docker.sock', socketRealpath: '/run/docker.sock', remoteOverridesAbsent: true },
  operationSet: 'Q03_NATIVE_TRACK_B_66_PLUS_2_V1', clusterId: '1234567890123456789',
  runId: hex(1), containerId: hex(2), runnerImageId: 'sha256:' + hex(3), sourceFingerprint: hex(4),
  inputManifest: B1.manifest, provisioningReceipt: hex(5),
};

function mockTerminal(claim, settings = {}) {
  let prompt;
  return {
    interactive: true, uid: 0, device: '/dev/pts/9', ...settings,
    show(value) { prompt = value; },
    read() { return claim(prompt); },
  };
}

function respond(prompt) {
  assert.match(prompt, /Baseline and unrelated databases are excluded/);
  assert.match(prompt, /one-time database creation/);
  const token = /token: ([a-f0-9]{24})/.exec(prompt)[1];
  return binding.target + ' ' + token;
}

test('interactive consent issues an in-process, exact-binding local approval', async () => {
  const approval = await confirmLocalOperator(binding, mockTerminal(respond));
  assert.equal(approval.mode, localMode);
  await verifyNativeRuntimeApproval(approval, binding, 'host');
  assert.throws(() => verifyLocalHostApproval({ ...approval }, binding), /CONFIRMATION_REQUIRED/);
  for (const change of [{ clusterId: '2234567890123456789' }, { containerId: hex(8) },
    { sourceFingerprint: hex(8) }, { runnerImageId: 'sha256:' + hex(9) }, { inputManifest: hex(0) }]) {
    assert.throws(() => verifyLocalHostApproval(approval, { ...binding, ...change }), /CONFIRMATION_REQUIRED/);
  }
});

test('local consent rejects unverified terminal and operator identity before reading', async () => {
  const rejectRead = () => assert.fail('read attempted');
  for (const settings of [{ interactive: false }, { uid: 1000 }, { device: '/dev/null' }]) {
    await assert.rejects(confirmLocalOperator(binding, mockTerminal(rejectRead, settings)), /TERMINAL_REQUIRED/);
  }
});

test('piped yes, prefilled token, wrong database and empty confirmation fail closed', async () => {
  for (const value of ['yes', 'q03_replacement_track_b ' + '0'.repeat(24), 'q03_replacement_baseline', '', 'q03_replacement_track_b']) {
    await assert.rejects(confirmLocalOperator(binding, mockTerminal(() => value)), /CONFIRMATION_REJECTED/);
  }
  let time = Date.now();
  const terminal = mockTerminal(prompt => { time += 300_000; return respond(prompt); });
  await assert.rejects(confirmLocalOperator(binding, terminal, () => time), /CONFIRMATION_REJECTED/);
});

test('local validation rejects wrong mode, target, privileges, operation and non-synthetic environments', async () => {
  for (const change of [
    { authorizationMode: 'signed-owner' }, { authorizationMode: undefined }, { authorizationMode: 'unknown' },
    { environment: 'production' }, { environment: 'staging' }, { environment: 'unknown' },
    { target: binding.baseline }, { target: 'other_database' }, { targetRole: 'postgres' }, { ownerRole: 'postgres' },
    { operationSet: 'create-any-database' }, { context: { ...binding.context, name: 'remote' } },
  ]) {
    await assert.rejects(confirmLocalOperator({ ...binding, ...change }, mockTerminal(respond)), /LOCAL_BINDING_REJECTED/);
  }
});

test('a local approval can never satisfy signed mode, or vice versa', async () => {
  const local = await confirmLocalOperator(binding, mockTerminal(respond));
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const signedBinding = { ...binding, authorizationMode: 'signed-owner' };
  const signed = { ...local, mode: 'signed-owner', bindingDigest: digest(JSON.stringify(signedBinding)) };
  signed.signature = sign(null, nativeAuthorityMessage(signed), privateKey).toString('base64url');
  assert.doesNotThrow(() => verifyNativeSignedAuthority(signed, signedBinding, publicKey));
  assert.throws(() => verifyNativeSignedAuthority(local, signedBinding, publicKey), /AUTHORITY_MODE_REJECTED/);
  await assert.rejects(verifyNativeRuntimeApproval(signed, binding, 'host'), /AUTHORITY_MODE_REJECTED/);
  assert.throws(() => verifyLocalHostApproval({ ...signed, mode: localMode }, binding), /CONFIRMATION_REQUIRED/);
});
