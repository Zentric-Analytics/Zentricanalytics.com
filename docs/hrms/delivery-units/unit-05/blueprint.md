# Unit 5 — Leave & Absence Management blueprint

Status: **BLUEPRINT COMPLETE — implementation requires separate approval.** This document contains recommendations unless explicitly labelled as a repository fact.

## Governing invariants

1. Policy decides entitlement.
2. Calendar decides chargeable time.
3. Ledger explains balance.
4. Workflow governs approval.
5. Audit explains every change.
6. Unit 4 alone changes workforce status.
7. Ambiguous eligibility, policy, calendar, authorization or accounting fails closed.

## Unit 5A–5F architecture

### 5A — Policies, schedules and calendars

- Separate a stable leave type from immutable policy versions.
- A policy version declares accounting model (`ENTITLEMENT`, `EVENT_LIMITED`, `UNLIMITED`, `UNPAID`, `STATUTORY`, `LONG_TERM`), unit, timezone, grant/accrual/carryover rules, request rules, evidence classification, approval workflow key and applicability rules.
- Normalize applicability by country, legal entity, location, employment type and grade; store tenure/FTE predicates in typed rule JSON validated against a versioned schema.
- Resolve policy at each chargeable segment's local date. Persist candidate IDs, winning version, precedence explanation and input snapshot.
- Precedence, highest first: explicit employee assignment; legal entity + location + employment type + grade; legal entity + location; legal entity; country; organization default. More constraints win within a tier; priority breaks intentional ties; equal-priority matches are an error.
- A versioned work schedule has organization timezone, weekly intervals, daily paid hours and effective dates. Employee schedule assignments are effective-dated; assignment/workforce changes can schedule a new one.
- A versioned holiday calendar contains dated holidays/shutdowns and applicability. Calendar assignment precedence mirrors policy scope. A request snapshot retains the exact schedule/calendar versions used.

### 5B — Accounts, entitlements, accruals and ledger

- A stable leave account belongs to organization + employee + leave type + unit. Account periods reference the exact policy version and period boundaries.
- The ledger is authoritative. Cached account-period totals are projections updated in the same transaction and verified by reconciliation.
- Signed entry effects are explicit: grants/accrual/carryover/positive adjustment/reversal credit availability; reservation debits spendable availability; reservation release credits it; consumption converts reserved to consumed without a second spendable debit; expiry and negative adjustment debit availability.
- Every entry records tenant, account/period, policy version, type, signed amount, unit, effective date, source type/ID, actor or worker, reason, correlation ID, tenant-scoped idempotency key and optional reversal-of entry.
- Ledger entries and calculation snapshots are immutable. Corrections are reversing and replacement entries.
- Upfront grants post once per account period. Periodic accrual uses local policy time, FTE and service proration. Join, separation, transfer and rehire boundaries split periods deterministically.
- Carryover is a transfer pair linked across periods. Expiry can only remove unreserved carryover. Maximum balance rules state whether they cap accrual only or total holdings.
- A reconciliation worker recomputes projections from the ledger and alerts on any difference; it never silently edits the ledger.

### 5C — Employee requests

- Employee flow: My Leave → balances/policy explanation → request → calculation preview → submit → status/upcoming/history.
- Drafts are mutable and versioned. Submission freezes a request version and calculation snapshot.
- Segments represent local date/time, scheduled minutes, excluded holiday/non-working minutes and chargeable units. Decimal precision is fixed by policy; rounding is explicit and reproducible.
- Preview explains calendar days, scheduled days/hours, exclusions, chargeable units, available and projected available.
- Overlap checks cover submitted through in-progress requests and use half-open timestamps.
- Evidence uploads to quarantine and records exact object version/checksum. Submission may proceed only according to the policy's evidence timing; access remains unavailable until clean.
- Employees may edit only drafts or returned requests. Submitted changes create a new immutable request version and invalidate prior approvals. Withdrawal/cancellation follows governed transitions.

### 5D — Manager and HR governance

