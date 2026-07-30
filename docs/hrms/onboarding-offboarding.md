# Onboarding and offboarding

Milestone 6 provides immutable, versioned lifecycle templates and materialized employee checklists. A template version is never edited after publication, so a running or completed checklist retains the exact instructions that governed it.

## Onboarding

The standard checklist covers employee verification, account provisioning, equipment, payroll setup, manager planning, policy acknowledgement and orientation. Tasks have due-date offsets and dependencies. A blocked task becomes pending only after every predecessor completes.

## Offboarding

The standard checklist covers exit planning, knowledge transfer, asset return, final payroll, access closure, exit interview and exit documents. Starting offboarding requires a named knowledge-transfer employee. Completion is rejected while an active asset assignment remains. Successful completion terminates and archives the employee, revokes active sessions and suspends the linked user.

## Authorization and evidence

Task authority is assignment-based. Employees complete exact tasks assigned to their user, current supervisors complete supervisor-owned tasks for exact direct reports, payroll completion requires payroll review authority, and HR/IT queues require workflow review authority. Override remains separately privileged.

Completion notes are mandatory. Evidence is stored as a reference, never a secret or file payload. Material actions are audited. Notifications use reference-only outbox payloads and idempotency keys.

## Operations

1. Apply migration `20260730040000_hrms_onboarding_offboarding`.
2. Run guarded preflight so the new permission is verified.
3. Publish standard onboarding and offboarding template versions.
4. Start checklists from **Admin → Lifecycle**.
5. Invoke reminders through an authenticated internal job runner.
