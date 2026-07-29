# Data model

`HrOrganization` is the tenant and configuration root. `HrUser`, `HrRole`, and `HrPermission` form many-to-many role and permission assignments. `HrSession`, `HrAccountInvitation`, `HrPasswordResetToken`, and `HrLoginAttempt` implement identity lifecycle.

`HrEmployee` is deliberately separate from applicants and can later link idempotently to one originating `JobApplication`. `HrSupervisorAssignment` grants time-bounded supervisor scope without a SUPERVISOR role.

`HrAuditEvent` is append-only. `HrEmailOutbox` and `HrEmailDeliveryAttempt` separate business commits from delivery. `HrOrganizationSetting` stores non-secret configuration. Critical states use enums; organization/email/time lookup fields are indexed.

Milestone 2 adds employee contacts, departments, positions, employment and effective-dated assignment history. Later migrations add leave, Decimal-based payroll snapshots, documents, assets, workflows, and offboarding without destructive changes to recruitment tables.
