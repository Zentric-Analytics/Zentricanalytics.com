# Unit 3 production deployment runbook

## Release identity and authorization boundary

- Release convention: `hrms-unit-<two-digit-unit>-v<semver>`.
- Unit 3 release tag: `hrms-unit-03-v1.0.0`.
- Approved feature baseline: `c522e02cee50d876d6b63761ce9606aa2c593626`.
- Unit 3 feature development is frozen. Changes after approval require a documented release-blocking defect, regression coverage and staging revalidation.
- **Do not connect to, migrate, deploy or modify production until the change owner gives explicit production authorization.** Approval of this runbook or tag is not deployment authorization.

## Required production configuration

All secret values must be independently generated for production and stored in the platform secret manager. Never copy staging values or print them in logs, tickets or chat.

### Application, identity and database

- `APP_ENV=production`
- `DATABASE_URL`: TLS-required private production PostgreSQL connection
- `APPLICATION_BASE_URL` and `NEXT_PUBLIC_SITE_URL`: approved HTTPS production origin
- `AUTH_SECRET`: production-only random secret of at least 32 characters
- `AUTH_SESSION_TTL`: approved session lifetime
- `RATE_LIMIT_SALT`: production-only random value
- First initialization only: `HR_BOOTSTRAP_ENABLED=true`, `HR_BOOTSTRAP_CONFIRM_ENV=production`, `BOOTSTRAP_ADMIN_EMAIL`, and a bcrypt `BOOTSTRAP_ADMIN_PASSWORD_HASH` with at least 12 rounds. Remove all bootstrap variables immediately after the first administrator enrolls MFA.
- Legacy recruitment secrets, if that interface remains enabled: production-only `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, and `ADMIN_SESSION_SECRET`; do not reuse HR credentials.

### Email and domain

- `EMAIL_PROVIDER=resend`, production `RESEND_API_KEY`, and the intent-based sender variables `EMAIL_FROM_CAREERS`, `EMAIL_FROM_OFFERS`, `EMAIL_FROM_HR`, and `EMAIL_FROM_ACCOUNTS`.
- Configure Reply-To independently with `EMAIL_REPLY_TO_CAREERS`, `EMAIL_REPLY_TO_OFFERS`, `EMAIL_REPLY_TO_HR`, and `EMAIL_REPLY_TO_ACCOUNTS`; use the support mailbox for account-security replies where appropriate.
- Every registered template must map to one sender category. Unknown or unmapped templates fail closed and must not be retried until configuration or code is corrected.
- Verify the sending domain with the provider. Publish and validate SPF and DKIM; publish a DMARC policy with monitored aggregate reporting before enforcement is increased.
- Configure a custom return-path/bounce domain where supported, provider webhooks, suppression handling and operational ownership for bounces/complaints.
- Confirm all CTA origins are the HTTPS production origin and send the registered template set to approved test mailboxes before opening access.

### Internal workers and monitoring secrets

- Independent random secrets of at least 64 characters: `EMAIL_WORKER_SECRET`, `ORGANIZATION_WORKER_SECRET`, `DOCUMENT_SCANNER_SECRET`, and `MONITORING_SECRET`.
- `yarn start` launches the web service and invokes the outbox and governed recruitment-activation endpoints. Defaults are a 10-second initial delay and 30-second interval; set `HR_WORKER_INITIAL_DELAY_MS` and `HR_WORKER_INTERVAL_MS` only after capacity review.
- Connect the authenticated document-scanner callback to a real malware-scanning provider. Human-authorized scan simulation is forbidden in production.
- Alert on worker invocation failure, abandoned mail, oldest pending mail over ten minutes, activation backlog, scans pending over fifteen minutes and sustained workflow/lifecycle overdue counts.

### Private object storage

- `OBJECT_STORAGE_PROVIDER=s3-compatible`
- HTTPS `OBJECT_STORAGE_ENDPOINT`, private `OBJECT_STORAGE_BUCKET`, correct `OBJECT_STORAGE_REGION`, bucket-scoped `OBJECT_STORAGE_ACCESS_KEY_ID` and `OBJECT_STORAGE_SECRET_ACCESS_KEY`
- `OBJECT_STORAGE_FORCE_PATH_STYLE` set for the provider
- `OBJECT_STORAGE_SERVER_SIDE_ENCRYPTION=AES256` or a stronger approved KMS policy
- Deny public access, require TLS, enable object versioning, encryption, access logging and lifecycle/retention protection. Application credentials must have only required object permissions.
- Set `UPLOAD_MAX_BYTES` to the approved limit. Do not use `local-private`, `PRIVATE_UPLOAD_ROOT` or ephemeral service disks for production HR documents.

### Backup and disaster recovery

- `DATABASE_BACKUP_PROVIDER=render-postgresql-plus-protected-logical-archives`
- `DATABASE_PITR_ENABLED=true` and `DATABASE_PITR_RETENTION_DAYS=7` for the supported Render PITR window
- `DATABASE_DAILY_BACKUP_RETENTION_DAYS=90` with successful daily encrypted logical-archive jobs and manifests
- `DATABASE_WEEKLY_BACKUP_RETENTION_DAYS=365` with successful protected weekly archive promotion
- `DATABASE_MONTHLY_ARCHIVE_RETENTION_YEARS=15` with successful protected monthly archive promotion
- `BACKUP_LAST_RESTORE_TEST_AT`: ISO timestamp from the latest successful isolated restore, no older than 90 days
- `BACKUP_LAST_DR_EXERCISE_AT`: ISO timestamp from the latest successful disaster-recovery exercise, no older than one year
- Encrypted, versioned object-storage recovery aligned with HR retention obligations
- Isolated restore drills quarterly; full disaster-recovery exercises annually. Record recovery point, duration, RPO/RTO, validation, reviewer and cleanup.

### Monitoring and ownership

- Poll `/api/health/live` and `/api/health/ready`; protect `/api/internal/hr/metrics` with `MONITORING_SECRET`.
- Route readiness, error-rate, latency, database saturation, worker backlog/failure, authentication anomaly, storage/scanner and backup alerts to named on-call owners.
- Keep logs free of tokens, credentials, salaries, identity data, document content and raw workflow payloads.
- Confirm incident commander, security/privacy escalation, provider escalation and rollback decision owners before deployment.

## Migrations and pre-deployment gates

1. Record explicit production authorization, release tag, operator, window and rollback owner.
2. Confirm the production target by service, database host/name and account without exposing secrets.
3. Verify current PITR and backup schedules; record a fresh recovery point and representative row counts.
4. Restore the latest recovery point into an isolated target and complete the quarterly drill if current evidence is missing or older than 90 days.
5. Check out the annotated release tag and verify its target and annotation. Install with `yarn install --frozen-lockfile`.
6. Run `yarn test`, `yarn lint`, `yarn tsc --noEmit`, `yarn prisma validate`, dependency/security review and `yarn build`.
7. Run `yarn prisma migrate status`. Review all pending SQL. Unit 3 migrations are additive; do not manually edit migration history.
8. Configure production secrets, domain, storage, workers, monitoring and backup evidence. Run `yarn hr:preflight`; it must report ready.
9. During the approved window run `yarn hr:release`. This applies migrations with `prisma migrate deploy`, performs only the guarded one-time bootstrap when explicitly enabled, and reruns preflight.
10. Start with `yarn start`, confirm one healthy instance, then scale according to the approved capacity plan.

## Immediate post-deployment smoke tests

Stop promotion on any failure.

1. Verify the deployed tag/commit, TLS certificate, HTTPS redirects and production security headers.
2. Run `yarn hr:preflight` and `yarn hr:smoke`; verify live, ready and HR login endpoints.
3. Sign in with two approved HR test users, verify MFA, role separation, tenant isolation and the accessible 403 experience.
4. Create a clearly identified production smoke vacancy only if the authorization explicitly permits transactional smoke data. Exercise approval/publish and archive it under policy.
5. Verify one approved email smoke through outbox, provider delivery, HTTPS CTA and audit. Do not send to unapproved recipients.
6. Upload a harmless approved test document; verify private access, scanner completion, authorized download, version replacement and denial without authorization.
7. Confirm outbox and activation workers process one idempotent test job and create no duplicate records.
8. Query representative application, handover, employee, onboarding and audit records read-only; verify links and immutable history.
9. Confirm dashboards, metrics, logs and alerts are receiving data without sensitive payloads.
10. Record results, operator, timestamps and correlation IDs in the change record.

## 24–48 hour monitoring checklist

- At deployment, +15 minutes, +1 hour, +4 hours, +24 hours and +48 hours review liveness/readiness, HTTP 5xx/4xx changes, p50/p95 latency, CPU/memory, connection-pool pressure and database locks.
- Review failed logins, MFA failures, password-reset/invitation failures and authorization-denial anomalies against baseline.
- Review outbox pending age, retry counts, abandoned records, duplicate provider IDs, bounce/complaint/suppression signals and domain reputation.
- Review activation backlog/idempotency, onboarding generation, employee-number uniqueness, workflow overdue counts and orphan/duplicate integrity queries.
- Review private-object access failures, scanner backlog, storage errors, version conflicts and audit completeness.
- Verify backup jobs and PITR continuity after deployment; confirm no lifecycle policy or credential change weakened retention.
- Obtain HR, security and operations sign-off at 24 and 48 hours. Keep enhanced monitoring open if any trend lacks a stable baseline.

## Rollback

1. Declare the rollback, stop further releases and preserve application, provider and audit logs.
2. Disable transactional smoke activity and nonessential worker invocation if it is worsening impact; do not delete queued or audit records.
3. Redeploy the last known-good application artifact/commit first. Unit 3 migrations are additive, so leave new tables, enum values and immutable history in place.
4. Run readiness and read-only integrity checks. Resume workers only after secrets, database and provider connectivity are confirmed.
5. If data integrity is compromised, freeze writes and restore into an isolated target from the last trustworthy PITR point. Validate before any promotion; never restore directly over production without incident-command and data-owner approval.
6. Never delete or rewrite audit, offer, approval, payroll, workflow, document-version or identity history as a rollback shortcut.
7. Rotate only affected credentials, revoke affected sessions, document impact and run the complete smoke suite before reopening.

## Non-blocking operational risks

- Staging load evidence used 100 requests at concurrency 10; production scaling and connection-pool limits still require observation under real traffic.
- External email placement is provider and recipient dependent; some staging mail initially reached junk, so DMARC progression and reputation monitoring remain operational work.
- Render's native recovery window is seven days. The required 90-day, one-year and 15-year tiers therefore depend on the separately scheduled Render logical-archive worker, protected archive disk, monitoring and periodic restore validation.
- The in-process worker scheduler is governed and recovered successfully in staging, but separate worker services may be preferable if web scaling or provider latency grows materially.