- Reuse `HrWorkflowDefinition` with subject `HrLeaveRequestVersion`. A request records the workflow instance and approved request version.
- Supported stages include manager, delegated manager, HR and policy-specific reviewers. Delegation is effective-dated, scoped and auditable.
- The requester cannot approve their own request. Reviewers cannot approve a stale version; duplicate decisions are idempotent.
- Manager calendar/detail exposes employee, operational leave label, dates, duration and coverage indicators. It excludes confidential reason, diagnosis, evidence and medical metadata.
- HR override is a governed command requiring permission, explicit authority/reason, before/after calculation, correlation and ledger/audit entries. No direct balance replacement exists.
- Coverage is explainable decision support. It does not automatically reject unless a versioned policy rule explicitly requires a limit.

### 5E — Long-term absence and workforce integration

- Short absence changes leave request/account state only; employee normally remains `ACTIVE`.
- A long-term policy marks an approved request as requiring a linked Unit 4 `LEAVE_OF_ABSENCE` event. Leave approval does not directly update `HrEmployee.employmentStatus`.
- Unit 5 creates the linked workforce event with the same correlation ID and requested effective timestamp. Unit 4 approval/effective worker changes the workforce state to `ON_LEAVE` exactly once.
- Return-to-work creates a linked Unit 4 `RETURN_FROM_LEAVE` event. Unit 5 completes the absence only after Unit 4 applies the return.
- Competing separation, transfer or rehire events are revalidated by the Unit 4 conflict engine. A separated employee's future leave is cancelled/reversed by an explicit governed compensating workflow.
- Publish stable outbox/domain events: `leave.requested`, `leave.approved`, `leave.cancelled`, `leave.started`, `leave.completed`, `leave.unpaid`, `absence.long_term.started`, `absence.returned`. Payloads contain tenant, person/employee/work-relationship IDs, effective interval, units, paid classification, source/version and correlation—not confidential evidence.

### 5F — automation, reporting and recovery

- Scheduled workers: policy assignment, period grant/accrual, carryover, expiry, leave activation, leave completion, long-absence orchestration, return reminders, approval/evidence reminders and reconciliation.
- Each run has tenant, job type, schedule key, window, status, lease/claim token, attempts, checkpoint, safe error and correlation. Unique tenant/job/window keys make replay harmless.
- Workers enumerate tenants explicitly, process bounded batches and never accept cross-tenant IDs from job payloads without revalidation.
- Reports: away today/upcoming, coverage, pending approvals, balances/expiries, negative anomalies, usage by type, adjustments, failed accruals and returns due. Confidential fields require separate permission and are excluded from ordinary exports.

## Proposed additive data model

Names are recommendations and should be finalized against Prisma conventions during implementation.

| Entity | Purpose and ownership | Key constraints/indexes | Mutability, retention and authorization |
|---|---|---|---|
| `HrLeaveType` extension | Stable tenant type and accounting model | unique org/code; index org/status/model | Archive only; HR policy manage |
| `HrLeavePolicyVersion` | Immutable rules and workflow contract | unique policy/version; non-overlap effective range; scope/status indexes | Publish locks rule fields; supersede with new version |
| `HrLeavePolicyApplicability` | Typed scope predicates/priority | unique version + dimension set; referenced IDs tenant-validated | Immutable with published version |
| `HrWorkSchedule` / `Version` | Stable schedule and immutable weekly pattern/timezone | org/code; version; effective range | HR manage; historical versions retained |
| `HrWorkScheduleAssignment` | Effective employee schedule | employee/effective indexes; no overlapping active assignment | Governed append/end; self read |
| `HrHolidayCalendar` / `Version` | Stable calendar and immutable applicability | org/code; version/effective indexes | HR manage; retained |
| `HrHolidayOccurrence` | Holiday/shutdown interval | unique calendar version/local date/code | Immutable after publish |
| `HrLeaveAccount` | Stable employee/type/unit account | unique org/employee/type/unit; status index | Never deleted with history; self/HR read |
| `HrLeaveAccountPeriod` | Policy-bound accounting interval and cached projection/version | unique account/start/end; account/status index; optimistic version | Projection mutable transactionally; reconstructable |
| `HrLeaveLedgerEntry` | Authoritative signed accounting | unique org/idempotency; source/correlation/account/effective indexes | Append-only; reversal links only |
| `HrLeaveRequest` extension | Stable request aggregate | unique org/reference and org/idempotency; employee/status/start index; version | State/version mutable through commands only |
| `HrLeaveRequestVersion` | Immutable submitted content/calculation basis | unique request/version; policy/schedule/calendar refs | Append-only |
| `HrLeaveRequestSegment` | Chargeable local date/time breakdown | unique request version/sequence; local interval index | Immutable with version |
| `HrLeaveTransition` | Immutable state history | unique request/fromVersion/transition key; correlation index | Append-only/auditor visible |
| Workflow instance reuse | Multi-stage approvals | existing workflow uniqueness/version checks | Existing workflow authorization |
| `HrLeaveDelegation` | Effective reviewer delegation and scope | no overlapping delegate scope; delegator/effective index | Governed end/revoke; audit |
| `HrLeaveEvidence` | Exact private document-version reference and classification | unique request version/document version; scan/status index | Metadata immutable; authorization by classification |
| `HrLeaveLongAbsence` | Link request to Unit 4 leave/return events | unique request; unique workforce-event links | State follows correlated events |
| `HrLeaveJobRun` / `Item` | Worker claim, replay and recovery evidence | unique org/job/window; status/retry indexes | Append/update operational status; retained per policy |
| `HrLeaveCalculationSnapshot` | Reproducible policy/calendar/schedule inputs and totals | unique request version | Immutable; confidential values minimized |

