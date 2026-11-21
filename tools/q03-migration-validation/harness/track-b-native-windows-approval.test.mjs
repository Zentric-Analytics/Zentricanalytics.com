import assert from 'node:assert/strict';
import { test } from 'node:test';
import { digest } from './b1-contract.mjs';
import { confirmWindowsLocalOperator, localMode, verifyLocalHostApproval } from './track-b-native-local-authority.mjs';
import { makeWindowsApprovalRequest, verifyWindowsApprovalReply } from './track-b-native-windows-approval.mjs';

const hex = character => character.repeat(64);
const binding = {
  authorizationMode: localMode, environment: 'local-synthetic', target: 'q03_replacement_track_b',
  baseline: 'q03_replacement_baseline', targetRole: 'q03_replacement_runner', ownerRole: 'q03_replacement_owner',
  context: { name: 'default', endpoint: 'unix:///var/run/docker.sock',
    socketRealpath: '/run/docker.sock', remoteOverridesAbsent: true },
  operationSet: 'Q03_NATIVE_TRACK_B_66_PLUS_2_V1', clusterId: '1234567890123456789',
  containerId: hex('1'), runnerImageId: 'sha256:' + hex('2'), sourceFingerprint: hex('3'),
  inputManifest: hex('4'), runId: hex('5'), provisioningReceipt: hex('6'),
};

const mockReply = (request, changes = {}) => ({
  code: 0, output: JSON.stringify({ version: 1, decision: 'approved', nonce: request.nonce,
    binding: request.binding, run: request.run, session: 3, ...changes }),
});

test('review request and private reply bind the exact operation and omit private credentials', async () => {
  const request = makeWindowsApprovalRequest({ ...binding, password: 'never include me' });
  assert.equal(request.operation, binding.operationSet);
  assert.equal(request.target, binding.target);
  assert.equal(request.baseline, binding.baseline);
  assert.equal(request.cluster, binding.clusterId);
  assert.equal(request.container, binding.containerId);
  assert.equal(request.runner, binding.runnerImageId);
  assert.equal(request.manifest, binding.inputManifest);
  assert.equal(request.source, binding.sourceFingerprint);
  assert.ok(!JSON.stringify(request).includes('never include me'));
  const approval = await confirmWindowsLocalOperator(binding, actual => {
    const challenge = makeWindowsApprovalRequest(actual);
    return verifyWindowsApprovalReply(challenge, mockReply(challenge));
  });
  assert.equal(approval.operator.surface, 'windows-desktop');
  assert.equal(approval.bindingDigest, digest(JSON.stringify(binding)));
  assert.doesNotThrow(() => verifyLocalHostApproval(approval, binding));
  assert.throws(() => verifyLocalHostApproval({ ...approval }, binding), /CONFIRMATION_REQUIRED/);
});

test('cancel, close, timeout, no desktop, duplicate window, and process failure refuse approval', () => {
  const request = makeWindowsApprovalRequest(binding);
  for (const [code, reason] of [[24, 'CANCELLED'], [25, 'CANCELLED'], [26, 'DESKTOP_REQUIRED'],
    [27, 'ALREADY_OPEN'], [1, 'REFUSED'], [null, 'REFUSED']]) {
    assert.throws(() => verifyWindowsApprovalReply(request, { ...mockReply(request), code }), new RegExp(reason));
  }
  assert.throws(() => verifyWindowsApprovalReply(request, mockReply(request), request.expiresAt), /REFUSED/);
  const preview = makeWindowsApprovalRequest(binding, true);
  assert.throws(() => verifyWindowsApprovalReply(preview, mockReply(preview)), /REFUSED/);
});

test('injected output, wrong challenge, stale run and changed identity are rejected', async () => {
  const request = makeWindowsApprovalRequest(binding);
  for (const altered of [{ nonce: hex('9') }, { binding: hex('9') }, { run: hex('9') },
    { session: 0 }, { decision: 'cancelled' }, { extra: true }]) {
    assert.throws(() => verifyWindowsApprovalReply(request, mockReply(request, altered)), /MALFORMED/);
  }
  for (const output of ['yes', '{}\n' + mockReply(request).output, 'invalid JSON']) {
    assert.throws(() => verifyWindowsApprovalReply(request, { code: 0, output }), /MALFORMED/);
  }
  const newRequest = makeWindowsApprovalRequest(binding);
  assert.throws(() => verifyWindowsApprovalReply(newRequest, mockReply(request)), /MALFORMED/);
  const mutable = { ...binding };
  await assert.rejects(confirmWindowsLocalOperator(mutable, () => {
    mutable.containerId = hex('8');
    return verifyWindowsApprovalReply(request, mockReply(request));
  }), /REFUSED/);
});

test('non-local mode and unrelated databases cannot be presented for approval', () => {
  for (const change of [{ environment: 'staging' }, { target: binding.baseline }, { authorizationMode: 'signed-owner' }]) {
    assert.throws(() => makeWindowsApprovalRequest({ ...binding, ...change }), /LOCAL_BINDING_REJECTED/);
  }
});
