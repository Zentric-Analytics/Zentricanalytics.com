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

See [Leave Management](docs/hrms/leave-management.md) for versioned policies, ledger-backed balances, accrual/carry-over, approval workflows, private attachments, and Milestone 3 deployment guidance.

See [Payroll](docs/hrms/payroll-model.md) for effective-dated salary history, Decimal calculations, controlled runs, private payslips, corrections, and secure exports.

See [Documents and Assets](docs/hrms/documents-assets.md) for private versioned records, quarantine/access logging, retention, inventory, custody, acknowledgements, and returns.

See [Onboarding and Offboarding](docs/hrms/onboarding-offboarding.md) for immutable checklist templates, dependency-aware tasks, provisioning, exit controls, reminders, and account closure.

See the [Generic Workflow Engine](docs/hrms/workflow-engine.md) for reusable conditional, parallel, quorum and multi-stage approvals.

See [Reports and Analytics](docs/hrms/reports-analytics.md) for tenant-scoped dashboards, HR metrics, hiring, leave, payroll, asset, turnover and audit exports.
