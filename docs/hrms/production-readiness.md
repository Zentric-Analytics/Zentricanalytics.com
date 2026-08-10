# Production readiness

Production release is a controlled operation, not an automatic consequence of merging code. Do not deploy until every item below has named evidence and approval.

## Release gate

1. Review and merge the stacked milestone pull requests in order.
2. Run `yarn install --frozen-lockfile`, `yarn lint`, `yarn test`, `yarn build`, `yarn audit --groups dependencies --level high`, and `git diff --check`.
3. Apply migrations to an isolated staging database with `prisma migrate deploy`.
4. Configure secrets from `.env.staging.example` in the hosting secret manager. Never paste them into issues, PRs, logs or chat.
5. Run `yarn hr:preflight`. It must report ready.
6. Enable MFA for every active `ADMIN`, `HR_ADMIN`, and `PAYROLL_ADMIN`.
7. Configure an approved malware scanner callback to `POST /api/internal/hr/document-scan`.
8. Schedule `POST /api/internal/hr/outbox` at least once per minute with its bearer secret.
9. Connect monitoring to `/api/health/live`, `/api/health/ready`, and the protected `/api/internal/hr/metrics`.
10. Run `yarn hr:smoke`, the authorization/IDOR test matrix, accessibility review, and `yarn hr:load-smoke` against non-production.
11. Verify Render's seven-day PITR, the independent 90-day daily/365-day weekly/15-year monthly archive tiers, a quarterly isolated restore drill (`BACKUP_LAST_RESTORE_TEST_AT`) and an annual DR exercise (`BACKUP_LAST_DR_EXERCISE_AT`).
12. Obtain HR, payroll, security and operations sign-off before production migration.

## Runtime security

Privileged accounts require authenticator MFA. Login uses a uniform error, dummy bcrypt work for unknown users, credential/IP rate limiting and audited failures. TOTP secrets are AES-256-GCM encrypted under `AUTH_SECRET`.

Internal endpoints use separate 32-character-or-longer bearer secrets and constant-time comparison. Rotate each independently. Public health responses contain no secrets, hostnames, versions or database identifiers.

Security headers include HSTS, frame denial, MIME protection, strict referrer policy, permissions policy, same-origin opener/resource policy and a restrictive CSP. Next currently needs inline bootstrap/style support; this is explicitly constrained to same-origin resources and should be migrated to per-request nonces when the hosting layer supports them.

## Known external evidence

The repository supplies automated security regression tests and a penetration-test plan. A qualified independent penetration test, provider backup evidence, actual restore timestamps, production object-storage credentials and live alert validation cannot be manufactured in source control. They are mandatory operator-supplied release evidence.
