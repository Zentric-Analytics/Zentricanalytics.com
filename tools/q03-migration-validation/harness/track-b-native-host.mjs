import { spawn } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { digest } from './b1-contract.mjs';
import { verifyNativeResources } from './track-b-native-boundary.mjs';
import { inspectNativeEvidenceVolume, inspectNativeRunner, inspectTrackBNativeDocker } from './track-b-native-engine.mjs';
import { requireNativeLiveEntry, verifyNativeWriteAuthority } from './track-b-native-postgres.mjs';

const id = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const entrypoint = '/opt/node/bin/node';
const worker = '/opt/q03/track-b-native-postgres.mjs';
const evidenceVolume = 'zentric-q03-replacement-evidence';
const runtimeEnvironmentOverride = /^(?:DATABASE_URL|DIRECT_URL|PG[A-Z_]*|POSTGRES_[A-Z_]*|NODE_OPTIONS|NODE_PATH|LD_[A-Z_]*|PRISMA_[A-Z_]*|.*(?:SECRET|PASSWORD|TOKEN|API_KEY|PROXY))=/i;

function requireFact(condition, reason) {
  if (!condition) throw Error(reason);
}

export function verifyNativeDockerContext(context) {
  requireFact(context?.name === 'default' && context.endpoint === 'unix:///var/run/docker.sock'
    && context.socketRealpath === '/run/docker.sock' && context.remoteOverridesAbsent === true,
  'NATIVE_DOCKER_CONTEXT_REJECTED');
}

export function nativeVolumeFingerprint(volume, resourceNonce) {
  requireFact(id(resourceNonce) && volume?.Labels?.['zentric.q03.resource'] === resourceNonce
    && typeof volume.CreatedAt === 'string' && Number.isFinite(Date.parse(volume.CreatedAt)),
  'NATIVE_VOLUME_OWNERSHIP_REJECTED');
  return digest(JSON.stringify([volume.Name, volume.Driver, volume.CreatedAt, resourceNonce]));
}

export function verifyNativeRunner(binding, observed, expectedState = 'created') {
  const config = observed?.Config;
  const host = observed?.HostConfig;
  const mounts = observed?.Mounts ?? [];
  requireFact(id(binding?.runnerId) && id(binding?.containerId) && id(binding?.resourceNonce)
    && /^sha256:[a-f0-9]{64}$/.test(binding.runnerImageId ?? '')
    && observed?.Id === binding.runnerId && observed.Image === binding.runnerImageId
    && config?.Labels?.['zentric.q03.resource'] === binding.resourceNonce
    && config.Labels['zentric.q03.role'] === 'native-runner'
    && config.User === '65532:65532' && config.OpenStdin === true && config.Tty === false
    && JSON.stringify(config.Entrypoint) === JSON.stringify([entrypoint])
    && JSON.stringify(config.Cmd) === JSON.stringify([worker])
    && Array.isArray(config.Env) && !config.Env.some(value => runtimeEnvironmentOverride.test(value))
    && observed.State?.Status === expectedState && typeof observed.State.Running === 'boolean'
    && observed.State.Running === (expectedState === 'running')
    && host?.NetworkMode === 'container:' + binding.containerId
    && host.ReadonlyRootfs === true && host.Privileged === false && host.Init === true
    && ['', 'private'].includes(host.PidMode) && !host.CapAdd?.length && !host.Devices?.length
    && !host.DeviceRequests?.length && !host.DeviceCgroupRules?.length && !host.Binds?.length
    && JSON.stringify(host.CapDrop) === '["ALL"]'
    && host.SecurityOpt?.some(value => ['no-new-privileges', 'no-new-privileges:true'].includes(value))
    && host.RestartPolicy?.Name === 'no' && host.PublishAllPorts === false
    && Object.keys(host.PortBindings ?? {}).length === 0
    && host.Memory === 1073741824 && host.NanoCpus === 2000000000 && host.PidsLimit === 128
    && Object.keys(host.Tmpfs ?? {}).sort().join(',') === '/tmp,/work'
    && host.Tmpfs['/tmp'] === 'rw,nosuid,nodev,size=128m,mode=1777'
    && host.Tmpfs['/work'] === 'rw,nosuid,nodev,size=512m,uid=65532,gid=65532,mode=0700'
    && mounts.length === 1 && mounts[0].Type === 'volume' && mounts[0].RW === true
    && mounts[0].Name === evidenceVolume && mounts[0].Destination === '/evidence',
  'NATIVE_RUNNER_ISOLATION_REJECTED');
}

