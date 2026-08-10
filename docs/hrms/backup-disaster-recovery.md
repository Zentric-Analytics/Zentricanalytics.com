# Backup and disaster recovery

## Policy

- Keep the application, PostgreSQL database, scheduled backup jobs and recovery tooling on Render.
- Enable Render-managed PostgreSQL point-in-time recovery and retain the supported seven-day window.
- Retain daily backups for at least 90 days, weekly backups for one year, and monthly archives for 15 years. Archive retention must be protected from ordinary application and operator deletion.
- Keep object storage private, encrypted, versioned and lifecycle-protected.
- Store database and object-storage credentials only in the platform secret manager.
- Set target RPO/RTO with the business owner; recommended starting targets are RPO 15 minutes and RTO 4 hours.
- Run and record an isolated restore drill at least quarterly and a full disaster-recovery exercise at least annually.

Render's seven-day PITR and short-lived logical exports do not by themselves satisfy the long-term tiers. Run `yarn hr:database-archive` daily from a Render Cron Job. The command creates a PostgreSQL custom-format dump, encrypts it with AES-256-GCM before upload, emits a SHA-256 manifest, classifies Sunday and first-of-month recovery points, and uploads both objects through an S3-compatible endpoint. Configure separate bucket-scoped credentials and bucket-lock prefixes for the 90-day daily, 365-day weekly and 15-year monthly tiers. Alert on missed jobs, invalid manifests or restore failures. A Render cron service has a minimum monthly charge and must not be provisioned without explicit approval.

`yarn hr:backup-readiness` independently validates the declared seven-day PITR window, 90-day daily tier, 365-day weekly tier, 15-year monthly tier, quarterly restore evidence and annual disaster-recovery evidence without printing credentials. Environment declarations are readiness inputs, not proof that provider jobs ran; retain Render job/deploy identifiers, archive manifests, checksums and restore correlations as operational evidence.

## Restore drill

1. Create a new isolated database from a backup/PITR timestamp. Never restore over staging or production.
2. Give the verification service a distinct URL containing `restore`, no public DNS, no email delivery and no production object-storage write access.
3. Set `APP_ENV=staging` and `DR_RESTORE_CONFIRM=isolated-restore`.
4. Run `yarn hr:restore-drill`. It performs read-only connectivity and foundation/history counts.
5. Apply pending migrations only after the raw restore has been verified.
6. Run preflight and smoke tests, sample immutable audit/payroll/workflow history, and verify private-object checksums from a controlled sample.
7. Delete the isolated restore under change control and record duration, timestamp, source recovery point, result and reviewer.

## Incident recovery

Freeze writes, preserve logs, identify the last trustworthy recovery point, rotate compromised credentials, restore into isolation, validate, then promote under incident-command approval. Do not silently repair immutable audit, payroll, workflow or document history. Record every exceptional remediation with reason and reviewer.
