# Unit 6 validation and release plan

No test below is claimed executed during blueprinting.

## Automated matrix

| Gate | Required coverage |
|---|---|
| Policy | precedence, ambiguity fail-closed, effective dates, assignment/workforce changes, tenant boundaries |
| Schedule/shift | weekly, flex, split, overnight, rotation, part-time, breaks, holidays, publish/version/history, overlap exclusion |
| Timezone | IANA validation, UTC/local snapshots, both DST transitions, midnight, leap day, zone change/travel |
| Capture | clock order, duplicate/idempotent receipt, missed punch, offline replay/skew, kiosk scope, timesheet versions |
| Attendance | normal, late/early, absence, leave/holiday, under-time, overtime candidate, break exceptions, reproducible recalculation |
| Unit 4/5 | hire/transfer/location/manager/leave/return/separation/rehire boundaries; partial/full/retroactive leave |
| Governance | correction lineage, separation of duties, delegation, stale versions, period lock, post-lock adjustment/export |
| Security/privacy | employee/manager/HR/admin/auditor/payroll matrix, server direct requests, field redaction, tenant isolation, location retention |
| Operations | worker retry/replay/dead letter, outbox idempotency, reconciliation, metrics, safe load, backup/restore |

Use real PostgreSQL for duplicate clock-in/out, approval/edit/withdrawal, schedule/event, leave/classification, lock/correction/export, worker replay, and separation/open-timesheet races. Require exactly one authoritative result, deterministic loser, zero relevant duplicates/orphans, and complete correlated audit.

## Full staging E2E

`active employee → effective policy → published schedule/shift → normal day → applicable capture mode → interpretation → Unit 5 leave overlap → correction → independent manager approval → authoritative time → period lock → payroll handoff contract → Unit 4 transfer/schedule change → long-term leave → return → separation → no future obligation → encrypted archive → isolated restore`

Run employee, manager, HR, auditor, and future payroll-reader browser journeys. Verify UI hiding and server authorization. Use recipient-backed notifications; do not infer delivery from queue state alone when actual staging delivery is supported.

## Recovery correlation

Restore a fresh encrypted staging archive to an isolated temporary database and verify:

`Person → Work Relationship → Assignment → Time Policy/Version → Schedule/Shift Version → Raw Event → Attendance Interpretation → Correction → Approval → Authoritative Entry → Period Lock → Audit`

Also verify Unit 5 leave and Unit 4 workforce-event references, notification/outbox, job runs, exact migration count, RPO/RTO, checksums, zero relevant duplicates/orphans, plaintext cleanup, and deletion of the temporary target.

## Production-readiness gates

- Owner decisions approved and threat/privacy review complete.
- Additive migrations reviewed against a production-source isolated restore.
- Complete suite, TypeScript, ESLint zero warnings, Prisma validation, build, migration ordering, preflight, health/readiness pass.
- Real PostgreSQL concurrency, browser E2E, tenant/privacy/authorization, worker recovery, load, and encrypted restore pass.
- No critical/high defect; no unresolved payroll-authoritative mismatch.
- Capacity profile demonstrates the production worker architecture is sufficient or an explicit smallest-cost change is approved.
- Accepted GoDaddy delivery exception is resolved or formally reaccepted for the Unit 6 release.

Only a separately authorized production release may deploy Unit 6. Blueprint completion is not production readiness.
