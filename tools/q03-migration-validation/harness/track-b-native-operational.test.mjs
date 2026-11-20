import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { digest, reviewedInputs } from './b1-contract.mjs';
import { overlapQueries } from './concurrency.mjs';
import { observeTrackBNativeEngine } from './track-b-native-engine.mjs';
import { launchNativeTrackB, nativeVolumeFingerprint, verifyNativeDockerContext, verifyNativeRunner } from './track-b-native-host.mjs';
import { buildNativeSessionGuard, nativeAuthorityMessage, runNativePostgresTrackB, verifyNativeSignedAuthority, verifyNativeWriteAuthority } from './track-b-native-postgres.mjs';
import { verifyPrismaConnection, verifyPrismaTransaction } from './track-b-native-prisma-check.mjs';
import { nativeMaintenanceCreationProgram } from './track-b-native-maintenance.mjs';

const hash = value => value.repeat(64);
const binding = {
  authorizationMode: 'signed-owner',
  baseline: 'q03_replacement_baseline', target: 'q03_replacement_track_b',
  baselineRole: 'q03_replacement_reader', controlRole: 'q03_replacement_creator',
  targetRole: 'q03_replacement_runner', ownerRole: 'q03_replacement_owner', runId: hash('1'), serverMarker: hash('2'),
  sourceFingerprint: hash('3'), provisioningReceipt: hash('4'), runnerId: hash('5'),
  runnerImageId: 'sha256:' + hash('6'), containerId: hash('7'), resourceNonce: hash('8'),
  socketSource: 'zentric-q03-replacement-socket',
};
const tag = 'q03b_' + binding.runId.slice(0, 24);
const issuedAt = 20_000;
const approval = {
  mode: 'signed-owner',
  scope: 'Q03_NATIVE_TRACK_B_WRITE', bindingDigest: digest(JSON.stringify(binding)),
  issuedAt, expiresAt: issuedAt + 10_000, provisioningReceipt: binding.provisioningReceipt,
};
const dockerContext = {
  name: 'default', endpoint: 'unix:///var/run/docker.sock', socketRealpath: '/run/docker.sock', remoteOverridesAbsent: true,
};

test('maintenance creation plan binds one exact cluster, socket, database, lock, and non-login owner', () => {
  const sql = nativeMaintenanceCreationProgram('1234567890123456789');
  assert.match(sql, /current_database\(\) = 'postgres'/);
  assert.match(sql, /inet_server_addr\(\) IS NULL/);
  assert.match(sql, /system_identifier::text FROM pg_control_system/);
  assert.match(sql, /pg_try_advisory_lock/);
  assert.match(sql, /NOT EXISTS \(SELECT 1 FROM pg_database WHERE datname = 'q03_replacement_track_b'\)/);
  assert.match(sql, /NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb/);
  assert.deepEqual(sql.match(/CREATE DATABASE[^;]+;/g), [
    'CREATE DATABASE "q03_replacement_track_b" OWNER "q03_replacement_owner" TEMPLATE template0;',
  ]);
  assert.throws(() => nativeMaintenanceCreationProgram("123'; CREATE DATABASE other;"), /CLUSTER_REJECTED/);
});

test('live host and worker refuse to inspect or launch without an explicitly authorized mode', async () => {
  await assert.rejects(launchNativeTrackB({ binding }), /AUTHORITY_MODE_REJECTED/);
  await assert.rejects(runNativePostgresTrackB({ binding }), /AUTHORITY_MODE_REJECTED/);
  if (process.platform === 'win32') await assert.rejects(observeTrackBNativeEngine(), /NATIVE_WSL_REQUIRED/);
});

test('write approval is bound to exact resources, distinct provisioning approval and a short freshness interval', () => {
  assert.doesNotThrow(() => verifyNativeWriteAuthority(approval, binding, issuedAt));
  for (const [permit, candidate, now] of [
    [null, binding, issuedAt],
    [approval, binding, issuedAt - 1],
    [approval, binding, approval.expiresAt],
    [approval, { ...binding, controlRole: 'q03_replacement_unrelated' }, issuedAt],
    [{ ...approval, provisioningReceipt: hash('0') }, binding, issuedAt],
    [{ ...approval, scope: 'smoke-test' }, binding, issuedAt],
  ]) assert.throws(() => verifyNativeWriteAuthority(permit, candidate, now), /WRITE_AUTHORITY_REJECTED/);
});

