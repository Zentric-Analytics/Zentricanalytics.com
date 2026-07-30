# HRMS milestones

1. Secure foundation: architecture, organization, database identity, RBAC/permissions, invitations, resets, sessions, suspension, layouts, user management, audit, outbox, storage boundary, and tests.
2. Core HR: employee records, contacts, departments, positions, effective-dated employment and supervisor assignments, recruitment conversion, organization settings, and user lifecycle.
3. Leave management: versioned policies, balances and immutable ledger, requests, approvals, calendar, attachments, notifications, accrual, and carry-over.
4. Payroll: effective-dated salary, configured earnings/benefits/taxes/deductions, Decimal calculations, versioned runs, review, approval, locking, payments, payslips, history, and exports.
5. Documents and assets: durable private documents, versioning, access logs, expiration, asset inventory, assignment history, returns, and employee self-service.
6. Onboarding and offboarding: reusable task/checklist execution, provisioning, acknowledgements, asset and access coordination, knowledge transfer, final-payroll coordination, and archival.
7. Workflow engine: reusable multi-stage approvals, parallel and conditional routing, immutable decisions, delegation-ready assignments, and module adapters.
8. Reports and analytics: permission-bound dashboards, headcount and turnover, leave/payroll/asset metrics, audit reports, and safe server-side exports.
9. Production hardening: performance, workers, observability, backups and disaster recovery, security testing, accessibility, load testing, operational documentation, and readiness review.

Each milestone is separately committed, reviewed, migrated, tested, and staged. Migrations are additive and financial, audit, approval, and assignment history is never destructively rewritten.

## Implementation status

Milestones 1 through 9 are implemented in the milestone branch stack. Local verification covers the complete automated test suite, strict linting, Prisma schema validation and generation, the production build, dependency audit, and credential-pattern scan.

Production promotion remains an operator-controlled activity. Before declaring a live environment ready, publish and review the stacked pull requests, configure secrets and private object storage, apply migrations to staging, complete the documented smoke/load/security checks, verify alert routing and scanner/email workers, and record current backup plus restore-drill evidence.
