# Security model

HRMS uses deny-by-default server authorization. UI visibility is convenience only. Session cookies are HTTP-only, `Secure` in production, `SameSite=Lax`, path-scoped, and backed by revocable hashed database tokens. Suspended users and expired/revoked sessions fail immediately.

Passwords use bcrypt with a configurable work factor. Invitation and reset tokens are random, single-use, time-limited, and stored only as SHA-256 hashes. Login errors are generic and attempts are rate limited and audited without passwords or tokens.

Sensitive changes use server actions, origin validation, Zod validation, Prisma transactions, and immutable audit events. Audit payload sanitization masks password, token, bank, salary, and identity fields. URL identifiers never establish authority.

Threat priorities: credential stuffing, session theft, IDOR, privilege escalation, supervisor-scope escape, CSRF, injection, unsafe upload/download, outbox leakage, and audit tampering. Remaining Milestone 1 limitations: MFA, malware scanning, KMS-backed field encryption, distributed rate limiting, and worker infrastructure are production-hardening milestones.
