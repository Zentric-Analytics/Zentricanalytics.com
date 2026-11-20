import { spawn } from 'node:child_process';
import { lstat, readFile } from 'node:fs/promises';
import { nativeMaintenanceCreationProgram } from './track-b-native-maintenance.mjs';
import { reconcileNativeCreation, runNativeCreationReservation, validateNativeCreationBinding } from './track-b-native-reservation.mjs';
import { requireNativeLiveEntry, verifyNativeSignedAuthority } from './track-b-native-postgres.mjs';
import { verifyNativeTrackBHost } from './track-b-native-host.mjs';
import { fingerprintNativeBoundarySource, verifyNativeInputs } from './track-b-native-boundary.mjs';

const state = '/root/.local/state/zentric-q03-synthetic';
const roleRecord = state + '/m14-track-b-roles';
const target = 'q03_replacement_track_b';
const baseline = 'q03_replacement_baseline';
const socket = '/var/run/postgresql';
const psql = ['/usr/bin/psql', '-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', socket];
const targetHba = [
  'local q03_replacement_baseline q03_replacement_reader peer map=zentric_reader',
  'local q03_replacement_track_b q03_replacement_runner scram-sha-256',
  'local q03_replacement_track_b q03_replacement_verifier scram-sha-256',
  'local all all reject', 'host all all 0.0.0.0/0 reject', 'host all all ::/0 reject',
].join('\n');

function docker(args, input = '', timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/docker', ['--host', 'unix:///run/docker.sock', ...args], {
      env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent', DOCKER_CONFIG: '/nonexistent', LC_ALL: 'C' },
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    let output = '';
    let interrupted = false;
    const interrupt = () => { interrupted = true; child.kill('SIGKILL'); };
    const timer = setTimeout(interrupt, timeoutMs);
    child.stdout.on('data', chunk => {
      output += chunk.toString();
      if (output.length > 8192) interrupt();
    });
    child.stdin.on('error', interrupt);
    child.once('error', interrupt);
    child.once('close', code => {
      clearTimeout(timer);
      if (code === 0 && !interrupted) resolve(output.trim());
      else reject(Error('NATIVE_CREATION_TRANSPORT_UNVERIFIED'));
    });
    child.stdin.end(input);
  });
}

function execPg(binding, args, input, timeout) {
  return docker(['exec', '-i', '--user', 'postgres', binding.containerId, ...args], input, timeout);
}

async function observeBaseline(binding) {
  const control = await execPg(binding, ['/usr/lib/postgresql/18/bin/pg_controldata', '/var/lib/postgresql/18/docker']);
  const clusterId = /^Database system identifier:\s+([0-9]{16,24})\s*$/m.exec(control)?.[1];
  if (clusterId !== binding.clusterId) throw Error('NATIVE_CREATION_CLUSTER_DRIFT');
  const row = await execPg(binding, [...psql, '-U', 'q03_replacement_reader', '-d', baseline, '-c',
    "SELECT json_build_object('baselineUnchanged',current_database()='q03_replacement_baseline' "
    + "AND current_user='q03_replacement_reader' AND inet_server_addr() IS NULL "
    + "AND current_setting('listen_addresses')='' AND current_setting('transaction_read_only')='on' "
    + "AND current_setting('server_version_num')='180006' "
    + "AND NOT has_schema_privilege(current_user,'public','CREATE') "
    + "AND NOT has_database_privilege(current_user,current_database(),'TEMP') "
    + "AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace) "
    + "AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace) "
    + "AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace='public'::regnamespace), "
    + "'roles', (SELECT count(*)=3 AND count(*) FILTER (WHERE rolcanlogin)=2 "
    + "AND bool_and(rolcanlogin=(rolname<>'q03_replacement_owner') "
    + "AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls) "
    + "FROM pg_roles WHERE rolname IN ('q03_replacement_owner','q03_replacement_runner','q03_replacement_verifier')) "
    + "AND pg_has_role('q03_replacement_runner','q03_replacement_owner','USAGE') "
    + "AND NOT pg_has_role('q03_replacement_runner','q03_replacement_owner','SET') "
    + "AND NOT pg_has_role('q03_replacement_verifier','q03_replacement_owner','MEMBER') "
    + "AND NOT has_database_privilege('q03_replacement_runner','q03_replacement_baseline','CONNECT') "
    + "AND NOT has_database_privilege('q03_replacement_verifier','q03_replacement_baseline','CONNECT'),"
    + "'targetAbsent',NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='q03_replacement_track_b'),"
    + "'owner',(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname='q03_replacement_track_b'));"]);
  const observed = JSON.parse(row);
  if (observed.baselineUnchanged !== true) throw Error('NATIVE_BASELINE_PROFILE_DRIFT');
  if (observed.roles !== true) throw Error('NATIVE_CREATION_ROLE_DRIFT');
  return { ...observed, clusterId };
}

