# Production infrastructure remediation evidence — 2026-08-01

Scope was limited to the two explicitly approved paid changes. No web-service upgrade, Pro-4gb database, high availability, storage increase, R2 bucket, scanner worker, application deployment, or database migration was performed.

## Completed infrastructure changes

- PostgreSQL `dpg-d8s88jurnols738a7og0-a` resized from Basic-256mb to **Basic-1gb** (0.5 CPU, 1 GB RAM).
- Database storage remained **15 GB**; autoscaling and HA remained disabled.
- Database returned to Available after the Render-managed restart.
- Dedicated cron `zentric-hrms-database-backup` (`crn-d9n53dp42hec73etr2jg`) created on Starter compute.
- Cron source is `release/hrms-units-01-03-production` at `793c2888462454353f2e1d9bb251bce1b6244cd6`.
- Build succeeded. Schedule is `0 3 * * *` (03:00 UTC daily). Command is `yarn hr:database-archive`.
- Cron is connected to the production database using a masked Render secret. Policy values and a generated 32-byte archive encryption secret are stored in Render.

## Read-only migration validation

`npx prisma migrate status` connected successfully to production and reported the 22 additive HRMS migrations beginning with `20260729000000_hrms_secure_foundation` and ending with `20260731020000_hrms_recruitment_lifecycle` as pending. No migration was applied. This matches the frozen release audit.

## Production preflight

The release-branch preflight connected to production but correctly returned **not ready (19 blockers)**. The database is reachable, but HRMS migration tables and organization initialization are absent because the 22 migrations have not been authorized or deployed. Other blockers include production document storage/scanner configuration, release worker secrets, protected archive object storage, archive lock/evidence, current production-source restore evidence, and DR evidence.

Some application/email/auth findings are expected artifacts of running the preflight in the isolated cron environment instead of the not-yet-deployed web release. They must be rerun on the production web service after release secrets are configured and before migration authorization.

## Backup scheduling validation

A manual verification run executed the correct archive command and stopped before `pg_dump` with `BLOCKED Production archives require dedicated S3-compatible object storage configuration.` This proves the schedule, build, command, database secret linkage, and production safety guard. It does **not** prove a successful archive; protected object storage remains intentionally unprovisioned.

## Scanner memory decision

ClamAV's current official requirements report approximately 1.2 GiB for the loaded engine and approximately 2.4 GiB during concurrent database reload before file-scan overhead. ClamAV recommends at least 3 GiB and prefers 4 GiB for containers. Render Starter (512 MB) and Standard (2 GB) are below that envelope. The smallest Render background worker that meets it is **Pro, 4 GB RAM and 2 CPU, $85/month**. No worker was provisioned.

## Remaining blockers

- Approve and configure protected S3-compatible object storage before enabling successful production archive runs.
- Approve the Pro 4 GB malware-scanner worker only if ClamAV is the selected scanner architecture.
- Restrict production database ingress, configure production release secrets and health checks, and complete the isolated production-source restore/DR evidence.
- Obtain separate explicit authorization before applying the 22 migrations or deploying Units 1–3 to production.
