import { open, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { B1, assertLedger, digest, reviewedInputs } from './b1-contract.mjs';
import { dockerTrackBProfile as profile, matchesDockerCancellation } from './track-b-docker-gate.mjs';

const sourceRoot = fileURLToPath(new URL('.', import.meta.url));
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const stages = Object.freeze([
  'preflight', 'create-target', 'apply-historical', 'seed-and-capture-legacy',
  'apply-upgrade', 'verify-upgrade', 'verify-behavior',
]);
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const role = value => typeof value === 'string' && /^q03_[a-z0-9_]{1,42}$/.test(value);
const localProfile = Object.freeze({
  ...profile,
  backend: 'docker-engine-wsl2',
  postgresConfig: 'sha256:8bca9649e52d948114ccc8164b55b7ab26b64e729893e420114bb5c87bf7c7cc',
  postgresIndex: 'sha256:e3d24f6906d0760bf4da0dae872415391ededefad23fd471c47dc53b0ddf3c42',
});
const postgresReferences = [localProfile.postgresManifest, localProfile.postgresIndex]
  .flatMap(pin => ['postgres@' + pin, 'docker.io/library/postgres@' + pin]);
export const nativePostgresDigests = Object.freeze({
  index: localProfile.postgresIndex,
  manifest: localProfile.postgresManifest,
  config: localProfile.postgresConfig,
});

export function verifyNativePostgresContent(content) {
  for (const [key, pin] of Object.entries(nativePostgresDigests)) {
    requireFact(Buffer.isBuffer(content?.[key]) && 'sha256:' + digest(content[key]) === pin,
      'NATIVE_POSTGRES_CONTENT_MISMATCH');
  }
  const index = JSON.parse(content.index);
  const manifests = index.manifests.filter(item => item.platform?.os === 'linux'
    && item.platform?.architecture === 'amd64');
  const manifest = JSON.parse(content.manifest);
  const config = JSON.parse(content.config);
  requireFact(manifests.length === 1 && manifests[0].digest === nativePostgresDigests.manifest
    && manifest.config.digest === nativePostgresDigests.config
    && config.os === 'linux' && config.architecture === 'amd64', 'NATIVE_POSTGRES_PLATFORM_MISMATCH');
}
const reviewedSource = Object.freeze([
  'b1-contract.mjs', 'concurrency.mjs', 'config.mjs', 'db-tests.mjs', 'evidence-rules.mjs', 'fixtures.mjs',
  'track-b-docker-gate.mjs', 'track-b-native-boundary.mjs', 'track-b-native-engine.mjs',
  'track-b-native-host.mjs', 'track-b-native-maintenance.mjs', 'track-b-native-postgres.mjs', 'track-b-native-prisma-check.mjs',
  'track-b-offline-runner.mjs',
]);

function requireFact(condition, reason) {
  if (!condition) throw Error(reason);
}

export function verifyNativeResources(binding, observed) {
  const { engine, container, network, volume, image } = observed ?? {};
  requireFact(sha(binding?.engineFingerprint) && sha(binding.containerId)
    && sha(binding.networkId) && sha(binding.volumeFingerprint)
    && Object.values(nativePostgresDigests).includes(binding.imageId)
    && binding.containerId !== B1.container && binding.networkId !== B1.network
    && binding.imageId !== B1.databaseImage, 'NATIVE_BINDING_REJECTED');
  requireFact(engine?.backend === localProfile.backend && engine.platform === localProfile.platform
    && engine.engineFingerprint === binding.engineFingerprint
    && container?.Id === binding.containerId && container.Name === '/' + profile.container
    && container.Image === binding.imageId && image?.Id === binding.imageId
    && image.Os === 'linux' && image.Architecture === 'amd64'
    && observed.postgresContentVerified === true
    && Array.isArray(image.RepoDigests) && image.RepoDigests.some(ref => postgresReferences.includes(ref))
    && network?.Id === binding.networkId && network.Name === profile.network
    && volume?.Name === profile.volume && volume.Driver === 'local'
    && volume.fingerprint === binding.volumeFingerprint, 'NATIVE_RESOURCE_IDENTITY_REJECTED');

  const mounts = container.Mounts ?? [];
  const data = mounts.find(mount => mount.Destination === profile.mount);
  const socket = mounts.find(mount => mount.Destination === '/run/zentric-track-b');
  const peers = Object.keys(network.Containers ?? {});
  const attached = container.NetworkSettings?.Networks ?? {};
  const host = container.HostConfig;
  const bindingLabel = item => item?.['zentric.q03.replacement'] === 'true';
  requireFact(container.State?.Status === 'running' && container.State.Running === true
    && bindingLabel(container.Config?.Labels) && bindingLabel(network.Labels) && bindingLabel(volume.Labels)
    && network.Internal === true && network.Driver === 'bridge' && peers.length === 1
    && peers[0] === container.Id && Object.keys(attached).length === 1
    && attached[profile.network]?.NetworkID === network.Id
    && host?.RestartPolicy?.Name === 'no' && host.Privileged === false
    && host.PublishAllPorts === false && Object.keys(host.PortBindings ?? {}).length === 0
    && Object.values(container.NetworkSettings?.Ports ?? {}).every(value => value === null)
    && mounts.length === 2 && data?.Type === 'volume' && data.Name === volume.Name && data.RW === true
    && socket?.Type === 'volume' && socket.Name === 'zentric-q03-replacement-socket' && socket.RW === true
    && observed.egressVerified === true && observed.storageVerified === true
    && observed.runnerMountIsolationVerified === true && observed.syntheticCredentialsVerified === true,
  'NATIVE_RESOURCE_ISOLATION_REJECTED');
}

export async function verifyNativeInputs() {
  const inputRoot = await realpath(resolve(sourceRoot, 'inputs'));
  const manifest = await readFile(resolve(sourceRoot, 'input-manifest.json'));
  requireFact(digest(manifest) === B1.manifest, 'NATIVE_INPUT_MANIFEST_CHANGED');
  const entries = JSON.parse(manifest.toString().replace(/^\uFEFF/, '')).Files;
  const bytes = new Map();
  for (const entry of entries) {
    const name = entry.Path.replaceAll('\\', '/');
    const expected = resolve(sourceRoot, name);
    const actual = await realpath(expected);
    requireFact(actual === expected && actual.startsWith(inputRoot + sep), 'NATIVE_INPUT_PATH_REJECTED');
    bytes.set(name, await readFile(actual));
  }
  return reviewedInputs(manifest, name => bytes.get(name));
}

export async function fingerprintNativeBoundarySource() {
  const hashes = await Promise.all(reviewedSource.map(async file =>
    [file, digest(await readFile(resolve(sourceRoot, file)))]));
  return digest(JSON.stringify(hashes));
}

/**
 * Ordered control boundary for a trusted transport. The repository entry point
 * never constructs a live transport. A failed run retains its marker forever.
 */
export async function rehearseNativeTrackBBoundary({
  transport, binding: proposedBinding, evidenceDirectory, signal, timeoutMs = 1000,
} = {}) {
  requireFact(transport?.mode === 'offline-fixture', 'NATIVE_LIVE_ENTRY_DISABLED');
  const binding = Object.freeze({ ...proposedBinding });
  requireFact(sha(binding.runId) && sha(binding.sourceFingerprint)
    && role(binding.baselineRole) && role(binding.targetRole) && binding.baselineRole !== binding.targetRole
    && typeof evidenceDirectory === 'string'
    && isAbsolute(evidenceDirectory) && Number.isInteger(timeoutMs)
    && timeoutMs > 0 && timeoutMs <= 5000, 'NATIVE_RUN_CONFIGURATION_REJECTED');
  const directory = await realpath(evidenceDirectory);
  const fromRepo = relative(await realpath(repository), directory);
  requireFact(fromRepo === '..' || fromRepo.startsWith('..' + sep) || isAbsolute(fromRepo),
    'NATIVE_EVIDENCE_MUST_BE_EXTERNAL');
  requireFact(binding.sourceFingerprint === await fingerprintNativeBoundarySource(),
    'NATIVE_SOURCE_FINGERPRINT_MISMATCH');
  const migrations = await verifyNativeInputs();
  const marker = await open(resolve(directory, 'native-track-b-' + binding.runId + '.jsonl'), 'wx', 0o600);
  let stage = 'start';
  const record = async event => {
    await marker.writeFile(JSON.stringify({ stage, event, mode: 'offline-fixture' }) + '\n');
    await marker.sync();
  };

  try {
    await record('reserved');
    for (const next of stages) {
      stage = next;
      requireFact(!signal?.aborted, 'NATIVE_RUN_INTERRUPTED');
      await record('begin');
      const deadline = AbortSignal.timeout(timeoutMs);
      const stepSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
      const inputs = stage === 'apply-historical' ? migrations.slice(0, 66)
        : stage === 'apply-upgrade' ? migrations.slice(66) : [];
      const receipt = await boundedStep(transport, stage, Object.freeze(inputs), stepSignal);
      stepSignal.throwIfAborted();
      requireFact(receipt?.verified === true && receipt.runId === binding.runId, 'NATIVE_OUTCOME_UNKNOWN');
      if (stage === 'preflight') {
        verifyNativeResources(binding, receipt.resources);
        requireFact(receipt.targetExists === false && receipt.baseline === profile.baseline
          && receipt.baselineRole === binding.baselineRole && receipt.baselineReadOnly === true
          && receipt.baselinePublicObjects === 0 && receipt.targetPrivilegesScoped === true,
        'NATIVE_BASELINE_OR_COLLISION_REJECTED');
      }
      if (stage === 'create-target') {
        requireFact(receipt.target === profile.target && receipt.createdOnce === true
          && receipt.owner === binding.targetRole && receipt.publicObjects === 0,
          'NATIVE_TARGET_CREATION_UNKNOWN');
      }
      if (stage === 'apply-historical' || stage === 'apply-upgrade') {
        const expected = stage === 'apply-historical' ? migrations.slice(0, 66) : migrations;
        assertLedger(receipt.ledger, expected, false);
        requireFact(receipt.ledger.length === expected.length
          && receipt.ledger.every(row => row.finished && row.steps === 1 && row.logs === null),
        'NATIVE_LEDGER_INCOMPLETE');
      }
      await record('verified');
    }
    await record('offline-pass');
  } catch {
    await record('stop-preserve');
    throw Error('NATIVE_RUN_STOPPED_PRESERVE');
  } finally {
    await marker.close();
  }
}

async function boundedStep(transport, stage, migrations, signal) {
  let onAbort;
  try {
    const interruption = new Promise((_, reject) => {
      onAbort = () => reject(Error('NATIVE_STEP_INTERRUPTED'));
      signal.addEventListener('abort', onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
    return await Promise.race([
      interruption,
      Promise.resolve().then(() => {
        signal.throwIfAborted();
        return transport.step(stage, migrations, signal);
      }),
    ]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

export function verifyNativeCancellation(expected, observed) {
  requireFact(matchesDockerCancellation(expected, observed), 'NATIVE_CANCELLATION_IDENTITY_REJECTED');
}
