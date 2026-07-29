# HRMS deployment and one-time initialization

HRMS database authentication is separate from the legacy recruitment admin login. Never reuse the legacy recruitment password or `ADMIN_PASSWORD_HASH` automatically. There is no public HR registration and no web-based bootstrap route.

## Normal deployment sequence

1. Install locked dependencies: `yarn install --frozen-lockfile`.
2. Generate Prisma Client: `yarn prisma generate`.
3. Apply additive migrations: `yarn prisma migrate deploy`.
4. Deploy/start the application.
5. On the first deployment of an environment only, run the bootstrap procedure below as a one-off job.
6. Run `yarn hr:preflight`.
7. Smoke-test HR login and confirm legacy recruitment login still works.

Render applies migrations through `preDeployCommand`. Bootstrap is deliberately not a build, start, or recurring command. Use a Render Shell or one-off job connected to the intended service. The preflight is intentionally run after first-time bootstrap; before bootstrap it returns non-zero and clearly reports the missing ADMIN.

## Recovery when bootstrap was skipped

The staging symptom is a reachable `/hr/login` with no valid HR account. The login page may show the generic message “HR access has not yet been activated.” This discloses no counts, emails, roles, or database details.

The current repository workspace has no staging database or Render credentials, so staging initialization must be performed by an authorized deployer:

1. In the staging service, verify `APP_ENV=staging`, `APPLICATION_BASE_URL=https://staging.zentricanalytics.com`, and that `DATABASE_URL` is the staging database. Do not print the URL.
2. Run `yarn prisma migrate status` and `yarn prisma migrate deploy`. Confirm `20260729000000_hrms_secure_foundation` is applied.
3. Generate a strong temporary password in an approved password manager. Do not place it in shell history or deployment logs.
4. In a private local terminal run `yarn hr:hash-password`. It reads the password without echo and refuses command arguments. Store only the resulting bcrypt hash in the staging secret manager; do not paste the plaintext into a command or deployment log.
5. Configure staging-only secrets `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD_HASH`, and `HR_BOOTSTRAP_CONFIRM_ENV=staging`. Ensure `APP_ENV=staging`.
6. Run the one-off command `yarn hr:bootstrap`.
7. Expect a safe `created` result. The output shows only the target environment and never the email, password, hash, secrets, or database location.
8. Run `yarn hr:preflight`; it must return exit code 0.
9. Sign in at `/hr/login`, confirm the account is active and has ADMIN access, then confirm `/admin/login` still authenticates independently.
10. Remove `BOOTSTRAP_ADMIN_PASSWORD_HASH` and `HR_BOOTSTRAP_CONFIRM_ENV` after initialization. Retain or rotate the bootstrap email according to operational policy. Store the actual password only in the approved password manager and rotate it after first login if policy requires.

Do not execute these staging steps against production.

## First-time production initialization

Repeat the same sequence with a separately generated credential, `APP_ENV=production`, `HR_BOOTSTRAP_CONFIRM_ENV=production`, the production service’s private database connection, HTTPS `APPLICATION_BASE_URL`, production `AUTH_SECRET`, private S3-compatible HR storage, email worker secret, and approved change control. Never copy staging bootstrap secrets into production.

The script refuses a confirmation mismatch, plaintext/malformed bcrypt hashes, hashes below 12 rounds, missing environment/database settings, existing ADMIN assignments, and conflicting existing accounts. If an ADMIN already exists, it returns `already initialized` and changes nothing. It never replaces an existing password hash. Recovery of an existing account uses the password-reset workflow, not bootstrap.

## Read-only preflight

Run `yarn hr:preflight` after migration and initialization and during release verification. It performs no writes and reports:

- database connectivity and HR table availability;
- organization, role, permission, and active ADMIN initialization;
- HR authentication configuration;
- application URL/environment agreement;
- production storage safety;
- email delivery mode and outbox-worker configuration.

Exit code 0 means ready. Any blocking issue returns non-zero. Output never includes secrets or database locations.

## Rollback

The HR migration is additive. Roll back application code first and leave HR tables intact. Back up PostgreSQL before migration, validate restore procedures, and never delete audit/session/identity history as a rollback shortcut.
