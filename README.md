# Zentric Analytics website

This repository contains the public Zentric Analytics website, recruitment portal, legacy recruitment administration, and the separate internal HRMS.

## HRMS deployment

HRMS uses database-backed credentials that are separate from legacy recruitment authentication. A new environment must apply Prisma migrations and run the one-time guarded bootstrap before anyone can sign in:

```text
yarn prisma migrate deploy
yarn hr:bootstrap
yarn hr:preflight
```

Bootstrap requires `DATABASE_URL`, `APP_ENV`, `BOOTSTRAP_ADMIN_EMAIL`, a bcrypt `BOOTSTRAP_ADMIN_PASSWORD_HASH`, and—for staging/production—`HR_BOOTSTRAP_CONFIRM_ENV` matching `APP_ENV`. Never use a plaintext password, commit credentials, reuse the legacy recruitment admin password automatically, or add bootstrap to the recurring start command.

Generate the hash in a private interactive terminal with `yarn hr:hash-password`; password input is hidden and is never accepted as a command argument.

See [HRMS deployment](docs/hrms/deployment.md) for safe staging recovery, first-time production initialization, verification, secret rotation, and one-off Render execution.

See [Core HR](docs/hrms/core-hr.md) for the normalized employee model, organization structure, effective-dated assignment history, protected-data authorization, and Milestone 2 migration notes.
