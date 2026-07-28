# Zentric Analytics

Production website and secure hiring workflow for Zentric Analytics, built with the Next.js App Router, React, TypeScript, Tailwind CSS, Prisma, PostgreSQL, and Vitest.

## Requirements

- Node.js 20 or newer
- npm 10+ (or Yarn 1.22, as used by the Render blueprint)
- PostgreSQL

## Local setup

1. Copy `.env.example` to `.env.local` and replace every example credential.
2. Install dependencies with `npm install`.
3. Apply migrations with `npx prisma migrate dev`.
4. Start the application with `npm run dev`.

Never commit `.env`, `.env.local`, database credentials, API keys, session secrets, uploaded candidate documents, or generated private files.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma. |
| `APP_BASE_URL` | Yes | Public origin used in server-generated links. |
| `ADMIN_SESSION_SECRET` | Yes | Long, random signing secret for admin sessions. |
| `ADMIN_EMAIL` | Yes | Admin login identifier. |
| `ADMIN_PASSWORD_HASH` | Yes | PBKDF2 password hash; never use a plaintext password. |
| `EMAIL_PROVIDER` | Yes | `console` for local development or `resend` in production. |
| `EMAIL_FROM` | Yes | Verified sender address. |
| `RESEND_API_KEY` | With Resend | Server-only Resend credential. |
| `PRIVATE_UPLOAD_ROOT` | Yes | Absolute path on persistent, private storage. Must not be under `public/`. |
| `PRIVATE_OBJECT_STORAGE_PROVIDER` | Yes | Currently `local-private`. |
| `UPLOAD_MAX_BYTES` | No | Upload ceiling; defaults to 20 MiB. |
| `ACCESS_CODE_REQUEST_LIMIT` | No | Request limit per rate-limit window. |
| `ACCESS_CODE_VERIFY_LIMIT` | No | Verification limit per rate-limit window. |
| `RATE_LIMIT_WINDOW_MS` | No | Rate-limit window duration. |

## Development workflow

Run all release gates before opening a pull request:

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
```

Schema changes require a checked-in Prisma migration. Keep pages as Server Components unless browser APIs, state, or event handlers require a Client Component. Add tests for hiring workflow or authentication changes.

## Project structure

- `src/app` — App Router pages, layouts, route handlers, server actions, metadata routes, and error boundaries.
- `src/components` — shared presentation and interaction components.
- `src/hooks` — reusable client-side hooks.
- `src/lib` — server services, validation, security, storage, email, and workflow logic.
- `prisma` — database schema and migrations.
- `public` — publicly cacheable static assets only.
- `tests` — Vitest regression and workflow tests.
- `docs` — phase-specific engineering and design audits.

## Production deployment

1. Provision PostgreSQL and persistent private storage.
2. Configure production secrets in the deployment platform; do not copy placeholder values from example files.
3. Set `EMAIL_PROVIDER=resend`, provide a verified sender and `RESEND_API_KEY`, and set `APP_BASE_URL` to the canonical HTTPS origin.
4. Run `npx prisma migrate deploy` as a release step.
5. Build with `npm run build` and start with `npm start`.
6. Verify `/robots.txt`, `/sitemap.xml`, security headers, email delivery, private upload persistence, admin authentication, and candidate tracking in a staging smoke test.
7. Connect platform logs and error events to the organization’s monitoring and alerting provider.

The included `render.yaml` is a staging baseline. Production should use managed secrets, backups, health monitoring, TLS, and a persistent disk or private object store sized for retention requirements.
