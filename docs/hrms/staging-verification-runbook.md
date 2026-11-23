# HRMS staging verification runbook

Run only after explicit authorization against an isolated staging service with synthetic data. Never paste secret values into chat, logs, issues, PRs, screenshots, or this document.

| Step | Action | Expected result | Evidence | Failure response | Blocking |
| --- | --- | --- | --- | --- | --- |
| 1 | Record authorization, operator, service, approved commit, maintenance window | Scope is unambiguous and non-production | Change record IDs and commit SHA | Stop; obtain approval | Yes |
| 2 | Create database backup/PITR point and record legacy recruitment/HR row counts | Recoverable pre-migration state | Provider backup ID, timestamp, counts | Stop; repair backup | Yes |
| 3 | Configure `.env.staging.example` keys in Render secret manager; never print values | Required variables exist with staging-only values | Redacted configuration checklist | Stop; correct secret scope | Yes |
| 4 | Configure private S3-compatible bucket, encryption, blocked public access, least-privilege key | Private object boundary is usable | Provider policy/encryption evidence | Stop; deny uploads | Yes |
| 5 | First initialization only: set `HR_BOOTSTRAP_ENABLED=true`, matching confirmation, email, bcrypt hash | One-time authorization is explicit | Secret names/config timestamps only | Stop; do not bypass guard | Yes |
| 6 | Deploy approved stack; Render runs `yarn hr:release` | Environment validation, `migrate deploy`, guarded bootstrap if needed, preflight pass | Sanitized release log and migration list | Roll back code; preserve DB; investigate | Yes |
| 7 | Remove bootstrap flag/hash/confirmation immediately after first initialization | Future releases cannot bootstrap | Secret-removal audit | Suspend initialization account if exposure suspected | Yes |
| 8 | Open `/api/health/live`, `/api/health/ready`, `/hr/login` | 200; no connection details or secrets | Status/time screenshots without data | Stop traffic; fix readiness | Yes |
| 9 | Sign in as initial ADMIN and enroll MFA before other operations | MFA succeeds; replayed code fails | Audit event IDs, not secret/QR | Suspend account and investigate | Yes |
| 10 | Redeploy without bootstrap secrets | Bootstrap skipped; full preflight passes including MFA | Sanitized release log | Stop; repair readiness | Yes |
| 11 | Test invitation, activation, reset, logout, rotation, suspension, role change, emergency MFA reset | Generic errors; links single-use/expiring; sessions revoked | Synthetic account/audit IDs | Disable affected auth flow | Yes |
| 12 | Execute ADMIN/HR_ADMIN/PAYROLL_ADMIN/EMPLOYEE authorization matrix and guessed-ID/cross-tenant cases | Allowed operations pass; all escalation attempts fail | Matrix results and denied audit/request IDs | Treat as security incident | Yes |
| 13 | Create synthetic employee, contacts, identifiers, bank, department/team/position, assignments | Complete history and correct masking | Synthetic record IDs/screenshots | Roll back synthetic workflow; file defect | Yes |
| 14 | Verify supervisor direct/team/department scopes, expiry, transfer, and removal | Only current configured employees visible/reviewable | Scope matrix | Block supervisor access | Yes |
| 15 | Exercise leave policy, year-boundary rejection, request, attachment, approval/rejection/withdrawal, accrual/carry-over | Exact balances/ledger; unsafe uploads rejected | Ledger/request IDs and calculations | Freeze leave mutations | Yes |
| 16 | Exercise salary maker-checker, components, adjustments, calculate/review/approve/lock/pay, correction/version | Exact Decimal snapshots; self-approval denied; locked immutable | Run/approval IDs and reconciled totals | Freeze payroll; do not mark paid | Yes |
| 17 | Generate/download payslips and summary/bank CSVs under each role | Ownership enforced; bank export separately authorized; CSV formula-safe | Export/audit IDs and checksums | Revoke export access | Yes |
| 18 | Upload valid/invalid documents; exercise scan clean/quarantine/conflict/replay, version, download, archive | Magic-byte checks, idempotent replay, quarantine denial, access audit | Version/scan/access IDs | Disable uploads/scanner | Yes |
| 19 | Create/assign/acknowledge/return/loss assets; attempt duplicate and cross-tenant assignment | Custody history retained; invalid operations rejected | Asset/assignment/audit IDs | Freeze asset mutations | Yes |
| 20 | Run onboarding tasks/dependencies/evidence/reminders | Prerequisites and owner scope enforced | Instance/task/audit IDs | Pause lifecycle | Yes |
| 21 | Run offboarding through payroll/leave/assets/access/email/documents/final communication | Completion blocked until all gates; account/session revoked; record archived | Instance/tasks/audit IDs | Suspend account manually; investigate | Yes |
| 22 | Run workflow ANY/ALL/QUORUM, conditions, rejection, cancellation, duplicate/concurrent/unauthorized decisions, definition version update | Immutable versioned decisions and correct terminal states | Definition/instance/approval IDs | Disable workflow creation | Yes |
| 23 | Run headcount, turnover, recruitment, leave, payroll, assets, offboarding, audit reports with dates/roles | Tenant/date scope, stable limits, minimized columns, audit exports | Report request/audit IDs | Revoke report/export permission | Yes |
| 24 | Trigger in-app/email notifications and duplicate/retry/terminal worker runs | Safe bodies, idempotency, immutable attempts, expected retry/backoff | Outbox/attempt IDs and redacted provider IDs | Pause worker and retry safely | Yes |
| 25 | Authenticate worker, scanner, and metrics with correct/incorrect secrets | Correct accepted; incorrect uniformly denied | Status codes and monitor evidence | Rotate affected secret | Yes |
| 26 | Connect live/ready/metrics monitors and force a safe synthetic failure | Alert reaches named on-call path | Alert/incident IDs | Block promotion | Yes |
| 27 | Run `yarn hr:smoke` and authorized `HR_LOAD_SMOKE_CONFIRM=non-production yarn hr:load-smoke` | All smoke checks pass; p95 within approved threshold | Sanitized command output | Diagnose; do not increase limits blindly | Yes |
| 28 | Run end-to-end approved email-deliverability verification for each sender category using approved test recipients | One delivery attempt and one mailbox-delivered result per category; provider id + email trace + quarantine outcomes are captured | Subject, sender, from/reply, provider message ID, trace ID, inbox placement, audit entry IDs | Pause release; investigate and correct mail-flow controls | Yes |
| 29 | Execute security test plan and independent penetration scope | No open critical/high findings | Signed report and retest IDs | Block promotion | Yes |
| 30 | Run `yarn hr:backup-readiness`, restore to isolated target, then guarded restore drill | Current backup and successful isolated restore | Backup/restore IDs and timestamp | Block promotion | Yes |
| 31 | Capture final HR, payroll, security, operations sign-off | Named approval of evidence package | Approval record IDs | Do not promote | Yes |

