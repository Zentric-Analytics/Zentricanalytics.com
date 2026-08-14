# Unit 8 final staging validation report

Status: **PASS — Unit 8 Production Ready**

## Candidate and environment

- Branch: `dev`
- Validated application SHA: `0d9f0e2a19ee094c5eab332b20977160f6b631c7`
- Staging deployment: `dep-d9vgp7942hec73918hmg`
- Database: `zentric_analytics_staging`
- Migrations: 51 applied, none pending
- Production: untouched

## Automated release evidence

- Automated tests: 771/771 passing across 69 files
- TypeScript: PASS
- ESLint: PASS with zero warnings
- Prisma validation: PASS
- Production build: PASS (121 routes)
- Staging preflight and health/readiness: PASS

## PostgreSQL concurrency and integrity

The final real-PostgreSQL concurrency gate passed with run correlation `unit8-concurrency-1786709498799`. All 16 race scenarios produced exactly one valid result and safe losing behavior, 16 correlated audit evidence objects, and the expected durable reservation of 8000.

The read-only integrity gate passed with zero orphan compensation records, invalid current-record pointers, authoritative overlaps, broken correction lineage, orphan or duplicate payroll handoffs, duplicate recommendation decisions, missing fixture audits, failed compensation outbox records, or invalid budget ledgers. Ten budgets reconciled.

## Notifications and workers

- Exactly one `hr-compensation-effective` outbox record was observed in `DELIVERED` state.
- Authenticated worker execution, unauthenticated rejection, dead-letter recovery, and replay idempotency passed.
- This evidence proves provider/outbox processing only; it does not claim final mailbox Inbox placement.

## Field-level privacy

The live browser and direct-route matrix passed for employee self-service, effective direct-report manager scope, HR administration, Compensation Administrator, Budget Owner, Payroll Reader, and Auditor. Denied requests returned 403 or privacy-safe 404, contained no sensitive partial payload, and exposed no unauthorized mutation controls. Payroll Reader was limited to effective payroll-authoritative fields; Auditor received correlation metadata with amounts and deliberations redacted. All temporary elevated roles were restored to their original assignments with correlated immutable audit evidence.

## Load

Safe staging load passed: 250 requests at concurrency 15, zero failures, p50 181.0 ms, p95 587.6 ms.

## Encrypted durable archive

- Correlation: `ba3853c31247`
- Durable object: `database-archives/daily/2026/hrms-db-20260814T121232Z-ba3853c31247.dump.enc`
- SHA-256: `731185aab706e9cf4be1320436a2d7e50aa89358a85c185b1f57cc423b6e7b27`
- Bytes: 1,484,132
- Remote verification: `2026-08-14T12:12:36.184Z`
- Remote object version: `7e5fffcfc50723b4ef14bcc60e37db6a`
- Plaintext or partial artifacts after upload: zero

## Isolated restore correlation

- Temporary target: `dpg-d9vgine1egvs73e6t4l0-a` / `zentric_unit8_restore`
- Plan: Basic-256 MB, 1 GB, non-HA
- Restore start: `2026-08-14T12:32:31.397Z`
- Restore completion: `2026-08-14T12:32:53.696Z`
- RTO: 22.299 seconds
- RPO at exercise start: 19 minutes 58.423 seconds from archive creation
- Migrations: 51 completed; none pending; Prisma schema up to date
- Duplicate/orphan/overlap/correction/payroll-handoff/promotion-input/audit/privacy failures: zero
- Budget reconciliation: 10 inspected; zero invalid ledgers
- Representative restored counts: 3 markets, 3 bands, 3 policies, 18 recommendations, 3 calibrations, 3 exceptions, 15 decisions, 7 authoritative records, 1 correction, 5 rewards, 10 payroll handoffs, 1,171 audit events
- Statements: the approved archive contained zero statement rows; the table and references restored successfully with zero orphan statement references
- Candidate recovery reconciliation: 132 stale built-in-role grants removed deterministically with immutable audit evidence; privacy violations after reconciliation: zero
- Plaintext restore artifact and temporary evidence file: removed
- Temporary connection secret: unset from the staging shell
- Target deletion: verified; target ID and name absent from the Render project; ongoing temporary resource count and cost: zero

## Defects corrected

- Serialized compensation-cycle and budget reservation races.
- Revalidated cycle, work-relationship, separation, and Unit 7 promotion state under database locks.
- Added the immutable promotion-decision database guard and read-only integrity gate.
- Aligned persisted database, static application, and bootstrap role grants to least privilege.
- Restored all temporary staging roles after privacy validation.
- Corrected the restore validator's statement-document join to `HrEmployeeDocumentVersion` and added regression coverage.
- Added guarded, audit-producing canonical built-in-role reconciliation to release and isolated-recovery paths.

## Final verdict

**PASS — Unit 8 Production Ready**

Production was not accessed or modified. Unit 9 was not started. A separate owner authorization is required before any Unit 8 production release.
