import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, realpath } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { B1, digest } from './b1-contract.mjs';
import { fingerprintNativeBoundarySource, verifyNativeInputs } from './track-b-native-boundary.mjs';
import { observeNativeCreationPreflight } from './track-b-native-creation-host.mjs';
import { inspectNativeEvidenceVolume, inspectNativeSocketVolume, inspectTrackBNativeDocker } from './track-b-native-engine.mjs';
import { nativeVolumeFingerprint, verifyNativeTrackBHostResources } from './track-b-native-host.mjs';
import { localAuthorityDirectory, localMode, runnerAuthorityDirectory, validateLocalBinding } from './track-b-native-local-authority.mjs';
import { validateNativeCreationBinding } from './track-b-native-reservation.mjs';

const state = '/root/.local/state/zentric-q03-synthetic';
const command = promisify(execFile);
const docker = async args => (await command('/usr/bin/docker', ['--host', 'unix:///run/docker.sock', ...args], {
  env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent', DOCKER_CONFIG: '/nonexistent' },
  timeout: 30_000, maxBuffer: 32_768,
})).stdout.trim();
const hex = () => randomBytes(32).toString('hex');
const requireFact = (value, code) => { if (!value) throw Error(code); };

async function prepare(image) {
  requireFact(process.platform === 'linux' && process.getuid?.() === 0 && /^sha256:[a-f0-9]{64}$/.test(image),
    'NATIVE_OPERATOR_SCOPE_REJECTED');
  requireFact(!['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH'].some(key => process.env[key]),
    'NATIVE_DOCKER_CONTEXT_REJECTED');
  const directory = await lstat(state);
  requireFact(directory.uid === 0 && (directory.mode & 0o077) === 0 && directory.isDirectory()
    && await realpath(state) === state, 'NATIVE_OPERATOR_PRIVATE_FILE_REJECTED');
  const entries = await readdir(state);
  requireFact(!entries.includes('track-b-windows-plan.json') && !entries.includes('q03_replacement_track_b.creation.jsonl'),
    'NATIVE_LOCAL_RESERVATION_ALREADY_USED');
  const identity = (await readFile(state + '/identities', 'utf8')).trim().split('\n');
  const clusterId = (await readFile(state + '/cluster-identity', 'utf8')).trim();
  const observed = await inspectTrackBNativeDocker();
  requireFact(identity.length === 4 && observed.container.Id === identity[3] && observed.network.Id === identity[2],
    'NATIVE_OPERATOR_RESOURCE_DRIFT');
  requireFact((await observeNativeCreationPreflight()).targetAbsent, 'NATIVE_CREATION_PREFLIGHT_REJECTED');
  let transport;
  for (const entry of entries.filter(value => /^runner-transport\.[a-zA-Z0-9]+$/.test(value))) {
    const result = await readFile(state + '/' + entry + '/result', 'utf8');
    const checksum = (await readFile(state + '/' + entry + '/result.sha256', 'utf8')).trim().split(/\s/)[0];
    if (result === 'stage=complete\nstatus=0\nimage=' + image + '\n' && digest(result) === checksum) transport = checksum;
  }
  requireFact(transport, 'NATIVE_RUNNER_PREFLIGHT_RECEIPT_MISSING');
  const cold = entries.filter(value => /^track-b-cold\.[a-zA-Z0-9]+$/.test(value));
  let preserved;
  for (const entry of cold) {
    try {
      const folder = state + '/' + entry;
      const proof = await readFile(folder + '/restore-verified', 'utf8');
      if (proof && (await readFile(folder + '/original-cluster-id', 'utf8')).trim() === clusterId) {
        await command('/usr/bin/sha256sum', ['--check', '--status', 'SHA256SUMS'], { cwd: folder, timeout: 20_000 });
        preserved = digest(await readFile(folder + '/SHA256SUMS'));
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  requireFact(preserved, 'NATIVE_COLD_PRESERVATION_REQUIRED');
  await verifyNativeInputs();
  const sourceFingerprint = await fingerprintNativeBoundarySource();
  const probe = ['run', '--rm', '--pull=never', '--network=none', '--read-only', '--user=65532:65532',
    '--cap-drop=ALL', '--security-opt=no-new-privileges', '--memory=256m', '--cpus=1', '--pids-limit=32'];
  const windowsHelper = '/opt/q03/track-b-windows-approval.ps1';
  const paths = ['/opt/node/bin/node', '/opt/project/node_modules/prisma/build/index.js', '/usr/bin/psql',
    '/opt/engines/schema-engine', '/opt/engines/libquery_engine.so.node', windowsHelper];
  requireFact(await docker([...probe, '--entrypoint', '/opt/node/bin/node', image, '--input-type=module', '-e',
    "import {fingerprintNativeBoundarySource as f} from '/opt/q03/track-b-native-boundary.mjs'; console.log(await f())"]) === sourceFingerprint,
  'NATIVE_SOURCE_CHANGED');
  const hashes = await docker([...probe, '--entrypoint', '/usr/bin/sha256sum', image, ...paths]);
  const artifactHashes = Object.fromEntries(hashes.trim().split('\n').map(line => {
    const match = /^([a-f0-9]{64}) {2}(\/[^\s]+)$/.exec(line);
    requireFact(match && paths.includes(match[2]), 'NATIVE_RUNNER_ARTIFACT_CHANGED');
    return [match[2], match[1]];
  }));
  requireFact(paths.every(path => artifactHashes[path]), 'NATIVE_RUNNER_ARTIFACT_CHANGED');
  const [socket, evidence] = await Promise.all([inspectNativeSocketVolume(), inspectNativeEvidenceVolume()]);
  const engine = observed.engine;
  const resourceNonce = identity[1];
  const context = { name: 'default', endpoint: 'unix:///var/run/docker.sock', socketRealpath: '/run/docker.sock', remoteOverridesAbsent: true };
  const provisioningReceipt = digest(JSON.stringify({ transport, preserved, clusterId, containerId: observed.container.Id }));
  const isolationEvidence = { provisioningReceipt, runnerEvidenceVerified: true, runnerArtifactVerified: true,
    egressVerified: true, storageVerified: true, runnerMountIsolationVerified: true, syntheticCredentialsVerified: true };
  const binding = {
    authorizationMode: localMode, environment: 'local-synthetic', operationSet: 'Q03_NATIVE_TRACK_B_66_PLUS_2_V1',
    target: 'q03_replacement_track_b', baseline: 'q03_replacement_baseline',
    targetRole: 'q03_replacement_runner', ownerRole: 'q03_replacement_owner',
    context, clusterId, runId: hex(), serverMarker: hex(), sourceFingerprint, inputManifest: B1.manifest,
    provisioningReceipt, isolationEvidenceDigest: digest(JSON.stringify(isolationEvidence)),
    engineFingerprint: engine.engineFingerprint, containerId: observed.container.Id, networkId: observed.network.Id,
    imageId: observed.image.Id, resourceNonce, volumeFingerprint: nativeVolumeFingerprint(observed.volume, resourceNonce),
    socketSource: socket.Name, socketVolumeFingerprint: nativeVolumeFingerprint(socket, resourceNonce),
    evidenceVolumeFingerprint: nativeVolumeFingerprint(evidence, resourceNonce), runnerImageId: image, artifactHashes,
    windowsHelperDigest: artifactHashes[windowsHelper],
  };
  validateLocalBinding(binding);
  validateNativeCreationBinding(binding);
  if (!entries.includes('m17-authority')) await mkdir(localAuthorityDirectory, { mode: 0o755 });
  const authority = await lstat(localAuthorityDirectory);
  requireFact(authority.isDirectory() && authority.uid === 0 && (authority.mode & 0o022) === 0
    && await realpath(localAuthorityDirectory) === localAuthorityDirectory
    && (await readdir(localAuthorityDirectory)).length === 0, 'NATIVE_LOCAL_RESERVATION_ALREADY_USED');
  const names = (await docker(['ps', '-a', '--format', '{{.Names}}'])).split('\n');
  const name = 'zentric-q03-m17-runner';
  binding.runnerId = names.includes(name)
    ? await docker(['inspect', '--format', '{{.Id}}', name])
    : await docker(['create', '--name', name, '--pull=never', '--network=none',
    '--read-only', '--interactive', '--init', '--user=65532:65532', '--cap-drop=ALL',
    '--security-opt=no-new-privileges', '--memory=1g', '--cpus=2', '--pids-limit=128', '--restart=no',
    '--label', 'zentric.q03.resource=' + resourceNonce, '--label', 'zentric.q03.role=native-runner',
    '--tmpfs', '/tmp:rw,nosuid,nodev,size=128m,mode=1777',
    '--tmpfs', '/work:rw,nosuid,nodev,size=512m,uid=65532,gid=65532,mode=0700',
    '--mount', 'type=volume,source=' + socket.Name + ',target=/socket,readonly,volume-nocopy',
    '--mount', 'type=volume,source=' + evidence.Name + ',target=/evidence,volume-nocopy',
    '--mount', 'type=bind,source=' + localAuthorityDirectory + ',target=' + runnerAuthorityDirectory + ',readonly', image]);
  const isolation = { ...isolationEvidence, bindingDigest: digest(JSON.stringify(binding)) };
  await verifyNativeTrackBHostResources({ binding, context, isolation });
  const plan = await open(state + '/track-b-windows-plan.json', 'wx', 0o600);
  try { await plan.writeFile(JSON.stringify({ binding, context, isolation })); await plan.sync(); }
  finally { await plan.close(); }
  const root = await open(state, 'r');
  try { await root.sync(); } finally { await root.close(); }
  console.log('NATIVE_LOCAL_PLAN_PREPARED_NO_WRITES');
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  Promise.resolve().then(() => {
    requireFact(process.argv.length === 3, 'NATIVE_OPERATOR_SCOPE_REJECTED');
    return prepare(process.argv[2]);
  }).catch(error => {
    console.error(/^NATIVE_[A-Z0-9_]+$/.test(error.message) ? error.message : 'NATIVE_LOCAL_PLAN_STOPPED_PRESERVE');
    process.exitCode = 1;
  });
}
