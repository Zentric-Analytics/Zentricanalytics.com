# Unit 5 repository audit

Status: blueprint evidence only. Audited from `dev` at `82808c8a4f35eae376e77c9c0d3fa29fbc715627`. Production was not accessed or changed.

## Facts discovered

### Identity and workforce foundations

- `HrOrganization` is the tenant boundary. Domain queries normally include `organizationId`; retained HR records use restrictive foreign keys.
- `HrPerson` is the stable identity. `HrEmployee` is the employment-facing profile, and `HrWorkRelationship` preserves separate historical relationships for rehire.
- `HrEmployeeAssignment` is effective-dated and links department, team, position, legal entity, business unit, division, location, cost center, employment type, FTE and a placement snapshot.
- `HrPosition`, `HrLegalEntity`, `HrLocation`, `HrGrade`, department/team structures and supervisor assignments already provide the applicability and manager-scope inputs Unit 5 needs.
- Unit 4 owns workforce state through versioned `HrWorkforceEvent` records, immutable versions, execution attempts, correlation/idempotency keys, governed workflows and an effective-dated worker. `LEAVE_OF_ABSENCE` and `RETURN_FROM_LEAVE` exist in the workforce event vocabulary and must remain the authority for employment-state changes.

### Existing leave implementation

- Migration `20260730010000_hrms_leave_management` created `HrLeaveType`, `HrLeavePolicy`, `HrEmployeeLeavePolicy`, `HrLeaveBalance`, `HrLeaveLedger`, `HrLeaveRequest`, `HrLeaveApproval`, `HrLeaveAttachment` and `HrPublicHoliday`.
- Leave types currently distinguish days/hours, paid/unpaid and whether evidence is required.
- Policies are version-numbered and effective-dated. They support entitlement, monthly/quarterly/annual accrual, maximum balance, carryover limit/expiry month, notice, maximum consecutive units, probation, negative balance and approval flags.
- Employee policy assignments are effective-dated. The current annual account is one `HrLeaveBalance` per employee/type/year with cached opening/accrued/carried-over/adjusted/reserved/used/expired totals.
- `HrLeaveLedger` has an immutable database guard and globally unique idempotency key. The documented calculation is `opening + accrued + carriedOver + adjusted - reserved - used - expired`.
- Current reservation occurs during submission. Approval releases the reservation and immediately posts `LEAVE_TAKEN`; rejection/withdrawal releases it; cancellation restores used units.
- Request submission and balance mutations use serializable transactions. Accrual and carryover use deterministic idempotency keys.
- Employee, supervisor and HR pages exist, as do leave/calendar CSV reporting and leave email templates.

### Reusable platform services

- Permissions and server-side authorization are centralized; employee self, assignment-scoped supervisor, HR/admin and auditor patterns already exist.
- The workflow engine supports immutable definitions, versions, stages, routing, independent review, optimistic versioning and audit evidence.
- Audit uses append-only `HrAuditEvent` records with correlation support.
- Email uses an idempotent outbox, delivery attempts, retry/backoff and an intent-based sender registry. Leave messages belong to the HR sender category. The accepted GoDaddy automatic-Inbox risk remains unchanged.
- Private S3 storage, object version correlation, GuardDuty quarantine, fail-closed download, scanner callback authentication and document audit already exist for employee documents.
- Authenticated internal workers, safe claiming/replay patterns, metrics, backup/archive, isolated restore and staging status conventions are available.

## Gaps in the current leave module

| Area | Repository gap | Unit 5 consequence |
|---|---|---|
| Policy kinds | All policies assume a numeric entitlement | Add entitlement-based, event-limited, unlimited, unpaid, statutory and long-term models |
| Applicability | No normalized country/entity/location/employment-type/grade/tenure rules or deterministic precedence | Add effective-dated eligibility/applicability and conflict diagnostics |
| Schedules | Organization `workingDays` is a global setting | Add versioned schedules, daily intervals, employee assignments and timezone |
| Calendars | Holidays are individual organization rows with optional country/region | Add versioned calendars, assignments, shutdowns and precedence |
| Precision | One request has one date range and one amount | Add immutable calculation snapshots and day/hour segments |
| Accounts | Annual balance is keyed only by employee/type/year and its policy ID can be overwritten | Add stable account identity and period/account-policy snapshots; retain cached totals only as reconcilable projections |
| Ledger | Entry lacks organization, account, unit, policy version, source kind/ID, correlation and reversal linkage | Enrich the authoritative ledger and enforce per-tenant idempotency |
| Consumption timing | Approval immediately records leave taken | Reserve on approval, consume when leave starts/completes according to policy, and reverse deterministically |
| States | `PENDING/APPROVED/...` cannot express draft versions, review, scheduled, in progress or completion | Add explicit transition history and optimistic version |
| Approval | One current reviewer plus append-only decisions | Reuse workflow definitions for multi-stage approval, delegation and separation of duties |
| Evidence | Leave attachments use legacy `put/get`, not exact-version quarantine/release metadata | Reuse `HrEmployeeDocumentVersion` or an exact-version evidence reference; managers see metadata only |
| Automation | Accrual/carryover are interactive server actions | Add authenticated scheduled workers, attempts, leases, dead-letter/recovery and reconciliation |
| Long absence | No link to workforce events | Link approved long-term absence to Unit 4 events; Unit 4 remains status authority |
| Effective dating | Cross-year requests are rejected; transfer/schedule/calendar changes are not snapshot-resolved | Segment across policy/account periods and freeze the approved calculation basis |
| Concurrency | Serializability exists, but no account-row lock/version contract or complete competing-operation matrix | Add account version/lock ordering, unique transition/application keys and real PostgreSQL gates |
| Privacy | Request reason is displayed to managers; evidence classification is coarse | Split operational reason/category from confidential notes/evidence |
| Recovery | Existing restore evidence does not specifically correlate a full Unit 5 chain | Add Unit 5 archive/restore correlation gate |

## Constraints to preserve

- No destructive rewrite of Units 1–4 data or validated Git history.
- Existing leave rows must remain readable while additive Unit 5 structures are introduced and backfilled.
- Unit 4 remains the only workforce status/effective-event engine.
- Private evidence remains fail-closed until the exact object version is clean.
- UI filtering never substitutes for tenant and permission checks.
- Unknown notification templates/sender categories fail closed.
- No claim of production or delivery validation is made during this blueprint phase.

