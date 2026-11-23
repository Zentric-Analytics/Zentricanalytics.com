import { spawn } from 'node:child_process';
import { createPublicKey, verify } from 'node:crypto';
import { existsSync } from 'node:fs';
import { lstat, mkdir, open, readFile, realpath, symlink, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { B1, assertLedger, digest, fixedSQL, inputPath } from './b1-contract.mjs';
import { runConcurrencyTests, runDatabaseTests } from './db-tests.mjs';
import { CATALOG_SQL, assertHistoricalPreserved, assertSafetyDefinitions } from './evidence-rules.mjs';
import { baseFixturesSQL, legacyFixturesSQL, LEGACY_SNAPSHOT_SQL } from './fixtures.mjs';
import { fingerprintNativeBoundarySource, verifyNativeInputs } from './track-b-native-boundary.mjs';
import { dockerTrackBProfile as profile } from './track-b-docker-gate.mjs';
import { verifySyntheticSnapshot } from './track-b-offline-runner.mjs';
import { localMode, signedMode, verifyLocalHostApproval, verifyLocalRunnerReceipt } from './track-b-native-local-authority.mjs';

// Deliberate source-level interlock. No flag, environment variable, fixture
// receipt or private manifest can enable database operations in this revision.
const authorityPaths = Object.freeze({
  host: '/root/.local/state/zentric-q03-synthetic/track-b-authority.pem',
  runner: '/opt/q03/track-b-authority.pem',
});

export function requireNativeLiveEntry(location = 'runner') {
  requireFact(Object.hasOwn(authorityPaths, location) && process.platform === 'linux'
    && existsSync(authorityPaths[location]), 'NATIVE_LIVE_ENTRY_DISABLED');
}
const schemaSource = new URL('./inputs/prisma/schema.prisma', import.meta.url);
const work = '/work/zentric-native-track-b';
const node = '/opt/node/bin/node';
const prisma = '/opt/project/node_modules/prisma/build/index.js';
const modules = '/opt/project/node_modules';
const schemaEngine = '/opt/engines/schema-engine';
const queryEngine = '/opt/engines/libquery_engine.so.node';
const psql = '/usr/bin/psql';
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const childEnvironment = Object.freeze({
  PATH: '/opt/node/bin:/usr/bin:/bin', HOME: '/tmp', TMPDIR: '/tmp',
  LC_ALL: 'C', CHECKPOINT_DISABLE: '1', DO_NOT_TRACK: '1', PRISMA_GENERATE_SKIP_AUTOINSTALL: '1',
  PRISMA_HIDE_UPDATE_MESSAGE: '1', PRISMA_SCHEMA_ENGINE_BINARY: schemaEngine,
  PRISMA_QUERY_ENGINE_LIBRARY: queryEngine,
});
const artifacts = Object.freeze([node, prisma, psql, schemaEngine, queryEngine]);

function requireFact(condition, code) {
  if (!condition) throw Error(code);
}

export function verifyNativeWriteAuthority(approval, binding, now = Date.now()) {
  requireFact(approval?.scope === 'Q03_NATIVE_TRACK_B_WRITE'
    && Number.isSafeInteger(now) && Number.isSafeInteger(approval.issuedAt)
    && Number.isSafeInteger(approval.expiresAt) && approval.issuedAt <= now
    && approval.expiresAt > now && approval.expiresAt - approval.issuedAt <= 3_600_000
    && sha(binding?.runId) && sha(approval.provisioningReceipt)
    && approval.provisioningReceipt === binding.provisioningReceipt
    && sha(approval.bindingDigest) && approval.bindingDigest === digest(JSON.stringify(binding)),
  'NATIVE_WRITE_AUTHORITY_REJECTED');
}

export function nativeAuthorityMessage(approval) {
  return Buffer.from(JSON.stringify(['zentric-native-track-b-v2', approval.mode, approval.scope, approval.bindingDigest,
    approval.provisioningReceipt, approval.issuedAt, approval.expiresAt]));
}

export function verifyNativeSignedAuthority(approval, binding, publicKey, now = Date.now()) {
  requireFact(approval?.mode === signedMode && binding?.authorizationMode === signedMode,
    'NATIVE_AUTHORITY_MODE_REJECTED');
  verifyNativeWriteAuthority(approval, binding, now);
  requireFact(publicKey?.type === 'public' && publicKey.asymmetricKeyType === 'ed25519'
    && typeof approval.signature === 'string' && /^[a-zA-Z0-9_-]{86}$/.test(approval.signature)
    && verify(null, nativeAuthorityMessage(approval), publicKey, Buffer.from(approval.signature, 'base64url')),
  'NATIVE_WRITE_AUTHORITY_SIGNATURE_REJECTED');
}

export async function verifyNativeRuntimeApproval(approval, binding, location) {
  requireFact(['host', 'runner'].includes(location) && approval?.mode === binding?.authorizationMode,
    'NATIVE_AUTHORITY_MODE_REJECTED');
  if (approval?.mode === localMode) {
    verifyNativeWriteAuthority(approval, binding);
    if (location === 'host') verifyLocalHostApproval(approval, binding);
    else await verifyLocalRunnerReceipt(approval, binding);
    return undefined;
  }
  requireFact(approval?.mode === signedMode, 'NATIVE_AUTHORITY_MODE_REJECTED');
  const key = await loadNativeAuthorityKey(location);
  verifyNativeSignedAuthority(approval, binding, key);
  return key;
}

export async function loadNativeAuthorityKey(location) {
  requireFact(location === 'host' || location === 'runner', 'NATIVE_AUTHORITY_LOCATION_REJECTED');
  const filename = authorityPaths[location];
  const info = await lstat(filename);
  requireFact(info.isFile() && info.uid === 0 && (info.mode & 0o022) === 0 && info.size <= 1024,
    'NATIVE_AUTHORITY_KEY_UNTRUSTED');
  return createPublicKey(await readFile(filename));
}

function verifyBinding(binding) {
  requireFact(binding?.target === profile.target && binding.baseline === profile.baseline
    && sha(binding.runId) && sha(binding.serverMarker) && sha(binding.sourceFingerprint)
    && sha(binding.provisioningReceipt) && binding.targetRole === 'q03_replacement_runner'
    && binding.ownerRole === 'q03_replacement_owner',
  'NATIVE_POSTGRES_BINDING_REJECTED');
}

// Every psql operation checks identity on the same connection that will run it.
// Credentials are never SQL interpolation, process arguments, or evidence.
export function buildNativeSessionGuard(binding, purpose) {
  verifyBinding(binding);
  requireFact(purpose === 'target', 'NATIVE_OPERATION_REJECTED');
  return `SELECT (current_database() = '${profile.target}' AND session_user = '${binding.targetRole}' AND current_user = session_user
  AND current_setting('server_version_num')::int = ${profile.serverVersion}
  AND current_setting('zentric.q03_replacement_marker',true) = '${binding.serverMarker}'
  AND inet_server_addr() IS NULL AND inet_client_addr() IS NULL
  AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolcanlogin AND NOT rolsuper AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls AND NOT rolcreatedb)
  AND EXISTS (SELECT 1 FROM pg_database WHERE datname=current_database()
    AND pg_get_userbyid(datdba)='${binding.ownerRole}' AND pg_has_role(current_user, datdba, 'USAGE'))
  ) IS TRUE AS native_identity_ok \\gset
\\if :native_identity_ok
\\else
SELECT 1/0;
\\endif
`;
}

function runChild(executable, args, input, env, { signal, timeoutMs, allowCancellation = false }) {
  return new Promise((resolveChild, reject) => {
    if (signal?.aborted) {
      reject(Error('NATIVE_CHILD_INTERRUPTED'));
      return;
    }
    const child = spawn(executable, args, { cwd: work, env, stdio: ['pipe', 'pipe', 'pipe'] });
    const output = [];
    let size = 0;
    let diagnostics = '';
    let interrupted = false;
    let killDeadline;
    const stop = () => {
      if (interrupted) return;
      interrupted = true;
      child.kill('SIGTERM');
      killDeadline = setTimeout(() => child.kill('SIGKILL'), 500);
    };
    const timer = setTimeout(stop, timeoutMs);
    signal?.addEventListener('abort', stop, { once: true });
    if (signal?.aborted) stop();
    child.stdout.on('data', chunk => {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) stop();
      else output.push(chunk);
    });
    child.stderr.on('data', chunk => {
      diagnostics += chunk.toString();
      if (diagnostics.length > 16 * 1024) stop();
    });
    child.stdin.on('error', stop);
    child.on('error', stop);
    child.on('close', (code, exitSignal) => {
      clearTimeout(timer);
      clearTimeout(killDeadline);
      signal?.removeEventListener('abort', stop);
      if (interrupted || exitSignal) reject(Error('NATIVE_CHILD_OUTCOME_UNKNOWN'));
      else if (code === 0) resolveChild(Buffer.concat(output).toString().trim());
      else if (allowCancellation && /\b57014: canceling statement due to user request\b/.test(diagnostics)) {
        reject(Error('canceling statement due to user request'));
      } else reject(Error('NATIVE_CHILD_OPERATION_FAILED'));
    });
    child.stdin.end(input);
  });
}

