import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { B1, digest } from './b1-contract.mjs';
import { verifyNativeSignedAuthority } from './track-b-native-postgres.mjs';

const target = 'q03_replacement_track_b';
const name = target + '.creation.jsonl';
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

async function openPrivateDirectory(directory) {
  if (!isAbsolute(directory) || await realpath(directory) !== directory) {
    throw Error('NATIVE_RESERVATION_DIRECTORY_REJECTED');
  }
  const info = await lstat(directory);
  if (!info.isDirectory() || (process.platform === 'linux'
    && (info.uid !== process.getuid() || (info.mode & 0o077) !== 0))) {
    throw Error('NATIVE_RESERVATION_DIRECTORY_REJECTED');
  }
  const handle = await open(directory, constants.O_RDONLY | (constants.O_DIRECTORY ?? 0)
    | (constants.O_NOFOLLOW ?? 0));
  const opened = await handle.stat();
  if (opened.dev !== info.dev || opened.ino !== info.ino) {
    await handle.close();
    throw Error('NATIVE_RESERVATION_DIRECTORY_CHANGED');
  }
  return handle;
}

const journalPath = handle => join('/proc/self/fd', String(handle.fd), name);

export function validateNativeCreationBinding(binding) {
  if (binding?.target !== target || !/^[0-9]{16,24}$/.test(binding?.clusterId ?? '')
    || ![binding.runId, binding.containerId, binding.engineFingerprint, binding.sourceFingerprint,
      binding.inputManifest, binding.provisioningReceipt].every(sha)
    || !/^sha256:[a-f0-9]{64}$/.test(binding.runnerImageId ?? '')
    || binding.inputManifest !== B1.manifest
    || binding.operationSet !== 'Q03_NATIVE_TRACK_B_66_PLUS_2_V1') {
    throw Error('NATIVE_CREATION_BINDING_REJECTED');
  }
}

/**
 * The file name is global to the single authorized target, across run IDs.
 * Even an empty or partial file permanently consumes the automatic attempt.
 * The only database operation supplied by the production caller is fixed
 * maintenance SQL. Tests supply an offline stand-in.
 */
export async function runNativeCreationReservation({
  directory, approval, binding, authorityKey, preflight, create, reconcile, now = Date.now,
}) {
  validateNativeCreationBinding(binding);
  verifyNativeSignedAuthority(approval, binding, authorityKey, now());
  const root = await openPrivateDirectory(directory);
  let journal;
  let started = false;
  const record = async (state, detail) => {
    await journal.writeFile(JSON.stringify({ state, target, runId: binding.runId, detail }) + '\n');
    await journal.sync();
  };
  const authorized = () => verifyNativeSignedAuthority(approval, binding, authorityKey, now());
  try {
    // Recheck observed target and identity away from the reservation's write path.
    const before = await preflight();
    if (before?.targetAbsent !== true || before.clusterId !== binding.clusterId) {
      throw Error('NATIVE_CREATION_PREFLIGHT_REJECTED');
    }
    authorized();
    journal = await open(journalPath(root), constants.O_WRONLY | constants.O_CREAT
      | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
    await record('RESERVED', { bindingDigest: approval.bindingDigest, approvalDigest: digest(JSON.stringify(approval)) });
    await root.sync();
    authorized();
    await record('STARTED');
    started = true;
    await create();
    const observed = await reconcile();
    if (observed?.clusterId !== binding.clusterId || observed.database !== target
      || observed.owner !== 'q03_replacement_owner' || observed.empty !== true
      || observed.restricted !== true || observed.baselineUnchanged !== true) {
      throw Error('NATIVE_CREATION_RESULT_UNVERIFIED');
    }
    await record('CONFIRMED');
    return observed;
  } catch (error) {
    if (started) {
      await record('UNCERTAIN');
      throw Error('NATIVE_CREATION_UNCERTAIN_PRESERVE');
    }
    throw error;
  } finally {
    try { await journal?.close(); } finally { await root.close(); }
  }
}

export async function reconcileNativeCreation({ directory, binding, observe }) {
  validateNativeCreationBinding(binding);
  const root = await openPrivateDirectory(directory);
  try {
    const journal = await open(journalPath(root), constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const info = await journal.stat();
      if (!info.isFile() || info.nlink !== 1 || info.size > 16_384) {
        throw Error('NATIVE_CREATION_JOURNAL_REJECTED');
      }
      const raw = await journal.readFile();
      const first = raw.toString().split('\n')[0];
      let reservation;
      try { reservation = JSON.parse(first); } catch { throw Error('NATIVE_CREATION_JOURNAL_INCOMPLETE'); }
      if (reservation.state !== 'RESERVED' || reservation.target !== target || reservation.runId !== binding.runId
        || reservation.detail?.bindingDigest !== digest(JSON.stringify(binding))) {
        throw Error('NATIVE_CREATION_JOURNAL_REJECTED');
      }
      const rows = raw.toString().split('\n').filter(Boolean);
      const confirmed = rows.length === 3 && rows.every((line, index) => {
        try {
          const row = JSON.parse(line);
          return row.state === ['RESERVED', 'STARTED', 'CONFIRMED'][index]
            && row.target === target && row.runId === binding.runId;
        } catch { return false; }
      });
      return { journalDigest: digest(raw), confirmed, observed: await observe() };
    } finally {
      await journal.close();
    }
  } finally {
    await root.close();
  }
}

export async function assertNativeCreationConfirmed(directory, binding) {
  const receipt = await reconcileNativeCreation({ directory, binding, observe: () => null });
  if (!receipt.confirmed) throw Error('NATIVE_CREATION_CONFIRMATION_REQUIRED');
}
