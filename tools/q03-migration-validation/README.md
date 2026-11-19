# Q03 migration-validation source preservation (WIP)

## Track B offline coordinator

The Docker Desktop / WSL 2 replacement has a separate offline gate in
`harness/track-b-docker-gate.mjs`. Its tests rehearse binding, isolation,
collision refusal, stage order, stop/preserve behavior and cancellation identity
without opening sockets or running commands. The gate accepts synthetic receipts
only. Its binding digest identifies a fixture, and does not authenticate owner
authority. No live adapter or durable global reservation is supplied. Run
`track-b-docker-gate.test.mjs` with the same guard and package read restriction
as the self-check below. This suite needs no evidence write permission.

`harness/track-b-offline-runner.mjs` models the Track B-only stage sequence with
synthetic adapter receipts. It verifies the pinned input manifest and all 72
input hashes, the exact original resource and runtime profile in the simulated
preflight, the 66+2 ledger, the preserved synthetic legacy snapshot, and required
behavior receipts. It writes an exclusive JSONL evidence marker and syncs each
event. It records only safe stage names, checksums, counts and fixed stop reasons.
Cancellation signals the fake adapter and stops later stages. This does not
prove a PostgreSQL session has stopped.

There is no real adapter, credential input or executable Track B command. Direct
execution rejects. The B1 adapter remains Track A-only. A future Track B run
requires a separately reviewed live adapter, verified private resource bindings
and authority for the exact target, independent identity and collision checks,
and verified PostgreSQL cancellation and evidence handling. The historical
aggregate runner remains outside that scope.

For native Docker Engine under WSL 2, `harness/track-b-native-engine.mjs` is
the read-only engine observation component. It queries the local Unix socket
and returns an engine fingerprint for private binding review. It does not
provision resources or admit a run. The offline fixture still models Docker
Desktop, so its receipts cannot authorize this native installation.

To run the coordinator tests from `harness/`, set
`Q03_TRACK_B_TEST_EVIDENCE` to an existing, private, absolute directory outside
Git. Use the same directory for `<evidence-root>` below. The tests retain their
synthetic evidence in that directory.

```text
node --require ./offline-validation-guard.cjs --permission --allow-fs-read=<package-root> --allow-fs-read=<evidence-root> --allow-fs-write=<evidence-root> --test --test-isolation=none --test-reporter=spec track-b-offline-runner.test.mjs
```

## Q03-B1 opt-in Track A adapter

The new `harness/b1-contract.mjs`, `b1-controller.mjs`, `b1-runner.mjs` and
`b1-contract.test.mjs` implement the separately owner-authorized Track A scope.
Importing them does not execute Docker or SQL. B1 uses its own exact CLI scope,
source fingerprint, offline evidence and short-lived local authorization; A8
authorization and the old Windows relay are not used. Operational records live
outside this repository and must never be committed.

The controller only accepts the exact dedicated run, original immutable Docker
resources, pinned runner image and single Track A database. Source paths are
checked against the pinned 72-file manifest and translated to Linux separators
without changing snapshot bytes. A network-none runner first verifies Node,
Prisma and engine hashes. The migration runner then receives the existing
disposable credential through private stdin, checks for a database collision,
creates only Track A, and runs exactly one `prisma migrate deploy`. It captures
ledger/catalog evidence and stops without repair or retry on migration failure.
Schema comparison emits a proposal only; it never applies that proposal.

For offline validation, add `b1-contract.test.mjs` to the guarded self-check
command below. It uses fake Docker drivers and opens no network/database
connection. The actual migration entrypoint is intentionally not listed as a
general setup command: exact flags and local records are safety controls, not
owner authorization. A durable execution marker and database collision rejection
prevent blind replay. Do not remove those controls to retry a historical run.

On 2026-11-02 the authorized Track A replay completed all 68 migrations using
Prisma 6.10.1 / PostgreSQL 18.6. Ledger checksums and Q02-B SQL definition checks
passed. Prisma's read-only schema comparison reported nonempty drift, including
foreign-key, index-name and column differences. No diff SQL was applied. This is
not a drift-free, runtime behavior, Track B or production-readiness certificate.
Exact execution evidence remains in the separate external B1 evidence directory.

This is a source preservation package, not a certified migration runner. No migration has been executed as part of G01. Historical Q03-A8 proved bounded read-only connectivity only. Q03-B1 and all database execution require separate owner authorization.

The original external workspace and its exact historical evidence remain separate. Source in `harness/` is copied byte-for-byte, with its historical constraints intact; G01 did not integrate it into application runtime, package scripts or CI. `source-checksums.json` records source, snapshot and artifact-reference hashes. The 72 `harness/inputs/` files are schema/migration/security source snapshots, not database records. The input manifest describes their historical baseline, not current deployment readiness.

