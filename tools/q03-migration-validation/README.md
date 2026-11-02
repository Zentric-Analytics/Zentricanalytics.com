# Q03 migration-validation source preservation (WIP)

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
