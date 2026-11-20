#!/bin/bash
set -euo pipefail
umask 077
export LC_ALL=C
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
[[ $(id -u) = 0 && "$#" = 0 ]]
here=$(dirname "$(realpath "$0")")
state=/root/.local/state/zentric-q03-synthetic
data=zentric-q03-replacement-data
image=sha256:d03740e4f4b7e53def7811769971b093dba8ca74429d166c560d79a9b05373b3
d=(/usr/bin/docker --host unix:///run/docker.sock)
probe=(--rm --pull never --network none --cap-drop ALL --security-opt no-new-privileges --memory 256m --cpus 1 --pids-limit 64)
bash "$here/native-baseline.sh" verify
mapfile -t identity <"$state/identities"
[[ "${#identity[@]}" = 4 && "${identity[3]}" =~ ^[a-f0-9]{64}$ ]]
cluster=$(cat "$state/cluster-identity")
[[ "$cluster" =~ ^[0-9]{16,24}$ ]]
[[ "$(df -Pm "$state" | awk 'NR==2 {print $4}')" -ge 1024 ]]
record=$(mktemp -d "$state/track-b-cold.XXXXXXXX")
"${d[@]}" inspect "${identity[3]}" >"$record/original-container.json"
"${d[@]}" volume inspect "$data" >"$record/original-volume.json"
"${d[@]}" network inspect "${identity[2]}" >"$record/original-network.json"
cp "$state/identities" "$record/original-identities"
cp "$state/cluster-identity" "$record/original-cluster-id"
restore_original() {
  if [[ "$("${d[@]}" inspect "${identity[3]}" --format '{{.State.Status}}')" = exited ]]; then
    bash "$here/native-baseline.sh" start
  fi
}
trap restore_original EXIT
bash "$here/native-baseline.sh" stop
[[ "$("${d[@]}" inspect "${identity[3]}" --format '{{.State.Status}}/{{.State.ExitCode}}')" = exited/0 ]]
[[ -z "$("${d[@]}" ps --filter volume="$data" --format '{{.ID}}')" ]]
"${d[@]}" run "${probe[@]}" --read-only --user 0:0 --cap-add DAC_OVERRIDE \
  --mount "type=volume,src=$data,dst=/original,readonly,volume-nocopy" \
  --entrypoint /bin/bash "$image" -euc '
    test ! -e /original/18/docker/postmaster.pid
    /usr/lib/postgresql/18/bin/pg_controldata /original/18/docker |
      grep -Eq "^Database cluster state: +shut down$"
    exec tar --numeric-owner -cpf - -C /original .
  ' >"$record/data.tar"
(
  cd "$record"
  sha256sum data.tar original-container.json original-volume.json original-network.json original-identities original-cluster-id > SHA256SUMS
  sha256sum -c --status SHA256SUMS
  sync -f .
)
bash "$here/native-baseline.sh" start
trap - EXIT

restore="$record/restore-probe"
mkdir "$restore"
tar --numeric-owner -xpf "$record/data.tar" -C "$restore"
"${d[@]}" run "${probe[@]}" --read-only --user 999:999 \
  --mount "type=bind,src=$restore,dst=/restore" --tmpfs /tmp:rw,nosuid,nodev,size=16m,mode=1777 \
  --entrypoint /bin/bash "$image" -euc '
    root=/restore/18/docker
    bin=/usr/lib/postgresql/18/bin
    actual=$("$bin/pg_controldata" "$root" | awk -F ": *" "\$1==\"Database system identifier\" {print \$2}")
    test "$actual" = "$1"
    "$bin/pg_ctl" -D "$root" -w -t 30 -l /tmp/restore.log -o "-c listen_addresses= -k /tmp" start
    stop_restore() { "$bin/pg_ctl" -D "$root" -m fast -w -t 30 stop; }
    trap stop_restore EXIT
    result=$("$bin/psql" -X -w -qAt -v ON_ERROR_STOP=1 -h /tmp -U q03_replacement_reader -d q03_replacement_baseline -c "
      SELECT current_database()=\$\$q03_replacement_baseline\$\$ AND inet_server_addr() IS NULL
        AND current_setting(\$\$server_version_num\$\$)=\$\$180006\$\$
        AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relnamespace=\$\$public\$\$::regnamespace)
        AND NOT EXISTS (SELECT 1 FROM pg_database WHERE datname=\$\$q03_replacement_track_b\$\$);" | tr -d "\r")
    test "$result" = t
  ' bash "$cluster"
bash "$here/native-baseline.sh" verify
printf '%s\n' 'Cold archive hash and isolated restore verified against original cluster and empty baseline.' >"$record/restore-verified"
sync -f "$record"
printf '%s\n' 'Cold archive and isolated restore passed. Original container is running.'
