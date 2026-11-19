#!/bin/bash
set -euo pipefail
umask 077
export LC_ALL=C
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH

here=$(dirname "$(realpath "$0")")
d=(/usr/bin/docker --host unix:///run/docker.sock)
state=/root/.local/state/zentric-q03-synthetic
volume=zentric-q03-replacement-evidence
[[ "$#" = 1 && "$1" =~ ^sha256:[0-9a-f]{64}$ && $(id -u) = 0 ]]
image=$1
bash "$here/native-baseline.sh" verify
[[ "$("${d[@]}" image inspect "$image" --format '{{.Id}}/{{.Os}}/{{.Architecture}}/{{with index .Config "Volumes"}}{{len .}}{{else}}0{{end}}')" = "$image/linux/amd64/0" ]]
receipt=$(mktemp -d "$state/runner-transport.XXXXXXXX")
stage=socket-source
finish() {
  local code=$?
  printf 'stage=%s\nstatus=%s\nimage=%s\n' "$stage" "$code" "$image" >"$receipt/result"
  sha256sum "$receipt/result" >"$receipt/result.sha256"
  sync -f "$receipt"
}
trap finish EXIT
mapfile -t identities <"$state/identities"
[[ "${#identities[@]}" = 4 && "${identities[1]}" =~ ^[a-f0-9]{64}$ && "${identities[3]}" =~ ^[a-f0-9]{64}$ ]]
pg_pid=$("${d[@]}" inspect "${identities[3]}" --format '{{.State.Pid}}')
[[ "$pg_pid" =~ ^[1-9][0-9]*$ ]]
socket_origin="/proc/$pg_pid/root/run/postgresql"
socket="$state/track-b-socket-view"
[[ -S "$socket_origin/.s.PGSQL.5432" ]]
[[ ! -L "$socket" ]]
if ! mountpoint -q "$socket"; then
  install -d -m 0700 "$socket"
  [[ -z "$(find "$socket" -mindepth 1 -maxdepth 1 -print -quit)" ]]
  stage=socket-bind
  mount --no-canonicalize --bind "$socket_origin" "$socket"
  mount -o remount,bind,ro "$socket"
fi
[[ "$(stat -Lc '%d:%i' "$socket")" = "$(stat -Lc '%d:%i' "$socket_origin")" ]]
[[ ",$(findmnt -n -o VFS-OPTIONS --mountpoint "$socket")," = *,ro,* ]]

stage=evidence-volume
volumes=$("${d[@]}" volume ls --format '{{.Name}}')
if ! grep -Fxq "$volume" <<<"$volumes"; then
  "${d[@]}" volume create --label "zentric.q03.resource=${identities[1]}" \
    --label zentric.q03.purpose=track-b-evidence "$volume" >/dev/null
fi
ownership=$("${d[@]}" volume inspect "$volume" --format '{{.Driver}}/{{index .Labels "zentric.q03.resource"}}/{{index .Labels "zentric.q03.purpose"}}')
[[ "$ownership" = "local/${identities[1]}/track-b-evidence" ]]
mount=$("${d[@]}" volume inspect "$volume" --format '{{.Mountpoint}}')
[[ "$mount" = "/var/lib/docker/volumes/$volume/_data" && "$(realpath "$mount")" = "$mount" ]]
chown 65532:65532 "$mount"
chmod 0700 "$mount"
[[ "$(stat -c '%a/%u/%g' "$mount")" = 700/65532/65532 ]]

stage=runner-socket-probe
"${d[@]}" run --rm --pull never --network none --read-only --user 65532:65532 \
  --cap-drop ALL --security-opt no-new-privileges --memory 1g --cpus 2 --pids-limit 128 \
  --mount "type=bind,source=$socket,target=/socket,readonly,bind-propagation=rprivate" \
  --mount "type=volume,source=$volume,target=/evidence,volume-nocopy" \
  --tmpfs /tmp:rw,nosuid,nodev,size=128m,mode=1777 \
  --entrypoint /bin/bash "$image" -euc '
    umask 077
    test -S /socket/.s.PGSQL.5432
    test ! -S /run/docker.sock
    test "$(ls /sys/class/net)" = lo
    test "$(/opt/node/bin/node --version)" = v22.23.3
    printf "%s  %s\n" \
      348b9e6f5c531d13a2cdb1e130b90306b8fe8d30cda879fbf22d21ea787f6244 /opt/engines/schema-engine \
      aef387b0b42412126048b637c502bd30ac32f696da402d39985f83ac95899544 /opt/engines/libquery_engine.so.node |
      sha256sum --check --status
    cd /opt/q03
    /opt/node/bin/node --input-type=module -e "import {verifyNativeInputs} from \"./track-b-native-boundary.mjs\"; if ((await verifyNativeInputs()).length !== 68) process.exit(1);"
    test "$(/opt/node/bin/node -p "require(\"/opt/project/node_modules/prisma/package.json\").version")" = 6.10.1
    CHECKPOINT_DISABLE=1 PRISMA_SCHEMA_ENGINE_BINARY=/opt/engines/schema-engine \
      DATABASE_URL=postgresql://synthetic@localhost/q03_replacement_track_b?host=/socket \
      /opt/node/bin/node /opt/project/node_modules/prisma/build/index.js validate --schema /opt/q03/inputs/prisma/schema.prisma
    diagnostic=$(psql -X -w -h /socket -U q03_replacement_reader -d q03_replacement_baseline -c "SELECT 1" 2>&1) && exit 1
    case "$diagnostic" in *"Peer authentication failed"*) ;; *) exit 1 ;; esac
    receipt=$(mktemp /evidence/runner-preflight.XXXXXXXX)
    printf "%s\n" "socket-only; no network interfaces except loopback; baseline peer denied; pinned artifacts and Prisma schema verified" >"$receipt"
    sync -f /evidence
    printf "%s\n" "Restricted runner preflight passed."
  '
stage=complete
