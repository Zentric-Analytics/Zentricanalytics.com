import { spawn } from 'node:child_process';
import { mkdir, open, readFile, realpath, symlink, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { B1, assertLedger, digest, fixedSQL, inputPath } from './b1-contract.mjs';
import { runConcurrencyTests, runDatabaseTests } from './db-tests.mjs';
import { CATALOG_SQL, assertHistoricalPreserved, assertSafetyDefinitions } from './evidence-rules.mjs';
import { baseFixturesSQL, legacyFixturesSQL, LEGACY_SNAPSHOT_SQL } from './fixtures.mjs';
import { fingerprintNativeBoundarySource, verifyNativeInputs } from './track-b-native-boundary.mjs';
import { dockerTrackBProfile as profile } from './track-b-docker-gate.mjs';
import { verifySyntheticSnapshot } from './track-b-offline-runner.mjs';

// Deliberate source-level interlock. No flag, environment variable, fixture
// receipt or private manifest can enable database operations in this revision.
const liveEntryEnabled = false;
export function requireNativeLiveEntry() {
  requireFact(liveEntryEnabled, 'NATIVE_LIVE_ENTRY_DISABLED');
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
const role = value => typeof value === 'string' && /^q03_replacement_[a-z0-9_]{1,36}$/.test(value);
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

function verifyBinding(binding) {
  requireFact(binding?.target === profile.target && binding.baseline === profile.baseline
    && sha(binding.runId) && sha(binding.serverMarker) && sha(binding.sourceFingerprint)
    && sha(binding.provisioningReceipt) && role(binding.baselineRole) && role(binding.targetRole)
    && role(binding.controlRole) && new Set([binding.baselineRole, binding.targetRole, binding.controlRole]).size === 3,
  'NATIVE_POSTGRES_BINDING_REJECTED');
}

// Every psql operation checks identity on the same connection that will run it.
// Credentials are never SQL interpolation, process arguments, or evidence.
export function buildNativeSessionGuard(binding, purpose) {
  verifyBinding(binding);
  requireFact(['baseline', 'control', 'target'].includes(purpose), 'NATIVE_OPERATION_REJECTED');
  const isTarget = purpose === 'target';
  const database = isTarget ? profile.target : profile.baseline;
  const username = binding[purpose + 'Role'];
  const rolePrivilege = purpose === 'control' ? 'rolcreatedb' : 'NOT rolcreatedb';
  return `SELECT (current_database() = '${database}' AND session_user = '${username}' AND current_user = session_user
  AND current_setting('server_version_num')::int = ${profile.serverVersion}
  AND current_setting('zentric.q03_replacement_marker',true) = '${binding.serverMarker}'
  AND inet_server_addr() = '127.0.0.1'::inet
  AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolcanlogin AND NOT rolsuper AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls AND ${rolePrivilege})
  ${isTarget ? "AND EXISTS (SELECT 1 FROM pg_database WHERE datname=current_database() AND datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user))" : ''}
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

async function verifyGeneratedTransaction(binding, secret, tag, signal) {
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
  await runChild(node, [fileURLToPath(new URL('./track-b-native-prisma-check.mjs', import.meta.url))],
    JSON.stringify({ url: url.href, database: profile.target, role: binding.targetRole, marker: binding.serverMarker, tag }),
    childEnvironment, { signal, timeoutMs: 25_000 });
}

function connectionUrl(binding, secret, tag) {
  const url = new URL('postgresql://127.0.0.1:5432/' + profile.target);
  url.username = binding.targetRole;
  url.password = secret;
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
  requireNativeLiveEntry();
  const { binding, approval, secrets, evidenceDirectory, signal } = options;
  verifyBinding(binding);
  verifyNativeWriteAuthority(approval, binding);
  requireFact(['baseline', 'control', 'target'].every(key => typeof secrets?.[key] === 'string'
    && /^[a-f0-9]{64}$/.test(secrets[key])) && new Set(Object.values(secrets)).size === 3,
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
  const stopCheck = () => {
    signal?.throwIfAborted();
    verifyNativeWriteAuthority(approval, binding);
  };
  const sql = async (purpose, body, { allowCancellation = false } = {}) => {
    stopCheck();
    const isTarget = purpose === 'target';
    return runChild(psql, ['-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'],
      buildNativeSessionGuard(binding, purpose) + body + '\n', {
        ...childEnvironment, PGHOSTADDR: '127.0.0.1', PGPORT: '5432',
        PGDATABASE: isTarget ? profile.target : profile.baseline, PGUSER: binding[purpose + 'Role'],
        PGPASSWORD: secrets[purpose], PGCONNECT_TIMEOUT: '5', PGAPPNAME: tag,
        PGOPTIONS: '-c statement_timeout=20000 -c lock_timeout=12000 -c idle_in_transaction_session_timeout=15000'
          + (purpose === 'baseline' ? ' -c default_transaction_read_only=on' : ''),
      }, { signal, timeoutMs: 30_000, allowCancellation });
  };
  const target = Object.freeze({ sql: body => sql('target', body, { allowCancellation: true }) });
  const execute = async (name, action, summarize) => {
    stage = name;
    stopCheck();
    await record('begin');
    const result = await action();
    stopCheck();
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
  const targetAbsent = `NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='${profile.target}')`;
  try {
    await record('reserved');
    const root = await open(evidence, 'r');
    try { await root.sync(); } finally { await root.close(); }
    await mkdir(work, { mode: 0o700 });
    await symlink(modules, work + '/node_modules', 'dir');
    await execute('preflight', async () => {
      const value = await sql('baseline', `SELECT ${targetAbsent} AND ${publicObjects}=0 AND current_setting('transaction_read_only')='on';`);
      requireFact(value === 't', 'NATIVE_BASELINE_OR_COLLISION_REJECTED');
      await prepareProject(migrations);
    });
    await execute('create-target', async () => {
      // No retry. CREATE DATABASE itself refuses a concurrent same-name create.
      await sql('control', `SELECT ${targetAbsent} AS target_absent \\gset
\\if :target_absent
CREATE DATABASE "${profile.target}" OWNER "${binding.targetRole}" TEMPLATE template0;
\\else
SELECT 1/0;
\\endif`);
      requireFact(await target.sql(`SELECT ${publicObjects}=0;`) === 't', 'NATIVE_TARGET_CREATION_UNKNOWN');
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
      await verifyGeneratedTransaction(binding, secrets.target, tag, signal);
      const remaining = await sql('baseline', `SELECT count(*) FROM pg_stat_activity WHERE pid<>pg_backend_pid()
        AND left(application_name,${tag.length})='${tag}' AND datname IN ('${profile.target}','${profile.baseline}');`);
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

async function main() {
  requireNativeLiveEntry();
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
    await runNativePostgresTrackB({ binding, approval, secrets, evidenceDirectory: '/evidence', signal: controller.signal });
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
