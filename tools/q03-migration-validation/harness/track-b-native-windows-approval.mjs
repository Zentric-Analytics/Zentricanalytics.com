import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { release } from 'node:os';
import { digest } from './b1-contract.mjs';
import { localMode, validateLocalBinding } from './track-b-native-local-authority.mjs';

const powershell = '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const helper = new URL('./track-b-windows-approval.ps1', import.meta.url);

export function makeWindowsApprovalRequest(binding, preview = false, now = Date.now()) {
  validateLocalBinding(binding);
  return Object.freeze({
    version: 1, mode: localMode, preview, expiresAt: now + (preview ? 35_000 : 300_000),
    nonce: randomBytes(24).toString('hex'), binding: digest(JSON.stringify(binding)), run: binding.runId,
    cluster: binding.clusterId, container: binding.containerId, target: binding.target, baseline: binding.baseline,
    runner: binding.runnerImageId, source: binding.sourceFingerprint, manifest: binding.inputManifest,
    operation: binding.operationSet,
  });
}

export function verifyWindowsApprovalReply(request, result, now = Date.now()) {
  if (result?.code === 24 || result?.code === 25) throw Error('NATIVE_WINDOWS_APPROVAL_CANCELLED');
  if (result?.code === 26) throw Error('NATIVE_WINDOWS_DESKTOP_REQUIRED');
  if (result?.code === 27) throw Error('NATIVE_WINDOWS_APPROVAL_ALREADY_OPEN');
  if (result?.code !== 0 || request.preview || now >= request.expiresAt
    || typeof result.output !== 'string' || result.output.length > 4096) throw Error('NATIVE_WINDOWS_APPROVAL_REFUSED');
  const line = result.output.trim();
  if (/[\r\n]/.test(line)) throw Error('NATIVE_WINDOWS_APPROVAL_MALFORMED');
  let reply;
  try { reply = JSON.parse(line); } catch { throw Error('NATIVE_WINDOWS_APPROVAL_MALFORMED'); }
  if (!reply || Object.keys(reply).sort().join(',') !== 'binding,decision,nonce,run,session,version'
    || reply.version !== 1 || reply.decision !== 'approved' || reply.nonce !== request.nonce
    || reply.binding !== request.binding || reply.run !== request.run
    || !Number.isInteger(reply.session) || reply.session <= 0) throw Error('NATIVE_WINDOWS_APPROVAL_MALFORMED');
  return Object.freeze({ session: reply.session, nonceDigest: digest(request.nonce), bindingDigest: request.binding });
}

async function runDialog(request, expectedHelperDigest) {
  if (process.platform !== 'linux' || process.getuid?.() !== 0 || !/microsoft-standard-wsl2/i.test(release())
    || !process.env.WSL_INTEROP || ['CI', 'SSH_CONNECTION', 'SSH_CLIENT', 'SSH_TTY'].some(key => process.env[key])) {
    throw Error('NATIVE_WINDOWS_DESKTOP_REQUIRED');
  }
  const script = await readFile(helper, 'utf8');
  if (digest(script) !== expectedHelperDigest) throw Error('NATIVE_WINDOWS_APPROVAL_HELPER_CHANGED');
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  if (encoded.length > 26_000) throw Error('NATIVE_WINDOWS_APPROVAL_HELPER_TOO_LARGE');
  return new Promise((resolve, reject) => {
    const child = spawn(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', encoded], {
      stdio: ['pipe', 'pipe', 'ignore'],
      env: { WSL_INTEROP: process.env.WSL_INTEROP, PATH: '/usr/bin:/bin' },
    });
    let output = '';
    let failure;
    const stop = reason => {
      failure ??= reason;
      child.stdin.end();
      child.kill('SIGTERM');
    };
    const timer = setTimeout(() => stop('NATIVE_WINDOWS_APPROVAL_TIMEOUT'), Math.max(1, request.expiresAt - Date.now() + 1500));
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      output += chunk;
      if (output.length > 4096) stop('NATIVE_WINDOWS_APPROVAL_MALFORMED');
    });
    child.stdin.on('error', () => stop('NATIVE_WINDOWS_APPROVAL_DISCONNECTED'));
    child.once('error', () => stop('NATIVE_WINDOWS_APPROVAL_LAUNCH_FAILED'));
    child.once('close', code => {
      clearTimeout(timer);
      child.stdin.end();
      if (failure) reject(Error(failure));
      else resolve({ code, output });
    });
    child.stdin.write(JSON.stringify(request) + '\n');
  });
}

export async function askNativeWindowsApproval(binding, { preview = false } = {}) {
  const request = makeWindowsApprovalRequest(binding, preview);
  const result = await runDialog(request, binding.windowsHelperDigest);
  if (preview && [24, 25].includes(result.code) && !result.output.trim()) return null;
  return verifyWindowsApprovalReply(request, result);
}