Existing `HrLeaveBalance` becomes a compatibility projection during migration, then a deprecated read model only after all consumers switch. Existing ledger rows are backfilled into enriched entries with deterministic source/correlation identities; originals are retained.

## State machines

### Request

`DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → SCHEDULED → IN_PROGRESS → COMPLETED`

Governed exits: `SUBMITTED/UNDER_REVIEW → RETURNED | REJECTED | WITHDRAWN`; `APPROVED/SCHEDULED → CANCELLATION_PENDING → CANCELLED`; `IN_PROGRESS → CANCELLED` only through HR correction with ledger compensation. Any edit after submission creates a new version and restarts review.

### Accounting

- Draft: no reservation.
- Submission: validation and preview snapshot; no spend unless a policy explicitly uses submit-time holds.
- Final approval: lock account periods in stable ID order, revalidate, post reservation and transition to approved/scheduled atomically.
- Start: convert reserved to consumed allocation without changing spendable total twice.
- Cancellation before start: release reservation.
- Cancellation/correction after start: reverse consumption and post corrected consumption explicitly.

Approval-time reservation is the default because only governed commitments should reduce spendable balance. Competing approvals serialize on account-period rows; one wins and the loser returns a clear insufficient-balance/stale-version result.

### Long-term absence

`DRAFT → APPROVED_PENDING_WORKFORCE_EVENT → SCHEDULED → ON_LEAVE → RETURN_PENDING → COMPLETED`, with `CANCELLED/FAILED_REQUIRES_REVIEW`. Unit 4 event states are referenced, never duplicated as the workforce authority.

## Concurrency contract

| Race | Deterministic outcome |
|---|---|
| Two approvals spend one balance | lock account periods; first valid commit reserves, second fails with current balance |
| Approval vs cancellation | request version lock; exactly one legal transition |
| Approval vs adjustment/accrual/expiry | account lock ordering; later command recalculates from committed ledger |
| Duplicate approval/worker | tenant-scoped idempotency + unique transition/application key; replay reports already applied |
| Return vs workforce event | Unit 4 conflict validation; one scheduled event can own the effective boundary |
| Policy reassignment vs accrual | assignment version/effective window captured; worker retries against authoritative version |
| Separation vs future leave | separation wins workforce authority; governed cancellation/reversal task is generated |

Use serializable transactions with retry for serialization failures, row locks through narrow SQL where Prisma cannot express them, optimistic request/account versions, stable lock ordering and database unique/exclusion constraints. External notifications are outbox writes committed with domain state.

## Security and privacy matrix

| Capability/data | Employee | Manager/delegate | HR | Administrator | Auditor |
|---|---|---|---|---|---|
| Own balances, calculation, requests | Read/create own | No | Scoped/all by permission | By permission | Read evidence-free history |
| Team absence dates/status | No unrelated data | Direct/delegated scope | By permission | By permission | Authorized report only |
| Operational reason/category | Own | Minimum needed | By permission | By permission | Redacted unless authorized |
| Confidential/medical notes | Own | No | Separate confidential permission | Not implied by admin role | No by default |
| Evidence content | Own clean version | No | Separate evidence permission | Not implied | Metadata/audit only |
| Policy/schedule/calendar manage | No | No | Explicit manage | Explicit manage | Read published history |
| Approve/override/adjust | No self-approval | Scoped stage | Explicit permission, separation of duties | Explicit permission | Never |
| Mutate ledger/audit | Never directly | Never | Commands only | Commands only | Never |