test('signed authority rejects a changed expiry, missing signature and a different operator key', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const other = generateKeyPairSync('ed25519').publicKey;
  const signature = sign(null, nativeAuthorityMessage(approval), privateKey).toString('base64url');
  const signed = { ...approval, signature };
  assert.doesNotThrow(() => verifyNativeSignedAuthority(signed, binding, publicKey, issuedAt));
  assert.throws(() => verifyNativeSignedAuthority(approval, binding, publicKey, issuedAt), /SIGNATURE_REJECTED/);
  assert.throws(() => verifyNativeSignedAuthority(signed, binding, other, issuedAt), /SIGNATURE_REJECTED/);
  assert.throws(() => verifyNativeSignedAuthority({ ...signed, expiresAt: signed.expiresAt + 1 }, binding, publicKey, issuedAt),
    /SIGNATURE_REJECTED/);
});

test('altered migration bytes fail before any write can be admitted', () => {
  const manifest = readFileSync(new URL('./input-manifest.json', import.meta.url));
  const edited = 'inputs/prisma/migrations/20261029000200_email_queue_safety_contract/migration.sql';
  const read = file => {
    const bytes = readFileSync(new URL(file, import.meta.url));
    return file === edited ? Buffer.concat([bytes, Buffer.from('\n-- synthetic mutation')]) : bytes;
  };
  assert.throws(() => reviewedInputs(manifest, read), /INPUT_HASH_MISMATCH/);
});

test('rejects context aliases, remote endpoints and overrides', () => {
  assert.doesNotThrow(() => verifyNativeDockerContext(dockerContext));
  for (const change of [{ name: 'desktop-linux' }, { endpoint: 'tcp://127.0.0.1:2375' },
    { socketRealpath: '/tmp/unowned.sock' }, { remoteOverridesAbsent: false }]) {
    assert.throws(() => verifyNativeDockerContext({ ...dockerContext, ...change }), /CONTEXT_REJECTED/);
  }
});

test('named volume alone is insufficient to establish ownership', () => {
  const volume = { Name: 'zentric-q03-replacement-data', Driver: 'local', CreatedAt: '2026-11-01T00:00:00Z',
    Labels: { 'zentric.q03.resource': binding.resourceNonce } };
  const expected = nativeVolumeFingerprint(volume, binding.resourceNonce);
  assert.match(expected, /^[a-f0-9]{64}$/);
  assert.notEqual(expected, nativeVolumeFingerprint({ ...volume, CreatedAt: '2026-11-02T00:00:00Z' }, binding.resourceNonce));
  assert.throws(() => nativeVolumeFingerprint({ ...volume, Labels: {} }, binding.resourceNonce), /VOLUME_OWNERSHIP_REJECTED/);
});

function runner() {
  return {
    Id: binding.runnerId, Image: binding.runnerImageId,
    Config: { User: '65532:65532', OpenStdin: true, Tty: false, Env: [],
      Labels: { 'zentric.q03.resource': binding.resourceNonce, 'zentric.q03.role': 'native-runner' },
      Entrypoint: ['/opt/node/bin/node'], Cmd: ['/opt/q03/track-b-native-postgres.mjs'] },
    State: { Status: 'created', Running: false },
    HostConfig: { NetworkMode: 'none', Privileged: false, ReadonlyRootfs: true,
      Init: true, PidMode: '', CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges'], RestartPolicy: { Name: 'no' },
      PublishAllPorts: false, Memory: 1073741824, NanoCpus: 2000000000, PidsLimit: 128,
      Tmpfs: { '/tmp': 'rw,nosuid,nodev,size=128m,mode=1777',
        '/work': 'rw,nosuid,nodev,size=512m,uid=65532,gid=65532,mode=0700' } },
    Mounts: [{ Type: 'volume', Name: 'zentric-q03-replacement-evidence', Destination: '/evidence', RW: true },
      { Type: 'volume', Name: binding.socketSource, Destination: '/socket', RW: false },
      { Type: 'bind', Source: '/root/.local/state/zentric-q03-synthetic/track-b-authority.pem',
        Destination: '/opt/q03/track-b-authority.pem', RW: false }],
  };
}

test('runner refuses additional mounts, inherited secrets, wrong namespace or wrong immutable image', () => {
  assert.doesNotThrow(() => verifyNativeRunner(binding, runner()));
  for (const change of [
    value => { value.Mounts.push({ Type: 'bind', Destination: '/run/docker.sock' }); },
    value => { value.Config.Env.push('RESEND_API_KEY=fixture'); },
    value => { value.HostConfig.NetworkMode = 'host'; },
    value => { value.Mounts[1].RW = true; },
    value => { value.Mounts[1].Name = 'zentric-q03-replacement-data'; },
    value => { value.Mounts[2].RW = true; },
    value => { value.Image = 'sha256:' + hash('0'); },
    value => { value.Config.Labels['zentric.q03.resource'] = hash('0'); },
    value => { value.State.Status = 'exited'; },
  ]) {
    const value = runner();
    change(value);
    assert.throws(() => verifyNativeRunner(binding, value), /RUNNER_ISOLATION_REJECTED/);
  }
});

