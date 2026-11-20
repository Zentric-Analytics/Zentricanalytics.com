#!/bin/bash
set -euo pipefail
umask 077
export LC_ALL=C
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
[[ $(id -u) = 0 && "$#" = 0 ]]
here=$(dirname "$(realpath "$0")")
state=/root/.local/state/zentric-q03-synthetic
d=(/usr/bin/docker --host unix:///run/docker.sock)
name=zentric-q03-replacement-postgres
old_name=zentric-q03-replacement-postgres-m12-held
candidate=zentric-q03-replacement-postgres-m14-candidate
socket_volume=zentric-q03-replacement-socket
data=zentric-q03-replacement-data
network=zentric-q03-replacement-net
image=sha256:e3d24f6906d0760bf4da0dae872415391ededefad23fd471c47dc53b0ddf3c42
bash "$here/native-baseline.sh" verify
mapfile -t identity <"$state/identities"
old=${identity[3]}
nonce=${identity[1]}
[[ "$old" = a2da71fc00d8* && "$nonce" =~ ^[a-f0-9]{64}$ ]]
[[ "$("${d[@]}" volume inspect "$socket_volume" --format '{{.Driver}}/{{index .Labels "zentric.q03.resource"}}/{{index .Labels "zentric.q03.purpose"}}')" = "local/$nonce/track-b-socket" ]]
backup=
for record in "$state"/track-b-cold.*; do
  if [[ -f "$record/restore-verified" ]] && cmp -s "$record/original-identities" "$state/identities" &&
    (cd "$record" && sha256sum -c --status SHA256SUMS); then
    backup=$record
  fi
done
[[ -n "$backup" ]]
probe=
for record in "$state"/socket-volume-probe.*; do
  if [[ -f "$record/result" ]] && grep -qx status=0 "$record/result" &&
    (cd "$record" && sha256sum -c --status result.sha256); then
    probe=$record
  fi
done
[[ -n "$probe" ]]
names=$("${d[@]}" ps -a --format '{{.Names}}')
! grep -Fxq "$old_name" <<<"$names"
record=$(mktemp -d "$state/socket-recreate.XXXXXXXX")
printf '%s\n' "$backup" >"$record/cold-backup-path"
printf '%s\n' "$old" >"$record/original-id"
sync -f "$record"

old_entry=$("${d[@]}" inspect "$old" --format '{{index .Config.Cmd 1}}')
old_image_reference=$("${d[@]}" inspect "$old" --format '{{.Config.Image}}')
[[ "$("${d[@]}" inspect "$old" --format '{{.Image}}')" = "$image" ]]
[[ "$("${d[@]}" image inspect "$old_image_reference" --format '{{.Id}}')" = "$image" ]]
tail='exec gosu postgres postgres -D "$data" -c "listen_addresses=" -k "$socket" -c shared_buffers=64MB -c max_connections=12'
[[ "$old_entry" = *"$tail" ]]
new_tail='install -d -m 0755 -o postgres -g postgres /run/zentric-track-b
exec gosu postgres postgres -D "$data" -c "listen_addresses=" -k "$socket,/run/zentric-track-b" -c shared_buffers=64MB -c max_connections=12'
entry=$'set -e\n[[ "$(cat /var/lib/postgresql/18/docker/.zentric-baseline-initialized)" = synthetic-baseline-v1 && "$(cat /var/lib/postgresql/18/docker/PG_VERSION)" = 18 ]]\n'
entry+="${old_entry%"$tail"}$new_tail"
if grep -Fxq "$candidate" <<<"$names"; then
  new=$("${d[@]}" inspect "$candidate" --format '{{.Id}}')
  [[ "$("${d[@]}" inspect "$new" --format '{{.State.Status}}/{{.Image}}')" = "created/$image" ]]
  [[ "$("${d[@]}" inspect "$new" --format '{{index .Config.Cmd 1}}')" = "$entry" ]]
  recorded=
  for prior in "$state"/socket-recreate.*; do
    if [[ -f "$prior/replacement-id" && -f "$prior/original-id" ]] &&
      [[ "$(cat "$prior/replacement-id")" = "$new" && "$(cat "$prior/original-id")" = "$old" ]]; then
      recorded=yes
    fi
  done
  [[ "$recorded" = yes ]]
else
  new=$("${d[@]}" create --name "$candidate" --pull never --platform linux/amd64 \
  --label "zentric.q03.resource=$nonce" --label zentric.q03.replacement=true \
  --network "$network" --dns 127.0.0.1 --sysctl net.ipv6.conf.all.disable_ipv6=1 \
  --restart no --memory 512m --memory-swap 512m --cpus 1 --pids-limit 128 --shm-size 64m \
  --stop-signal SIGINT --mount "type=volume,src=$data,dst=/var/lib/postgresql" \
  --mount "type=volume,src=$socket_volume,dst=/run/zentric-track-b,volume-nocopy" \
  --log-driver local --log-opt max-size=2m --log-opt max-file=2 \
  --entrypoint /bin/bash "$old_image_reference" -c "$entry")
fi
printf '%s\n' "$new" >"$record/replacement-id"
"${d[@]}" inspect "$new" >"$record/replacement-config"
# Compare the complete container config except the reviewed command, hostname
# and the single additional mount. ContainerConfig.Hostname is ID-derived.
node=/root/.cache/zentric-q03/mission13-node/node-v22.23.3-linux-x64/bin/node
"$node" -e '
  const fs=require("node:fs");const assert=require("node:assert/strict");
  const [a,b]=process.argv.slice(1).map(p=>JSON.parse(fs.readFileSync(p))[0]);
  for (const c of [a,b]) {delete c.Config.Cmd;delete c.Config.Hostname;}
  assert.deepEqual(a.Config,b.Config);
  assert.deepEqual(a.HostConfig.Mounts,b.HostConfig.Mounts.filter(m=>m.Target!=="/run/zentric-track-b"));
  delete a.HostConfig.Mounts;delete b.HostConfig.Mounts;
  for (const c of [a,b]) c.HostConfig.OomKillDisable ??= false;
  const differences=Object.keys({...a.HostConfig,...b.HostConfig})
    .filter(key=>!require("node:util").isDeepStrictEqual(a.HostConfig[key],b.HostConfig[key]));
  if(differences.length) throw Error("HostConfig mismatch: "+differences.join(", "));
' "$backup/original-container.json" "$record/replacement-config"
sync -f "$record"

rollback() {
  local status=$?
  if [[ "$status" != 0 ]]; then
    set +e
    if [[ "$("${d[@]}" inspect "$new" --format '{{.State.Running}}')" = true ]]; then
      "${d[@]}" stop --time 30 "$new" >/dev/null || return "$status"
    fi
    if [[ "$("${d[@]}" inspect "$new" --format '{{.Name}}')" = "/$name" ]]; then
      "${d[@]}" rename "$new" "$candidate" || return "$status"
    fi
    if [[ "$("${d[@]}" inspect "$old" --format '{{.Name}}')" = "/$old_name" ]]; then
      "${d[@]}" rename "$old" "$name" || return "$status"
    fi
    cp "$backup/original-identities" "$state/identities"
    sync -f "$state"
    bash "$here/native-baseline.sh" start
  fi
}
trap rollback EXIT
bash "$here/native-baseline.sh" stop
"${d[@]}" rename "$old" "$old_name"
"${d[@]}" rename "$new" "$name"
printf '%s\n' "${identity[@]:0:3}" "$new" >"$record/new-identities"
cp "$record/new-identities" "$state/identities.m14"
mv -T "$state/identities.m14" "$state/identities"
sync -f "$state"
bash "$here/native-baseline.sh" start
"${d[@]}" exec "$new" test -S /run/zentric-track-b/.s.PGSQL.5432
printf '%s\n' verified >"$record/result"
sync -f "$record"
trap - EXIT
printf 'Old PostgreSQL container %s held stopped; replacement %s verified.\n' "${old:0:12}" "${new:0:12}"