async function verifyArtifactIntegrity(binding) {
  requireFact(process.platform === 'linux' && process.version === 'v' + profile.node
    && process.execPath === node && process.getuid?.() === 65532, 'NATIVE_RUNNER_RUNTIME_REJECTED');
  for (const artifact of artifacts) {
    requireFact(sha(binding.artifactHashes?.[artifact])
      && digest(await readFile(artifact)) === binding.artifactHashes[artifact],
    'NATIVE_RUNNER_ARTIFACT_CHANGED');
  }
  for (const [path, hash] of [
    [schemaEngine, '348b9e6f5c531d13a2cdb1e130b90306b8fe8d30cda879fbf22d21ea787f6244'],
    [queryEngine, 'aef387b0b42412126048b637c502bd30ac32f696da402d39985f83ac95899544'],
  ]) {
    requireFact(binding.artifactHashes[path] === hash, 'NATIVE_PRISMA_ENGINE_PIN_MISMATCH');
  }
  for (const name of ['prisma', '@prisma/client']) {
    requireFact(JSON.parse(await readFile(modules + '/' + name + '/package.json', 'utf8')).version === profile.prisma,
      'NATIVE_PRISMA_VERSION_REJECTED');
  }
}

async function prepareProject(migrations) {
  const manifest = await readFile(new URL('./input-manifest.json', import.meta.url));
  requireFact(digest(manifest) === B1.manifest, 'NATIVE_INPUT_MANIFEST_CHANGED');
  const known = new Map(JSON.parse(manifest.toString().replace(/^\uFEFF/, '')).Files
    .map(entry => [inputPath(entry.Path), entry.SHA256]));
  for (const [label, selected] of [['historical', migrations.slice(0, 66)], ['upgrade', migrations]]) {
    const project = work + '/' + label;
    await mkdir(project + '/migrations', { recursive: true, mode: 0o700 });
    const copy = async (file, destination) => {
      const path = 'inputs/prisma/' + file;
      const bytes = await readFile(new URL(path, import.meta.url));
      requireFact(digest(bytes) === known.get(path), 'NATIVE_PROJECT_INPUT_CHANGED');
      await writeFile(project + '/' + destination, bytes, { flag: 'wx', mode: 0o600 });
    };
    await copy('schema.prisma', 'schema.prisma');
    await copy('migrations/migration_lock.toml', 'migrations/migration_lock.toml');
    for (const migration of selected) {
      const file = 'migrations/' + migration.name;
      await mkdir(project + '/' + file, { mode: 0o700 });
      await copy(file + '/migration.sql', file + '/migration.sql');
    }
  }
}

