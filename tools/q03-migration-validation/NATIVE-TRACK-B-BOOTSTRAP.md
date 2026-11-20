# Native WSL 2 replacement for Q03 Track B

This procedure is for review. Provisioning the persistent replacement and executing Track B require separate approvals. The earlier in-memory smoke test approval covered that test alone.

## Mission 12 reusable baseline

Mission 12 authorized the named local synthetic baseline on the existing WSL
ext4 disk on C:. The elevated check reported 100% used-space encryption and
Protection Off. The VHD ACL restricts ordinary local access to the owner and
authorized system principals. It does not provide offline drive protection.
Keep real data, passwords, recovery materials and sensitive evidence out of
this profile. The separate Track B storage and approval gates still apply.

The baseline profile uses PostgreSQL Unix-socket peer authentication instead
of a password. Only the container's PostgreSQL operating-system identity maps
to the restricted reader. PostgreSQL listens on no TCP address. There are no
creator or Track B owner logins in this baseline profile. The Docker admin
boundary controls access to the mapped operating-system identity.

### Reuse and recovery

1. Check Windows available RAM before a new Docker launch and use the
   established 6 GiB threshold. In Ubuntu start the local Docker service
   manually. Keep a WSL session open while PostgreSQL is required. WSL may
   stop the distribution after its final session closes, and neither Docker
   nor the container is configured to start automatically.
2. Run `sudo bash tools/q03-migration-validation/harness/native-baseline.sh start`
   from the WSL checkout path. The script rechecks the recorded engine,
   resource labels, container, image, network, volume and PostgreSQL identity
   before reporting readiness. Use the same script with `verify` for the
   restricted read-only check against an already running container.
3. Run the script with `stop` before closing the WSL session. It performs a
   graceful stop and verifies a clean exit. Use `cycle` for an authorized
   stop/start persistence check. The volume and cluster identifiers must match
   before and after. A different identity or existing partial reservation
   requires investigation. Never invoke initial provisioning as a recovery
   shortcut.
4. Keep private synthetic ownership, volume and cluster records in the
   root-only operator directory outside the checkout. Independently approve
   any off-machine backup destination and record backup and restore results
   only after an actual drill. Version application test fixtures in source
   and keep the baseline empty. See [the synthetic application plan](SYNTHETIC-APPLICATION-PLAN.md).

The following sections describe the separate Track B deployment review. The
baseline profile alone cannot serve as a Track B write-capable configuration.
The read-only `preflight-track-b` operator action records a unique private
preflight receipt and returns status 12 on this peer-only profile. It does
not reserve a write run. Track B needs a separately verified, narrowly scoped
creation identity on an approved maintenance connection, a restricted owner,
and an isolated runner and evidence mount. The existing worker routes its
control connection through the baseline. A Track B transition must preserve
the baseline's existing grants and peer-only access, so that route requires
a reviewed change before activation.

## Provisioning sequence

1. Verify the authorized source branch and all 72 preserved input hashes. Check available Windows memory against the 6 GiB startup threshold and record the WSL limits. Use the local Docker socket, confirm that no Docker API TCP listener exists, and inventory containers, images, networks, and volumes. Stop on any name collision or uncertain ownership.
2. Verify the official PostgreSQL 18.6 linux/amd64 manifest against the reviewed digest in the fixture profile. Verify the cached or acquired image matches the manifest's config digest. Acquire and verify the separate Prisma runtime and dependencies before closing acquisition access. Bind image IDs by digest, with pull disabled during the run.
3. Identify the backing Windows volume for the Docker data root and a private directory outside the checkout for execution evidence. Verify storage protection and permissions before persistent initialization. Prepare a separate, approved off-machine backup for non-secret evidence and reproducible inputs. Keep credentials and private resource bindings out of that evidence.
4. After provisioning approval, create the internal bridge `zentric-q03-replacement-net` and local volume `zentric-q03-replacement-data`. Create `zentric-q03-replacement-postgres` on that bridge only, with the volume mounted at `/var/lib/postgresql`, no published port, and restart disabled. Apply the label `zentric.q03.replacement=true` to all three. Initialize only `q03_replacement_baseline`; leave `q03_replacement_track_b` absent. Keep the container ID, network ID, image IDs, and independent storage identity in the private binding. Preserve any partial resources if outcomes are unclear.
5. Generate distinct 32-byte random synthetic credentials for `q03_replacement_reader`, `q03_replacement_creator` and `q03_replacement_owner`. Only the creator has `CREATEDB` and the membership needed to assign database ownership to the target role. The reader has baseline connectivity, no object creation rights and read-only transactions. The owner controls only the future Track B target. None has superuser, role creation, replication or RLS bypass. Keep credentials out of Docker command arguments, logs, Git and test evidence. Use approved private bootstrap delivery, and close that path before a validation run.
6. Independently verify isolation before using the database. Inspect container, network and volume identities, network peers, mounts, and port bindings. Check routes, forwarding, listeners, DNS and egress from the intended execution namespaces, including WSL and Windows where relevant. Use local controlled probes or inspect the enforcing rules to verify egress denial. Confirm the runner has no Docker socket, PostgreSQL data volume, inherited provider credentials, or other host access. A Docker internal bridge is one check in this sequence.

