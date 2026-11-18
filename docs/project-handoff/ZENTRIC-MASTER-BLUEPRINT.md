# Zentric Analytics — master project blueprint

Handoff date: November 18, 2026, America/Los_Angeles. This is a sanitized public
handoff, not operational authorization. Read [START-HERE-NEXT-CODEX.md](START-HERE-NEXT-CODEX.md)
and the root [AGENTS.md](../../AGENTS.md) before acting.

## Mission and scope

The objective is the **entire Zentric Analytics application**: fully functional,
secure, stable and operationally ready. Understand and audit code/infrastructure;
fix verified defects and incomplete functionality; resolve security, authorization,
database and integration problems; debug and test the whole application; reconcile
development and production; eventually align `dev` and `main` with owner-approved
functionality and verify actual staging/production operation.

The HRMS email queue is one workstream, not the whole project. Passing its tests
does not certify payroll, recruitment, storage, infrastructure or recovery.

## Workflow and authority

Repository: https://github.com/Zentric-Analytics/Zentricanalytics.com

**Only development branch: `feature/hrms-email-queue-safety`.** It was established
to preserve unfinished, validated local work off-machine while isolating it from
the deployment branches. All future authorized development stays on this exact
branch; do not create per-unit, recovery or temporary branches. Review scope,
test, sanitize for this public repository, commit verified increments (label
incomplete work WIP), refresh deployment-trigger safety, push fast-forward and
verify GitHub's resulting SHA. Preserve uncommitted work; never reset/clean,
force-push or rewrite published history.

Feature-to-`dev` integration requires separate owner approval and release gates.
Then verify complete staging operation before separately approved `dev`-to-`main`
promotion. Merges, PR/release actions, deployment, database writes, credentials,
provider operations and infrastructure changes are not implied by source access.
The current handoff task authorizes documentation/preservation only.

## Current Git baseline

Freshly checked November 18 before this documentation commit: local source tip
and remote feature tip both `95c42b6db6d01dd874feafe51503f2dd3a41f91d`, clean tree,
no unpublished source commits. This handoff commit is a descendant; obtain its
actual SHA with `git rev-parse HEAD` and compare the live remote rather than
treating the preceding source SHA as the forever-current tip.

| Ref / historical checkpoint | SHA |
|---|---|
| Previous remote preservation checkpoint | `23da55f06c857545d4c441329bcce62a43f159bf` |
| Recovered/published Q03-B1 Track A checkpoint | `e0ce681f7b80c1077a0cecd2263fcdb190bded03` |
| Schema contract corrections | `ded465066d9612150f2df121db267a48885b89f6` |
| WIP guarded email runtime/queue integration | `95c42b6db6d01dd874feafe51503f2dd3a41f91d` |
| `dev`, unchanged at handoff baseline | `df6bb5ed872be23c0411d792fb610b59f06588b7` |
| `main`, unchanged at handoff baseline | `0a096929b573a9090b73c46ea8ea8ef0d9c01ce9` |

Historical production web ran `c441344bafcfba9d1c6eac80549302d37d0e570b`, not the
recorded `main` tip. November 18 read-only publication checks still showed this
production source link and staging's `dev` source link. Do not assume a branch
tip equals deployed code. Refresh exact deployment identity before release.

## Completed investigation and development

### Initial reconciliation / Unit 01

The original audit recorded `dev` 186 commits ahead/zero behind `main`, 482 changed
paths (397 added, 85 modified), and 15 dev-only migration definitions. These are
historical baseline counts, not current branch-diff or unapplied-live-migration
counts. Historical tests were `main`: 771 passing; `dev`: 1,934 passing/23 failing.
Do not erase those failures or treat newer test totals as item-level closure.

Unit 01 was owner accepted **as investigation and planning**, October 27, 2026;
production readiness was not accepted. Seven original evidence reports and later
closure/planning reports remain external, unchanged by this handoff. Important
open findings include ZA-01–ZA-14 audit dispositions, payroll salary/permission
and uncertified business Unit 9 containment, database ingress, storage IAM,
effective provider/environment isolation, migration readiness and recovery.
Original ZA descriptions must come from their evidence crosswalk, not inference.
The historical three recovered SQL definitions and execution limitations and
15-migration prechecks still require their original evidence; no blanket live
schema or recovery certification exists.

