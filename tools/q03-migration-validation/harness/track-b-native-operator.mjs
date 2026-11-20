import { lstat, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createNativeTrackBOnce, inspectNativeTrackBCreation, observeNativeCreationPreflight } from './track-b-native-creation-host.mjs';
import { launchNativeTrackB, verifyNativeTrackBHost } from './track-b-native-host.mjs';
import { loadNativeAuthorityKey, nativeAuthorityMessage, requireNativeLiveEntry } from './track-b-native-postgres.mjs';
import { validateNativeCreationBinding } from './track-b-native-reservation.mjs';
import { digest } from './b1-contract.mjs';

const state = '/root/.local/state/zentric-q03-synthetic';

async function privateFile(name, limit) {
  const path = state + '/' + name;
  const info = await lstat(path);
  if (!info.isFile() || info.uid !== 0 || info.nlink !== 1 || (info.mode & 0o077) !== 0 || info.size > limit) {
    throw Error('NATIVE_OPERATOR_PRIVATE_FILE_REJECTED');
  }
  return readFile(path, 'utf8');
}

async function main(argv) {
  if (process.platform !== 'linux' || process.getuid?.() !== 0 || argv.length !== 1
    || !['observe', 'signing-input', 'check', 'create', 'reconcile', 'run'].includes(argv[0])) {
    throw Error('NATIVE_OPERATOR_SCOPE_REJECTED');
  }
  const operation = argv[0];
  if (operation === 'observe') {
    console.log(JSON.stringify(await observeNativeCreationPreflight()));
    return;
  }
  requireNativeLiveEntry('host');
  await loadNativeAuthorityKey('host');
  const plan = JSON.parse(await privateFile('track-b-plan.json', 24_576));
  const { binding, context, isolation, approval } = plan;
  validateNativeCreationBinding(binding);
  if (approval?.bindingDigest !== digest(JSON.stringify(binding))
    || approval.provisioningReceipt !== binding.provisioningReceipt) throw Error('NATIVE_OPERATOR_BINDING_REJECTED');
  const options = { binding, context, isolation, approval };
  switch (operation) {
    case 'signing-input':
      // Public challenge bytes. The externally held private key is never read.
      process.stdout.write(nativeAuthorityMessage(approval));
      break;
    case 'check':
      await verifyNativeTrackBHost(options);
      console.log('NATIVE_SIGNED_HOST_PREFLIGHT_VERIFIED');
      break;
    case 'create':
      await createNativeTrackBOnce(options);
      console.log('NATIVE_TARGET_CREATION_CONFIRMED');
      break;
    case 'reconcile': {
      const receipt = await inspectNativeTrackBCreation(binding);
      console.log(JSON.stringify(receipt));
      break;
    }
    case 'run': {
      const target = (await privateFile('m14-track-b-roles/runner.secret', 80)).trim();
      if (!/^[a-f0-9]{64}$/.test(target)) throw Error('NATIVE_OPERATOR_SECRET_REJECTED');
      await launchNativeTrackB({ ...options, secrets: { target } });
      console.log('NATIVE_TRACK_B_RUN_COMPLETED');
      break;
    }
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main(process.argv.slice(2)).catch(error => {
    console.error(/^NATIVE_[A-Z0-9_]+$/.test(error.message) ? error.message : 'NATIVE_OPERATOR_STOPPED_PRESERVE');
    process.exitCode = 1;
  });
}