## Mission 13 continuation

The current worker accepts only the restricted Track B login on a Unix socket
and verifies membership in the dedicated non-login owner role. Database creation
is a separate, fixed maintenance-session program that checks the cluster ID,
role, socket, target absence and advisory lock. The worker has no maintenance
connection or creation credential. Its live entry stays disabled until the
host authority, restricted PostgreSQL roles and exact socket path are verified.

Build the candidate with `harness/track-b-runner.Dockerfile` and a private
context containing only the pinned Node binary, reviewed Prisma packages and
engines, and checksum-reviewed Q03 source and inputs. A scratch final stage
avoids inheriting an implicit PostgreSQL data volume. Bind the resulting
immutable image ID, apply the resource caps and use `--network none`.

## Mission 14 shared socket and rollback

The direct cross-container and WSL bind attempts failed on this host. A
disposable client and listener proved a Docker-managed socket volume works
with networking disabled and the client mount read-only. The PostgreSQL
container mounts `zentric-q03-replacement-socket` at `/run/zentric-track-b`
and retains the original socket directory. The runner mounts only the socket
volume at `/socket` read-only and `zentric-q03-replacement-evidence` at
`/evidence` writable by its private UID. PostgreSQL has no TCP listener.

`track-b-cold-preservation.sh` stops the recorded container, archives the
shut-down cluster read-only, verifies the checksums, restarts the original,
and boots a separate restored copy on a network-disabled container. The
restore probe verifies cluster identity and the empty peer-only baseline.
The backup and restore probe stay outside Git on the same disk. Off-machine
recovery and active disk protection are still unverified.

`track-b-socket-recreate.sh` checks the private backup and socket receipts,
compares configuration and keeps the original stopped under its held name.
Only the replacement may run against the shared data volume. To roll back,
stop and verify the replacement first, preserve its identity and logs, restore
the held container's original name and recorded private binding, then start
and verify the original. Never start both against this volume. The original
and replacement use the same cluster. Restoring a backup over the live volume
is a separate operation.

`track-b-socket-roles.sh` provisions a non-login owner and restricted runner
and verifier logins. Its final authentication rules preserve the existing
baseline peer rule and admit only the named Track B logins on local sockets
to the Track B target. Temporary maintenance access is removed after role
setup. Keep synthetic credentials under root-only custody. The live write
interlock stays closed until an operator-signed authority and one-time
maintenance reservation are verified against the refreshed runner and target.

## Mission 15 one-time authority and reconciliation

### Mission 16 local synthetic operation

The operator now requires an explicit mode. `signed-owner` continues to require
an independently verified Ed25519 signature and its original protected key
mount. Its actions now take the mode before the command, for example
`signed-owner check`. The signed envelope includes the mode. It never falls
back to a local approval. Older unsigned or unspecified-mode requests are
rejected.

`local-synthetic-operator` applies only to this verified replacement cluster.
The local plan program takes the immutable image ID after the read-only runner
preflight passes. It verifies the cold archive, source, manifest, image,
socket and evidence volume, then prepares the stopped restricted runner and a
root-only plan. Use `local-synthetic-operator check` for a read-only review.

From an interactive local WSL terminal, as the authorized machine operator,
run `local-synthetic-operator confirm`. The prompt displays the exact cluster,
container, target, runner and source, evidence scope and one-time run identity.
Type the target and the freshly displayed token. The controller checks the
foreground terminal and rejects piped input, unattended invocations and stale
answers. A successful confirmation is in-process authority and an audit
receipt. It does not provide cryptographic owner identity. The runner receives
only a read-only view of that root-created receipt. After confirmation the same
process reserves the exact database, runs fixed maintenance creation, verifies
the result and launches the pinned test sequence.

There is no standalone local `create` or `run` command. A local receipt and
creation journal cannot be reused after interruption. Use
`local-synthetic-operator reconcile` for observation only, and preserve the
existing journal, target and evidence on uncertainty.

### Signed-owner operation

The live operator is `harness/track-b-native-operator.mjs` and runs as root
under WSL. The local authority key is an owner-authenticated Ed25519 **public**
PEM stored at `/root/.local/state/zentric-q03-synthetic/track-b-authority.pem`.
Enroll it only after confirming its fingerprint with the owner through a
trusted channel. Keep its parent directory root-only. The runner receives
this one file as a read-only mount at `/opt/q03/track-b-authority.pem`. A
root-owned public key with mode 0444 is readable by the restricted runner UID.
The owner retains the private key.