function requireLedger(rows, expected) {
  assertLedger(rows, expected, false);
  requireFact(rows.length === expected.length && rows.every(row => row.finished && row.steps === 1 && row.logs === null),
    'NATIVE_POSTGRES_LEDGER_INCOMPLETE');
}

async function verifyGeneratedTransaction(binding, approval, secret, tag, signal, continuation, recordDispatch) {
  const original = await readFile(schemaSource, 'utf8');
  requireFact(original === await readFile(work + '/upgrade/schema.prisma', 'utf8'), 'NATIVE_GENERATOR_SOURCE_CHANGED');
  const generatedSchema = original.replace('provider = "prisma-client-js"',
    'provider = "prisma-client-js"\n  output = "/work/zentric-native-track-b/generated"');
  requireFact(generatedSchema !== original, 'NATIVE_GENERATOR_SCHEMA_REJECTED');
  const schema = work + '/client.prisma';
  await writeFile(schema, generatedSchema, { flag: 'wx', mode: 0o600 });
  const url = connectionUrl(binding, secret, tag);
  const env = { ...childEnvironment, DATABASE_URL: url.href };
  await runChild(node, [prisma, 'generate', '--schema', schema], '', env, { signal, timeoutMs: 45_000 });
  if (continuation) {
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = queryEngine;
    const { Prisma, PrismaClient } = (await import(work + '/generated/index.js')).default;
    requireFact(Prisma.prismaVersion.client === profile.prisma
      && Prisma.prismaVersion.engine === '9b628578b3b7cae625e8c927178f15a170e74a9c', 'NATIVE_PRISMA_VERSION_REJECTED');
    const { verifyPrismaSession, verifyPrismaTransaction } = await import('./track-b-native-prisma-check.mjs');
    const client = new PrismaClient({ datasourceUrl: url.href, log: [] });
    try {
      const input = { url: url.href, database: profile.target, role: binding.targetRole, marker: binding.serverMarker, tag };
      if (recordDispatch) {
        const { verifyDispatchContracts } = await import('./track-b-prisma-dispatch-check.mjs');
        const { createQueueDispatcher } = await import('/resume/dispatch-engine.mjs');
        await verifyDispatchContracts(client, createQueueDispatcher, tx => verifyPrismaSession(tx, input), recordDispatch);
      } else {
        await verifyPrismaTransaction(client, input);
      }
    } finally { await client.$disconnect(); }
    return;
  }
  await runChild(node, [fileURLToPath(new URL('./track-b-native-prisma-check.mjs', import.meta.url))],
    JSON.stringify({ url: url.href, database: profile.target, role: binding.targetRole, marker: binding.serverMarker, tag, binding, approval }),
    childEnvironment, { signal, timeoutMs: 25_000 });
}