export async function observeNativeCreationPreflight() {
  if (process.platform !== 'linux' || process.getuid?.() !== 0) throw Error('NATIVE_OPERATOR_SCOPE_REJECTED');
  const identities = (await readFile(state + '/identities', 'utf8')).trimEnd().split('\n');
  const clusterId = (await readFile(state + '/cluster-identity', 'utf8')).trim();
  if (identities.length !== 4 || !/^[a-f0-9]{64}$/.test(identities[3]) || !/^[0-9]{16,24}$/.test(clusterId)) {
    throw Error('NATIVE_CREATION_PRIVATE_BINDING_REJECTED');
  }
  const observed = await observeBaseline({ containerId: identities[3], clusterId });
  return { baselineUnchanged: observed.baselineUnchanged, targetAbsent: observed.targetAbsent, restrictedRoles: observed.roles };
}

export function buildNativeMaintenanceScript(binding) {
  if (!/^[a-f0-9]{64}$/.test(binding.serverMarker ?? '')) throw Error('NATIVE_SERVER_MARKER_REJECTED');
  return [
    'set -euo pipefail', 'umask 077', 'root=/var/lib/postgresql/18/docker',
    'original=$(cat "$root/pg_hba.conf")',
    "expected=$(cat <<'NATIVE_HBA'", targetHba, 'NATIVE_HBA', ')',
    'test "$original" = "$expected"',
    'reload() {',
    '  file=$(mktemp "$root/.q03-hba.XXXXXXXX")',
    '  cat >"$file"; sync -f "$file"; mv -T "$file" "$root/pg_hba.conf"; sync -f "$root"',
    '  /usr/lib/postgresql/18/bin/pg_ctl -D "$root" reload >/dev/null',
    '}',
    "restore_hba() { printf '%s\\n' \"$original\" | reload; }",
    'trap restore_hba EXIT', "trap 'exit 1' INT TERM",
    "printf '%s\\n' 'local postgres postgres peer' \"$expected\" | reload",
    'run_psql() { ' + psql.join(' ') + ' -U postgres -d postgres "$@"; }',
    'for attempt in {1..15}; do',
    "  if [[ \"$(run_psql -c 'SELECT current_user' </dev/null 2>/dev/null)\" = postgres ]]; then break; fi",
    '  sleep 0.2', 'done',
    "run_psql <<'NATIVE_SQL'",
    nativeMaintenanceCreationProgram(binding.clusterId).trimEnd(),
    'REVOKE ALL ON DATABASE "q03_replacement_track_b" FROM PUBLIC;',
    'GRANT CONNECT ON DATABASE "q03_replacement_track_b" TO q03_replacement_verifier;',
    "ALTER DATABASE q03_replacement_track_b SET zentric.q03_replacement_marker = '" + binding.serverMarker + "';",
    'NATIVE_SQL', 'restore_hba', 'trap - EXIT',
    'for attempt in {1..15}; do',
    "  if ! run_psql -c 'SELECT 1' </dev/null >/dev/null 2>&1; then exit 0; fi",
    '  sleep 0.2', 'done', 'exit 1', '',
  ].join('\n');
}

