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

## Render staging environment checklist

Configure these values in the Render secret/environment manager before `yarn hr:release`:

- `OBJECT_STORAGE_PROVIDER=s3-compatible`
- `OBJECT_STORAGE_ENDPOINT`: an HTTPS AWS S3 or S3-compatible endpoint, without embedded credentials, query parameters, or fragments
- `OBJECT_STORAGE_BUCKET`: the private HR document bucket
- `OBJECT_STORAGE_REGION`: the provider region, or `auto` where the provider requires it
- `OBJECT_STORAGE_ACCESS_KEY_ID`: a credential scoped to the private bucket
- `OBJECT_STORAGE_SECRET_ACCESS_KEY`: the corresponding secret
- `OBJECT_STORAGE_FORCE_PATH_STYLE`: exactly `true` or `false`, according to the provider
- `OBJECT_STORAGE_SERVER_SIDE_ENCRYPTION=AES256` when supported by the provider
- `EMAIL_WORKER_SECRET`: an independent 64-character hexadecimal value
- `DOCUMENT_SCANNER_SECRET`: a different independent 64-character hexadecimal value
- `MONITORING_SECRET`: a third independent 64-character hexadecimal value

Generate each internal secret separately and save each output directly in the secret manager:

```sh
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32
```

Do not reuse outputs, place them in `render.yaml`, or expose them in logs. The bucket must remain private. HR document access continues through authenticated application routes; the application does not require a public object URL.

`local-private` (and the legacy `local` alias) is accepted only for development/test. Staging and production fail closed unless `s3-compatible` is fully and validly configured. HTTP object endpoints are accepted only for localhost development/test services such as MinIO.

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

## Operations handbook

Use the [Operations Handbook index](operations-handbook-index.md) for the complete Unit 1–3 production runbook set (deployment, email, storage, workers, backup, DR, monitoring, and security).
