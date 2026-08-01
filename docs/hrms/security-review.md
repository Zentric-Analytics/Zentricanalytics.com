# HRMS security review

## Verified controls

- HRMS authentication is database-backed and separate from legacy recruitment administration.
- Login uses a generic response, dummy bcrypt verification, combined email/IP rate limiting, safe audit events, optional TOTP, and atomic TOTP replay rejection.
- Invitation/reset tokens are random, hashed at rest, expiring, single-use, and invalidated on replacement. Email links keep the credential in a URL fragment; a client redemption page removes it from history and POSTs it into a scoped HttpOnly, SameSite=Strict cookie.
- Sessions use random opaque tokens, hashed storage, expiry, rotation, revocation, HttpOnly/SameSite cookies, and Secure cookies in production builds.
- Password reset/change, suspension, emergency MFA reset, termination, and role changes revoke relevant sessions.
- Privileged staging/production accounts are redirected to MFA enrollment and denied protected API downloads/exports until MFA is active.
- Permanent roles remain ADMIN, HR_ADMIN, PAYROLL_ADMIN, and EMPLOYEE. Supervisor authority is effective-dated assignment capability, not a role.
- Server actions and route handlers enforce permissions, ownership, tenant scope, or constant-time internal bearer authentication.
- Sensitive fields are encrypted at rest and recursively redacted from HR audit metadata. Notifications contain safe references.
- Private downloads require clean scan state, ownership/permission, no-store, attachment disposition, MIME protection, and audit/access history.
- Security headers, safe health/readiness responses, protected metrics, worker secrets, preflight, backup, restore, and load tooling are present.

## Adversarial remediation

The final review added tests for payroll self-approval, privileged MFA policy, malicious MIME metadata, direct/team/department supervisor scope, credential-link transport, role-change session revocation, scanner callback replay, and guarded release configuration.

## Environment pending

Real provider behavior, private bucket policy, KMS/SSE enforcement, scanner authenticity, Render secret scoping, monitoring/alert routing, backup/PITR evidence, restore evidence, rate-limit behavior across multiple instances, and independent penetration testing require authorized staging. No production security claim is made.