Approved reconciliation roadmap (different from historical HRMS business-unit
numbering): 02 Security and Permissions; 03 Application and Schema Corrections;
04 Historical Evidence and Test Integrity; 05 Recruitment and Existing Data;
06 Database Migration Readiness; 07 Full Release Candidate Verification;
08 Controlled Main Promotion; 09 Production Deployment and Signoff.

Approved principles: separate email credentials/contain staging recipients;
preserve approved legacy payroll while uncertified business Unit 9 official
operations remain inaccessible; require recovery/rollback evidence and accepted
RPO/RTO; separately authorize live prechecks with load/schema/safety review;
document security acceptance of ingress and storage IAM. Detailed risk acceptance
and technical gates remain necessary. Approved legacy workflows must not be invented.

### Pure security and queue contracts

- U02-I01: `src/lib/deployment-environment.mjs` and `.d.mts` — injected identity
  resolver; verified staging/production or unverified, fail closed.
- U02-I02: `src/lib/environment-policy-rules.mjs` and `.d.mts` — pure account/
  recipient policies. Email eligibility never grants HRMS authorization.
- U02-I03-01: `src/lib/deployment-runtime-metadata.mjs` and `.d.mts` — pure snapshot
  validation, explicit preview classification, no provider attestation.
- U02-I03-02: `src/lib/email-dispatch-decision.mjs` and `.d.mts` — offline dispatch
  classification, policy hold/config block/simulation/provider-outcome distinction.
- Q01: `src/lib/hr/notifications/queue-transition-rules.mjs` and `.d.mts` — pure
  queue transitions, ownership, intent/reservation/invocation, safe cancellation,
  hold/release and uncertainty rules. Pure rules do not enforce database atomicity.
- Corresponding tests are under `tests/`, including `queue-transition-rules.test.ts`.

Owner's latest HRMS policy: staging explicitly authorized test accounts may use
any valid domain; production internal HRMS accounts require exactly
`@zentricanalytics.com` plus existing password/MFA/session/roles/tenant permissions.
Review existing legitimate production external-email accounts with the owner
before enforcement; never automatically disable/migrate them. Public recruitment
accepts ordinary valid external emails and must not grant internal HRMS access.
**Full environment-specific HRMS account enforcement is not claimed implemented**
by the email runtime checkpoint. Staging email recipient allowlisting is separate.

### Q02 schema and Q03 isolated testing

`prisma/schema.prisma` and these two additive migrations preserve HELD and the
safety contract:

1. `prisma/migrations/20261029000100_email_queue_held_enum/migration.sql`
2. `prisma/migrations/20261029000200_email_queue_safety_contract/migration.sql`

HELD enum commit visibility precedes the safety migration. Historical migrations
must never be edited to hide drift. SQL protections include constraints and
append-only journal rules; read the exact SQL and regression tests before changes.

Q03-A developed guarded connectivity, identity verification and a Linux runner;
Q03-A8 proved bounded read-only connectivity. Q03-B1 Track A on November 2 used
PostgreSQL 18.6 and Prisma 6.10.1, successfully applied all 68 migrations and
matched ledger checksums. Drift was reported, never applied. This is historical
migration evidence, not a runtime/concurrency or production certificate.

Preserved source: `tools/q03-migration-validation/README.md`, `harness/`,
`source-checksums.json`, `reference/`. Its 72 input snapshots are historical
source, not current runtime or database records. Credentials, execution manifests,
dependencies, images and full evidence are intentionally omitted. The README has
historical phase-specific statements; the development ledger/current source take
precedence for subsequent implementation status, not for execution authorization.

### Schema drift and Phases 1–3

The recorded diff proposed 88 FK drops, 23 FK adds, 87 index renames, four column
alterations and one index removal. Classification of 180 distinct objects:
23 FK representations corrected; 87 explicit index mappings; four column fixes;
one retained index; 65 supplemental SQL-only FKs preserved.

