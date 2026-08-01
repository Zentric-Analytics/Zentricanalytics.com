# Security model

HRMS uses deny-by-default server authorization. UI visibility is convenience only. Session cookies are HTTP-only, `Secure` in production, `SameSite=Lax`, available to the `/hr` UI and `/api/hr` protected routes, and backed by revocable hashed database tokens. Active portal sessions rotate every 30 minutes without extending their absolute expiry. Suspended users and expired/revoked sessions fail immediately.

Passwords use bcrypt with a work factor of 12. Invitation and reset tokens are random, single-use, time-limited, and stored only as SHA-256 hashes. Login errors are generic, unknown users receive dummy bcrypt work, and attempts are database-rate-limited and audited without passwords or tokens. Authenticator TOTP is available to all users and mandatory for privileged production readiness; secrets are AES-256-GCM encrypted under `AUTH_SECRET`.

Sensitive changes use server actions, origin validation, Zod validation, Prisma transactions, and immutable audit events. Audit payload sanitization masks password, token, bank, salary, and identity fields. URL identifiers never establish authority.

Threat priorities are credential stuffing, session theft, IDOR, privilege escalation, supervisor-scope escape, CSRF, injection, unsafe upload/download, outbox leakage, and audit tampering. Internal workers, scanner callbacks and monitoring use separate constant-time-checked bearer secrets. Provider-managed KMS/HSM custody for application encryption keys and an independent authorized penetration test remain deployment controls outside this repository.

Environment initialization is a guarded one-time operation, not application startup behavior. Non-development bootstrap requires `HR_BOOTSTRAP_CONFIRM_ENV` to match `APP_ENV`, never overwrites an account or password, and refuses to run after an ADMIN assignment exists. HRMS and legacy recruitment credentials remain intentionally separate.
