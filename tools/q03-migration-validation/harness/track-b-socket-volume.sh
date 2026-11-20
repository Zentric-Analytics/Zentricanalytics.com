#!/bin/bash
set -euo pipefail
umask 077
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
export LC_ALL=C
[[ $(id -u) = 0 && "$#" = 0 ]]
d=(/usr/bin/docker --host unix:///run/docker.sock)
state=/root/.local/state/zentric-q03-synthetic
volume=zentric-q03-replacement-socket
image=sha256:d03740e4f4b7e53def7811769971b093dba8ca74429d166c560d79a9b05373b3
here=$(dirname "$(realpath "$0")")
bash "$here/native-baseline.sh" verify
mapfile -t identity <"$state/identities"
[[ "${#identity[@]}" = 4 && "${identity[1]}" =~ ^[a-f0-9]{64}$ ]]
list=$("${d[@]}" volume ls --format '{{.Name}}')
if ! grep -Fxq "$volume" <<<"$list"; then
  "${d[@]}" volume create --label "zentric.q03.resource=${identity[1]}" \
    --label zentric.q03.purpose=track-b-socket "$volume" >/dev/null
fi
[[ "$("${d[@]}" volume inspect "$volume" --format '{{.Driver}}/{{index .Labels "zentric.q03.resource"}}/{{index .Labels "zentric.q03.purpose"}}')" = "local/${identity[1]}/track-b-socket" ]]
receipt=$(mktemp -d "$state/socket-volume-probe.XXXXXXXX")
name="zentric-socket-probe-${receipt##*.}"
flags=(--rm --pull never --network none --read-only --cap-drop ALL --security-opt no-new-privileges --memory 128m --cpus 1 --pids-limit 32)
node=/opt/node/bin/node
sock=/socket/q03-volume-probe.sock
finish() {
  local code=$?
  if [[ "$("${d[@]}" inspect "$name" --format '{{.Config.Labels}}' 2>/dev/null || true)" = *"$name"* ]]; then
    "${d[@]}" stop --time 2 "$name" >/dev/null || true
  fi
  printf 'status=%s\nimage=%s\nvolume=%s\n' "$code" "$image" "$volume" >"$receipt/result"
  sha256sum "$receipt/result" >"$receipt/result.sha256"
  sync -f "$receipt"
}
trap finish EXIT
"${d[@]}" run -d "${flags[@]}" --name "$name" --label "zentric.q03.probe=$name" --user 0:0 \
  --mount "type=volume,src=$volume,dst=/socket,volume-nocopy" \
  --entrypoint "$node" "$image" -e '
    const fs=require("node:fs"); const net=require("node:net"); const path=process.argv[1];
    if (fs.existsSync(path)) process.exit(2);
    const server=net.createServer(s=>{s.setTimeout(1000,()=>s.destroy());s.end("isolated-socket-ok")});
    server.listen(path,()=>fs.chmodSync(path,0o666));
    const stop=()=>server.close(()=>process.exit(0));
    process.on("SIGTERM",stop); setTimeout(stop,20000);
  ' "$sock" >/dev/null
timeout 18 "${d[@]}" run "${flags[@]}" --user 65532:65532 \
  --mount "type=volume,src=$volume,dst=/socket,readonly,volume-nocopy" \
  --entrypoint "$node" "$image" -e '
    const fs=require("node:fs"); const net=require("node:net"); const path=process.argv[1];
    if (fs.readdirSync("/sys/class/net").join()!=="lo" || fs.existsSync("/run/docker.sock")) process.exit(2);
    for (let i=0;i<40&&!fs.existsSync(path);i++) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);
    if (!fs.statSync(path).isSocket()) process.exit(3);
    const s=net.connect(path); let out="";
    s.setTimeout(3000,()=>process.exit(4)); s.on("data",x=>out+=x);
    s.on("end",()=>{if(out!=="isolated-socket-ok") process.exit(5); console.log("Shared Docker volume socket verified with network disabled and client mount read-only");});
  ' "$sock"
