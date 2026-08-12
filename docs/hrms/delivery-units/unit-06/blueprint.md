# Unit 6 — Time, Attendance & Workforce Scheduling blueprint

Status: **UNIT 6 BLUEPRINT COMPLETE — READY FOR IMPLEMENTATION APPROVAL**

This is architecture, not implementation or production readiness. Repository facts are identified as facts; recommendations are proposed design; owner decisions remain explicitly open.

## Governing architecture and invariants

`Employment/Assignment → Time Policy → Published Schedule → Unit 5 Leave → Raw Evidence → Attendance Interpretation → Correction/Approval → Locked Authoritative Time → Future Payroll`

- Schedule is expectation, not proof. Raw events are evidence, not automatically payroll-authoritative.
- Unit 4 remains workforce authority. Unit 5 remains leave authority. Unit 6 never clones either engine.
- Original evidence and approved history are append-only. Corrections create lineage; they never silently replace source events.
- Policy resolution is effective-dated, deterministic, explainable, and fail-closed on no match or ambiguous equal precedence.
- All commands require tenant scope, optimistic version/idempotency, a reason where judgment is exercised, and correlated audit.
- No hidden monitoring, continuous precise-location collection, facial recognition, or biometric identification.

## 6A — Policies, shared schedules, and shift planning

### Tracking modes

| Mode | Expected behavior | Typical use |
|---|---|---|
| `NONE` | No attendance obligation or capture; workforce/leave history still applies | Roles outside tracking scope |
| `EXCEPTION_BASED` | Published schedule is presumed satisfied unless leave or a governed exception exists | Salaried/corporate employees |
| `CLOCK` | Append-only clock/break events form work sessions | Hourly/shift workers |
| `TIMESHEET` | Daily/weekly entries are submitted and approved | Contractors/project work |
| `KIOSK` | Controlled shared-device events, without biometrics | Site-based teams |

Recommendation: extend the Unit 5 schedule aggregate. Keep `HrWorkSchedule` as stable identity and `HrWorkScheduleVersion` as immutable expectation. Normalize version intervals into child rows for validation/querying while retaining `weeklyPattern` as a compatibility snapshot. Add shift templates, rotation patterns, published schedule instances, and assignments referencing the exact schedule version. Unit 5 continues consuming the same shared version.

Schedule versions support IANA timezone, local weekday, local start/end, expected minutes, flexible/grace windows, paid/unpaid breaks, split/overnight segments, on-call flag, work arrangement, and optional governed location. Published instances are immutable; changes publish a new version and generate affected-employee tasks/notifications. Exclusion constraints prevent overlapping employee shifts and overlapping effective assignments.

Policy resolution precedence, highest first: explicit assignment/work relationship; shift assignment; position; employee/worker type plus legal entity and location; department/grade/work arrangement; legal entity/country; organization default. More constrained matches win within a tier; explicit priority resolves intentional overlaps; equal winners fail closed with an actionable configuration error. The resolution snapshot records candidate IDs and the winner.

## 6B — Time capture as evidence

- `TimeEvent` is append-only: organization, person, work relationship, assignment, event type, UTC instant, IANA zone, resolved local date/time/offset, source, external receipt, idempotency key, optional device/kiosk reference, optional coarse location assertion, received time, correction lineage, and correlation.
- Client timestamps never override trusted receipt/provenance. Offline replay preserves both occurred-at and received-at and rejects impossible future/skew windows according to policy.
- Clock sessions are projections over events. Duplicate clock-in/out is an idempotent replay when the same receipt/key is used and a deterministic conflict otherwise.
- Timesheets contain versioned periods and immutable submitted versions. Entries carry local work date, duration/category, optional project/cost references, comment, and source; edits after submission create a new version.
- Exception-based workers record only governed exceptions/corrections. Normal days can be materialized by a worker as policy-derived attendance, with exact input snapshots.
- Kiosk identity is authenticated account/badge/PIN policy, never biometric. Device registration, revocation, and event signing are separately auditable.

Clock session conceptual state: `NOT_STARTED → CLOCKED_IN ↔ ON_BREAK → CLOCKED_OUT`; `CORRECTION_REQUIRED` is a governed projection state, not mutation of events. Invalid order yields an exception and no authoritative hours.

Timesheet conceptual state: `DRAFT → SUBMITTED → IN_REVIEW → APPROVED → LOCKED`, with `RETURNED`, `REJECTED`, `WITHDRAWN`, and append-only `CORRECTED_AFTER_LOCK` paths.

