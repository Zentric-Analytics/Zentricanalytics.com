import { B1, digest } from './b1-contract.mjs';

// Public proposal from the official linux/amd64 manifest. Runtime IDs must come
// from a separately approved, privately stored binding after provisioning.
export const dockerTrackBProfile = Object.freeze({
  backend: 'docker-desktop-wsl2',
  platform: 'linux/amd64',
  container: 'zentric-q03-replacement-postgres',
  network: 'zentric-q03-replacement-net',
  volume: 'zentric-q03-replacement-data',
  mount: '/var/lib/postgresql',
  baseline: 'q03_replacement_baseline',
  target: 'q03_replacement_track_b',
  postgresManifest: 'sha256:e923a22ac074261dd73970c57edf659475bf0497cb9456f17d98ed7cdd3ca913',
  serverVersion: 180006,
  node: '22.23.3',
  prisma: '6.10.1',
  engineRevision: B1.revision,
  inputManifest: B1.manifest,
});

const exactIds = ['hostFingerprint', 'engineFingerprint', 'containerId', 'networkId',
  'postgresImageId', 'runnerImageId', 'volumeFingerprint', 'sourceFingerprint'];
const bindingKeys = [...exactIds, 'baselineRole', 'targetRole', 'runId'];
const stages = Object.freeze(['preflight', 'create-target', 'apply-historical',
  'seed-and-capture-legacy', 'apply-upgrade', 'verify-upgrade', 'verify-behavior']);
const sha = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const role = value => typeof value === 'string' && /^q03_[a-z0-9_]{1,42}$/.test(value);

function requireFact(condition, reason) {
  if (!condition) throw Error(reason);
}

function bindingProjection(binding) {
  requireFact(binding && Object.getPrototypeOf(binding) === Object.prototype
    && Object.keys(binding).length === bindingKeys.length && bindingKeys.every(key => Object.hasOwn(binding, key))
    && exactIds.every(key => sha(binding[key]))
    && role(binding.baselineRole) && role(binding.targetRole)
    && binding.baselineRole !== binding.targetRole && sha(binding.runId), 'DOCKER_BINDING_MISSING_OR_INVALID');
  requireFact(binding.containerId !== B1.container && binding.networkId !== B1.network, 'ORIGINAL_TARGET_FORBIDDEN');
  return Object.fromEntries(bindingKeys.map(key => [key, binding[key]]));
}

export function dockerTrackBBindingDigest(binding) {
  return digest(JSON.stringify({ profile: dockerTrackBProfile, binding: bindingProjection(binding) }));
}

function verifyPreflight(binding, observation) {
  requireFact(observation && Object.entries(dockerTrackBProfile).every(([key, value]) => observation.profile?.[key] === value)
    && exactIds.every(key => observation.identity?.[key] === binding[key]), 'DOCKER_IDENTITY_MISMATCH');
  requireFact(observation.baselineRole === binding.baselineRole && observation.targetRole === binding.targetRole
    && observation.baselineReadOnly === true && observation.baselinePublicObjects === 0
    && observation.targetPrivilegesScoped === true, 'DOCKER_DATABASE_SCOPE_MISMATCH');
  requireFact(observation.internalNetwork === true && observation.publishedPorts === 0
    && observation.databaseOnlyPeer === true && observation.runnerVolumeMount === false
    && observation.runnerSocketMount === false && observation.externalEgressDenied === true
    && observation.offlineAcquisitionClosed === true && observation.restartDisabled === true,
  'DOCKER_ISOLATION_UNVERIFIED');
  requireFact(observation.targetExists === false, 'DOCKER_TARGET_EXISTS_OR_UNKNOWN');
}

/**
 * Inert admission and stage-order rehearsal. All inputs are synthetic receipts.
 * No engine, command, SQL, connector, filesystem, secret, or live mode is exposed.
 */
export function createDockerTrackBOfflineGate({ mode, binding, approval, now } = {}) {
  requireFact(mode === 'offline-fixture', 'DOCKER_LIVE_EXECUTION_UNAVAILABLE');
  const pinned = Object.freeze(bindingProjection(binding));
  requireFact(approval?.scope === 'DOCKER_REPLACEMENT_TRACK_B_OFFLINE_FIXTURE'
    && approval.bindingDigest === dockerTrackBBindingDigest(pinned)
    && Number.isSafeInteger(now) && Number.isSafeInteger(approval.expiresAt)
    && approval.expiresAt > now && approval.expiresAt - now <= 3_600_000, 'DOCKER_APPROVAL_INVALID');
  const expiresAt = approval.expiresAt;
  let index = 0;
  let lastTime = now;
  let stopped = false;

  return Object.freeze({
    accept(stage, receipt, observedAt) {
      requireFact(!stopped, 'DOCKER_STOP_PRESERVE');
      try {
        requireFact(Number.isSafeInteger(observedAt) && observedAt >= lastTime && observedAt < expiresAt, 'DOCKER_APPROVAL_EXPIRED_OR_CLOCK_REGRESSED');
        requireFact(index < stages.length && stage === stages[index], 'DOCKER_STAGE_ORDER_REJECTED');
        requireFact(receipt?.runId === pinned.runId && receipt.markerSynced === true
          && receipt.outcome === 'verified', 'DOCKER_OUTCOME_UNVERIFIED');
        if (stage === 'preflight') {
          requireFact(receipt.markerCreatedExclusively === true, 'DOCKER_RUN_MARKER_REUSED_OR_UNKNOWN');
          verifyPreflight(pinned, receipt.observation);
        }
        if (stage === 'create-target') {
          requireFact(receipt.createdOnce === true && receipt.target === dockerTrackBProfile.target
            && receipt.ownerRole === pinned.targetRole && receipt.publicObjects === 0, 'DOCKER_CREATE_UNVERIFIED');
        }
        index++;
        lastTime = observedAt;
        return stages[index] ?? 'offline-complete';
      } catch (error) {
        stopped = true;
        throw error;
      }
    },
    cancel() { stopped = true; },
  });
}

// A future live adapter must gather the current backend identity independently
// just before cancellation, then verify closure. This function never signals it.
export function matchesDockerCancellation(expected, observed) {
  return Boolean(expected && observed && sha(expected.runId)
    && Number.isSafeInteger(expected.pid) && expected.pid > 0
    && typeof expected.backendStart === 'string' && Number.isFinite(Date.parse(expected.backendStart))
    && role(expected.role) && expected.database === dockerTrackBProfile.target
    && expected.tag === 'q03b_' + expected.runId.slice(0, 24)
    && ['runId', 'pid', 'backendStart', 'role', 'database', 'tag'].every(key => expected[key] === observed[key]));
}
