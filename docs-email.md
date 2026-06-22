# Hiring email delivery

The hiring portal sends applicant notifications through `src/lib/email.ts`.

## Environment variables

- `EMAIL_PROVIDER`: `console` for local/dev fallback or `resend` for real delivery.
- `RESEND_API_KEY`: Resend server-side API key. Required only when `EMAIL_PROVIDER=resend` and never exposed to the client.
- `EMAIL_FROM`: Verified sender address configured in Resend.
- `APP_BASE_URL`: Public base URL for applicant-facing links.

## Staging on Render

Set these Render environment variables on the staging/dev service only:

```bash
EMAIL_PROVIDER=resend
RESEND_API_KEY=<Render secret value>
EMAIL_FROM=careers@zentricanalytics.com
APP_BASE_URL=https://staging.zentricanalytics.com
NEXT_PUBLIC_SITE_URL=https://staging.zentricanalytics.com
```

Do not prefix `RESEND_API_KEY` with `NEXT_PUBLIC_`. The app reads it only in server actions. If the key is missing, the send attempt is recorded as failed without showing provider details to applicants.
