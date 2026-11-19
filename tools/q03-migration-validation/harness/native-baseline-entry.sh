#!/bin/bash
set -euo pipefail
umask 077
export LC_ALL=C

data=/var/lib/postgresql/18/docker
socket=/var/run/postgresql
baseline=q03_replacement_baseline
marker=$data/.zentric-baseline-initialized

# No address outside the directly connected isolated bridge is routable.
awk 'NR>1 { if ($2=="00000000" || $3!="00000000") exit 1; routes++ }
     END { if (!routes) exit 1 }' /proc/net/route
if grep -Eq '^00000000000000000000000000000000 00 .* (eth|en)' /proc/net/ipv6_route; then exit 1; fi
test "$(cat /proc/sys/net/ipv6/conf/all/disable_ipv6)" = 1
if timeout 2 getent ahostsv4 example.com >/dev/null; then exit 1; fi
if timeout 2 bash -c 'exec 3<>/dev/tcp/192.0.2.1/5432' 2>/dev/null; then exit 1; fi

install -d -m 0700 -o postgres -g postgres "$data"
install -d -m 0755 -o postgres -g postgres "$socket"
if [[ ! -f "$marker" ]]; then
  [[ -z "$(find "$data" -mindepth 1 -maxdepth 1 -print -quit)" ]]
  gosu postgres initdb -D "$data" --username=postgres --auth-local=peer --auth-host=scram-sha-256 --locale=C --encoding=UTF8
  gosu postgres pg_ctl -D "$data" -w -t 30 -o "-c listen_addresses='' -k $socket" start
  gosu postgres psql -X -w -v ON_ERROR_STOP=1 -h "$socket" -U postgres -d postgres <<'SQL'
CREATE ROLE q03_replacement_reader LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE DATABASE q03_replacement_baseline OWNER postgres TEMPLATE template0;
REVOKE ALL ON DATABASE q03_replacement_baseline FROM PUBLIC;
GRANT CONNECT ON DATABASE q03_replacement_baseline TO q03_replacement_reader;
ALTER ROLE q03_replacement_reader IN DATABASE q03_replacement_baseline SET default_transaction_read_only=on;
\connect q03_replacement_baseline
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO q03_replacement_reader;
SQL
  gosu postgres pg_ctl -D "$data" -m fast -w -t 30 stop
  cat >"$data/pg_hba.conf" <<'HBA'
local q03_replacement_baseline q03_replacement_reader peer map=zentric_reader
local all all reject
host all all 0.0.0.0/0 reject
host all all ::/0 reject
HBA
  printf 'zentric_reader postgres q03_replacement_reader\n' >"$data/pg_ident.conf"
  chown postgres:postgres "$data/pg_hba.conf" "$data/pg_ident.conf"
  sync -f "$data"
  printf '%s\n' 'synthetic-baseline-v1' >"$marker"
  sync -f "$data"
fi
[[ "$(cat "$marker")" = synthetic-baseline-v1 && "$(cat "$data/PG_VERSION")" = 18 ]]
exec gosu postgres postgres -D "$data" -c "listen_addresses=" -k "$socket" -c shared_buffers=64MB -c max_connections=12
