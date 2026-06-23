# Hiring Phase 2 backend foundation

This branch targets staging only: https://staging.zentricanalytics.com. Do not merge or deploy to production until the staged workflow is tested and approved.

## Required staging environment variables

- `DATABASE_URL`: PostgreSQL connection string used by Prisma.
- `NEXT_PUBLIC_SITE_URL`: `https://staging.zentricanalytics.com` for links in email messages.
- `ADMIN_SESSION_SECRET`: long random value required as `?adminSecret=...` for the temporary admin dashboard protection layer.
- `EMAIL_PROVIDER`: defaults to `console`; production provider integration can be added later without changing callers.
- `APP_ENV`: set to `staging` on the Render staging service so production-like storage checks are active before launch.
- `PRIVATE_OBJECT_STORAGE_PROVIDER`: set to `local-private` only when the host has persistent private disk. Do not set this to a public/static upload path.
- `PRIVATE_UPLOAD_ROOT`: private filesystem path on a persistent Render disk, currently `/var/data/zentric-private-uploads` when the disk is mounted at `/var/data`. Files are not stored under `public/` and are not directly downloadable.
- `UPLOAD_MAX_BYTES`: Stage 1 applicant upload limit in bytes. Use `20971520` for the required 20MB maximum.

## Private upload storage on Render staging

Staging is deployed on Render. Because applicant uploads must survive redeploys and instance restarts, the web service must have a persistent disk mounted at `/var/data`; the included `render.yaml` documents the expected disk and environment variable values. On Render, create or verify a private persistent disk before redeploying, then set:

```bash
APP_ENV=staging
PRIVATE_OBJECT_STORAGE_PROVIDER=local-private
PRIVATE_UPLOAD_ROOT=/var/data/zentric-private-uploads
UPLOAD_MAX_BYTES=20971520
```

The app keeps the safety check that blocks uploads when `PRIVATE_UPLOAD_ROOT` is missing in staging/production. During upload, it creates the configured private directory if needed, verifies it is readable and writable by the app process, writes the file, checks the saved byte count, and only then creates `UploadedDocument` metadata.

If a future staging or production deployment is moved to serverless hosting or any platform without persistent private disk, do not use `.private-uploads` or any other local ephemeral directory. Instead, add a private object-storage adapter such as S3, Cloudflare R2, or Supabase Storage, keep the bucket private, store only private storage keys in the database, and keep admin view/download behind the protected admin upload API route.

After redeploy, verify Stage 1 CV upload, Stage 2 government ID/photo upload, Stage 3 assessment upload, admin View/Download controls, and the missing-file warning by temporarily checking an orphaned upload record or removed file in a non-production test record.

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
- Uploaded files are stored privately; admin view/download is served only through the protected admin upload API route.
