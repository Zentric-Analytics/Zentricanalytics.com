# Unit 5 validation and release plan

Status: planned evidence; nothing in this document claims execution.

## Test matrix

| Layer | Mandatory coverage |
|---|---|
| Unit/property | policy precedence, eligibility, proration, rounding, schedule intervals, holidays, DST, leap/year boundaries, ledger algebra, reversals |
| Domain/state | every legal/illegal request, cancellation, long-absence and return transition; stale versions and separation of duties |
| PostgreSQL integration | constraints, ledger/projection reconciliation, effective-range overlap, tenant isolation, idempotency and lock ordering |
| Concurrency | competing approvals, approval/cancel, approval/adjustment/accrual/expiry, duplicate worker/decision, policy reassignment/accrual, return/workforce event, separation/future leave |
| Authorization/privacy | employee/manager/delegate/HR/admin/auditor matrix; UI and direct URL/API; protected fields/evidence; every cross-tenant path |
| Workers | restart, lease expiry, duplicate delivery, bounded replay, partial/terminal failure, dead-letter and recovery |
| Notification | every registered template, HR sender, HTTPS CTA, text fallback, idempotent outbox, provider failure; real staging mailbox where approved |
| Documents | clean/infected/pending, stale/duplicate callback, exact-version replacement, unauthorized read and retention metadata |
| Unit 4 integration | long absence approval, scheduled ON_LEAVE, conflict, return-to-work, exactly-once status/history |
| Migration | production-shaped restore, additive migration, backfill replay, reconciliation, old-app compatibility and forward-fix rehearsal |
| Browser E2E | coherent employee → manager → HR → worker lifecycle with accessible errors and field privacy |
| Load | preview/search/calendar/report and bounded worker batches with defined p95/error targets |
| Backup/restore | encrypted archive, isolated target, complete correlated chain, checksum/RPO/RTO and cleanup |

## Coherent staging lifecycle

1. Create/publish policy, schedule and holiday-calendar versions.
2. Assign an eligible active employee; create account/period and idempotent grant/accrual.
3. Employee previews annual leave across non-working/holiday time and submits with the expected chargeable segments.
4. Manager approves; reservation posts once. A concurrent competing approval loses safely.
5. Effective worker starts leave and converts reservation to consumption exactly once; completion reconciles.
6. Employee submits then cancels a second request; reservation and reversal reconcile.
7. HR posts a governed adjustment and reversal with reasons and independent audit.
8. Carryover/expiry workers run twice without duplicate accounting.
9. Employee submits a long-term absence with clean exact-version evidence; manager cannot view confidential content.
10. HR approval creates the linked Unit 4 leave event; effective worker transitions employee to `ON_LEAVE` once.
11. Return workflow creates/applies the Unit 4 return event and restores `ACTIVE` once.
12. Run tenant/privacy/direct-ID tests, concurrency/load, reconciliation and notification delivery.
13. Create encrypted backup, restore to isolated staging, verify the complete chain and delete the target.

## Release gates

- All owner decisions recorded and configuration seeded without country assumptions in core code.
- Additive migration review and production-shaped staging restore pass.
- Full automated suite, TypeScript, ESLint, Prisma validation and production build pass.
- Real PostgreSQL concurrency/idempotency gates pass with exactly one authoritative result.
- Browser lifecycle, tenant isolation, authorization and field privacy pass.
- Workers, retry/dead-letter, notifications and exact-version evidence pass.
- Reconciliation reports zero unexplained differences, duplicates and orphans.
- Health/readiness, safe load, encrypted backup and isolated restore pass.
- Deployment, rollback/forward-fix, monitoring and operations documentation are complete.
- Accepted GoDaddy deliverability exception is explicitly resolved or reaccepted for the Unit 5 release.

Only after these gates may Unit 5 receive a staging production-readiness verdict. This blueprint is not that verdict.