function connectionUrl(binding, secret, tag) {
  const url = new URL('postgresql://localhost:5432/' + profile.target);
  url.username = binding.targetRole;
  url.password = secret;
  url.searchParams.set('host', '/socket');
  url.searchParams.set('application_name', tag);
  url.searchParams.set('connect_timeout', '5');
  url.searchParams.set('connection_limit', '1');
  url.searchParams.set('options', '-c statement_timeout=120000 -c lock_timeout=10000 -c idle_in_transaction_session_timeout=15000');
  return url;
}

/**
 * Entry is intentionally disabled. Future activation requires a reviewed host
 * supervisor with independently verified Docker and private authority bindings.
 */
export async function runNativePostgresTrackB(options) {
  const { binding, approval, secrets, evidenceDirectory, signal } = options;
  verifyBinding(binding);
  await verifyNativeRuntimeApproval(approval, binding, 'runner');
  requireFact(typeof secrets?.target === 'string' && /^[a-f0-9]{64}$/.test(secrets.target)
    && Object.keys(secrets).length === 1,
  'NATIVE_SYNTHETIC_CREDENTIALS_REJECTED');
  requireFact(binding.sourceFingerprint === await fingerprintNativeBoundarySource(), 'NATIVE_SOURCE_CHANGED');
  const migrations = await verifyNativeInputs();
  await verifyArtifactIntegrity(binding);
  const evidence = await realpath(evidenceDirectory);
  requireFact(evidence === '/evidence' || evidence.startsWith('/evidence' + sep), 'NATIVE_EVIDENCE_PATH_REJECTED');
  const marker = await open(resolve(evidence, profile.target + '.jsonl'), 'wx', 0o600);
  const tag = 'q03b_' + binding.runId.slice(0, 24);
  let stage = 'reserved';
  const record = async (event, proof) => {
    await marker.writeFile(JSON.stringify({ stage, event, proof }) + '\n');
    await marker.sync();
  };
  const preserveSnapshot = async (phase, snapshot) => {
    verifySyntheticSnapshot(snapshot);
    const handle = await open(resolve(evidence, profile.target + '-legacy-' + phase + '.json'), 'wx', 0o600);
    try {
      await handle.writeFile(JSON.stringify(snapshot) + '\n');
      await handle.sync();
    } finally {
      await handle.close();
    }
    const directory = await open(evidence, 'r');
    try { await directory.sync(); } finally { await directory.close(); }
  };
  const stopCheck = async () => {
    signal?.throwIfAborted();
    await verifyNativeRuntimeApproval(approval, binding, 'runner');
  };
  const sql = async body => {
    await stopCheck();
    return runChild(psql, ['-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'],
      buildNativeSessionGuard(binding, 'target') + body + '\n', {
        ...childEnvironment, PGHOST: '/socket', PGPORT: '5432',
        PGDATABASE: profile.target, PGUSER: binding.targetRole,
        PGPASSWORD: secrets.target, PGCONNECT_TIMEOUT: '5', PGAPPNAME: tag,
        PGOPTIONS: '-c statement_timeout=20000 -c lock_timeout=12000 -c idle_in_transaction_session_timeout=15000',
      }, { signal, timeoutMs: 30_000, allowCancellation: true });
  };
  const target = Object.freeze({ sql });
  const execute = async (name, action, summarize) => {
    stage = name;
    await stopCheck();
    await record('begin');
    const result = await action();
    await stopCheck();
    await record('verified', summarize?.(result));
    return result;
  };
  const migrate = async (directory, expected) => {
    await target.sql('SELECT 1;');
    const url = connectionUrl(binding, secrets.target, tag);
    await runChild(node, [prisma, 'migrate', 'deploy', '--schema', work + '/' + directory + '/schema.prisma'],
      '', { ...childEnvironment, DATABASE_URL: url.href }, { signal, timeoutMs: 240_000 });
    requireLedger(JSON.parse(await target.sql(fixedSQL('ledger'))), expected);
  };
  const publicObjects = `((SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace)
    + (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace)
    + (SELECT count(*) FROM pg_type WHERE typnamespace='public'::regnamespace))`;
  try {
    await record('reserved');
    const root = await open(evidence, 'r');
    try { await root.sync(); } finally { await root.close(); }
    await mkdir(work, { mode: 0o700 });
    await symlink(modules, work + '/node_modules', 'dir');
    await execute('preflight', async () => {
      requireFact(await target.sql(`SELECT ${publicObjects}=0;`) === 't', 'NATIVE_EMPTY_TARGET_NOT_VERIFIED');
      await prepareProject(migrations);
    });
    await execute('apply-historical', () => migrate('historical', migrations.slice(0, 66)), () => ({ migrations: 66 }));
    const before = await execute('seed-and-capture-legacy', async () => {
      const fixtureBody = source => {
        requireFact(source.startsWith('BEGIN;\n') && source.endsWith('\nCOMMIT;'), 'NATIVE_FIXTURE_SHAPE_REJECTED');
        return source.slice('BEGIN;\n'.length, -'\nCOMMIT;'.length);
      };
      await target.sql('BEGIN;\n' + fixtureBody(baseFixturesSQL()) + '\n' + fixtureBody(legacyFixturesSQL()) + '\nCOMMIT;');
      const snapshot = JSON.parse(await target.sql(LEGACY_SNAPSHOT_SQL));
      await preserveSnapshot('before', snapshot);
      return snapshot;
    }, snapshot => ({
      snapshotDigest: digest(JSON.stringify(snapshot)),
      outbox: snapshot.outbox.length, attempts: snapshot.attempts.length, audit: snapshot.audit.length,
    }));
    await execute('apply-upgrade', () => migrate('upgrade', migrations), () => ({ migrations: 68 }));
    await execute('verify-upgrade', async () => {
      const after = JSON.parse(await target.sql(LEGACY_SNAPSHOT_SQL));
      await preserveSnapshot('after', after);
      assertHistoricalPreserved(before, after);
      const migration = migrations.at(-1);
      const bytes = await readFile(new URL('inputs/prisma/migrations/' + migration.name + '/migration.sql', import.meta.url));
      requireFact(digest(bytes) === migration.checksum, 'NATIVE_CATALOG_SOURCE_CHANGED');
      assertSafetyDefinitions(JSON.parse(await target.sql(CATALOG_SQL)), bytes.toString());
    }, () => ({ legacyPreserved: true, catalogVerified: true }));
    await execute('verify-behavior', async () => {
      await runDatabaseTests(target);
      const results = await runConcurrencyTests(target, { tag, role: binding.targetRole, database: profile.target });
      requireFact(results.length === 7, 'NATIVE_RACE_SET_INCOMPLETE');
      await verifyGeneratedTransaction(binding, approval, secrets.target, tag, signal);
      const remaining = await target.sql(`SELECT count(*) FROM pg_stat_activity WHERE pid<>pg_backend_pid()
        AND left(application_name,${tag.length})='${tag}' AND datname='${profile.target}' AND usename=current_user;`);
      requireFact(remaining === '0', 'NATIVE_SESSION_CLOSURE_UNVERIFIED');
    }, () => ({ concurrencyCases: 7, generatedClientVerified: true, sessionsClosed: true }));
    await record('pass');
  } catch {
    await record('stop-preserve');
    throw Error('NATIVE_POSTGRES_STOPPED_PRESERVE');
  } finally {
    await marker.close();
  }
}