Every lookup, list, workflow action, worker and document route rechecks organization and scope server-side. Cross-tenant IDs return a non-disclosing denial. Sensitive audit payloads store references/redactions rather than diagnoses or file contents.

## Evidence security

- Reuse the private S3/GuardDuty pipeline and exact object version IDs.
- Upload → quarantine → scan callback → exact-version clean release. Pending, infected, stale or unknown versions are not downloadable.
- Store classification, checksum, object version, retention rule and request-version link. Replacement never changes the version reviewed.
- Managers receive only `evidence satisfied/pending` unless separately authorized. Access and denials are audited.

## Notifications and integration

- Use the existing HR sender category and registered templates for submitted, review required, approved, rejected, returned, cancelled, upcoming, evidence required, expiring balance and return-to-work messages.
- Unknown mappings fail closed. Idempotency is event + recipient + template + version.
- A notification failure never rolls back approved leave; the outbox retries and exposes backlog/failure metrics.
- The GoDaddy/Outlook exception remains an operational risk and is not weakened or claimed resolved.

## Failure behavior

- Missing/ambiguous policy, schedule, calendar, reviewer or tenant scope: fail closed with actionable configuration error.
- Insufficient balance, overlap, stale/duplicate decision: no mutation; return current authoritative state.
- Transfer after approval: retain snapshot for history, re-evaluate future segments only through an explicit governed recalculation/version.
- Scanner failure: evidence remains quarantined and approval requiring evidence is blocked.
- Partial worker failure: transaction rolls back the item; retry from checkpoint; terminal failure enters reviewed recovery state.
- Time calculations use IANA zones and local dates; UTC stores instants. Tests cover DST, leap years and year boundaries.

## Migration strategy

1. Add new enums/tables/nullable foreign keys and indexes; existing application remains compatible.
2. Backfill stable accounts/periods and enriched ledger entries in bounded, restartable jobs with reconciliation reports.
3. Dual-read and compare old projection versus new ledger; no dual authoritative writes.
4. Switch commands behind a feature flag in staging; retain old columns as compatibility projections.
5. Make constraints required only after zero-null/orphan reconciliation.
6. Roll back application first; leave additive schema/history intact. Use forward fixes for data/schema defects.

No destructive production migration is proposed in this phase.

## Observability and recovery

- Metrics/alerts: accrual failures/lag, ledger mismatch, negative anomalies, stuck approvals, worker retry/dead-letter, duplicate attempts, outbox backlog, scanner failures, carryover/expiry failures and return-event failures.
- Logs contain tenant-safe IDs, job/request/correlation and safe errors; never evidence contents or medical reasons.
- Backup/restore gate verifies `Person → WorkRelationship → Assignment → PolicyVersion → Account → Period → Ledger → RequestVersion → Workflow/Approval → LongAbsence → WorkforceEvent → Return → Audit`, plus documents/outbox and zero orphans.

## User experience

- Employee: simple balances, explanation, preview, request, status, upcoming and history; ledger jargon stays behind an explanation view.
- Manager: team availability, pending decisions, overlap/coverage, request operational details and upcoming leave; confidential content excluded.
- HR: policy versions, schedules, calendars, accounts, requests, long absences, returns, adjustments, exceptions, carryover/expiry, reconciliation, reports and audit.

## Open decisions requiring owner approval

1. Default reservation point: recommended final approval, with optional policy-specific submit-time holds.
2. Consumption point: recommended leave start per segment, with completion reconciliation.
3. Whether unlimited leave exposes usage-only summaries or a non-numeric balance label.
4. Initial countries/legal entities and their configured statutory extensions; none belong in the core engine.
5. Evidence retention periods and which HR permission can view medical evidence.
6. Default approval workflows by leave model and thresholds.
7. Retroactive request/correction policy and locked-payroll interaction.
8. Grace/expiry rules for carryover when an approved request already reserves expiring units.