## Default-deny boundaries

No `resource-manifest.json`, `a8-authorization.json`, runner artifact manifest, runtime source overlay, credentials, generated dependencies or database state is supplied. The historical resource manifest is hash-pinned in source; absent or mismatched configuration must fail closed. The old Windows migration transport remains blocked. CLI flags and exported functions are safeguards, never independent owner approval. No file in this package authorizes Docker operations, SQL, installation, email or deployment.

Do not put execution authorizations or real resource bindings into Git. A fresh run needs separately reviewed local configuration, positively verified disposable resource identity, fresh authorization, private credential handling, an isolated runtime and explicit cleanup bounds. Do not change pins or weaken gates merely to make the archive executable. Do not run `run-q03b.mjs --execute`, invoke `runA8Suite`, build the Dockerfile, start workers, install with lifecycle scripts, or execute schema/migration commands under this preservation task.

## Offline verification

Use an already installed Node 22 permission-capable runtime; no dependency installation is needed for Node's test runner. From `harness/`, substitute the package's absolute directory for `<package-root>`:

```text
node --require ./offline-validation-guard.cjs --permission --allow-fs-read=<package-root> --test --test-isolation=none --test-reporter=spec self-check.test.mjs
```

This suite reads source; the guard blocks network/subprocess APIs. Do not run real runner entrypoints. The other preserved suites (`runner-boundary.test.mjs`, `a5-security.test.mjs`, `a8-connectivity.test.mjs`) also reference omitted historical manifests or historical negative-test fixtures. An initial G01 packaged self-check/boundary run encountered two missing-resource-manifest failures in the boundary suite. This is an explicit archive dependency, not permission to add live bindings. Their complete historical run remains in the external evidence package. They are preserved as source, not advertised as self-contained runnable suites here. A later authorized packaging task may introduce independent synthetic fixtures without importing historical execution credentials.

## Fresh-environment reconstruction plan

1. Clone the sole approved development branch and verify its remote SHA. Verify every entry of `source-checksums.json` before using this source. Keep the clone separate from any execution workspace.
2. Create a separate reviewed test workspace. Stage only approved source and synthetic fixtures there. Original `config.mjs` and `target-boundary.mjs` retain historical Windows executable paths, Docker endpoint, run/resource identities and external-directory layout. They are deliberately unchanged archival source, not machine-independent configuration. The input manifest also uses Windows path separators; native Linux execution requires a separately reviewed portability/configuration adaptation. Never edit historical records to impersonate a new authorized run.
3. Acquire dependencies only in a separately authorized setup step. Intended Prisma CLI and `@prisma/client` are 6.10.1; Node is 22.23.3; historical TypeScript is 5.8.3 and Vitest 4.1.11. Use the repository's reviewed lockfile as the dependency baseline. Verify platform and all package integrity values. Do not run project postinstall/build/release scripts as a shortcut.
4. `reference/node-integrity.json` records the official Node artifact URL, length and SHA-256. `reference/linux-engine-integrity.json` records official Prisma engine URLs, revision `9b628578b3b7cae625e8c927178f15a170e74a9c`, platform and compressed/uncompressed hashes. Binaries are deliberately absent. Independently verify the upstream artifacts and platform before execution; a checksum record alone is not fresh provider attestation.
5. Historical runner Dockerfile pins the PostgreSQL base image by digest and expects a verified Node archive, engines, dependency tar and runner-code build context. None is bundled. Build preparation, image acquisition, fresh resource binding, authorization generation and a new image build require separate review. Never use a repository-wide Docker context containing secrets or dependencies. Original A7 image layers and local archives need secure off-machine backup or reacquisition; a local Docker image ID is not a remote backup.
6. Only after fresh authorization: prove the target is disposable, synthetic-only, inaccessible from live connections, has no published database port, and cannot inherit live secrets. Run the authorized connectivity/security gates before migration testing. Do not choose staging or production resources. A8 does not authorize Q03-B.

## Excluded local-only material and backup

The external Q03 workspace retains historical reports, exact manifests/authorizations, full test logs, acquisition scripts/cache inventory, package archives, generated dependencies, verified engines, runner image and Docker resources. These are not all reconstructible from this source package alone. Preserve significant non-secret historical evidence in a separately approved off-machine backup; protect or omit credentials and local runtime state. A second folder on the same computer is insufficient disaster recovery.

No automatic CI, merge, staging or production activation is configured. Runtime integration, generated Prisma Client validation, migration correctness, policy enforcement and provider exactly-once delivery remain unproved by this archive. Before any eventual merge, separately authorized debugging, compilation, regression, security, database safety, deployment readiness and recovery verification must resolve all critical/high-risk blockers, followed by explicit owner merge approval.
