#!/bin/bash
set -euo pipefail
umask 077
export LC_ALL=C
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH

network=zentric-q03-replacement-net
volume=zentric-q03-replacement-data
container=zentric-q03-replacement-postgres
image=docker.io/library/postgres@sha256:e3d24f6906d0760bf4da0dae872415391ededefad23fd471c47dc53b0ddf3c42
image_id=sha256:e3d24f6906d0760bf4da0dae872415391ededefad23fd471c47dc53b0ddf3c42
baseline=q03_replacement_baseline
reader=q03_replacement_reader
state=/root/.local/state/zentric-q03-synthetic
here=$(dirname "$(realpath "$0")")
docker=(/usr/bin/docker --host unix:///run/docker.sock)

fail() { printf '%s\n' "$1" >&2; exit 1; }
[[ $(id -u) = 0 && $(realpath /var/run/docker.sock) = /run/docker.sock ]] || fail 'Local root and Docker socket required'
[[ "$#" = 1 ]] || fail 'Choose provision-synthetic, verify, start, stop, cycle, or preflight-track-b'
[[ "$("${docker[@]}" info --format '{{.OSType}}/{{.Architecture}}')" = linux/x86_64 ]] || fail 'Unexpected Docker backend'
engine=$("${docker[@]}" info --format '{{.ID}}')
[[ -n "$engine" ]] || fail 'Missing engine identity'

verify_network() {
  local id interface
  id=$("${docker[@]}" network inspect "$network" --format '{{.Id}}')
  [[ "$id" = "$network_id" ]]
  [[ "$("${docker[@]}" network inspect "$id" --format '{{.Driver}}/{{.Internal}}/{{.EnableIPv6}}/{{index .Options "com.docker.network.bridge.gateway_mode_ipv4"}}/{{index .Labels "zentric.q03.resource"}}')" = "bridge/true/false/isolated/$nonce" ]]
  interface=br-${id:0:12}
  ip link show dev "$interface" >/dev/null
  [[ -z "$(ip -o -4 addr show dev "$interface"; ip -o -6 addr show dev "$interface" scope global)" ]]
}

verify_bindings() {
  [[ -f "$state/identities" ]]
  mapfile -t binding <"$state/identities"
  [[ "${#binding[@]}" = 4 && "${binding[0]}" = "$engine" ]]
  nonce=${binding[1]}
  network_id=${binding[2]}
  container_id=${binding[3]}
  [[ "$nonce" =~ ^[a-f0-9]{64}$ && "$network_id" =~ ^[a-f0-9]{64}$ && "$container_id" =~ ^[a-f0-9]{64}$ ]]
  verify_network
  [[ "$("${docker[@]}" volume inspect "$volume" --format '{{.Driver}}/{{index .Labels "zentric.q03.resource"}}')" = "local/$nonce" ]]
  if [[ -f "$state/volume-created" ]]; then
    [[ "$("${docker[@]}" volume inspect "$volume" --format '{{.CreatedAt}}')" = "$(cat "$state/volume-created")" ]]
  fi
  [[ "$("${docker[@]}" container inspect "$container" --format '{{.Id}}/{{.Image}}/{{index .Config.Labels "zentric.q03.resource"}}/{{.HostConfig.RestartPolicy.Name}}/{{.HostConfig.Memory}}/{{.HostConfig.NanoCpus}}/{{.HostConfig.PidsLimit}}/{{len .HostConfig.PortBindings}}/{{.HostConfig.PublishAllPorts}}')" = "$container_id/$image_id/$nonce/no/536870912/1000000000/128/0/false" ]]
  [[ "$("${docker[@]}" container inspect "$container_id" --format '{{len .Mounts}}/{{range .Mounts}}{{.Type}}/{{.Name}}{{.Destination}}/{{.RW}}{{end}}')" = "1/volume/$volume/var/lib/postgresql/true" ]]
  [[ "$("${docker[@]}" container inspect "$container_id" --format '{{.HostConfig.NetworkMode}}')" = "$network" ]]
  [[ "$("${docker[@]}" image inspect "$image_id" --format '{{.Id}}/{{.Os}}/{{.Architecture}}')" = "$image_id/linux/amd64" ]]
}

verify_database() {
  local i value peers diagnostic
  for i in {1..25}; do
    if "${docker[@]}" exec --user postgres "$container_id" pg_isready -q -h /var/run/postgresql -U "$reader" -d "$baseline"; then break; fi
    sleep 1
  done
  peers=$("${docker[@]}" network inspect "$network_id" --format '{{range $id, $_ := .Containers}}{{println $id}}{{end}}')
  [[ "$peers" = "$container_id" ]] || fail 'Unexpected network peers'
  [[ "$("${docker[@]}" inspect "$container_id" --format '{{len .NetworkSettings.Networks}}/{{range .NetworkSettings.Networks}}{{.NetworkID}}{{end}}')" = "1/$network_id" ]]
  "${docker[@]}" exec "$container_id" cat /proc/net/route |
    awk 'NR>1 { if ($2=="00000000" || $3!="00000000") exit 1; routes++ }
         END { if (!routes) exit 1 }'
  [[ "$("${docker[@]}" exec "$container_id" cat /proc/sys/net/ipv6/conf/all/disable_ipv6)" = 1 ]]
  value=$(timeout 8 "${docker[@]}" exec --user postgres "$container_id" psql -X -w -qAt -v ON_ERROR_STOP=1 -h /var/run/postgresql -U "$reader" -d "$baseline" -c "
SELECT current_database()='q03_replacement_baseline'
 AND current_user='q03_replacement_reader' AND session_user=current_user
 AND current_setting('server_version_num')='180006'
 AND current_setting('transaction_read_only')='on' AND current_setting('listen_addresses')=''
 AND inet_server_addr() IS NULL AND NOT has_schema_privilege(current_user,'public','CREATE')
 AND NOT has_database_privilege(current_user,current_database(),'CREATE')
 AND NOT has_database_privilege(current_user,current_database(),'TEMP')
 AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls)
 AND NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='q03_replacement_track_b')
 AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace)
 AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace)
 AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace='public'::regnamespace);")
  [[ "$value" = t ]] || fail 'Baseline identity, privileges, or emptiness could not be verified'
  if diagnostic=$(timeout 5 "${docker[@]}" exec --user nobody "$container_id" psql -X -w -qAt -h /var/run/postgresql -U "$reader" -d "$baseline" -c 'SELECT 1' 2>&1); then
    fail 'Unapproved peer authenticated'
  else
    [[ "$?" = 2 && "$diagnostic" = *'Peer authentication failed'* ]] || fail 'Peer denial was not verified'
  fi
  if diagnostic=$(timeout 5 "${docker[@]}" exec --user postgres "$container_id" psql -X -w -qAt -h 127.0.0.1 -U "$reader" -d "$baseline" -c 'SELECT 1' 2>&1); then
    fail 'Unexpected TCP connection'
  else
    [[ "$?" = 2 && "$diagnostic" = *'Connection refused'* ]] || fail 'TCP refusal was not verified'
  fi
  [[ -z "$("${docker[@]}" port "$container_id")" ]] || fail 'Unexpected published port'
  if [[ -f "$state/cluster-identity" ]]; then
    [[ "$(cluster_identity)" = "$(cat "$state/cluster-identity")" ]] || fail 'Unexpected PostgreSQL cluster'
  fi
  printf '%s\n' 'PostgreSQL 18.6, peer-only reader, empty baseline and absent target verified.'
}