// Fixed continuation for the confirmed Mission 17 target and its exact stop.
// This path cannot create, migrate, reseed, or consume a creation reservation.
async function continueRetainedTrackB({ binding, approval, secrets, signal }, dispatchOnly) {
  verifyBinding(binding);
  requireFact(binding.authorizationMode === 'local-synthetic-operator'
    && /^[a-f0-9]{64}$/.test(secrets?.target ?? ''), 'NATIVE_CONTINUATION_BINDING_REJECTED');
  const oldEvidence = '/evidence/' + profile.target;
  const receipt = JSON.parse(await readFile('/resume/approval.json', 'utf8'));
  const journal = (await readFile('/resume/creation.jsonl', 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  requireFact(digest(JSON.stringify(binding)) === approval.bindingDigest
    && JSON.stringify(receipt.approval) === JSON.stringify(approval) && receipt.runId === binding.runId
    && journal.length === 3 && journal.every((entry, index) => entry.runId === binding.runId
      && entry.target === binding.target && entry.state === ['RESERVED','STARTED','CONFIRMED'][index])
    && journal[0].detail.bindingDigest === approval.bindingDigest
    && journal[0].detail.approvalDigest === digest(JSON.stringify(approval)), 'NATIVE_CONTINUATION_RECEIPT_REJECTED');
  const previous = (await readFile(oldEvidence + '.jsonl', 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  requireFact(previous.at(-1)?.stage === 'verify-behavior' && previous.at(-1)?.event === 'stop-preserve'
    && previous.some(entry => entry.stage === 'verify-upgrade' && entry.event === 'verified'
      && entry.proof?.legacyPreserved === true && entry.proof?.catalogVerified === true),
  'NATIVE_CONTINUATION_STAGE_REJECTED');
  await verifyArtifactIntegrity(binding);
  const migrations = await verifyNativeInputs();
  await mkdir(work, { mode: 0o700 });
  await symlink(modules, work + '/node_modules', 'dir');
  await mkdir(work + '/upgrade', { mode: 0o700 });
  await writeFile(work + '/upgrade/schema.prisma', await readFile(schemaSource), { flag: 'wx', mode: 0o600 });
  const tag = 'q03b_' + binding.runId.slice(0, 24);
  const sql = body => runChild(psql, ['-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'],
    buildNativeSessionGuard(binding, 'target') + body + '\n', {
      ...childEnvironment, PGHOST: '/socket', PGPORT: '5432', PGDATABASE: profile.target, PGUSER: binding.targetRole,
      PGPASSWORD: secrets.target, PGCONNECT_TIMEOUT: '5', PGAPPNAME: tag,
      PGOPTIONS: '-c statement_timeout=20000 -c lock_timeout=12000 -c idle_in_transaction_session_timeout=15000',
    }, { signal, timeoutMs: 30_000, allowCancellation: true });
  const preserved = async () => {
    requireLedger(JSON.parse(await sql(fixedSQL('ledger'))), migrations);
    const snapshot = JSON.parse(await sql(LEGACY_SNAPSHOT_SQL));
    verifySyntheticSnapshot(snapshot);
    const before = await readFile(oldEvidence + '-legacy-before.json');
    const after = await readFile(oldEvidence + '-legacy-after.json');
    requireFact(before.equals(after), 'NATIVE_CONTINUATION_SNAPSHOT_MISMATCH');
    assertHistoricalPreserved(JSON.parse(before), snapshot);
    return digest(before);
  };
  const snapshotDigest = await preserved();
  let evidencePath = oldEvidence + '.mission18.jsonl';
  let prismaOnly = false;
  for (let retry = 1; ; retry++) {
    let prior;
    try { prior = await readFile(evidencePath, 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') break; throw error; }
    const rows = prior.trim().split('\n').map(line => JSON.parse(line));
    const stopped = rows.at(-1);
    if (dispatchOnly && prismaOnly && stopped?.stage === 'final' && stopped.event === 'pass'
      && stopped.proof?.snapshotDigest === snapshotDigest
      && rows.some(entry => entry.stage === 'prisma' && entry.event === 'verified' && entry.proof?.generatedClient)) {
      evidencePath = oldEvidence + '.mission19.jsonl';
      for (let attempt = 1; attempt <= 3; attempt++) try {
        const priorDispatch = (await readFile(evidencePath, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
        requireFact(priorDispatch.at(-1)?.stage === 'prisma' && priorDispatch.at(-1)?.event === 'stop-preserve',
          'NATIVE_M19_REPLAY_REJECTED');
        evidencePath = oldEvidence + '.mission19-retry-' + attempt + '.jsonl';
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        break;
      }
      break;
    }
    if (stopped?.stage === 'prisma' && stopped.event === 'stop-preserve'
      && rows.some(entry => entry.stage === 'concurrency' && entry.event === 'verified' && entry.proof?.cases === 7)) {
      prismaOnly = true;
    } else {
      requireFact(stopped?.event === 'stop-preserve' && (!prismaOnly
        ? stopped.stage === 'sql' && !rows.some(entry => entry.stage === 'concurrency')
        : stopped.stage === 'prisma'), 'NATIVE_CONTINUATION_REPLAY_REJECTED');
    }
    evidencePath = oldEvidence + '.mission18-retry-' + retry + '.jsonl';
  }
  requireFact(!dispatchOnly || /\.mission19(?:-retry-[1-3])?\.jsonl$/.test(evidencePath), 'NATIVE_M19_CHECKPOINT_REJECTED');
  const counts = await sql(`SELECT (SELECT count(*) FROM "HrEmailOutbox")=${prismaOnly ? 12 : 5}
    AND (SELECT count(*) FROM "HrEmailDeliveryAttempt")=10
    AND (SELECT count(*) FROM "HrAuditEvent")=2
    AND (SELECT count(*) FROM "HrEmailDispatchEvent")=${prismaOnly ? 7 : 0}
    AND NOT EXISTS (SELECT 1 FROM "HrEmailOutbox" WHERE id LIKE '%native_prisma_transaction')
    AND NOT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid());`);
  requireFact(counts === 't', 'NATIVE_CONTINUATION_UNEXPECTED_DATABASE_STATE');
  const marker = await open(evidencePath, 'wx', 0o600);
  let stage = 'preflight';
  const record = async (event, proof) => {
    await marker.writeFile(JSON.stringify({ stage, event, proof }) + '\n');
    await marker.sync();
  };
  try {
    await record('verified', { migrations: 68, snapshotDigest, scope: prismaOnly ? 'prisma-only' : 'behavior' });
    const directory = await open('/evidence', 'r');
    try { await directory.sync(); } finally { await directory.close(); }
    if (!prismaOnly) {
      stage = 'sql';
      await record('begin');
      const results = await runDatabaseTests({ sql }, { onPass: item => record('case-pass', item) });
      await record('verified', { cases: results.length });
      stage = 'concurrency';
      await record('begin');
      await runConcurrencyTests({ sql }, { tag, role: binding.targetRole, database: profile.target },
        { onPass: item => record('case-pass', item) });
      await record('verified', { cases: 7 });
    }
    stage = 'prisma';
    await record('begin');
    await verifyGeneratedTransaction(binding, approval, secrets.target, tag, signal, true, dispatchOnly ? proof => record('dispatch-contracts', proof) : undefined);
    await record('verified', { generatedClient: true, rollback: true, staleFence: true, tenantScope: true });
    stage = 'final';
    await record(dispatchOnly ? 'verified-with-blocker' : 'pass', { snapshotDigest: await preserved() });
  } catch (error) {
    const reason = /^NATIVE_[A-Z0-9_]+$/.test(error.message) ? error.message
      : /^(?:ERR_[A-Z0-9_]+|P[0-9]{4})$/.test(error.code ?? '') ? error.code
      : /^(?:PrismaClientInitializationError|PrismaClientValidationError|TypeError)$/.test(error.name) ? error.name : 'UNCLASSIFIED';
    const checkLine = /track-b-prisma-dispatch-check\.mjs:(\d+):\d+/.exec(error.stack ?? '')?.[1];
    await record('stop-preserve', { reason, checkLine });
    throw Error('NATIVE_MISSION18_STOPPED_PRESERVE');
  } finally { await marker.close(); }
}

async function main() {
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  let input = '';
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    for await (const chunk of process.stdin) {
      controller.signal.throwIfAborted();
      input += chunk;
      requireFact(input.length <= 16_384, 'NATIVE_WORKER_INPUT_REJECTED');
    }
    const { binding, approval, secrets } = JSON.parse(input);
    input = '';
    const options = { binding, approval, secrets, evidenceDirectory: '/evidence', signal: controller.signal };
    if (process.argv[2] === 'mission18-behavior' && process.argv.length === 3) await continueRetainedTrackB(options, false);
    else if (process.argv[2] === 'mission19-prisma' && process.argv.length === 3) await continueRetainedTrackB(options, true);
    else {
      requireFact(process.argv.length === 2, 'NATIVE_OPERATION_REJECTED');
      await runNativePostgresTrackB(options);
    }
  } finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(error => {
    console.error(error.message === 'NATIVE_LIVE_ENTRY_DISABLED'
      ? 'NATIVE_LIVE_ENTRY_DISABLED' : 'NATIVE_POSTGRES_STOPPED_PRESERVE');
    process.exitCode = 1;
  });
}
