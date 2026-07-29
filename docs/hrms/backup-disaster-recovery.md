# Backup and disaster recovery

## Policy

- Use provider-managed encrypted PostgreSQL backups with point-in-time recovery.
- Retain recoverable backups for at least 30 days.
- Keep object storage private, encrypted, versioned and lifecycle-protected.
- Store database and object-storage credentials only in the platform secret manager.
- Set target RPO/RTO with the business owner; recommended starting targets are RPO 15 minutes and RTO 4 hours.
- Run and record an isolated restore drill at least quarterly.

`yarn hr:backup-readiness` validates declared provider, retention, PITR and restore-test evidence without printing credentials.

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