cluster_identity() {
  "${docker[@]}" exec --user postgres "$container_id" pg_controldata /var/lib/postgresql/18/docker |
    awk -F ': *' '$1=="Database system identifier" {print $2}'
}

stop_db() {
  "${docker[@]}" stop --time 30 "$container_id" >/dev/null
  [[ "$("${docker[@]}" inspect "$container_id" --format '{{.State.ExitCode}}/{{.State.OOMKilled}}')" = 0/false ]]
}

case "$1" in
  provision-synthetic)
    containers=$("${docker[@]}" ps -a --format '{{.Names}}')
    networks=$("${docker[@]}" network ls --format '{{.Name}}')
    volumes=$("${docker[@]}" volume ls --format '{{.Name}}')
    ! grep -Fxq "$container" <<<"$containers" && ! grep -Fxq "$network" <<<"$networks" &&
      ! grep -Fxq "$volume" <<<"$volumes" || fail 'Replacement resource name already exists'
    [[ "$("${docker[@]}" image inspect "$image" --format '{{.Id}}/{{.Os}}/{{.Architecture}}')" = "$image_id/linux/amd64" ]]
    install -d -m 0700 "$(dirname "$state")"
    mkdir -m 0700 "$state" || fail 'Existing ownership reservation requires manual review'
    nonce=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')
    printf '%s\n' "$engine" "$nonce" >"$state/reservation"
    sync -f "$state"
    network_id=$("${docker[@]}" network create --driver bridge --internal --ipv6=false \
      --opt com.docker.network.bridge.gateway_mode_ipv4=isolated \
      --label "zentric.q03.resource=$nonce" --label zentric.q03.replacement=true "$network")
    verify_network
    "${docker[@]}" volume create --label "zentric.q03.resource=$nonce" --label zentric.q03.replacement=true "$volume" >/dev/null
    [[ "$("${docker[@]}" volume inspect "$volume" --format '{{.Driver}}/{{index .Labels "zentric.q03.resource"}}')" = "local/$nonce" ]]
    entry=$(tr -d '\r' <"$here/native-baseline-entry.sh")
    container_id=$("${docker[@]}" create --name "$container" --pull never --platform linux/amd64 \
      --label "zentric.q03.resource=$nonce" --label zentric.q03.replacement=true \
      --network "$network" --dns 127.0.0.1 --sysctl net.ipv6.conf.all.disable_ipv6=1 \
      --restart no --memory 512m --memory-swap 512m --cpus 1 --pids-limit 128 --shm-size 64m \
      --stop-signal SIGINT --mount "type=volume,src=$volume,dst=/var/lib/postgresql" \
      --log-driver local --log-opt max-size=2m --log-opt max-file=2 \
      --entrypoint /bin/bash "$image" -c "$entry")
    printf '%s\n' "$engine" "$nonce" "$network_id" "$container_id" >"$state/identities"
    sync -f "$state"
    # The entrypoint checks actual sandbox routes and egress before initdb.
    verify_bindings
    [[ "$("${docker[@]}" network inspect "$network_id" --format '{{len .Containers}}')" = 0 ]]
    "${docker[@]}" start "$container_id" >/dev/null
    verify_bindings
    verify_database
    ;;
  verify) verify_bindings; verify_database ;;
  preflight-track-b)
    verify_bindings
    verify_database
    role_flags=$(timeout 8 "${docker[@]}" exec --user postgres "$container_id" psql -X -w -qAt -F / -v ON_ERROR_STOP=1 -h /var/run/postgresql -U "$reader" -d "$baseline" -c "
SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='q03_replacement_creator' AND rolcanlogin AND rolcreatedb AND NOT rolsuper),
       EXISTS (SELECT 1 FROM pg_roles WHERE rolname='q03_replacement_owner' AND rolcanlogin AND NOT rolcreatedb AND NOT rolsuper);")
    [[ "$role_flags" =~ ^[tf]/[tf]$ ]] || fail 'Track B role observation failed'
    preflight_dir=$(mktemp -d "$state/track-b-preflight.XXXXXXXX")
    {
      printf 'utc=%s\n' "$(date -u +%FT%TZ)"
      printf 'status=blocked-peer-only-profile\nroles_creator_owner=%s\n' "$role_flags"
      printf 'database=%s\nreader=%s\ntrack_b_target_absent=true\n' "$baseline" "$reader"
      printf 'image=%s\nnetwork=%s\nvolume=%s\n' "$image_id" "$network_id" "$volume"
      printf 'engine=%s\ncontainer=%s\ncluster=%s\n' "$engine" "$container_id" "$(cluster_identity)"
    } >"$preflight_dir/result"
    sha256sum "$preflight_dir/result" >"$preflight_dir/result.sha256"
    sync -f "$preflight_dir"
    printf 'Track B creator/owner roles present: %s\n' "$role_flags"
    printf '%s\n' 'Track B execution is blocked on this verified peer-only baseline profile.'
    exit 12
    ;;
  start) verify_bindings; "${docker[@]}" start "$container_id" >/dev/null; verify_bindings; verify_database ;;
  stop) verify_bindings; stop_db ;;
  cycle)
    verify_bindings
    "${docker[@]}" start "$container_id" >/dev/null
    verify_database
    before=$(cluster_identity)
    [[ "$before" =~ ^[0-9]{16,24}$ ]] || fail 'Missing cluster identity'
    stop_db
    verify_bindings
    "${docker[@]}" start "$container_id" >/dev/null
    verify_database
    [[ "$(cluster_identity)" = "$before" ]] || fail 'PostgreSQL cluster changed after restart'
    printf '%s\n' "$before" >"$state/cluster-identity"
    "${docker[@]}" volume inspect "$volume" --format '{{.CreatedAt}}' >"$state/volume-created"
    sync -f "$state"
    printf '%s\n' 'Graceful stop, start and same PostgreSQL cluster verified.'
    ;;
  *) fail 'Unknown operation' ;;
esac
