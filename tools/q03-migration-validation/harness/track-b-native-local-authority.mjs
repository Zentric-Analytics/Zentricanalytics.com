import { randomBytes, timingSafeEqual } from 'node:crypto';
import { lstat, open, readFile, realpath } from 'node:fs/promises';
import { digest } from './b1-contract.mjs';

export const localMode = 'local-synthetic-operator';
export const signedMode = 'signed-owner';
export const localAuthorityDirectory = '/root/.local/state/zentric-q03-synthetic/m17-authority';
export const runnerAuthorityDirectory = '/opt/q03/local-authority';
const issued = new WeakSet();

export function validateLocalBinding(binding) {
  if (binding?.authorizationMode !== localMode || binding.environment !== 'local-synthetic'
    || binding.target !== 'q03_replacement_track_b' || binding.baseline !== 'q03_replacement_baseline'
    || binding.targetRole !== 'q03_replacement_runner' || binding.ownerRole !== 'q03_replacement_owner'
    || binding.context?.name !== 'default' || binding.context.endpoint !== 'unix:///var/run/docker.sock'
    || binding.context.socketRealpath !== '/run/docker.sock' || binding.context.remoteOverridesAbsent !== true
    || binding.operationSet !== 'Q03_NATIVE_TRACK_B_66_PLUS_2_V1') {
    throw Error('NATIVE_LOCAL_BINDING_REJECTED');
  }
}

export async function confirmLocalOperator(binding, terminal, now = Date.now) {
  validateLocalBinding(binding);
  if (terminal?.interactive !== true || terminal?.uid !== 0
    || !/^\/dev\/pts\/\d+$/.test(terminal?.device ?? '')) throw Error('NATIVE_LOCAL_TERMINAL_REQUIRED');
  const bindingDigest = digest(JSON.stringify(binding));
  const before = now();
  const token = randomBytes(12).toString('hex');
  await terminal.show([
    'Local synthetic approval. This is a one-time database creation followed by the fixed Track B test sequence.',
    'Target: ' + binding.target + ' | cluster: ' + binding.clusterId + ' | container: ' + binding.containerId,
    'Mode: ' + localMode + ' | runner: ' + binding.runnerImageId,
    'Source: ' + binding.sourceFingerprint + ' | migration manifest: ' + binding.inputManifest,
    'Evidence: root-controlled WSL journal and zentric-q03-replacement-evidence.',
    'Baseline and unrelated databases are excluded. An interrupted or failed creation cannot be automatically retried.',
    'Reservation ' + binding.runId + ' is unconsumed. Confirmation expires in five minutes.',
    'Type the exact database name followed by a space and this token: ' + token,
  ].join('\n') + '\n');
  const expected = Buffer.from(binding.target + ' ' + token);
  const answer = Buffer.from(String(await terminal.read()));
  if (answer.length !== expected.length || !timingSafeEqual(answer, expected)
    || now() - before >= 300_000 || now() < before || digest(JSON.stringify(binding)) !== bindingDigest) {
    throw Error('NATIVE_LOCAL_CONFIRMATION_REJECTED');
  }
  return issueLocalApproval(binding, bindingDigest, { uid: terminal.uid, terminal: terminal.device }, now());
}

export async function confirmWindowsLocalOperator(binding, dialog, now = Date.now) {
  validateLocalBinding(binding);
  const bindingDigest = digest(JSON.stringify(binding));
  const before = now();
  const response = await dialog(binding);
  const after = now();
  if (response?.bindingDigest !== bindingDigest || digest(JSON.stringify(binding)) !== bindingDigest
    || !Number.isInteger(response?.session) || response.session <= 0
    || !/^[a-f0-9]{64}$/.test(response.nonceDigest ?? '') || after < before || after - before >= 300_000) {
    throw Error('NATIVE_WINDOWS_APPROVAL_REFUSED');
  }
  return issueLocalApproval(binding, bindingDigest, Object.freeze({
    uid: 0, surface: 'windows-desktop', session: response.session, challenge: response.nonceDigest,
  }), after);
}

function issueLocalApproval(binding, bindingDigest, operator, issuedAt) {
  const approval = Object.freeze({
    mode: localMode, scope: 'Q03_NATIVE_TRACK_B_WRITE', issuedAt, expiresAt: issuedAt + 1_800_000,
    bindingDigest, provisioningReceipt: binding.provisioningReceipt, runId: binding.runId,
    operator,
  });
  issued.add(approval);
  return approval;
}

export function verifyLocalHostApproval(approval, binding) {
  validateLocalBinding(binding);
  if (approval?.mode !== localMode || !issued.has(approval) || approval.expiresAt <= Date.now()
    || approval.runId !== binding.runId || approval.bindingDigest !== digest(JSON.stringify(binding))) {
    throw Error('NATIVE_LOCAL_CONFIRMATION_REQUIRED');
  }
}

export async function verifyLocalRunnerReceipt(approval, binding) {
  validateLocalBinding(binding);
  const file = runnerAuthorityDirectory + '/approval.json';
  const info = await lstat(file);
  if (!info.isFile() || info.uid !== 0 || info.nlink !== 1 || (info.mode & 0o222) !== 0 || info.size > 4096) {
    throw Error('NATIVE_LOCAL_RECEIPT_REJECTED');
  }
  const expected = JSON.stringify({ mode: localMode, runId: binding.runId, approval });
  if (await readFile(file, 'utf8') !== expected || approval.mode !== localMode
    || approval.runId !== binding.runId || approval.expiresAt <= Date.now()
    || approval.bindingDigest !== digest(JSON.stringify(binding))) throw Error('NATIVE_LOCAL_RECEIPT_REJECTED');
}

export async function publishLocalRunnerReceipt(approval, binding) {
  verifyLocalHostApproval(approval, binding);
  const directory = await lstat(localAuthorityDirectory);
  if (!directory.isDirectory() || directory.uid !== 0 || (directory.mode & 0o022) !== 0
    || await realpath(localAuthorityDirectory) !== localAuthorityDirectory) throw Error('NATIVE_LOCAL_RECEIPT_REJECTED');
  const file = await open(localAuthorityDirectory + '/approval.json', 'wx', 0o444);
  try {
    await file.writeFile(JSON.stringify({ mode: localMode, runId: binding.runId, approval }));
    await file.sync();
  } finally {
    await file.close();
  }
  const handle = await open(localAuthorityDirectory, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}
