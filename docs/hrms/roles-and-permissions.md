# Roles and permissions

The only initial roles are `ADMIN`, `HR_ADMIN`, `PAYROLL_ADMIN`, and `EMPLOYEE`. Permissions are stable string keys defined centrally and seeded idempotently.

- ADMIN receives every Milestone 1 permission and alone assigns administrative roles or changes permission mappings.
- HR_ADMIN manages employee operations and employee invitations but cannot grant ADMIN, HR_ADMIN, or PAYROLL_ADMIN.
- PAYROLL_ADMIN receives payroll-specific authority only; it cannot manage reporting or supervisor assignments.
- EMPLOYEE can access permitted self-service data only.

Authorization helpers require authentication, roles, permissions, employee ownership, active supervisor scope, or resource ownership. Adding a navigation link never grants access.
