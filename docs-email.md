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

## Production hardening environment variables

Admin access no longer uses URL query-string secrets. Configure:

- `ADMIN_EMAIL` — the admin login email.
- `ADMIN_PASSWORD_HASH` — PBKDF2 hash, never a plaintext password.
- `ADMIN_SESSION_SECRET` — at least 32 random characters for signed httpOnly admin sessions.

Generate a password hash locally with this shell-safe command. The plaintext password is used only as the command argument and later in the admin login form; do not store the plaintext password in Render:

```bash
node -e "const crypto=require('crypto');const p=process.argv[1];const d=String.fromCharCode(36);const s=crypto.randomBytes(16).toString('hex');const i=310000;const h=crypto.pbkdf2Sync(p,s,i,32,'sha256').toString('hex');console.log(['pbkdf2_sha256',i,s,h].join(d));" "YOUR_NEW_ADMIN_PASSWORD"
```

Copy only the generated output beginning with `pbkdf2_sha256$...` into the Render `ADMIN_PASSWORD_HASH` value field. Do not paste `ADMIN_PASSWORD_HASH=` into the value field, and do not wrap any Render admin environment values in single or double quotes. Redeploy or restart the staging service after changing `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, or `ADMIN_SESSION_SECRET`.

Failed admin login attempts write safe boolean diagnostics to server logs so staging can distinguish email mismatch, malformed hash, password mismatch, and session-secret configuration without logging submitted emails, plaintext passwords, password hashes, salts, session secrets, or session tokens.

Private upload storage:

- `PRIVATE_UPLOAD_ROOT` — staging/local private filesystem root. Do not point this at `public/`.
- Render staging must mount a persistent private disk at `/var/data` and use `PRIVATE_UPLOAD_ROOT=/var/data/zentric-private-uploads`; local `.private-uploads` is only for development.
- `PRIVATE_OBJECT_STORAGE_PROVIDER` — defaults to `local-private`. Non-local private object storage is intentionally a production placeholder in this build; if set without an adapter, uploads fail closed instead of becoming public.
- `UPLOAD_MAX_BYTES` — optional override; default remains 20MB.

Rate limiting:

- `RATE_LIMIT_SALT` — optional salt for hashed rate-limit keys. If omitted, the admin session secret is used where available.
