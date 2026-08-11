# Unit 6 staging validation evidence

Status: in progress. This record does not declare Unit 6 production ready.

## Candidate

- Branch: `feature/hrms-unit-06-time-attendance-blueprint`
- Candidate: `fcaa7535b478b0d9d60e75e86bce20d854971f8a`
- Render deployment: `dep-d9tk5f2d0e5s739d5ptg`
- Database: `zentric_analytics_staging` on the recorded staging host
- Migrations: 40 applied, none pending
- Production: untouched

## Defects corrected

1. The Unit 6 migration was committed with a UTF-8 BOM. PostgreSQL rejected byte one before executing any migration statement. The failed staging attempt was marked rolled back, the BOM was removed, and a regression assertion now rejects BOM-prefixed migration SQL.
2. The first concurrency fixture used `WEB` instead of the canonical `EMPLOYEE_WEB` event-source enum. Both candidate inserts failed before reaching the intended uniqueness race. The fixture was corrected without weakening the application constraints, and a regression assertion protects the canonical source.

## Executed evidence

- Guarded release applied `20260811160000_hrms_unit6_time_attendance_foundation`; a subsequent release no-op confirmed no pending migration.
- Automated: 660/660 pass. TypeScript and ESLint zero warnings pass. Prisma validation and production build passed on the deployed implementation milestone.
- PostgreSQL concurrency run `unit6-concurrency-1786463096829`:
  - duplicate event capture: one durable winner from two simultaneous attempts;
  - competing open sessions: one durable open session;
  - correction decision: one winner and one stale loser;
  - period lock: claims `[1, 0]`;
  - worker lease: claims `[1, 0]`, attempt count 1.
- Governed browser policy `UNIT6_BROWSER_1786463274315`: one published CLOCK version.
- Governed weekly period `cmsou42aw0037qt2c9doqmkuh`: `OPEN v1 -> SUBMITTED v2 -> APPROVED v3 -> LOCKED v4`, with a non-empty lock hash.
- Period audit correlation `ad701459-eea0-4360-a413-a1df2a0e00c4` contains created, submitted, approved, and locked actions in order.
- Internal worker endpoint: unauthenticated POST returned 401; authenticated invocation returned 200 and skipped the already-successful window without duplicate processing.
- Integrity: zero orphan events, duplicate open sessions, duplicate event idempotency keys, orphan authoritative entries, and duplicate worker runs.
- Safe load: 250 readiness requests at concurrency 10, zero failures, p50 92.3 ms, p95 253.6 ms.
- Backup-readiness preflight: pass; provider and credential values remained hidden.

## Remaining mandatory gates

- Employee, manager, HR, auditor, and payroll-reader browser/privacy matrix, including direct-record denial.
- Recipient-backed time notifications with delivery, retry, and duplicate-delivery evidence.
- Worker temporary/permanent failure and dead-letter recovery evidence.
- Full Unit 4/5 boundary lifecycle with time interpretation and corrections.
- Fresh encrypted staging archive, isolated restore correlation, RPO/RTO, plaintext cleanup, and temporary-target deletion.

Only after every remaining gate passes may the verdict become `PASS — Unit 6 Production Ready`.