## 6C — Attendance interpretation

The engine resolves the exact assignment, policy, schedule/shift, holiday calendar, Unit 5 leave segments, and raw evidence for a local attendance date. It writes a reproducible input snapshot and categorized minute totals.

Possible outcomes include present, late, early departure, missing in/out, absent, approved leave, holiday, non-working day, overtime candidate, under-time, break exception, schedule exception, and pending correction. Names will be finalized to repository enum conventions during implementation.

Interpretation is policy-driven: grace windows affect classification; they do not erase evidence. Extra time is only an overtime candidate until the configured approval rule accepts it. Money is never calculated. Recalculation appends a new interpretation version and records why the prior version was superseded.

Unit 5 precedence:

- Approved full-day leave explains the overlapping scheduled obligation.
- Partial/hourly leave partitions expected minutes; worked plus leave minutes cannot exceed the allowable window without an explicit overtime/overlap exception.
- Cancelled or retroactively corrected leave queues deterministic re-interpretation.
- `ON_LEAVE` long absence suppresses normal obligations through the effective interval; return-to-work restores them at the Unit 4 boundary.

## Breaks and overtime classification

Break rules are versioned policy inputs: scheduled, employee-recorded, paid/unpaid, optional auto-deduct, minimum/maximum, missed/excessive exception. Auto-deduction is transparent in the interpretation snapshot and correctable. Jurisdiction rules are configuration packages, not hardcoded engine logic.

Overtime classification produces minutes by category: daily threshold, weekly threshold, weekend, holiday, shift premium, approved extra time, or unapproved extra time. Precedence avoids double classification unless policy explicitly allows stacking. Unit 9 prices categories; Unit 6 does not calculate wages.

## 6D — Corrections, approvals, locking

- Employee correction requests reference exact evidence/attendance versions and proposed changes.
- Manager/HR decisions require direct-report or permission scope, expected version, reason, and separation of duties. Employees cannot approve their own time.
- Manager change during review snapshots the authorized reviewer at submission while allowing governed reassignment with audit.
- Corrections append adjustment events and a new interpretation; original clock/timesheet evidence remains.
- Attendance periods support daily, weekly, biweekly, monthly, and custom boundaries with IANA-zone local dates.
- Period states: `OPEN → SUBMITTED → APPROVED → LOCKED`; return/reject paths remain before lock. Post-lock correction creates a new correction batch and payroll-impact signal, never unlocks/replaces the original silently.
- Payroll export claims one locked snapshot/version. A later correction produces a new adjustment event, never alters the exported payload.

Attendance exception conceptual state: `OPEN → EXPLAINED | CORRECTION_PENDING → APPROVED → RESOLVED`, with `REJECTED`/`WAIVED` governed outcomes.

## 6E — Unit 4 and Unit 5 integration

Unit 4 boundaries:

- No obligations before work-relationship/assignment start or after effective end.
- Transfer, location, work arrangement, manager, position, grade, or employment-type changes trigger effective-dated policy/schedule resolution; history remains on the old assignment.
- Separation closes future unpublished obligations and cancels/flags open time workflows according to policy; published historical expectations remain.
- Rehire reuses Person, creates a new work relationship/assignment, and resolves a new policy. No attendance crosses relationships.

Unit 5 boundaries are described above. Leave approval/cancellation emits or schedules an idempotent attendance reinterpretation request keyed by leave version and attendance date. Unit 6 stores references, not copied leave truth.

## 6F — reporting, automation, payroll handoff, and recovery

Manager UX is exception-first: today/week schedule, present/away summary, exceptions, corrections, timesheets awaiting review, and schedule planning. Managers do not review normal exception-based days individually.

Employee UX varies by mode: schedule and exception reporting; clock/break/current state/missed-punch correction; or timesheet entry/submission/history. HR manages policies, schedules, shifts, periods, corrections, locks, overtime classification, reports, audit, and reconciliation. Overrides require explicit permission and reason.

Stable payroll contract, versioned and idempotent per organization/period/employee/assignment:

- regular approved minutes;
- overtime minutes by category;
- unpaid absence minutes;
- paid leave minutes with Unit 5 reference;
- shift-premium classifications;
- approved correction deltas;
- locked-period ID/version and source correlation;
- retroactive adjustment signal.

