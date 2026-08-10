# Delivery Unit 4 blueprint: governed workforce events

Status: draft for product-owner scope approval. No implementation or production deployment is included.

## Objective

Provide one governed, effective-dated, auditable engine for workforce changes that coordinates organization assignments, position occupancy, employee status, supervisor authority, compensation effects, payroll boundaries, lifecycle tasks, system access, notifications, and documents without rewriting history.

## Proposed event types

- transfer, promotion, demotion, location or manager change;
- employment-type or work-mode change;
- secondment and return;
- leave of absence and return;
- suspension and reinstatement;
- resignation, termination, rescission, and retirement;
- compensation-impacting events through existing salary/payroll approval controls.

The approved scope must state which types ship in the first Unit 4 increment. Unsupported types fail closed.

## Core aggregate

- Stable workforce-event identity plus immutable version rows.
- Organization, employee, event type, requested/effective dates, reason, source, policy/workflow version, initiator, and idempotency key.
- Explicit DRAFT, SUBMITTED, IN_REVIEW, APPROVED, SCHEDULED, EXECUTING, COMPLETED, REJECTED, CANCELLED, FAILED, and COMPENSATION_REQUIRED states.
- Immutable impact snapshot listing every downstream record expected to change.
- Versioned approvals and evidence references; private documents remain in the existing exact-version storage boundary.
- Execution attempts with claim token, retry state, safe error, correlation ID, and dead-letter/recovery record.

## Safety invariants

- Serializable execution and exactly one terminal application per event version.
- No overlapping primary assignment, position overfill, invalid hierarchy, cross-tenant link, duplicate employee-number change, or retroactive mutation of locked payroll.
- Effective-date conflicts are detected before approval and revalidated immediately before execution.
- Approval cannot silently apply a newer event version.
- Scheduled and manual execution race safely with one winner and a clear losing result.
- Every downstream mutation and notification shares the event correlation ID.
- Failure is fail-closed; partial application is rolled back transactionally or marked for explicit compensating action when an external side effect cannot be rolled back.

## Architecture boundary

- Reuse the workflow engine for approvals, not a parallel approval implementation.
- Reuse organization transfer/capacity policy as domain validation, progressively moving orchestration behind the workforce-event command boundary.
- Reuse lifecycle tasks for onboarding/offboarding consequences.
- Reuse payroll/salary approval and lock rules; do not let a workforce event rewrite locked payroll history.
- Reuse the authenticated worker/outbox/audit infrastructure with event-specific permission keys and metrics.

## Staging release gates

- Additive migration and compatibility review against a production-shaped staging restore.
- Authorization and tenant-isolation matrix for every event type and transition.
- Real PostgreSQL concurrency for duplicate submit/approve/execute, conflicting effective dates, position capacity, and manual-versus-scheduled execution.
- Failure injection for transaction rollback, worker restart, duplicate jobs, stale versions, temporary/permanent provider failure, retry, dead letter, and recovery.
- Browser E2E for draft through execution, rejection, cancellation, scheduled execution, history, audit, and accessible errors.
- Reconciliation of employee status, assignments, positions, supervisor scopes, lifecycle tasks, salary/payroll effects, access, notifications, and audit.
- Complete automated suite, TypeScript, ESLint, Prisma validation, production build, security review, safe staging load, backup/restore evidence, and release report.

## Open scope decisions

- First-increment event types.
- Whether compensation-impacting events are one composite event or linked governed sub-events.
- Rules for retroactive events and closed payroll periods.
- Whether termination remains exclusively offboarding-driven or becomes a workforce event that mandates an offboarding lifecycle.
- Required approval policies per event type and organization scope.
