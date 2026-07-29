# Zentric Analytics website

Zentric Analytics is a Next.js App Router website with public consultancy pages and a server-rendered recruitment workflow for candidates and administrators.

## Runtime

- Node.js 20 or newer
- PostgreSQL
- npm (the validation commands below use npm)

## Installation

1. Copy `.env.example` to `.env.local` and provide values appropriate for your environment.
2. Install dependencies with `npm install`.
3. Apply the Prisma schema using the database workflow approved for the target environment.

Never commit `.env`, `.env.local`, credentials, access tokens, or private uploads.

## Local development

```bash
npm run dev
```

The application is served at `http://localhost:3000` by default.

## Quality checks

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
```

The production build generates the Prisma client before compiling Next.js. Inter and Manrope are loaded through `next/font`; the build environment therefore needs outbound access to Google Fonts.

## Environment variables

The application recognizes these names. See `.env.example` for non-secret examples and operational comments.

- `DATABASE_URL`
- `APP_BASE_URL`
- `NEXT_PUBLIC_SITE_URL`
- `EMAIL_PROVIDER`
- `EMAIL_FROM`
- `RESEND_API_KEY`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`
- `PRIVATE_OBJECT_STORAGE_PROVIDER`
- `PRIVATE_UPLOAD_ROOT`
- `UPLOAD_MAX_BYTES`
- `ACCESS_CODE_REQUEST_LIMIT`
- `ACCESS_CODE_VERIFY_LIMIT`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_SALT`
- `APP_ENV`
- `VERCEL_ENV`

`NODE_ENV` is supplied by the runtime. Production secrets must be managed by the deployment platform, not stored in source control.

## Deployment overview

Build with `npm run build`, run database migrations through the deployment process, mount or configure private upload storage, and start with `npm start`. Configure a durable, shared rate-limit store before horizontally scaling the application. Confirm email delivery, database backups, private-file retention, TLS termination, and monitoring with the infrastructure owner before launch.

The included `render.yaml` describes the staging service and its private disk. Production values must be supplied through the hosting platform.

## Project structure

- `src/app`: App Router pages, layouts, server actions, and route handlers
- `src/components`: shared presentation and interaction components
- `src/hooks`: reusable client hooks
- `src/lib`: authentication, validation, email, storage, security, and workflow utilities
- `prisma`: database schema
- `tests`: Vitest regression tests
- `public`: approved public assets
- `docs`: phase and operational documentation

## Maintenance notes

- Keep server-only secrets out of client components and `NEXT_PUBLIC_` variables.
- Keep candidate uploads outside `public/`; storage adapters must fail closed when private storage is unavailable.
- Preserve validation and authorization in server actions and route handlers.
- Review security headers when adding third-party scripts or embeds. A Content Security Policy requires an explicit inventory of those origins and a deployment-specific nonce or hash strategy.
- The in-process rate limiter is suitable only for a single instance; multi-instance production requires shared infrastructure.
- The contact form is deliberately fail-closed until a production CRM or contact backend is selected.
- Generated build, coverage, browser-test, and Lighthouse directories remain ignored.
