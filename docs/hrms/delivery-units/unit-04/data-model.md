# Unit 4 workforce data model

Status: implementation checkpoint. Staging migration and representative-data reconciliation remain required.

## Authoritative boundaries

- `HrPerson` is a stable identity anchor only. It deliberately contains no duplicate legal-name, contact, bank, tax, or assignment truth.
- `HrEmployee` remains the authoritative employee profile introduced by Units 1–3.
- `HrWorkRelationship` represents each employment period. Rehire creates another relationship linked through `rehireOfId`; it does not create another person.
- `HrEmployeeAssignment` remains the effective-dated organizational placement record.
- `HrWorkforceEvent` governs a proposed employment change and owns state, version, effective date, idempotency key, correlation ID, and immutable snapshots.
- `HrWorkforceEventVersion` preserves every reviewed event version and the exact evidence-version references.
- `HrWorkflowInstance` remains the approval authority. Unit 4 does not create a parallel approval engine.
- `HrWorkforceEventExecutionAttempt` records idempotent application claims, outcomes, and safe failure evidence.
- `HrProfileChangeRequest` separates employee-proposed sensitive changes from direct low-risk edits.

## Existing-data reconciliation

The additive migration creates one deterministic person anchor and one work relationship for every existing employee without changing employee IDs or overwriting any existing field. Existing status and employment dates determine the initial relationship state. The staging preflight must prove row counts, tenant consistency, uniqueness, and the absence of orphaned links before the migration is accepted.

## Concurrency controls

- Tenant-scoped unique idempotency and correlation keys prevent duplicate creation.
- Event and assignment versions are compared in conditional updates.
- Only one caller can claim an eligible event by moving it to `APPLYING`.
- Execution is designed to run inside a serializable transaction so assignment closure, replacement, history, audit, and event completion commit together.
- Scheduled events reject early execution and revalidate assignment state immediately before application.