## Rollback

Stop workers and user traffic first. Roll back application code to the prior approved commit while leaving additive migrations and retained history intact. For data corruption, restore the recorded backup into an isolated database, validate it, and switch only through approved provider/change-control procedures. Never run migration reset, `db push`, unscoped delete, or manual history edits.

## Mission 21 read-only checkpoint

| Area | Result and evidence | Required follow-through |
| --- | --- | --- |
| Service and artifact | PASS for identity. Render staging web service `srv-d8s6ovvavr4c73fctksg` tracks `dev` with auto-deploy and PR previews off. Live web deploy `dep-dap83pm0tbcc738o2kpg` is commit `df6bb5ed872be23c0411d792fb610b59f06588b7`. | Verify GitHub rules and hooks and the exact candidate artifact before authorizing any publication. |
| Database | FAIL for restricted ingress and migration parity. Staging PostgreSQL 18.4 instance `dpg-d8s9itj6sc1c73c6vsl0-a` allows `0.0.0.0/0`. The Render connector queried only metadata in a verified read-only transaction. Of 70 ledger entries, 66 finished and four were rolled back and superseded. Sixty-five finished entries match the LF source. `20260730110000_hrms_organization_management` matches its original Git blob at `b8aea93b3ddc32acdb65fdcfcae578129ee7cb3f`, while current source and the live deploy contain the later revision. Both queue-safety migrations are pending and the catalog lacks the dispatch journal. The inspection login has database and role creation capabilities. The web runtime role and its grants remain unverified. | Review trusted clients and authorize a separate ingress change. Reconcile the organization schema delta and backfill evidence against the original artifact and a restored isolated copy before approving release. Verify the runtime and migration roles independently. |
| Runtime secrets and providers | BLOCKED. Service metadata confirmed a staging web service and scheduled outbox cron in the same Render environment. Effective secret isolation, database binding and provider recipient policy were not established. | Obtain a redacted environment and provider policy attestation. Verify disabled bootstrap and approved worker/recipient boundaries before any run. |
| Health and alerting | PASS for observed HTTP 200 liveness and readiness, protected metrics returning 401 without credentials, and Render telemetry availability. Later probe retries timed out from the local host. Render health-check path was blank. Actual alert delivery and access/retention configuration were BLOCKED. | Confirm the intended HTTP health-check policy, named monitor owner, redacted logs and recipient route. Arrange a separately approved bounded synthetic alert and capture delivery and acknowledgement. |
| Recovery | BLOCKED. Local Track B receipts and baseline were reconciled. Staging backup, retention, encryption, measured RPO/RTO and isolated restore evidence were unavailable. | Collect provider backup/PITR and independent encrypted archive evidence. Verify a recent isolated restore with measured recovery results. Obtain separate approval if a fresh drill is needed. |
| Privileged and multi-role integration | PASS locally with fictional persistence for administrator MFA, provisioning-draft creation and audit, employee self-service and denials, tenant filtering, payroll visibility, logout, and reset. Actual staging writes and the privileged approval workflow were NOT RUN. | Schedule the existing fictional-data staging matrix under separate write approval. Gate payroll publication and external providers independently. |

