# Unit 7 staging production-readiness report

## Final verdict

**PASS — Unit 7 Production Ready.** This is a staging-only verdict. Unit 7 was not deployed to production and Unit 8 was not started.

## Candidate and release gates

- Branch: `feature/hrms-unit-07-performance-career-blueprint`.
- Validated event: `WFE-2026-5B0A5F70`; promotion case `cmsr89lq001dkqe2x7mxbcci6`; correlation `34701d91-20d4-4c4e-aeeb-9107030e5797`.
- Database: 43 migrations applied; none pending in staging or the isolated restore.
- Automated validation: 721 tests across 66 files passed. TypeScript, ESLint with zero warnings, Prisma validation, and production build passed.
- Real PostgreSQL concurrency: 16 races passed with 16 correlated audit records under `unit7-concurrency-1786631174407`.
- Load smoke: 250 requests at concurrency 15, zero failures, p50 200.1 ms, p95 696.0 ms.
- Health, readiness, and staging preflight passed.

## Durable encrypted archive

- New correlation: `779a86473028`; the prior instance-local archive was not reused.
- Durable object: `database-archives/daily/2026/hrms-db-20260813T155415Z-779a86473028.dump.enc`.
- Encrypted bytes: 1,292,027.
- SHA-256: `bab418524fd7823b9adf17d13b3377890414145c987ebd6c568444c19f11e0c`.
- Archive created: `2026-08-13T15:54:15.879Z`.
- Archive and manifest were verified in durable S3-compatible staging storage and retrieved from a replacement web instance with no matching local file.
- Remote checksum/metadata verification passed; local partial and plaintext artifact counts were zero.

## Isolated restore correlation

- First target `dpg-d9uude142hec73fgg0b0-a` (PostgreSQL 16) failed closed because the PostgreSQL 18 archive contained `transaction_timeout`; plaintext cleanup passed and the target was deleted.
- Successful target: `dpg-d9uuk0nlk1mc73emnnhg-a`, PostgreSQL 18, Basic-256 MB, 1 GB, non-HA.
- Restore started: `2026-08-13T16:04:07.191Z`; completed: `2026-08-13T16:04:21.894Z`.
- RTO: 14.703 seconds. Observed archive-to-restore-start RPO window: 9 minutes 51.312 seconds.
- Person `cmsqmowqz0001t14pm9q3onle`; work relationship `cmsqmowr80005t14pitb3y3pp`; previous assignment `cmsqmowrf0007t14pkmcqmkbz`; replacement assignment `cmsrgv17f04tnsv2w6e70zbqu`.
- Exactly one promotion decision, one Unit 4 promotion event, one completed application attempt, one active final assignment, and no assignment overlap were present.
- Goals 4, evidence 3, feedback 1, review submissions 2, development plans 4, assignments 2, correlated audits 12, and promotion outbox records 4 survived intact.
- Duplicate promotion decisions: 0; duplicate workforce events: 0; assignment overlaps: 0; relevant orphan links: 0.
- Original manager recommendation remained immutable. The calibrated outcome remained in its separate field even where calibration affirmed the manager rating. Employee-facing rationale did not contain the private calibration rationale.
- Notification/outbox lineage and audit correlation were verified.

## Defects corrected

- Added S3-compatible checksum configuration and phase-safe archive diagnostics.
- Scoped VersionId retrieval to native AWS S3 while retaining unique archive keys and checksum verification for the approved R2-compatible store.
- Added a guarded, repeatable Unit 7 restore validator with regression coverage.
- Corrected validator assumptions for affirmed calibration outcomes, employee-facing process wording, application-time assignment boundaries, and promotion/outbox correlation.

## Cleanup

- Temporary plaintext restore artifacts were removed after each attempt.
- `RESTORE_DATABASE_URL` was removed from Render staging configuration.
- Both temporary database targets were deleted; neither appears in the staging project, so ongoing temporary restore cost returned to zero.
- Production was not accessed or modified.

## Release boundary

Separate owner authorization is required before any Unit 7 production release.
