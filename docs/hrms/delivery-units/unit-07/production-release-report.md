# Unit 7 Production Release Report

Release date: 2026-08-13  
Scope: Unit 7 — Performance and Career Development  
Verdict: CONDITIONAL PASS — Unit 7 Production Ready and Operational

## Release identity

- Staging candidate: `affcb536ae628f919eb93a1c0f95642306670d94`
- Staging deployment: `dep-d9uv01942hec73fhst6g`
- Staging tag: `hrms-unit-07-v1.0.0`
- Pre-release `main`: `be43258e83ed226715bb28c0dea921b7ee98f0aa`
- Validated `dev`: `c57c21d7827b099fc3abea12a1c946f3c58f65ff`
- Production merge and deployed SHA: `b20fc7db0fd5338fb73dd4fe304e2438345736b6`
- Production deployment: `dep-d9uvte61egvs73e47ru0`
- Production tag: `hrms-unit-07-production-v1.0.0`

History was preserved with normal merge commits. No squash, rebase, force-push, or history rewrite was used.

## Release validation

- Automated suite: 721/721 tests passed across 66 files.
- TypeScript: passed.
- ESLint: passed with zero warnings.
- Prisma schema validation: passed.
- Production build: passed.
- Guarded pre-deploy command: `yarn hr:release` passed.
- Migrations: 43 recognized; the three reviewed additive Unit 7 migrations applied successfully; none pending and none rolled back.
- Production preflight: ready.
- Health and readiness endpoints: HTTP 200.
- Public website, Careers, applicant tracking, and Unit 7 status routes: HTTP 200.
- Worker authentication: unauthenticated Unit 7 worker request rejected with HTTP 401.
- Conservative load smoke: 50 requests, zero failures, p50 91.7 ms, p95 142.8 ms, maximum 199.3 ms.

## Integrity and operational evidence

Post-deployment read-only checks reported:

- email outbox pending: 0;
- email outbox failed: 0;
- orphan goal versions: 0;
- orphan performance evidence: 0;
- orphan performance feedback: 0;
- duplicate calibration decisions: 0;
- duplicate promotion decisions: 0;
- approved promotion cases missing workforce events: 0;
- Unit 7 audit events missing correlation IDs: 0.

The production database contained no Unit 7 performance goals before the release smoke, so no synthetic performance or career record was fabricated. Confidentiality, authorization, calibration separation, immutable recommendation, promotion exactly-once behavior, and Unit 4 effective-event integration remain supported by the exact deployed code and the validated staging/regression evidence.

## Recovery points

- Pre-release encrypted archive: correlation `d1836a805af9`, daily tier, 935,183 bytes, successful.
- Post-release encrypted archive: correlation `2ebf29c23b84`, daily tier, 1,047,796 bytes, successful.
- Production backup-readiness check: passed.

The governed archive workflow performs encrypted durable upload, checksum validation, retention classification, and plaintext cleanup. Existing isolated restore and disaster-recovery evidence remained current at release time.

## Monitoring and rollback

The deployment reached live state without migration, readiness, database, worker, outbox, or authorization failures. The previous known-good application SHA and pre-release encrypted archive were retained as rollback points. No rollback was required; additive migrations remain in place.

## Accepted operational exception

Automatic GoDaddy Advanced Email Security to Microsoft 365 Inbox placement remains unproven for all HRMS transactional email. SPF, DKIM, DMARC, sender registry, Resend acceptance, and message generation are verified, but GoDaddy can still produce a false-positive quarantine requiring the documented narrow operational release procedure. This exception does not authorize a broad allowlist or weakening of anti-spoofing, malware, or phishing controls.

Unit 7 email generation and outbox behavior passed, but the global email trust gate is not claimed as fully passed. Vendor remediation remains open and must be revalidated with one controlled message when GoDaddy supplies a narrow supported fix.

## Freeze

Unit 7 production behavior is frozen at `hrms-unit-07-production-v1.0.0`. Only release-blocking fixes may modify this baseline. Unit 8 must not begin until the owner separately authorizes it.
