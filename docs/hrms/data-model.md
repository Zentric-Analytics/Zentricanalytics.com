# Data model

`HrOrganization` is the tenant and configuration root. `HrUser`, `HrRole`, and `HrPermission` form many-to-many role and permission assignments. `HrSession`, `HrAccountInvitation`, `HrPasswordResetToken`, and `HrLoginAttempt` implement identity lifecycle.

`HrEmployee` is deliberately separate from applicants and can later link idempotently to one originating `JobApplication`. `HrSupervisorAssignment` grants time-bounded supervisor scope without a SUPERVISOR role.

`HrAuditEvent` is append-only. `HrEmailOutbox` and `HrEmailDeliveryAttempt` separate business commits from delivery. `HrOrganizationSetting` stores non-secret configuration. Critical states use enums; organization/email/time lookup fields are indexed.

Milestone 2 adds employee contacts, departments, positions, employment and effective-dated assignment history. Milestone 3 adds versioned leave policy, balance, request, approval, attachment, holiday, and immutable ledger records. Milestone 4 adds effective-dated salary/component assignments, payroll periods and versioned runs, immutable calculation line snapshots, approvals, adjustments, payments, payslips, and export history. Milestone 5 adds logical employee documents, immutable file versions, scan/access history, asset inventory, and custody/return history. Later additive migrations introduce workflow/checklist execution, offboarding, and reporting without destructive changes to recruitment tables.
