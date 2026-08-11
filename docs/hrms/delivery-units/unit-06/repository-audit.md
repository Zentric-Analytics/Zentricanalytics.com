# Unit 6 repository audit

This document records repository facts at `56cee8bb80cda6a662e60780d7c255d29827bd94`. It does not authorize implementation, migrations, staging deployment, or production changes.

## Current baseline

- Long-term branches are `dev` and `main`; this audit runs on a short-lived branch from `dev`.
- Units 1–5 are present. The development schema contains 39 ordered migrations.
- Production remains the separately sealed Unit 5 baseline. The GoDaddy automatic-Inbox exception and web-memory monitoring risk are not changed by Unit 6.

## Search results

Repository searches covered attendance, clock/clock-in/clock-out, punch, timesheet, shift, rota, schedule, overtime, lateness, under-time, break, work hours, time entry, and kiosk.

| Finding | Classification | Evidence and consequence |
|---|---|---|
| `HrWorkSchedule`, immutable `HrWorkScheduleVersion`, effective-dated `HrWorkScheduleAssignment` | Reusable foundation | Version carries `timezone`, `weeklyPattern`, effective range, and publish timestamp. Extend the pattern; do not create a second basic schedule authority. |
| `HrHolidayCalendar` versions, occurrences, and assignments | Reusable | Unit 6 resolves expected work and holidays using exact published versions. |
| Unit 5 leave versions, local segments, calculation snapshots, long absences | Reusable | Approved leave explains scheduled non-work; Unit 6 must reference it and never reproduce leave accounting. |
| `HrPerson`, `HrEmployee`, `HrWorkRelationship`, `HrEmployeeAssignment`, supervisor assignments | Reusable | Effective workforce identity, assignment, manager, location, work mode, and employment boundaries determine eligibility and scope. |
| Unit 4 workforce events and serializable application | Reusable | Transfers, location/manager changes, separation, rehire, and long-term leave change attendance obligations at effective boundaries. |
| Workflow definitions/instances/stages/approvals | Reusable, extension needed | Use for correction and timesheet approvals; add Unit 6 subject/action conventions and separation-of-duties rules. |
| Permission catalog and deny-by-default server authorization | Reusable, extension needed | Add narrow time self/team/manage/approve/lock/read-authoritative/export permissions. UI hiding is never sufficient. |
| Immutable `HrAuditEvent` with tenant, request, reason, correlation and safe snapshots | Reusable | Every evidence ingestion, interpretation, correction, approval, lock, replay, and export must correlate here. |
| `HrEmailOutbox`, delivery attempts, sender registry, retries and HTTPS templates | Reusable, extension needed | Unit 6 notifications use the HR sender category and unique idempotency keys. Unknown mappings fail closed. |
| Authenticated internal workers and Unit 4/5 job-run patterns | Reusable | Add attendance processing/reconciliation jobs with tenant/job/window uniqueness, leases, retry, safe error, and replay. |
| Private document storage and scanner | Partial | Use only for optional evidence attachments. Clock/device metadata belongs in structured restricted records, not document storage. |
| Encrypted archive, isolated restore, readiness and load tooling | Reusable | Extend correlation and orphan/duplicate queries to Unit 6 chains. |
| `HrEmployeeLeavePolicy`, `HrLeaveBalance`, `HrLeaveLedger`, legacy leave request tables | Legacy alongside Unit 5 authority | Do not use legacy balance structures as schedule or attendance authority. |
| Employment agreement `roleSchedule` JSON and organization `workingDays` settings | Legacy/partial | May inform migration diagnostics only; never reinterpret historical attendance from mutable JSON/settings. |
| Actual clock/punch/time-event records | Missing | Add append-only evidence with exact tenant, assignment, instant, local context, source, and idempotency. |
| Shift templates, rotating/split/overnight shifts, publication and employee shift assignments | Missing | Extend shared schedule domain with versioned planning entities. |
| Timesheets and entries | Missing | Add versioned draft/submission/approval/lock records. |
| Attendance-day interpretation and exception records | Missing | Add reproducible policy/schedule/leave/evidence snapshots and derived outcomes. |
| Corrections and authoritative-time locking | Missing | Add append-only correction lineage, optimistic versions, approval, lock, and post-lock adjustment signals. |
| Payroll time handoff | Missing | Unit 6 publishes approved categories only; Unit 9 will price them. |

## Existing model constraints that Unit 6 must respect

- Every new business record is tenant-owned. Cross-tenant identifiers fail before mutation or disclosure.
- `HrPerson` preserves identity across rehire; attendance attaches to the exact work relationship and assignment, not merely a mutable employee row.
- Schedule and holiday versions are retained and referenced by approved Unit 5 requests. Extending them must remain backward compatible.
- Current schedule `weeklyPattern` is JSON. It is adequate for Unit 5 chargeable-day calculations but insufficient by itself for published shifts, split shifts, premiums, or conflict constraints.
- `HrEmployeeAssignment.location` is legacy text while `locationId` is the governed reference. Unit 6 uses `locationId` and snapshots the resolved timezone/policy context.
- Current roles are ADMIN, HR_ADMIN, PAYROLL_ADMIN, EMPLOYEE, and AUDITOR; manager authority is derived from effective supervisor scope and permissions, not a broad manager role.
- The application worker currently invokes outbox, recruitment activation, workforce events, and leave. Unit 6 needs a separately authenticated route but can reuse the worker host and secret-rotation pattern.

## Honest gap conclusion

The repository has strong workforce, leave, governance, notification, audit, security, and recovery primitives. It does not yet have production-grade time evidence, shift planning, attendance interpretation, corrections, period locking, or authoritative payroll handoff. Those are Unit 6 implementation scope after owner approval.