Only locked authoritative time is exportable. The contract excludes wage rates, gross-to-net, and payment calculation.

Workers: schedule publication, attendance interpretation, missing-punch detection, period reminders/close, leave/workforce re-interpretation, reconciliation, and payroll-export preparation. Each job uses unique organization/job/window keys, a lease/claim token, attempt count, checkpoint, safe error, correlation, retry/backoff, and dead-letter/recovery state. Replay is harmless.

## Proposed repository data model

Names are recommendations subject to Prisma naming review.

| Entity | Purpose and mutability | Required constraints/indexes/privacy |
|---|---|---|
| `HrTimePolicy` / `Version` | Stable policy plus immutable tracking/break/grace/overtime configuration | org/code unique; version unique; effective-range and status indexes; HR manage, history retained |
| `HrTimePolicyApplicability` / `Assignment` | Deterministic scoped/explicit resolution | tenant FKs; priority/scope indexes; exclusion against overlapping explicit assignments |
| extensions to `HrWorkScheduleVersion` + `HrScheduleInterval` | Shared expected-work foundation | exact version/sequence unique; local interval validation; never rewrite published rows |
| `HrShiftTemplate` / `Version` | Reusable split/overnight/break pattern | org/code and version uniqueness; timezone/local interval indexes |
| `HrShiftAssignment` / published occurrence | Employee/assignment expectation | tenant employee/assignment/effective indexes; PostgreSQL exclusion for overlap |
| `HrTimeDevice` / kiosk registration | Controlled capture source | org/device key unique; credential stored hashed; status/revocation audit; restricted metadata |
| `HrTimeEvent` | Immutable raw evidence | org/source/idempotency unique; assignment/occurred-at, local-date, received-at indexes; retention policy |
| `HrClockSession` | Rebuildable projection and correction state | event lineage; one open session per assignment/policy scope via partial unique index |
| `HrTimesheet` / `Version` / `Entry` | Versioned periodic reporting | employee/period unique; version and entry sequence unique; optimistic version |
| `HrAttendanceDay` / `InterpretationVersion` | Expected-vs-actual result and reproducible inputs | assignment/local-date unique aggregate; interpretation version unique; snapshot immutable |
| `HrAttendanceException` | Actionable anomaly | type/status/date indexes; exact interpretation reference; optimistic version |
| `HrTimeCorrection` | Governed append-only proposed/approved adjustment | source/correction lineage, workflow, expected version, correlation; no source overwrite |
| `HrAttendancePeriod` / `HrPeriodLock` | Submit/approve/lock boundary | org/type/local range unique; lock version/hash/export state; immutable lock |
| `HrAuthoritativeTimeEntry` | Approved categorized minutes | lock/employee/assignment/date/category unique; immutable; payroll-reader field scope |
| `HrTimeWorkerRun` | Idempotent automation evidence | org/job/window unique; lease/status/attempt indexes; safe errors only |

Every table carries organization ownership directly or through a parent with composite tenant integrity enforced in commands and, where practical, composite foreign keys. Use `Restrict` for authoritative history. Retention separates raw device/location evidence from longer-lived attendance totals/audit.

## Timezone and DST model

- Persist UTC instants plus IANA zone and resolved offset/local date used for interpretation.
- Schedule definitions use local wall time and IANA zone. Overnight shifts retain one business-date anchor and explicit end-day offset.
- Ambiguous DST fall-back instants require offset/fold disambiguation; nonexistent spring-forward local times fail publication or follow an explicit policy rule.
- Travel/cross-zone work resolves policy-approved event zone; assignment zone remains the schedule authority unless an effective override exists.
- Leap days, timezone database changes, and policy changes do not alter snapshots already approved/locked.

## Authorization and privacy matrix

| Actor | Record scope | Field/action scope |
|---|---|---|
| Employee | Own current and history | Capture allowed mode, draft/submit own timesheet, request correction; no approval/lock/device secrets |
| Manager | Effective direct reports/delegation only | Schedule/team exception and approval fields; no precise location/device fingerprint or HR-confidential fields |
| Delegated manager | Explicit dated delegation scope | Same narrow delegated actions; cannot delegate onward or self-approve |
| HR | Tenant and granted permissions | Policy/schedule/correction/lock; location/device details only when purpose requires; override reason mandatory |
| Administrator | Tenant administration | Configuration and authorization; sensitive evidence still purpose/permission scoped |
| Auditor | Authorized tenant history | Read-only evidence, transitions, locks, exports, redacted device/location data |
| Future payroll reader | Locked entries only | Required categories/corrections; no raw punches, device/location evidence, or unapproved time |