function docker(args, input, { signal, timeoutMs }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Error('NATIVE_HOST_INTERRUPTED'));
      return;
    }
    const child = spawn('/usr/bin/docker', ['--host', 'unix:///run/docker.sock', ...args], {
      env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent', DOCKER_CONFIG: '/nonexistent' },
      stdio: ['pipe', 'ignore', 'ignore'],
    });
    let interrupted = false;
    const interrupt = () => {
      interrupted = true;
      child.kill('SIGKILL');
    };
    const timeout = setTimeout(interrupt, timeoutMs);
    signal?.addEventListener('abort', interrupt, { once: true });
    if (signal?.aborted) interrupt();
    child.stdin.on('error', interrupt);
    child.on('error', interrupt);
    child.on('close', code => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', interrupt);
      if (!interrupted && code === 0) resolve();
      else reject(Error('NATIVE_HOST_OUTCOME_UNKNOWN'));
    });
    child.stdin.end(input);
  });
}

/** Host and worker are both held behind the source interlock pending review. */
export async function launchNativeTrackB(options) {
  requireNativeLiveEntry();
  const { binding, approval, secrets, context, isolation, signal } = options;
  verifyNativeWriteAuthority(approval, binding);
  verifyNativeDockerContext(context);
  requireFact(await realpath('/var/run/docker.sock') === '/run/docker.sock', 'NATIVE_DOCKER_SOCKET_REJECTED');
  requireFact(!['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']
    .some(variable => process.env[variable]), 'NATIVE_DOCKER_CONTEXT_REJECTED');
  requireFact(isolation?.bindingDigest === approval.bindingDigest
    && isolation.provisioningReceipt === binding.provisioningReceipt
    && isolation.runnerEvidenceVerified === true && isolation.runnerArtifactVerified === true,
  'NATIVE_PREREQUISITE_RECEIPT_REJECTED');
  const observed = await inspectTrackBNativeDocker({ signal });
  observed.volume.fingerprint = nativeVolumeFingerprint(observed.volume, binding.resourceNonce);
  requireFact(observed.container.Config.Labels?.['zentric.q03.resource'] === binding.resourceNonce
    && observed.network.Labels?.['zentric.q03.resource'] === binding.resourceNonce
    && observed.container.HostConfig.Memory === 536870912 && observed.container.HostConfig.NanoCpus === 1000000000,
  'NATIVE_RESOURCE_OWNERSHIP_REJECTED');
  verifyNativeResources(binding, {
    ...observed, egressVerified: isolation.egressVerified, storageVerified: isolation.storageVerified,
    runnerMountIsolationVerified: isolation.runnerMountIsolationVerified,
    syntheticCredentialsVerified: isolation.syntheticCredentialsVerified,
  });
  const evidence = await inspectNativeEvidenceVolume({ signal });
  requireFact(id(binding.evidenceVolumeFingerprint) && evidence.Name === evidenceVolume && evidence.Driver === 'local'
    && nativeVolumeFingerprint(evidence, binding.resourceNonce) === binding.evidenceVolumeFingerprint,
  'NATIVE_EVIDENCE_VOLUME_REJECTED');
  verifyNativeRunner(binding, await inspectNativeRunner(binding.runnerId, { signal }));
  verifyNativeWriteAuthority(approval, binding);
  try {
    const timeoutMs = Math.min(approval.expiresAt - Date.now(), 900_000);
    requireFact(timeoutMs > 0, 'NATIVE_WRITE_AUTHORITY_EXPIRED');
    await docker(['start', '--attach', '--interactive', binding.runnerId],
      JSON.stringify({ binding, approval, secrets }), { signal, timeoutMs });
    const finished = await inspectNativeRunner(binding.runnerId);
    verifyNativeRunner(binding, finished, 'exited');
    requireFact(finished.State.ExitCode === 0 && finished.State.Pid === 0, 'NATIVE_WORKER_CLOSURE_UNVERIFIED');
  } catch {
    // Never delete or retry. The docker client exiting does not stop the runner.
    // Signal only the still-running, freshly inspected, exact bound container.
    const current = await inspectNativeRunner(binding.runnerId);
    if (current.State?.Running === true) {
      verifyNativeRunner(binding, current, 'running');
      await docker(['kill', '--signal', 'SIGTERM', binding.runnerId], '', { timeoutMs: 5000 });
      const deadline = Date.now() + 5000;
      let stopped;
      do {
        stopped = await inspectNativeRunner(binding.runnerId, { signal: AbortSignal.timeout(1000) });
        if (stopped.State?.Running === false) break;
        verifyNativeRunner(binding, stopped, 'running');
        await delay(100);
      } while (Date.now() < deadline);
      verifyNativeRunner(binding, stopped, 'exited');
      requireFact(stopped.State.Pid === 0, 'NATIVE_WORKER_CLOSURE_UNVERIFIED');
    }
    throw Error('NATIVE_HOST_STOPPED_PRESERVE');
  }
}
