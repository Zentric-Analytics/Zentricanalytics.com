# Security and penetration test plan

Run against an isolated staging copy with synthetic data and explicit authorization.

## Automated baseline

- authentication, invitation, reset, session and MFA tests;
- role and granular-permission matrices;
- direct-object-reference tests across employee, leave, payslip, document, asset, lifecycle, workflow and report IDs;
- supervisor exact-assignment and effective-date tests;
- CSRF/origin, rate-limit and generic-error tests;
- upload MIME/signature, path, size, quarantine and private-download tests;
- CSV formula injection and audit/outbox redaction tests;
- transaction race tests for leave, payroll, asset and approval state changes;
- immutable database-trigger and migration tests;
- dependency audit, lint, build and secret scan.

## Independent penetration scope

Test OWASP ASVS-aligned authentication/session handling, privilege escalation, tenant escape, IDOR, injection, stored/reflected XSS, CSRF, SSRF, file upload/download, business-logic races, MFA bypass, password reset/invitation replay, internal-endpoint authentication, information leakage and denial-of-service controls.

The tester must receive no production credentials or real employee data. Findings need severity, evidence, affected route, reproduction, business impact and remediation verification. Critical/high findings block production; accepted residual risk requires named executive and security approval.
