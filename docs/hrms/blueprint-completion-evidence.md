# HRMS blueprint completion evidence

This document maps the master blueprint's Milestones 2–9 to reviewable source and verification evidence. It does not claim that staging or production is ready: environment evidence remains a separate, operator-authorized gate.

| Milestone | Implemented evidence | Automated evidence | Pull request |
| --- | --- | --- | --- |
| 2 — Employee Core | `HrEmployee`, contacts, addresses, emergency contacts, identifiers, tax profile, departments, teams, positions, status history, generated employee-number sequence, effective-dated employment/supervisor assignments, full authorized admin profile | `tests/hrms-core-hr.test.ts`, `tests/hrms-blueprint-completion.test.ts` | #397, #405 |
| 3 — Leave | Versioned types/policies, employee policy assignments, balances, immutable ledger, requests, attachments, scoped supervisor and HR decisions, calendar, accrual/carry-over | `tests/hrms-leave.test.ts` | #398, #405 |
| 4 — Payroll | Effective-dated salary/components, Decimal calculations, versioned periods/runs, immutable lines, review/approval/locking, adjustments, payment state, payslips, authorized bank schedule | `tests/hrms-payroll.test.ts`, `tests/hrms-blueprint-completion.test.ts` | #399, #405 |
| 5 — Documents and Assets | Private-object boundary, versioning, scan quarantine, access history, expiry, retention metadata, inventory, assignment/acknowledgement/return history | `tests/hrms-documents-assets.test.ts` | #400 |
| 6 — Onboarding and Offboarding | Immutable template versions, dependent tasks, role ownership, reminders, evidence, explicit payroll/leave/email exit controls, access/session revocation, asset-return gate, archival | `tests/hrms-lifecycle.test.ts`, `tests/hrms-blueprint-completion.test.ts` | #401, #405 |
| 7 — Workflow Engine | Versioned definitions, serial/parallel/conditional stages, ANY/ALL/QUORUM decisions, explicit assignees/permissions/supervisors, immutable approvals with complete actor/request/status/correlation context, future delegation fields | `tests/hrms-workflow.test.ts`, `tests/hrms-blueprint-completion.test.ts` | #402, #405 |
| 8 — Reports and Analytics | Permission-scoped dashboards and server-side audited CSV exports for employees, departments, supervisors, headcount, turnover, recruitment, leave, payroll, payslips, assets, offboarding, audit, and separately authorized banking | `tests/hrms-reports.test.ts`, `tests/hrms-blueprint-completion.test.ts` | #403, #405 |
| 9 — Production Hardening | MFA/replay controls, worker endpoints, health/metrics, security headers, storage scanning boundary, operational indexes, preflight/smoke/load/backup/restore tooling, security and recovery runbooks | `tests/hrms-production-hardening.test.ts`, `tests/security-headers.test.ts`, `tests/hr-bootstrap-deployment.test.ts` | #404 |

## Cross-cutting controls

- Every HR mutation is server-side, schema validated, organization scoped, permission checked, transactional where multiple records change, and audited.
- Supervisor access is derived from current direct, team, or department assignments rather than a permanent supervisor role.
- Bank, identity, tax, MFA, token, and document data is encrypted, hashed, masked, or omitted according to use. Full bank account numbers appear only in specifically authorized admin/payroll surfaces.
- Notifications use an in-transaction durable email outbox plus in-app notifications and per-category preferences. Payloads contain safe references, not sensitive HR content.
- Employee, assignment, approval, payroll, document, and audit histories are retained; terminal lifecycle actions archive instead of deleting employees.
- The completion audit removed catch-all placeholder workspace routes and replaced every linked HR navigation destination with an implemented page.

## Local verification record

On the completion branch, the following passed:

- Prisma format, validation, and client generation;
- 269 Vitest tests across 26 files;
- ESLint with zero warnings;
- optimized Next.js production build with 71 routes;
- Yarn production dependency audit with zero vulnerabilities;
- tracked credential-pattern scan;
- `git diff --check`.

## Staging evidence record

Complete this section only after explicit staging authorization. Use synthetic data and store evidence in the approved operational system, never in source control when it contains credentials or employee data.

| Gate | Required evidence | Result |
| --- | --- | --- |
| Deployment identity | staging service/project, approved operator, commit SHA | Pending authorization |
| Configuration | `hr:preflight` ready result; secrets and storage configured in secret manager | Pending |
| Database | backup identifier, successful `prisma migrate deploy`, schema/migration status | Pending |
| Authentication | invitation/reset/login/session/MFA/suspension tests | Pending |
| Authorization | ADMIN, HR_ADMIN, PAYROLL_ADMIN, EMPLOYEE, and scoped supervisor matrix; IDOR attempts denied | Pending |
| Core workflows | synthetic employee → assignment → leave → payroll → documents/assets → offboarding | Pending |
| Sensitive data | full bank data visible only to specifically authorized admin/payroll users; masked elsewhere | Pending |
| Workers | outbox delivery, retries, scanner callback, overdue reminders | Pending |
| Operations | live/ready/metrics monitors, alert delivery, load-smoke result | Pending |
| Recovery | backup-readiness and isolated restore-drill evidence | Pending |
| Sign-off | HR, payroll, security, operations | Pending |

Production deployment and automatic merging remain prohibited until the release gate in `docs/hrms/production-readiness.md` is complete.
