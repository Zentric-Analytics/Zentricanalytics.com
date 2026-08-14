# Unit 8 final staging validation report

Status: **IN PROGRESS — isolated restore remains**

## Candidate and environment

- Branch: `dev`
- Validated application SHA: `9f6f926167b929842141637a1ecf00c1b3ee1291`
- Staging deployment: `dep-d9vfvbbl550s738hf780`
- Database: `zentric_analytics_staging`
- Migrations: 51 applied, none pending
- Production: untouched

## Automated release evidence

- Automated tests: 770/770 passing across 69 files
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

## Defects corrected

- Serialized compensation-cycle and budget reservation races.
- Revalidated cycle, work-relationship, separation, and Unit 7 promotion state under database locks.
- Added the immutable promotion-decision database guard and read-only integrity gate.
- Aligned persisted database, static application, and bootstrap role grants to least privilege.
- Restored all temporary staging roles after privacy validation.

## Mandatory gate still open

Restore archive `ba3853c31247` into the smallest owner-approved temporary non-HA Render PostgreSQL target, verify all 51 migrations and the complete Unit 8 lineage, record RPO/RTO and correlation evidence, remove plaintext artifacts and temporary secrets, then delete the target and verify ongoing temporary cost returns to zero.

No Unit 8 production-readiness PASS is asserted until that gate succeeds.