Location is event-time proof only, preferably a site/geofence assertion rather than continuous coordinates. Precise coordinates are optional, encrypted/restricted, short-retained, excluded from routine manager views, and collected only under explicit policy and notice. Device data is minimized to fraud/security purpose. No covert monitoring.

## Concurrency and failure contract

All payroll-impacting commands use PostgreSQL serializable transactions with bounded retry, row/version guards, unique idempotency keys, and deterministic conflicts.

| Race/failure | Required result |
|---|---|
| duplicate clock event/offline replay | one evidence row; replay returns prior receipt; conflicting payload rejected |
| clock-out without/open-session race | one valid state transition; invalid event preserved as exception, not authoritative time |
| clock event vs correction | exact-version correction wins or becomes stale; event remains immutable |
| approval vs withdrawal/edit | one version wins; loser receives stale-state response |
| schedule/shift change vs event/worker | event binds to effective published version; re-interpretation is versioned |
| leave approval vs absence classification | leave-version event queues idempotent reinterpretation; no double absence |
| period lock vs correction/export | lock/export claims exact version; later correction becomes explicit adjustment |
| worker replay/failure | one job/window application, retry or dead-letter; no duplicate notification/audit/business row |
| separation during open time | effective boundary closes obligations; unresolved pre-boundary time remains reviewable |

Missing/ambiguous policy or schedule, overlapping shifts, invalid timezone, stale correction, unauthorized scope, or inconsistent evidence fails closed before authoritative time or payroll handoff.

## Notifications, tasks, and observability

Use HR sender category and existing outbox/task infrastructure for shift publication/change, missed clock-out, correction required, timesheet due/submitted, approval required, returned/rejected, period closing, and period locked. Recipient comes from configured employee/manager identity. Keys include template, subject/version, recipient, and event correlation.

Proposed metrics (not yet implemented): event ingestion failures/lag, duplicate attempts, open clock sessions, missed punches, engine lag, unresolved exceptions, timesheet/approval backlog, worker retries/dead letters, reconciliation mismatch, locked-period corrections, export backlog, and policy/schedule ambiguity. Alerts must be tenant-safe and contain no precise location or confidential evidence.

## Migration strategy

1. Add enums and nullable stable aggregates; add tenant/effective/status indexes.
2. Add policy/shift/version tables and normalized schedule intervals without removing Unit 5 JSON.
3. Backfill schedule intervals from valid published Unit 5 versions with reconciliation reports; keep dual-read compatibility.
4. Add evidence, projection, attendance, correction, period/lock, authoritative entry, and job-run tables.
5. Add partial unique/exclusion constraints after conflict diagnostics pass.
6. Introduce nullable references, backfill/snapshot, verify, then make required in a later migration.
7. Deploy code capable of reading old and new schedule representations before any write cutover.

No destructive rewrite of Units 1–5 history. Forward-fix is preferred; rollback leaves additive schema intact and disables Unit 6 routes/workers.

## Owner decisions required before implementation

1. Jurisdictions and initial labor-rule configuration packages; core engine stays jurisdiction-neutral.
2. Default tracking mode by worker population and whether any production population uses `KIOSK` at launch.
3. Location-evidence policy, precision, retention, employee notice/consent, and permitted sites. Recommendation: no precise location at launch unless legally/business-required.
4. Raw event/device metadata retention versus authoritative attendance/audit retention.
5. Attendance period defaults and lock/retroactive-correction approval authority.
6. Overtime approval/stacking rules and future project/cost-allocation scope.
7. Offline clock maximum delay/skew and kiosk credential method (non-biometric).
8. Whether Unit 5 schedule JSON is normalized in Unit 6 implementation or retained indefinitely with a normalized projection.

## Known risks

- DST and overnight interpretation can corrupt payroll inputs without snapshot/fold tests.
- Mutable legacy schedule JSON/settings cannot be used as historical authority.
- Over-collection of location/device data creates disproportionate privacy risk.
- A single 512 MB web process currently hosts scheduled worker calls; capacity must be profiled before Unit 6 ingestion load is approved.
- Existing accepted email-deliverability risk remains separate and must be reaccepted or resolved at Unit 6 release.