Proceed in order. Bind the proposed commit and the current web, cron, and database targets. Close the ingress, migration parity, secrets, recovery and webhook gaps before any release. The three organization import and revision tables exist in staging. Their presence alone leaves application constraints and the historical backfill unverified. Verify restore evidence and a compatible rollback artifact before authorizing the migration-bearing `hr:release` hook. Keep worker and provider activation outside the smoke test unless specifically approved. Stop on target or commit mismatch, failed health or database checks, migration uncertainty, missing recovery evidence, or an unexpected provider invocation. Record the artifact, operator, timestamps, probe status, synthetic role results and redacted alert receipt before requesting promotion.

## Mission 22 staged change packages

### A. Restrict PostgreSQL external ingress

The web service, cron, and database are in the same Oregon Render environment
(`evm-d8s6nt1o3t8c73eqksu0`). Four other database client sessions in the sampled
snapshot used private-range addresses and the same login as the read-only
inspection. This sample establishes neither service attribution nor the
absence of intermittent maintenance clients. The cron sends an authenticated
request to the web worker endpoint rather than directly connecting to PostgreSQL
in its configured command. Confirm its target without disclosing its bearer value.

Before changing ingress, verify the web, release hook, and recovery operator
targets and roles using redacted connection facts, identify intermittent
maintenance or backup users, and confirm database readiness through the internal
path. With separate owner approval, remove `0.0.0.0/0` from
`dpg-d8s9itj6sc1c73c6vsl0-a`. Use an empty external allowlist if no external
client is required. Otherwise admit only the independently verified CIDRs
and note their owners, purpose, and expiry. Verify allowed maintenance and
internal readiness plus denied external access from a controlled test client.
Observe scheduled-worker health through metadata and redacted logs without
triggering delivery. Stop on a dependency failure and restore access to the
verified affected client. Reinstating broader ingress requires explicit approval.
[Render external access](https://render.com/docs/postgresql-creating-connecting#restricting-external-access)

### B. Reconcile schema and migrate forward

The staging checksum matches the original organization migration at
`b8aea93b3ddc32acdb65fdcfcae578129ee7cb3f`. The deployed and candidate files
contain the same later substantive revision, adding 77 lines of organization
import/revision DDL and compatibility backfills. Staging has the three tables,
with 13/8/10 columns and 2/3/3 indexes respectively. Table presence leaves
constraint and backfill equivalence unproven. Staging lacks the HELD enum
value and the dispatch journal. Its outbox has 16 columns, five indexes and no
enabled custom triggers, while the delivery attempt table retains an enabled
custom trigger.

The release command now checks the exact candidate migration bytes against
the applied prefix before invoking Prisma. It rejected the observed staging
ledger and accepted a synthetic matching prefix with two pending migrations.
Track B validated the queue upgrade on the reviewed local baseline. To resolve
staging, first compare the catalog and aggregate organization backfill invariants
on a separately approved isolated restore. Record the provenance of the later
objects and prepare any required additive DDL or idempotent backfill with
checks for uniqueness, references, populated legacy fields, and lock duration.
Authorize and validate a migration-history reconciliation plan separately. Keep
the 68 historical files intact, preserve the four superseded attempts, and
avoid replay or ledger edits as a shortcut. Once parity is independently
resolved, apply the HELD enum migration first and let it commit before the
queue-contract migration adds fields, checks, triggers and the journal.
Keep old and new workers quiesced for the migration window under separate
approval. On failure, stop execution and preserve state. Application rollback
does not reverse schema or recover data.

### C. Protect operations and prove recovery

The inspection transaction was read-only. Its login can create databases and
roles, create in `public`, and owns 280 public tables. No direct memberships
were observed. PUBLIC has CONNECT in the inspected database, has no CREATE in
the public schema and has no observed table grants there. The web runtime,
release runner, and maintenance role bindings remain unverified. Confirm each
binding and its required grants before proposing changes. Move recurring
inspection to a dedicated role with only needed metadata access and no
ownership or create privileges. Separate migration ownership from runtime
privileges, and rehearse grant changes against the isolated copy before
authorizing a shared change.

Confirm available PITR timestamps, the authorized staging recovery point,
encrypted independent retention, recovery owner and acceptable RPO/RTO.
Render recovery creates a new instance and copies the source allowlist, so
resolve ingress first. Approve a staging-only restore with private access,
no web or worker binding, and restricted evidence retention. Validate the
restored catalog and ledger, run the guarded application checks, and record
measured recovery and data-loss windows. Keep the original instance in place.
[Render recovery](https://render.com/docs/postgresql-backups)

Verify secret presence and purpose without extracting values. Confirm the
approved provider and recipient policy, log redaction and retention, and a named
alert route. Review `/api/health/ready` as the Render HTTP check once health
behavior is verified and the path change is separately approved. Use
`/api/health/live` for process liveness and protected metrics for queue health.
Validate delivery and acknowledgement with a separately approved synthetic
alert.

### D. Control source publication and staging release

Bind the reviewed candidate SHA, compare it against the freshly verified
`dev` and `main` tips, and establish GitHub rules, required checks, hooks and
app-trigger behavior before publication. Render's observed `dev` web and cron
automatic deploy settings are off. That leaves GitHub and production triggers
unverified. Publication, integration into `dev`, the migration-bearing deploy,
cron changes and provider activation each require their own authorization.

For the approved release window, record the previous live web and cron
artifacts, verify backup and isolated-restore evidence, quiesce dispatch,
recheck the staging ledger and ingress, and deploy only the exact approved
candidate. Validate health, restricted role behavior, the new ledger,
immutable attempts, journal and audit, and a fictional multi-role smoke run.
Resume scheduled dispatch only after separately approved recipient/provider
checks. Stop on unexpected schema or role drift, failed readiness, unresolved
writes, protection loss, or unapproved provider activity. Use the previous web
artifact only after proving its schema compatibility. Route data recovery
through the isolated restore procedure.

## Mission 23 preflight and resume checkpoint

- **Ingress BLOCKED.** Read-only inspection reconfirmed the exact Oregon database
  and `0.0.0.0/0`. Five client sessions in the new sample used private-range
  addresses and the inspection login. The web and cron are in the same Render
  environment. The cron's configured path is an HTTP request to the web
  worker route. Its database behavior depends on the web runtime. Effective
  web and migration connection targets, and intermittent maintenance and backup
  requirements remain unverified. Dashboard sign-in is needed for the
  administrative path. Confirm these facts and a narrow rollback route before
  clearing the external list or applying verified CIDRs.
- **Restore BLOCKED.** The paid source is available. The documented PITR
  flow copies the source allowlist even when other settings are customized.
  Clear or restrict ingress first, then verify the exact available recovery
  point in the Dashboard. Confirm destination isolation from creation,
  approved cost and retention, and the read-only validation role before
  creating a single dedicated instance. Keep services, worker schedules,
  and external providers disconnected. Source availability does not establish
  a usable recovery timestamp. No instance was created.
- **Migration FAIL.** The fresh ledger still has 70 rows, including 66 finished
  in source order and four rolled back. The organization checksum still matches
  the original artifact. Staging still lacks the HELD enum and dispatch journal.
  The release guard now also catches completed rows out of order, using a single
  repeatable-read snapshot for the catalog and ledger. The original organization
  revision and later backfill remain subject to the Package B restore
  comparison before the release hook can proceed.
- **Operational preflight PASS in part.** Liveness and readiness returned 200,
  and anonymous metrics returned 401. The configured HTTP health path is blank.
  Render lists scheduled cron success, with delivery, alert routing and backup
  retention still unverified. The inspection login remains able to create
  databases and roles. No post-change verification was run.

Resume with the existing Mission 23 approvals once the required connectivity,
administrative and recovery facts are independently verified. The local
synthetic runner and protected Track B remain separate from this workflow.