Prepare the root-only mode-0600 `track-b-plan.json` in the same WSL state
directory. It contains `binding`, `context`, `isolation` and `approval`.
Record the verified engine, cluster ID, container, network, socket and
evidence volume fingerprints, created runner ID, immutable runner image,
source fingerprint, existing manifest digest, run ID, server marker and
artifact hashes in the binding. Use the operation set
`Q03_NATIVE_TRACK_B_66_PLUS_2_V1` and exact target
`q03_replacement_track_b`. Include the reviewed isolation evidence digest
and provisioning receipt digest. The approval scope is
`Q03_NATIVE_TRACK_B_WRITE`.

Run the operator with `signing-input` to emit the exact bytes to sign. The
owner reviews the bound plan and validity window, signs those bytes outside
the controller, and returns a detached Ed25519 signature. Put its unpadded
base64url representation in `approval.signature`. The controller never
reads a private signing key. Run `check` to validate the signed plan against
the actual engine, resource IDs, runner mounts and private evidence volume.

Use `create` only with a valid signed plan. The host creates one global
`q03_replacement_track_b.creation.jsonl` with exclusive creation and syncs
its reservation and start records before issuing fixed maintenance SQL.
Independent catalog and verifier checks must confirm the name, ownership,
grants, empty target and unchanged baseline. A partial, started or uncertain
journal consumes the automatic creation attempt. Use `reconcile` for a
read-only observation of that journal and the database. Do not clear the
journal, repeat creation, or upgrade uncertain evidence to confirmed.

`run` is available only after the creation journal is confirmed for the
same signed binding. Keep that journal, the runner's synced stage records,
fixture snapshots and migration checksums private. If an operation has an
uncertain outcome, capture its ledger and resource state with read-only
checks before deciding how to recover.

## Earlier Track B deployment design

This table records the prior shared-network design. The continuation uses a
network-disabled runner and the socket-only boundary described above.

| Component | Required configuration |
| --- | --- |
| Database | Pinned linux/amd64 PostgreSQL image, 512 MiB memory, 1 CPU, no restart, no published ports, internal bridge only |
| Data mount | `zentric-q03-replacement-data` to `/var/lib/postgresql`, no additional runtime bind mounts |
| PostgreSQL config | Loopback only on port 5432, SCRAM-SHA-256, startup marker `zentric.q03_replacement_marker` set to the private random binding value |
| Host authentication | Ordered loopback SCRAM rules only for the reader and creator on the baseline, and owner on the target. Deny other host combinations and restrict any initialization-only local socket rule before admitting a runner |
| Resource binding | Label the database, network, volume and runner with the same high-entropy private `zentric.q03.resource` value. Verify immutable IDs and the local volume creation fingerprint from fresh Docker inspection |
| Runner | Precreated, pinned image, UID/GID 65532, read-only root, drop all capabilities, no-new-privileges, private PID namespace, init, no restart, 1 GiB memory, 2 CPUs, 128 PIDs, `container:<bound-database-id>` network namespace |
| Runner tmpfs | `/tmp:rw,nosuid,nodev,size=128m,mode=1777` and `/work:rw,nosuid,nodev,size=512m,uid=65532,gid=65532,mode=0700` |
| Runner entry | `/opt/node/bin/node /opt/q03/track-b-native-postgres.mjs` with stdin open, no TTY, pinned source and artifacts, secrets only through private stdin |
| Runner evidence | Protected local volume `zentric-q03-replacement-evidence` at `/evidence`, writable only by the runner identity and approved reviewers. Verify backing encryption, mount isolation, and a separate encrypted off-machine backup path before activation |

The database must be the only bridge peer. The runner shares its network namespace so that PostgreSQL can stay bound to loopback. Verify WSL and Windows listeners, namespace routes, DNS and the enforcing egress rules independently. A passed Unix-socket inspection alone supplies neither those observations nor authorization.

The host supervisor inspects exact Docker resources and the prepared runner. The worker has fixed psql operations and staged Prisma deploys, re-verifies the migration ledgers, and uses a generated Prisma client for a fenced transaction and rollback check. Both share an explicit source interlock. Leave it disabled until the protected bindings, artifact availability, provisioning and exact database-write authorization have been independently reviewed and recorded. Build and verify the native runner image from the pinned runtime outside Git before use. The current checkpoint's offline fixtures cannot attest to a real server, client transaction, or approved runner image.

The intended sequence reserves exclusive durable run evidence, proves target absence and baseline identity, creates the exact target once, and applies the 66 historical migrations. Seed and capture five synthetic outbox rows, ten attempts, and two audit rows, then apply the two pinned safety migrations. Compare full before and after snapshots and ledgers, verify catalog behavior, tenant constraints, ownership, fencing, and journal consistency, and run the seven bounded concurrency cases with real Prisma transactions and fake providers. Re-observe the database, role, backend start time, PID, and run tag before cancellation. An unverified outcome stops the run and preserves resources and evidence for review.
