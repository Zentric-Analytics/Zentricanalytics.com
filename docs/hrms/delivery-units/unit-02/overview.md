# Delivery Unit 2: Enterprise Organization Management

## Delivery status

The product owner approved this design on 2026-07-30. The additive implementation is in progress on `feature/hrms-organization-management-design`; this document does not by itself represent production approval.

## Business objective

Model Zentric customers across legal, financial, geographic, operational, job, grade, and position dimensions. Integrate employee provisioning and assignment workflows with approved headcount while preserving all existing HRMS records.

## Current-state assessment

Reusable capabilities already present:

- `HrOrganization`, `HrDepartment`, `HrTeam`, `HrPosition`, `HrEmployeeAssignment`, and `HrSupervisorAssignment`.
- Organization-scoped server queries and mutations in the existing admin workspaces.
- Effective dates on employee and supervisor assignments.
- Transactional assignment replacement and audit events.
- A reporting-cycle validator for employee supervisor relationships.
- Permission catalog, audit sanitizer, notification outbox, report routes, and provisioning workflow.

Material gaps:

- No legal entity, business unit, division, location, cost center, job family, job profile, or grade models.
- Departments, teams, and positions are mutable current-state records rather than effective-dated structures.
- Position status is the generic active/archive status; there is no approval workflow, headcount capacity, occupancy, budget, freeze, or closure lifecycle.
- Employee assignments lack legal-entity, business-unit, division, location, cost-center, FTE, primary/secondary, and immutable organizational snapshots.
- Existing authorization is organization-wide and cannot yet enforce legal-entity or organizational-dimension scopes.
- Existing position and assignment actions perform business logic directly in server-action files.
- No bulk import, org chart, headcount workspace, historical “as of” organization query, scheduled restructuring worker, or Unit 2 operational metrics.
- Existing tests are primarily source-level regression tests; Unit 2 requires database-backed isolation, concurrency, rollback, and migration tests.

## Delivery boundary

Included:

- All organization dimensions listed in the blueprint.
- Draft and approval-controlled position lifecycle.
- Position occupancy and headcount enforcement.
- History-preserving transfer command.
- Future-dated structure versions and activation.
- Organization workspaces, org chart, headcount and data-quality reports.
- Provisioning integration with approved/open positions.
- Additive migration, compatibility backfill, tests, audit, notifications, and monitoring.

Not included:

- General scoped IAM role-assignment redesign (Unit 3). Unit 2 introduces resource-scope authorization interfaces and permission keys, while retaining current organization-wide grants until Unit 3.
- General workforce-event engine (Unit 4).
- Compensation budgets beyond position/grade validation (Unit 5).
- A generic workflow-definition engine migration (Unit 9); Unit 2 uses a bounded position approval model.

## Acceptance gate

Implementation is accepted only when every active employee resolves to a valid effective-dated assignment and approved position, capacity cannot be exceeded under concurrency, transfers preserve history, circular hierarchies are rejected, reports reconcile, and all validation commands in `test-plan.md` pass.
