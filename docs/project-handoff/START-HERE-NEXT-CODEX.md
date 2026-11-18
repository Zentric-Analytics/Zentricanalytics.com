# Start here — next Codex agent

Handoff: November 18, 2026. Read the [master blueprint](ZENTRIC-MASTER-BLUEPRINT.md)
for the whole-application mission, history, policies and release blockers. This
guide grants no execution authority.

## On the second computer

1. Sign in to an owner-authorized GitHub account. Do not copy old credentials or
   `.env` files into the new checkout.
2. Clone the existing branch; do not create another branch:

   ```sh
   git clone --branch feature/hrms-email-queue-safety --single-branch https://github.com/Zentric-Analytics/Zentricanalytics.com.git
   cd Zentricanalytics.com
   git remote -v
   git branch --show-current
   git status --short
   git rev-parse HEAD
   git ls-remote origin refs/heads/feature/hrms-email-queue-safety refs/heads/dev refs/heads/main
   ```

3. Confirm the branch name exactly and compare local HEAD to the current feature
   remote SHA. Stop on unexpected differences; do not reset, force-push, discard
   work or create an alternative branch. The last verified application-source
   commit was `95c42b6db6d01dd874feafe51503f2dd3a41f91d`; the handoff commit is its
   descendant. Always inspect the live tip, not only this historical SHA.
4. Read in order: root `AGENTS.md`; this guide; the master blueprint;
   `docs/hrms/email-queue-development-progress.md`;
   `tools/q03-migration-validation/README.md`; then relevant code/tests and securely
   transferred evidence. Older archive README statements are historical, not proof
   that later runtime code is absent or a CLI is currently authorized.
5. Ask the owner to securely transfer selected external evidence listed below.
   Establish available tooling and scope without installing, generating, starting
   workers, executing SQL or connecting to live systems under this handoff task.

## Current position

- Phase 1 CONDITIONAL: source preserved, drift classified/corrected; fresh DB diff pending.
- Phase 2 BLOCKED: original Docker installation fails with a missing installation
  Registry key; Track B has not executed. Track A historically applied 68 migrations
  successfully on PostgreSQL 18.6 / Prisma 6.10.1.
- Phase 3 CONDITIONAL: guarded email transport/existing queue integration committed,
  actual PostgreSQL transactions/concurrency and activation unresolved.
- November 16 verification: 3,040 application tests, 157 harness tests; Prisma
  validation/isolated client generation, TypeScript, changed-file lint and local
  build passed. These were not rerun for this documentation-only handoff and are
  not a certificate for a new computer, current provider state or production.
- `dev` baseline `df6bb5ed872be23c0411d792fb610b59f06588b7`;
  `main` baseline `0a096929b573a9090b73c46ea8ea8ef0d9c01ce9`.

## What clone does not contain

The old root was `C:\Users\worki\Documents\Codex\2026-10-25\ar`.
Selected external `outputs/UNIT-01-*.md`, `outputs/UNIT-02-*.md`,
`outputs/consolidated-20261116/`, `outputs/q03-20261030-1960147fab/` (especially
`b1-20261102/`) and `outputs/g01-preservation-20261102/` hold dated reports,
ledger/catalog evidence, private manifests and authorization dependencies,
validation logs and toolchain/integrity records. Dependencies, verified engines,
images, original databases/volume and runtime bindings are not GitHub backups.
Owner must choose secure transfer/reconstruction; do not publish these wholesale.

The source archive deliberately omits operational prerequisites. Its pins, flags,
checksums and historical records are safety gates, not permission. Do not change
them merely to get an archived runner to execute.

## Next recommended action

First reconcile current GitHub state and securely obtain/review the external
evidence. Then present the owner with a minimal recovery or reconstruction plan.
On the original computer, installation repair needs separate approval, followed
by immutable identity/isolation checks before resuming the original Track B scope.
On another computer, **the original database authorization does not automatically
apply to any replacement database, container, image, network or volume**. Obtain
fresh exact target/setup/write authorization; do not impersonate the original run.

Track B requires preparation/validation before writes, collision refusal,
synthetic-only legacy baseline (five queue rows, ten attempts), 66 historical then
two Q02-B migrations, exact record preservation, integrity and bounded concurrency
tests with fake providers. Preserve databases and failed evidence; no resets,
automatic repairs, failure-injection target or uncontrolled parallelism.

After SQL-backed verification, address unversioned legacy records, authorized HELD
review/release and credential/configuration isolation. Staging HRMS eligibility
allows authorized valid external-email testers; production requires exact company
domain plus all existing checks. Public recruitment remains external-email capable.
These policies are distinct from staging's outbound recipient allowlist. Do not
claim HRMS account enforcement or live credential separation is already activated.

## Fresh approval and safety gates

This handoff is documentation/preservation only. Obtain an explicit next work
scope. Setup/install/download, Docker repair/reconstruction, database operations,
provider or credential changes, real emails, worker activation, recovery tests,
PR/release actions, merges and deployments require their applicable separate
owner authorization. Never execute release/start/bootstrap/preflight/archive/
restore scripts as a setup shortcut; some query/write databases or start workers.
`postinstall` generates Prisma, so review installation scripts before any approved
dependency setup. Use synthetic environment/offline safeguards for approved tests.

All source work stays on `feature/hrms-email-queue-safety`. Before each approved
push, check public suitability, GitHub workflows/webhooks, Render service branches/
auto-deploy/preview or Blueprint triggers; verify remote SHA afterward. No automatic
feature-to-dev or dev-to-main merge. Full final debugging, compilation, regression,
security, database/deployment safety and recovery verification plus critical/high
closure and explicit owner approval are mandatory before promotion.

## Ready-to-copy opening instruction

> Continue Zentric Analytics from the existing GitHub branch
> `feature/hrms-email-queue-safety`. Read root AGENTS.md and both
> docs/project-handoff documents first. Verify current remote/local SHAs and
> preserve all work. Our goal is full application readiness, not just email.
> Begin with read-only handoff/evidence/toolchain reconciliation and report the
> smallest next authorized step. Do not create another branch, fix Docker,
> install dependencies, execute SQL/migrations, use live credentials, send email,
> start workers, merge or deploy without the required explicit scope. Original
> Q03 authorization is not transferable to a replacement database on this computer.
