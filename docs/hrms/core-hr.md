# Core HR (Milestone 2)

Core HR replaces spreadsheet-based employee and organization records while retaining every historical assignment.

## Data ownership

- `HrEmployee` is the canonical employee identity and lifecycle record.
- A finalized recruitment application creates at most one linked `DRAFT` employee. Recruitment records remain the source history and are never copied wholesale or deleted.
- `HrDepartment`, `HrTeam`, and `HrPosition` define the active organization structure. They are archived, not deleted.
- `HrEmployeeAssignment` stores effective-dated department, team, position, employment type, and location history. A transfer closes the prior assignment in the same transaction.
- `HrSupervisorAssignment` grants temporary supervisor capabilities. Supervisor is not a permanent role and reporting cycles are rejected.

## Protected information

Bank account numbers, government identifiers, tax identifiers, and pension identifiers are encrypted at rest with authenticated AES-256-GCM envelopes. The full value is rendered only after permission authorization:

- bank details: `payroll.read_bank_details`;
- tax and pension: `payroll.read_salary`;
- government/identity records: `document.read_sensitive`.

Audit payload sanitization redacts these values before an event is stored. Last-four values exist for safe operational identification but are not substituted for the full value on authorized admin profile screens.

## Administrative workflows

The admin workspace includes real pages for employees, departments/teams, positions, employment and supervisor assignments, user lifecycle management, organization settings, and searchable audit events.

Role assignment and revocation use permission checks. The final active ADMIN cannot be revoked. Suspension revokes sessions, reactivation does not manufacture a password, and invitation resend revokes older active invitations.

## Migration and rollback

Migration `20260730000000_hrms_core_hr` is additive. It refuses to guess how any pre-existing free-form `departmentScopeId` should map to a department; an operator must resolve such data before retrying. Roll back application code before considering database changes, and retain the additive history tables.

Before deployment:

1. Back up PostgreSQL.
2. Run `yarn prisma migrate status`.
3. Confirm no legacy supervisor assignment contains a non-null free-form `departmentScopeId`.
4. Run `yarn prisma migrate deploy`.
5. Run `yarn hr:preflight`.
6. Smoke-test role boundaries and the Core HR admin pages.
