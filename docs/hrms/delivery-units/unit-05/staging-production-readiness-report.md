# Unit 5 staging production-readiness report

Verdict: **PASS — Unit 5 Production Ready**

Production was not accessed or modified during Unit 5 implementation or validation.

## Final staging evidence

- Database: `zentric_analytics_staging`; 39 migrations applied, none pending.
- Automated validation: 616/616 tests pass; TypeScript, ESLint, Prisma validation, and the production build pass.
- Health: live, ready, and HRMS preflight pass.
- Browser lifecycle: employee request, manager approval, reservation, start, consumption, completion, governed cancellation/reversal, HR adjustment, long-term absence, Unit 4 `ON_LEAVE`/return-to-work events, and final `ACTIVE` state pass.
- Privacy: employee, manager, HR, auditor, and cross-tenant server-side boundaries pass.
- Notifications: recipient-backed request, review, approval, rejection, cancellation, and upcoming-leave deliveries pass with idempotent outbox evidence.
- PostgreSQL concurrency: approval/cancellation, approval/adjustment, accrual/approval, carryover-expiry/approval, duplicate worker replay, and long-absence workforce-event races pass with exactly-once or stale-version losing behavior.
- Safe load: 250 requests, zero failures, p95 300.9 ms.

## Encrypted restore correlation

- Archive correlation: `c41f55510b8a`.
- Archive creation: `2026-08-11T12:15:09.614Z`; encrypted size 850,438 bytes; daily retention tier; checksum verified before restore.
- Restore target: temporary Render PostgreSQL `dpg-d9th09pt0dsc73b9opt0-a`, Basic-256MB, 1 GB storage, HA and autoscaling disabled.
- Restore: started `2026-08-11T12:15:27.844Z`, completed `2026-08-11T12:15:39.998Z`; restore execution time 12.15 seconds; archive RPO at restore start 18.23 seconds.
- Correlation: 39 migrations, policies/accounts/ledger/request versions/transitions, a completed long-term absence linked to both Unit 4 workforce events, notifications/outbox, document metadata, and audit history were present.
- Representative long-absence correlation: `be490802-968a-4bc4-b52d-feeffdde9d7a`; 14 correlated audit events.
- Integrity: zero orphan request versions, segments, transitions, ledger entries, long-absence requests, start events, or return events; zero duplicate ledger idempotency keys, request versions, or long-absence correlations.
- Cleanup: temporary plaintext dump removal verified; temporary Render database deleted after evidence capture and absent from the staging project inventory.

## Defects corrected during the final gates

- PostgreSQL serializable conflicts surfaced by raw statements as Prisma `P2010` with SQLSTATE `40001`; retry classification now recognizes both this form and `P2034`.
- Restore-target guard now admits only the existing isolated Unit 4 convention or the Unit 5 isolated naming convention; arbitrary databases remain rejected.

No unresolved critical or high-severity Unit 5 defect remains.