`tests/fixtures/schema-contract-alignment.json` records provenance;
`tests/schema-contract-alignment.test.ts` guards corrections and immutable inputs.
Offer/EmploymentAgreement updatedAt defaults now match SQL; legacy payroll creator
nullability is represented honestly; recruitment offer creator is required to match
original SQL; JobApplication_deletedAt_idx is retained. This resolves the specific
source representation discrepancy, not unqueried live-schema uncertainty. All 68
historical migrations and original Q03 snapshots remain unchanged. No diff SQL ran.

Runtime integration at `95c42b6`:

- `src/lib/email-runtime-policy.mjs` / `.d.mts`: source-controlled bindings plus
  server configuration validation. Never HTTP host/header authority or `NODE_ENV`
  alone. Configuration matching is not cryptographic Render attestation.
- `src/lib/email.ts`: shared final dispatch guard, staging JSON
  `STAGING_EMAIL_RECIPIENT_ALLOWLIST`, valid production business-recipient policy,
  bounded provider request/idempotency key, sanitized outcomes. Simulation is not
  delivery; acceptance is not mailbox receipt; ambiguity is not ordinary failure.
- `src/lib/hr/notifications/dispatch-engine.ts`, `outbox.ts`, `worker.ts`: existing
  queue, contract-v1 records, tenant-scoped CAS/claims/transactions, audit/journal,
  intent/reservation/invocation accounting and safe recovery.
- `src/lib/hr/auth/invitations.ts`, `password-reset.ts`: credential/expiry binding;
  immediate invitation dispatch requires organization scope.
- `tests/email-runtime-policy.test.ts`, `hr-email-dispatch-engine.test.ts` and
  `email.test.ts`: synthetic policy/provider/store coverage. No real sends.

Policy denial cannot authorize provider dispatch. Proven non-invocation permits
fenced reservation cancellation with zero provider attempts; ambiguous evidence
is preserved without unsafe counter refund or automatic retry. HELD never becomes
automatically dispatchable. Old unversioned rows are deliberately skipped, pending
classification. No new HELD release API, permission or dashboard was invented.
Current policy authorizes web dispatch only; cron is not implicitly authorized.

## Verified checkpoint and limitations

| Work | State / evidence date |
|---|---|
| Source preservation and classification (Phase 1) | CONDITIONAL; published, fresh DB diff pending |
| SQL upgrade/concurrency/recovery (Phase 2) | BLOCKED; Track B not executed |
| Application integration (Phase 3) | CONDITIONAL; source/fake-tested, SQL verification pending |
| Application tests | November 16: 3,040 passed, 178 files |
| Separately guarded harness tests | November 16: 157 passed, no failures/skips |
| Prisma validate / isolated generation | PASS, 6.10.1; no DB connection |
| TypeScript / changed-file lint / local Next build | PASS, November 16 |
| Harness checksum inventory | 100 entries matched |
| Current source preservation | Fresh November 18 Git comparison, clean baseline |

