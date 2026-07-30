# HRMS deployment and one-time initialization

HRMS database authentication is separate from legacy recruitment administration. Never reuse the legacy password or `ADMIN_PASSWORD_HASH`. There is no public HR registration or web bootstrap route.

## Deployment sequence

1. Install locked dependencies: `yarn install --frozen-lockfile`.
2. Run `yarn lint`, `yarn test`, dependency audit and `yarn build`.
3. Render runs `yarn hr:release` as the pre-deploy command. It validates non-secret configuration, applies additive migrations, checks initialization, optionally performs explicitly enabled one-time bootstrap, then runs read-only preflight.
4. Deploy/start the application with `yarn start`; migration/bootstrap logic is never part of recurring start.
5. On the first deployment only, enable the guarded bootstrap variables below before release.
6. Enable MFA for every privileged account.
7. Configure and schedule outbox, scanner and monitoring integrations.
8. Run `yarn hr:preflight` and `yarn hr:smoke`.

Render performs guarded migration/initialization/preflight through `preDeployCommand`. Bootstrap remains absent from build/start and runs only when no active ADMIN exists and `HR_BOOTSTRAP_ENABLED=true`.

## First initialization

1. Confirm the environment, private database and HTTPS application URL without printing credentials.
2. Run `yarn prisma migrate status` and `yarn prisma migrate deploy`.
3. Generate a strong temporary password in an approved password manager.
4. Run `yarn hr:hash-password` in a private terminal. It reads without echo; store only the bcrypt result in the secret manager.
5. Set `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD_HASH`, and `HR_BOOTSTRAP_CONFIRM_ENV` to the exact target environment.
6. Set `HR_BOOTSTRAP_ENABLED=true` and deploy once; `yarn hr:release` runs bootstrap only if initialization is absent.
7. Sign in immediately and enroll authenticator MFA. The one initial release reports this temporary enrollment gate explicitly.
8. Remove `HR_BOOTSTRAP_ENABLED`, bootstrap hash/email/confirmation, rotate the initial password under policy, and redeploy. Full preflight must now pass without an MFA exception.

The script refuses environment mismatch, plaintext/malformed hashes, fewer than 12 bcrypt rounds, an existing ADMIN assignment and conflicting accounts. An initialized environment returns without changes. Existing-account recovery uses password reset, never bootstrap.

Production uses separately generated credentials, production-only `AUTH_SECRET`, private S3-compatible storage, Resend, distinct internal endpoint secrets, managed backups/PITR and approved change control. Never copy staging secrets.

## Preflight

`yarn hr:preflight` is read-only. It checks:

- database connectivity and every milestone table;
- organization, exact roles/permissions and active ADMIN;
- environment/base URL and secret minimum lengths;
- S3-compatible private HR storage;
- email worker, scanner and monitoring secrets;
- privileged-account MFA;
- production email provider;
- backup retention, PITR and recent restore evidence.

Exit code 0 means the declared environment is ready. Output never includes secrets or database locations.

## Rollback

Back up before migration. Roll back application code first and leave additive tables/history intact. Never delete audit, payroll, workflow, document or identity history as a rollback shortcut. Use the disaster-recovery runbook for data restoration.
