# Hiring Phase 2 backend foundation

This branch targets staging only: https://staging.zentricanalytics.com. Do not merge or deploy to production until the staged workflow is tested and approved.

## Required staging environment variables

- `DATABASE_URL`: PostgreSQL connection string used by Prisma.
- `NEXT_PUBLIC_SITE_URL`: `https://staging.zentricanalytics.com` for links in email messages.
- `ADMIN_SESSION_SECRET`: long random value required as `?adminSecret=...` for the temporary admin dashboard protection layer.
- `EMAIL_PROVIDER`: defaults to `console`; production provider integration can be added later without changing callers.
- `PRIVATE_UPLOAD_ROOT`: private filesystem path for local fallback uploads, for example `/var/data/zentric-private-uploads`. Files are not stored under `public/` and are not directly downloadable.
- `UPLOAD_MAX_BYTES`: Stage 1 applicant upload limit in bytes. Use `20971520` for the required 20MB maximum.

## Staging commands

Run these on Render/staging after dependencies can be installed:

```bash
yarn install
npx prisma generate
npx prisma migrate deploy
yarn lint
yarn test
yarn build
```

## Known limitations

- Email delivery is provider-abstracted but currently console-mode unless a real provider is added.
- The admin protection layer is intentionally simple and environment-secret based for staging; replace with real admin authentication before production.
- Uploaded CVs are stored privately and only metadata is shown; no public CV download route is implemented.