No thousands-test rerun was needed for this documentation-only task. Earlier
historical counts (including Track A's 1,059 offline tests) are not new test results.
The build used synthetic configuration with provider egress denied; only existing
Google font HTTPS fetches were permitted. Full SQL-backed end-to-end tests are not
proved by fake-store concurrency or generated types. Dependencies were isolated
copies, not package installation. Historical line-ending normalization was reverted;
only narrow checkout rules reproduce sealed original bytes, not changed evidence.

## Remaining work, in dependency order

| Next work | Status | Gate / authorization |
|---|---|---|
| Recover original Q03 Docker installation | BLOCKED | Installation/Registry failure; separately approve repair; no reset/recreate |
| Verify original resources; execute exact Track B | BLOCKED | Original-only authorization, fresh identity/collision/security checks |
| SQL migration, integrity, journal, concurrency/recovery | NOT VERIFIED | Approved disposable scope; synthetic data/fake providers only |
| Verify integrated Prisma transactions against PostgreSQL | NOT VERIFIED | Do not substitute mocks for SQL evidence |
| Legacy row classification and HELD review/release | NOT VERIFIED | Owner decisions on reviewer permission, retention, auditable current-policy release |
| Email credentials/runtime metadata/approved recipients | NOT VERIFIED | Separately authorized provider/config changes; preserve legitimate production sends |
| HRMS environment-specific account enforcement | NOT VERIFIED | Owner review of external production accounts; preserve MFA/RBAC/public recruitment |
| Whole-application debugging/security and remaining ZA findings | NOT VERIFIED | Recover original crosswalk, scope authorized fixes; maintain legacy payroll containment |
| Infrastructure, IAM/ingress, backups/restores/deployed SHA | NOT VERIFIED | Fresh evidence, accepted RPO/RTO, separate recovery/operational authority |
| Feature-to-dev integration | BLOCKED | Final audit, critical/high closure and explicit owner approval |
| Complete staging validation | NOT VERIFIED | Separate deployment/operational authority and containment |
| dev-to-main / production signoff | BLOCKED | Separate final verification and explicit owner approval |

Docker Desktop's last observed startup failure: missing installation Registry key
`SOFTWARE\Docker Inc.\Docker Desktop`; approved engine pipe absent. No repair was
performed. Do not treat this dated diagnosis as fresh inspection on another machine.

The original Track B authorization covered only new `q03_1960147fab_track_b` in
the exact original verified PostgreSQL 18.6 resources: collision refusal, 66 original
migrations, deterministic fictional organizations/accounts, exactly five legacy queue
rows and ten historical attempts, baseline comparison, two unchanged Q02-B migrations,
scoped constraints/journal/claim/concurrency tests on additional synthetic rows with
fake providers. Preserve Track A, baseline and Track B; stop failed migrations without
repair/reset; bounded temporary runner exact-ID cleanup only. No failure-injection
database. Authorization is not portable to a replacement computer/database. Recover
the private authority/resource evidence and seek fresh approval for any new target.
The prepared fixture contract tests do not constitute a complete executed Track B.

## External evidence and transfer boundaries

Old-machine workspace root: `C:\Users\worki\Documents\Codex\2026-10-25\ar`.
These locations are **not supplied by Git clone** and are not assumed backed up:

| Location relative to that root | Important contents / handling |
|---|---|
| `outputs/UNIT-01-*.md` | Seven evidence reports plus closure; sensitive operational observations; secure review/transfer |
| `outputs/UNIT-02-*.md` | Source map, verification, decisions and superseding environment policy; preserve dates/precedence |
| `outputs/consolidated-20261116/` | Final consolidated report, validation logs, drift classification, verified backups, generated client/dependencies and helper scripts |
| `outputs/q03-20261030-1960147fab/b1-20261102/` | Track A report, ledger/catalog/checksums/results; DO-NOT-APPLY diff; execution records |
| `outputs/q03-20261030-1960147fab/` | Private manifests/identity evidence, historical authorization dependencies, cache/toolchain and fixtures |
| `outputs/g01-preservation-20261102/` | Historical publication/preservation evidence and independent verification clone |
| Original Docker installation/resources | Database volume, images and network; not transferred by source checkout |

Transfer only selected evidence through an owner-controlled secure channel after
review/redaction; do not upload entire workspaces, secrets, personal records, dumps,
private authorization records or Docker resources to this public repository.
Do not assume an omitted toolchain or original resource can be reconstructed from
source alone. Original Windows paths/pins require review, never silent substitution.

## Success criteria and stopping rule

The full application is complete only after verified functionality, security and
tenant integrity; resolved critical/high blockers; approved legacy/payroll boundaries;
current migration and recovery/rollback evidence; approved RPO/RTO; and staging/
production identities/configuration matching approved code. No test suite alone
establishes this. Preserve uncertainty and original audit failures until closed with
specific evidence.

Before any eventual `dev`-to-`main` merge, a separately authorized final debugging,
TypeScript compilation, regression, security, database safety, deployment-readiness
and recovery-verification phase must pass, all critical/high blockers must be
resolved, and the owner must explicitly approve the merge. Stop this task after
handoff publication/verification; begin no development or operational work.
