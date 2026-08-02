# Unit 3 staging validation report

## Approval

- Verdict: **PASS — Production Ready**
- Approved feature commit: `c522e02cee50d876d6b63761ce9606aa2c593626`
- Staging deployment: `dep-d9n1tkrncjis7399uif0`
- Staging database: `zentric_analytics_staging`
- Production access or modification: none
- Feature-development state: frozen; only release-blocking fixes are permitted after approval

## Final evidence

- Automated suite: 430 tests passed in 43 files.
- TypeScript, ESLint, Prisma validation and optimized production build passed.
- Staging preflight and `/api/health/live`, `/api/health/ready`, and `/hr/login` smoke checks passed.
- Load smoke: 100 requests, concurrency 10, zero failures, p50 133.7 ms, p95 445.6 ms.
- Complete browser lifecycle passed from vacancy through offer, handover, pre-hire, onboarding, activation, automatic account provisioning, MFA and first login.
- Registered HR email templates were validated for branding, personalization, CTA, HTTPS links, plain text and outbox/audit integrity; real staging delivery was exercised.
- Worker restart, duplicate, temporary/permanent failure, retry and dead-letter recovery passed.
- Private storage authorization, replacement history and exact-version verification passed.
- The isolated PITR restore drill was accepted as the staging restore gate and was not invalidated by the subsequent code-only deployment.

## Evidence correlations

- PostgreSQL concurrency: `unit3-concurrency-1785601236713`
- Exact document-version conflict: `unit3-document-conflict-1785601957307`

The concurrency run produced exactly one winner and one rejected request for offer acceptance, handover creation, pre-hire conversion, employee-number/onboarding generation, and manual-versus-scheduled activation. It produced no duplicates or orphans and retained exact audit evidence.

In the document conflict run, version 1 remained `REPLACEMENT_REQUESTED`, its stale decision was rejected, version 2 required a new HR decision and became `VERIFIED`, both private objects remained preserved, and audit records identified the exact document IDs and versions.

Do not store credentials, mailbox contents, applicant documents, access tokens, database URLs or other personal data in this report.


## Production-integration candidate revalidation (2026-08-02)

- Integration commit: `ffb98c461a0ed043c0ce3b88c8b7af2416744e3f`
- Staging deployment: `dep-d9nhjdh42hec73fl2i6g` (`live`)
- Release pre-deploy confirmed `zentric_analytics_staging`; production was not deployed, migrated, or modified.
- Regression suite: 46 files, 444 tests passed. TypeScript, ESLint, Prisma validation, and optimized production build passed.
- Health smoke passed for live, ready, and HR login endpoints.
- Safe staging load: 250 requests, concurrency 15, zero failures, p50 185.8 ms, p95 405.5 ms.
- Authorization boundaries: unauthenticated admin access redirected (`307`); scanner and metrics endpoints rejected missing credentials (`401`).
- PostgreSQL concurrency correlation: `unit3-concurrency-1785666275910`; every governed race produced one winner, one rejected loser, one durable record, and audit evidence.
- Exact document-review correlation: `unit3-document-conflict-1785666236888`; stale version-1 review was rejected, version 2 required a new decision, both objects remained preserved, and exact-version audits were recorded.
- Browser storage validation: restricted PDF upload entered `PENDING` quarantine with no download link; version 1 became downloadable only after a clean result. Replacement version 2 independently entered `PENDING`; version 1 remained available; version 2 became downloadable only after its own clean result.
- Release-blocking storage defect corrected: generic S3-compatible providers no longer receive unsupported `VersionId` parameters for head, get, or delete. AWS S3 continues to use immutable provider version IDs. Regression coverage is included in the 444-test total.

The real AWS GuardDuty clean and infected-object scans, EventBridge retry/DLQ behavior, encrypted archive upload, immutable lock metadata, checksum verification, and isolated production-source restore were validated separately during production-infrastructure remediation. End-to-end delivery from AWS into the production scanner callback remains a post-deployment smoke gate because production application code and schema are intentionally not deployed yet; AWS events must not be redirected into the staging database.
