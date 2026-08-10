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
