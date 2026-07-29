# Deployment

Apply `prisma migrate deploy` before starting the application. Run the one-time ADMIN bootstrap with configured email and password hash; it is idempotent and never prints credentials. Do not run public seed users.

Required: `DATABASE_URL`, `APPLICATION_BASE_URL`, `AUTH_SECRET`, session TTL, bootstrap variables, email variables, worker secrets, upload limit, and `APP_ENV`. S3-compatible storage variables are mandatory before production documents are enabled.

Rollback is application-first: deploy the prior application while leaving additive HR tables intact. The Milestone 1 migration is additive and does not alter recruitment data. Back up PostgreSQL before migration and verify restore procedures.

Do not deploy this feature branch directly to production. Review migrations, configure secrets, bootstrap once, run smoke tests, and enable workers separately.
