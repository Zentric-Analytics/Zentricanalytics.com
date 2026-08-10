# Delivery Unit 4 repository audit

Status: blueprinting only. All implementation and validation must occur in staging. No Unit 4 production deployment is authorized.

## Scope identity

The only explicit prior Unit 4 reference is in Delivery Unit 2, which reserves the **general workforce-event engine** for Unit 4. The milestone numbering in `docs/hrms/milestones.md` is a separate implementation-stack taxonomy and must not be substituted for delivery-unit numbering.

## Reusable foundation

- `HrEmployee`, immutable `HrEmployeeStatusHistory`, effective-dated `HrEmployeeAssignment`, and effective-dated `HrSupervisorAssignment`.
- Unit 2 organization dimensions, position capacity controls, serializable transfer command, future structure changes, and organization activation worker.
- Versioned workflow definitions/instances/approvals with ANY/ALL/QUORUM support.
- Lifecycle instances/tasks for onboarding and offboarding.
- Effective-dated salary history and payroll locking controls.
- Notification outbox, immutable audit events, idempotency conventions, scoped permissions, private document evidence, worker authentication, and operational metrics.

## Material gaps

- No canonical workforce-event aggregate or event-number sequence.
- Transfers are a bounded organization command rather than one event type in a governed cross-module engine.
- No common state machine for promotion, demotion, transfer, secondment, employment-type change, location change, manager change, compensation-linked change, leave of absence, return, suspension, termination, or rescission.
- No event-level effective-date conflict detector spanning assignments, position occupancy, salary, supervisor scope, lifecycle, access, and payroll periods.
- No immutable event snapshot tying approvals, impacted records, policy version, evidence, execution attempts, and rollback/compensation actions together.
- No generic dry-run impact preview, scheduled event worker, retry/dead-letter model, or event reconciliation report.
- Existing delivery-unit documentation contains numbering drift: Unit 2 reserves scoped IAM for Unit 3, while the completed Unit 3 package is recruitment-to-activation. Unit 4 must therefore begin from an explicit owner-approved scope statement before implementation.

## Production boundary

- Units 1-3 production behavior is frozen at the conditional baseline.
- Unit 4 branches from the frozen repository baseline but deploys only to staging.
- Unit 4 cannot reach production until its own staging gates pass and the GoDaddy exception is resolved or formally reaccepted for that release.
- When GoDaddy responds, Unit 4 pauses at a safe staging checkpoint for the narrow production remediation and one controlled email test.
