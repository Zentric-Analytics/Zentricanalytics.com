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

## Source-level requirement matrix

The classifications below reflect source inspection. `VERIFIED` means locally evidenced implementation, not staging certification.

| Requirement | Classification | Source/model/migration | Permission or ownership | Audit and test | Documentation / staging |
| --- | --- | --- | --- | --- | --- |
| Employee records, status/history, generated IDs, archival | VERIFIED | `admin/employees/actions.ts`; `HrEmployee`, `HrEmployeeStatusHistory`, `HrEmployeeNumberSequence`; `20260730080000` | `employee.create/update/read_*` | `hr.employee.*`; `hrms-core-hr`, `hrms-final-remediation` | `core-hr.md`; runbook 13/21 |
| Contacts, addresses, emergency, identifiers, tax, bank | VERIFIED | employee detail/actions; encrypted credential fields | employee, sensitive-document, payroll-specific permissions | redacted `hr.employee.*`; foundation/core tests | data classification; runbook 13 |
| Departments, teams, positions, employment/supervisor history | VERIFIED | assignment/department/position actions; effective-dated models | manage/assignment/supervisor permissions | assignment audit; core/scope tests | authorization matrix; runbook 13/14 |
| Recruitment conversion | VERIFIED | `admin/applications/actions.ts`; `recruitmentApplicationId` unique link | legacy recruitment ADMIN final decision; HR tenant lookup | conversion audit/correlation; Stage 8 and completion tests | core HR docs; runbook 13 |
| System access lifecycle | VERIFIED | system-access actions/model; termination/offboarding revocation | assignment create/end | access audit; completion tests | lifecycle docs; runbook 21 |
| Leave policies, balances, accrual/carry-over, ledger | VERIFIED | leave admin/actions/engine; leave models and immutable trigger | leave policy/override | leave audit; `hrms-leave` | leave docs; runbook 15 |
| Leave request/attachment/decision/withdrawal | VERIFIED | employee/supervisor actions; attachment route; magic-byte validation | own request, scoped reviewer, HR override | request/download audit; leave/final tests | security review; runbook 15 |
| Cross-year leave | VERIFIED | explicit rejection in employee leave action | own request | adversarial suite | known limitation; runbook 15 |
| Salary/components/adjustments and Decimal calculation | VERIFIED | payroll setup/actions/engine; Decimal columns | payroll-specific permissions | payroll audit; payroll/final tests | payroll docs; runbook 16 |
| Payroll maker-checker, version, lock, payment | VERIFIED | payroll actions and immutable approvals | separate create/review/approve actors | approval/audit; final test | authorization matrix; runbook 16 |
| Payslip and exports | VERIFIED | payslip/export routes, private storage, CSV guard | owner/payroll; distinct bank permission | download/export audit; payroll/report tests | reports docs; runbook 17 |
| Private documents, versions, scan/quarantine, access | VERIFIED | document actions/routes/storage/validation; immutable access | own/employee/sensitive document permissions | document scan/access audit; document/final tests | storage/security docs; runbook 18 |
| Scanner authentication/replay | VERIFIED | internal scanner route and constant-time bearer helper | scanner bearer secret | system audit; production/final tests | security review; runbook 18/25 |
| Asset inventory/custody/return/loss | VERIFIED | asset actions and restrictive history models | asset manage/assign/return; own acknowledge | asset audit; document-assets tests | documents-assets docs; runbook 19 |
| Onboarding/offboarding tasks and gates | VERIFIED | lifecycle definitions/actions/models | workflow owner/override and assignment scope | lifecycle audit; lifecycle/final tests | lifecycle/data model docs; runbook 20/21 |
| Workflow versioning/routing/decisions | VERIFIED | workflow engine/actions/models/immutable triggers | create/assign/task/override | complete approval context/audit; workflow tests | workflow docs; runbook 22 |
| Workflow delegation UI/automation | PARTIALLY_IMPLEMENTED | schema-ready delegation/reassignment fields only | N/A until enabled | no runtime claim | known limitations |
| Reports and safe exports | VERIFIED | report route/metrics; export records | report view/export; bank distinct | export audit; reports/completion tests | reports docs; runbook 23 |
| Durable email/in-app notification/preferences | VERIFIED | outbox, worker, notification pages/actions/models | authenticated owner; worker bearer | attempts/audit; foundation/production/final tests | notification docs; runbook 24 |
| Invitation/reset email redemption | VERIFIED | invitations/reset, worker, fragment redemption pages, POST cookie routes | single-use token ownership | auth audit; foundation/final tests | security review; runbook 11 |
| Structured append-only audit | VERIFIED | audit sanitizer/model and immutable trigger | audit read only | foundation and module tests | data classification; runbook 23 |
| Session/MFA/rate limit/security headers | VERIFIED | auth/session/TOTP/authorize, Next config | authenticated/privileged MFA | auth audit; foundation/hardening/final tests | security review; runbook 9/11 |
| Render release without shell | VERIFIED | `render.yaml`, `hr-release.mjs`, bootstrap/preflight | explicit one-time flag/secrets | bootstrap/final tests | deployment/runbook 3–10 |
| Live providers, migrations, workers, monitoring, backup, restore, load, penetration | ENVIRONMENT_PENDING | repository adapters/tooling present | authorized staging operator | no local claim | staging runbook 1–30 |
