# Data model

`HrOrganization` is the tenant and configuration root. `HrUser`, `HrRole`, and `HrPermission` form many-to-many role and permission assignments. `HrSession`, `HrAccountInvitation`, `HrPasswordResetToken`, and `HrLoginAttempt` implement identity lifecycle.

`HrEmployee` is deliberately separate from applicants and can later link idempotently to one originating `JobApplication`. `HrSupervisorAssignment` grants time-bounded supervisor scope without a SUPERVISOR role.

`HrAuditEvent` is append-only. `HrEmailOutbox` and `HrEmailDeliveryAttempt` separate business commits from delivery. `HrOrganizationSetting` stores non-secret configuration. Critical states use enums; organization/email/time lookup fields are indexed.

Milestone 2 adds employee contacts, departments, positions, employment and effective-dated assignment history. Milestone 3 adds versioned leave policy, balance, request, approval, attachment, holiday, and immutable ledger records. Milestone 4 adds effective-dated salary/component assignments, payroll periods and versioned runs, immutable calculation line snapshots, approvals, adjustments, payments, payslips, and export history. Milestone 5 adds logical employee documents, immutable file versions, scan/access history, asset inventory, and custody/return history.

Milestone 6 adds immutable onboarding and offboarding template versions, materialized checklist runs and tasks, dependencies, evidence, provisioning requests, exit records, and lifecycle coordination. Milestone 7 adds immutable workflow definition versions and stages, instances, stage assignments, and decisions supporting serial, parallel, conditional, ANY, ALL, and QUORUM approval paths without executable user-authored code.

Milestone 8 links recruitment applications to the tenant for permission-scoped reporting and records audited server-side exports. Milestone 9 adds MFA replay protection and operational indexes while preserving the additive migration strategy. Outbox delivery attempts, workflow decisions, audit events, leave ledger entries, payroll snapshots, document access events, and historical assignments remain immutable evidence records.