async function verifyRoleWitness() {
  const proof = (await readFile(roleRecord + '/catalog-stage', 'utf8')).trim();
  const hba = (await readFile(roleRecord + '/pg_hba.track-b', 'utf8')).trimEnd();
  if (proof !== 'verified' || hba !== targetHba) throw Error('NATIVE_ROLE_WITNESS_REJECTED');
}

async function observeCreated(binding) {
  const baselineState = await observeBaseline(binding);
  if (baselineState.targetAbsent !== false) return baselineState;
  if (!/^[a-f0-9]{64}$/.test(binding.serverMarker ?? '')) throw Error('NATIVE_SERVER_MARKER_REJECTED');
  const secretFile = roleRecord + '/verifier.secret';
  const info = await lstat(secretFile);
  if (!info.isFile() || info.uid !== 0 || (info.mode & 0o077) !== 0 || info.size > 80) {
    throw Error('NATIVE_VERIFIER_SECRET_UNTRUSTED');
  }
  const password = (await readFile(secretFile, 'utf8')).trim();
  if (!/^[a-f0-9]{64}$/.test(password)) throw Error('NATIVE_VERIFIER_SECRET_UNTRUSTED');
  const sql = "SELECT json_build_object('database',current_database(),'empty',"
    + "NOT EXISTS (SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace) "
    + "AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace) "
    + "AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace='public'::regnamespace),"
    + "'restricted',current_user='q03_replacement_verifier' AND inet_server_addr() IS NULL "
    + "AND current_setting('transaction_read_only')='on' "
    + "AND current_setting('zentric.q03_replacement_marker',true)='" + binding.serverMarker + "' "
    + "AND NOT has_schema_privilege(current_user,'public','CREATE') "
    + "AND NOT has_database_privilege(current_user,current_database(),'TEMP') "
    + "AND NOT has_database_privilege('q03_replacement_runner','q03_replacement_baseline','CONNECT') "
    + "AND NOT has_database_privilege(current_user,'q03_replacement_baseline','CONNECT') "
    + "AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT rolsuper AND NOT rolcreatedb "
    + "AND NOT rolcreaterole AND NOT rolreplication));";
  const result = await execPg(binding, ['/bin/bash', '-euc',
    'IFS= read -r PGPASSWORD; export PGPASSWORD PGCONNECT_TIMEOUT=5; exec "$@"', 'bash',
    ...psql, '-U', 'q03_replacement_verifier', '-d', target, '-c', sql], password + '\n');
  return { ...baselineState, ...JSON.parse(result) };
}

export async function createNativeTrackBOnce(options) {
  requireNativeLiveEntry('host');
  const { binding, approval } = options;
  validateNativeCreationBinding(binding);
  const authorityKey = await verifyNativeTrackBHost(options);
  if (binding.sourceFingerprint !== await fingerprintNativeBoundarySource()) throw Error('NATIVE_SOURCE_CHANGED');
  await verifyNativeInputs();
  await verifyRoleWitness();
  const script = buildNativeMaintenanceScript(binding);
  return runNativeCreationReservation({
    directory: state, binding, approval, authorityKey,
    preflight: () => observeBaseline(binding),
    create: () => {
      verifyNativeSignedAuthority(approval, binding, authorityKey);
      if (approval.expiresAt - Date.now() < 50_000) throw Error('NATIVE_CREATION_WINDOW_TOO_SHORT');
      return execPg(binding, ['/usr/bin/timeout', '--kill-after=5', '40', '/bin/bash', '-s'], script, 50_000);
    },
    reconcile: () => observeCreated(binding),
  });
}

export async function inspectNativeTrackBCreation(binding) {
  return reconcileNativeCreation({ directory: state, binding, observe: () => observeCreated(binding) });
}