test('the runner SQL guard accepts only its bound target over a Unix socket', () => {
  const guard = buildNativeSessionGuard(binding, 'target');
  assert.ok(guard.includes(binding.targetRole) && guard.includes(binding.ownerRole));
  assert.ok(guard.includes(binding.serverMarker));
  assert.match(guard, /inet_server_addr\(\) IS NULL/);
  assert.match(guard, /NOT rolcreatedb/);
  assert.match(guard, /180006/);
  assert.match(guard, /SELECT 1\/0/);
  assert.throws(() => buildNativeSessionGuard(binding, 'control'), /OPERATION_REJECTED/);
  assert.throws(() => buildNativeSessionGuard(binding, 'baseline'), /OPERATION_REJECTED/);
  assert.throws(() => buildNativeSessionGuard(binding, 'arbitrary-sql'), /OPERATION_REJECTED/);
  assert.throws(() => buildNativeSessionGuard({ ...binding, target: 'postgres' }, 'target'), /BINDING_REJECTED/);
  assert.throws(() => buildNativeSessionGuard({ ...binding, targetRole: "';\n" }, 'target'), /BINDING_REJECTED/);
});

test('native cancellation checks exact database, role, run tag, PID and backend start', () => {
  const queries = overlapQueries('interrupted_lock', 'SELECT 1;', 'SELECT 1;', {
    interrupt: true, nativeIdentity: { database: binding.target, role: binding.targetRole, tag },
  });
  assert.ok(queries.control.includes(tag + '_interrupted_lock_leader'));
  assert.ok(queries.control.includes(binding.target));
  assert.ok(queries.control.includes(binding.targetRole));
  assert.match(queries.control, /INTO STRICT owned_pid,owned_start/);
  assert.match(queries.control, /pid=owned_pid AND backend_start=owned_start/);
  assert.match(queries.control, /IF NOT pg_cancel_backend\(owned_pid\)/);
  assert.throws(() => overlapQueries('interrupted_lock', '', '', {
    nativeIdentity: { database: 'postgres', role: binding.targetRole, tag },
  }), /INVALID_NATIVE_RACE_IDENTITY/);
});

function prismaInput() {
  const url = new URL('postgresql://localhost:5432/' + binding.target);
  url.username = binding.targetRole;
  url.password = hash('0');
  url.searchParams.set('host', '/socket');
  url.searchParams.set('application_name', tag);
  url.searchParams.set('connect_timeout', '5');
  url.searchParams.set('connection_limit', '1');
  url.searchParams.set('options', '-c statement_timeout=120000 -c lock_timeout=10000 -c idle_in_transaction_session_timeout=15000');
  return { url: url.href, database: binding.target, role: binding.targetRole, marker: binding.serverMarker, tag };
}

test('generated Prisma client configuration rejects alternate hosts, schemas, roles and overrides', () => {
  const input = prismaInput();
  assert.doesNotThrow(() => verifyPrismaConnection(input));
  for (const url of [input.url.replace('localhost', 'db.example.invalid'), input.url.replace('%2Fsocket', '%2Fwrong'),
    input.url + '&schema=other', input.url + '&application_name=other',
    input.url.replace(binding.targetRole, binding.controlRole), input.url.replace(binding.target, 'postgres')]) {
    assert.throws(() => verifyPrismaConnection({ ...input, url }), /PRISMA_VERIFICATION_FAILED/);
  }
});

test('generated query sequence proves rollback and fails before writes on the wrong session', async () => {
  let writes = 0;
  const model = verified => ({
    async $transaction(action, options) {
      assert.deepEqual(options, { maxWait: 3000, timeout: 10_000 });
      let pending;
      return action({
        $queryRaw: () => [{ verified }],
        hrEmailOutbox: {
          async count({ where }) { return pending?.organizationId === where.organizationId && pending.id === where.id ? 1 : 0; },
          async create({ data }) { writes++; pending = data; },
          async findFirst({ where }) { return pending?.id === where.id ? pending : null; },
          async updateMany({ where }) { return { count: pending?.version === where.version ? 1 : 0 }; },
        },
      });
    },
  });
  await assert.rejects(verifyPrismaTransaction(model(false), prismaInput()), /PRISMA_VERIFICATION_FAILED/);
  assert.equal(writes, 0);
  await verifyPrismaTransaction(model(true), prismaInput());
  assert.equal(writes, 1);
});
