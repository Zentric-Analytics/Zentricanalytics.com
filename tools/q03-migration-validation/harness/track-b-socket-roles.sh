#!/bin/bash
set -euo pipefail
umask 077
export LC_ALL=C
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
[[ $(id -u) = 0 && "$#" = 0 ]]
here=$(dirname "$(realpath "$0")")
state=/root/.local/state/zentric-q03-synthetic
d=(/usr/bin/docker --host unix:///run/docker.sock)
data=/var/lib/postgresql/18/docker
bash "$here/native-baseline.sh" verify
passed=
for receipt in "$state"/runner-transport.*; do
  if [[ -f "$receipt/result" ]] && grep -qx stage=complete "$receipt/result" &&
    grep -qx status=0 "$receipt/result" && (cd "$receipt" && sha256sum -c --status result.sha256); then
    passed=yes
  fi
done
[[ "$passed" = yes ]]
mapfile -t identity <"$state/identities"
container=${identity[3]}
[[ "$container" =~ ^[a-f0-9]{64}$ ]]
cluster=$(cat "$state/cluster-identity")
[[ "$cluster" =~ ^[0-9]{16,24}$ ]]
record="$state/m14-track-b-roles"
mkdir -m 0700 "$record"
"${d[@]}" exec "$container" cat "$data/pg_hba.conf" >"$record/pg_hba.original"
cat >"$record/pg_hba.expected" <<'HBA'
local q03_replacement_baseline q03_replacement_reader peer map=zentric_reader
local all all reject
host all all 0.0.0.0/0 reject
host all all ::/0 reject
HBA
cmp -s "$record/pg_hba.original" "$record/pg_hba.expected"
{
  head -n 1 "$record/pg_hba.original"
  printf '%s\n' 'local q03_replacement_track_b q03_replacement_runner scram-sha-256' \
    'local q03_replacement_track_b q03_replacement_verifier scram-sha-256'
  tail -n +2 "$record/pg_hba.original"
} >"$record/pg_hba.track-b"
{
  printf '%s\n' 'local postgres postgres peer'
  cat "$record/pg_hba.track-b"
} >"$record/pg_hba.maintenance"
openssl rand -hex 32 >"$record/runner.secret"
openssl rand -hex 32 >"$record/verifier.secret"
runner=$(cat "$record/runner.secret")
verifier=$(cat "$record/verifier.secret")
[[ "$runner" =~ ^[0-9a-f]{64}$ && "$verifier" =~ ^[0-9a-f]{64}$ && "$runner" != "$verifier" ]]
sync -f "$record"

set_hba() {
  "${d[@]}" exec -i --user postgres "$container" /bin/bash -euc '
    umask 077
    root=/var/lib/postgresql/18/docker
    temp=$(mktemp "$root/.hba.m14.XXXXXXXX")
    cat >"$temp"
    sync -f "$temp"
    mv -T "$temp" "$root/pg_hba.conf"
    sync -f "$root"
    /usr/lib/postgresql/18/bin/pg_ctl -D "$root" reload >/dev/null
  ' <"$1"
}
maint=("${d[@]}" exec -i --user postgres "$container" /usr/bin/psql -X -w -qAt -v ON_ERROR_STOP=1 -h /var/run/postgresql -U postgres -d postgres)
restore_hba() { set_hba "$record/pg_hba.original"; }
trap restore_hba EXIT
set_hba "$record/pg_hba.maintenance"
for i in {1..15}; do
  if [[ "$("${maint[@]}" -c 'SELECT current_user' </dev/null 2>/dev/null)" = postgres ]]; then break; fi
  sleep 0.2
done
printf '%s\n' begun >"$record/catalog-stage"
sync -f "$record"
{
  cat <<SQL
BEGIN;
SET LOCAL log_statement=none;
SET LOCAL log_min_error_statement=panic;
SET LOCAL password_encryption='scram-sha-256';
SELECT (current_database()='postgres' AND current_user='postgres' AND inet_server_addr() IS NULL
 AND (SELECT system_identifier::text FROM pg_control_system())='$cluster'
 AND NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='q03_replacement_track_b')
 AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('q03_replacement_owner','q03_replacement_runner','q03_replacement_verifier'))) AS safe \gset
\if :safe
CREATE ROLE q03_replacement_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE q03_replacement_runner LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '$runner';
CREATE ROLE q03_replacement_verifier LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '$verifier';
GRANT q03_replacement_owner TO q03_replacement_runner WITH ADMIN FALSE, INHERIT TRUE, SET FALSE;
ALTER ROLE q03_replacement_verifier SET default_transaction_read_only=on;
\else
SELECT 1/0;
\endif
COMMIT;
SQL
} | "${maint[@]}" >/dev/null 2>&1
proof=$("${maint[@]}" -c "
SELECT count(*)=3 AND count(*) FILTER (WHERE rolcanlogin)=2
 AND bool_and(NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls)
 AND pg_has_role('q03_replacement_runner','q03_replacement_owner','USAGE')
 AND NOT pg_has_role('q03_replacement_runner','q03_replacement_owner','SET')
 AND NOT has_database_privilege('q03_replacement_runner','q03_replacement_baseline','CONNECT')
 AND NOT has_database_privilege('q03_replacement_verifier','q03_replacement_baseline','CONNECT')
 FROM pg_roles WHERE rolname IN ('q03_replacement_owner','q03_replacement_runner','q03_replacement_verifier');" </dev/null)
[[ "$proof" = t ]]
set_hba "$record/pg_hba.track-b"
for i in {1..15}; do
  if ! "${maint[@]}" -c 'SELECT 1' </dev/null >/dev/null 2>&1; then break; fi
  sleep 0.2
done
if "${maint[@]}" -c 'SELECT 1' </dev/null >/dev/null 2>&1; then exit 1; fi
bash "$here/native-baseline.sh" verify
printf '%s\n' verified >"$record/catalog-stage"
sync -f "$record"
trap - EXIT
printf '%s\n' 'Restricted owner, runner and verifier roles verified. Temporary maintenance access removed.'
