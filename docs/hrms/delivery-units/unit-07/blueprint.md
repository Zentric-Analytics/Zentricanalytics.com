# Unit 7 — Performance, Goals, Career Development & Promotion Readiness

Status: **UNIT 7 BLUEPRINT COMPLETE — READY FOR IMPLEMENTATION APPROVAL**

This is an architecture blueprint only. It authorizes no Unit 7 runtime implementation, migration, staging deployment, or production change. Repository facts are in `repository-audit.md`; recommendations and owner decisions are distinguished below.

## Governing architecture

`Job Architecture → Goals → Evidence → Continuous Feedback → Performance Review → Calibration → Development → Promotion Readiness → Promotion Decision → Unit 4 Workforce Event`

Performance describes current-role outcomes and behaviors. Readiness describes sustained evidence against a specific target profile/level. Promotion is a governed business decision. Unit 4 alone changes the official assignment, job, grade, or position.

## 7A — Job architecture and level expectations

### Recommended framework

- Add stable tenant-owned job functions above existing `HrJobFamily`.
- Add stable career tracks (`IC`, `PEOPLE_MANAGER`, and configurable future tracks) and effective track transitions. Changing track creates history; it never rewrites prior assignments or reviews.
- Add company levels as configurable stable identities with immutable published versions. Recommend Z1–Z8 as initial internal codes, defined by organizational scope rather than tenure.
- Keep `HrGrade` separate. A level may map to allowed grades through versioned configuration, but level is career scope and grade is organizational/compensation structure.
- Add `HrJobProfileVersion` referencing the existing stable `HrJobProfile`, exact family, track, company-level version, title, responsibilities, requirements, and effective interval.
- Add reusable expectation dimensions: scope, independence, complexity, impact, influence, leadership, judgment, collaboration. A published company-level version defines common expectations; a published family/profile version interprets them professionally.
- Add competencies as broad demonstrated capabilities and optional skills as specific knowledge/capability. A competency expectation ties a competency, required demonstration, target level/profile version, evidence guidance, and importance descriptor. Avoid decimal pseudo-precision.

Employee visibility recommendation: show career title and plain-language expectations by default; show internal Z-level labels only after owner approval. Managers/HR always see the internal reference needed for governance.

Recommended starting scope framework for owner review (configurable, not seeded until approved):

| Level | General scope | IC interpretation | People-manager interpretation |
|---|---|---|---|
| Z1 | Learns and delivers bounded work with close guidance | Entry practitioner | Not normally a manager level |
| Z2 | Owns routine work with decreasing guidance | Independent practitioner | Team coordination only where separately authorized |
| Z3 | Independently owns significant team work | Experienced practitioner | First-line manager of a bounded team |
| Z4 | Leads complex work with cross-team impact | Senior practitioner | Established manager of a team/function segment |
| Z5 | Shapes multiple systems/programs or teams | Staff/lead practitioner | Senior manager over multiple related teams |
| Z6 | Sets function-wide direction and resolves broad ambiguity | Principal practitioner | Director-level functional leadership |
| Z7 | Produces enterprise-level strategy and durable organizational impact | Distinguished/enterprise practitioner | Executive functional leadership |
| Z8 | Sets company-wide direction at the highest accountable scope | Exceptional company-level IC | Company executive leadership |

Titles are family-specific and are not derived automatically from these labels. IC and manager profiles can share an organizational level while requiring different professional expectations. A track movement creates a new effective job-profile/assignment relationship through Unit 4; the former track/profile remains historical. Cross-track movement is not treated automatically as a promotion or demotion.

### Version rules

Stable masters may change name/status with audit. Published level, profile, competency-framework, rating-scale, and promotion-criteria versions are immutable. New meaning requires a successor version with `effectiveFrom`, optional `effectiveTo`, `supersedesId`, publisher, reason, and content hash. Goals, reviews, readiness assessments, and promotion cases store exact version IDs.

## 7B — Goals, evidence, continuous feedback, and check-ins

### Goals

`HrPerformanceGoal` is the stable aggregate; `HrPerformanceGoalVersion` is an immutable material version. Scope supports company, department, team, and individual goals. Type supports aligned, operational, developmental, and growth goals. Alignment uses an edge table with exact parent goal/version, alignment narrative, effective interval, and no requirement that every individual goal has a parent. Organizational changes do not destroy the historic edge.

Simple goals require only title, owner, type, outcome description, due date, and cycle/period. Optional fields include weight, measure, baseline, target, contributors, milestones, alignment, and evidence guidance. Weights are descriptive allocation and must not automatically calculate an official performance rating.

Goal state: `DRAFT → PROPOSED → ACTIVE → COMPLETED`, with `RETURNED`, `CANCELLED`, and a governed `REVISED` lineage. Progress updates and milestone completion append progress/evidence records without creating a version. Changes to outcome, measure, target, owner, due date, weight, or alignment after proposal create a new immutable version and require reason/reapproval according to policy.

### Evidence

`HrPerformanceEvidence` records subject, author/source, type, occurred interval, summary, exact source reference/version, visibility, verification status, and correlation. Sources include goal/milestone, employee submission, manager/peer feedback, recognition, project achievement, development action, finalized probation review, approved workforce event, and—only when policy permits—specific Unit 6 evidence. Attendance must never be interpreted automatically as performance.

Files reference an exact clean `HrEmployeeDocumentVersion`. Evidence becomes immutable when attached to a submitted review/readiness snapshot; corrections supersede with lineage. Learning completion is evidence, never automatic mastery/readiness.

### Feedback and check-ins

Recommended feedback kinds: recognition, coaching, developmental, manager, peer, achievement acknowledgment, and check-in note. Visibility is explicit: employee-visible, manager-and-employee, HR-confidential, or calibration-only. Do not implement an unrestricted “private manager dossier.” If owner approves private manager notes, restrict them to legitimate time-bounded coaching purpose, prohibit promotion/review use unless disclosed/reclassified, and audit access.

Submitted feedback is immutable; a short configurable draft window may permit author edits. Corrections supersede rather than overwrite. Formal review snapshots include only evidence explicitly selected and permitted for that audience.

`HrPerformanceCheckIn` is lightweight: employee, effective manager snapshot, date/cadence, shared topics, blockers, agreed actions, next date, visibility, and version. Private HR/calibration material is never stored in shared check-in text.

## 7C — reviews and calibration

### Cycles and templates

`HrPerformanceCycle` defines tenant, code, type, population rules, local dates, review cadence, workflow definition/version, and state. `HrReviewTemplate` has immutable published versions composed from versioned sections/questions and an exact rating-scale version. Do not hardcode forms.

Cycle state: `DRAFT → PUBLISHED → OPEN → CALIBRATION → FINALIZING → CLOSED`, with governed cancel/reopen that creates an amendment and audit. Review state: `NOT_STARTED → SELF_REVIEW → MANAGER_REVIEW → CALIBRATION → FINALIZED`; `RETURNED`, `SKIPPED_SELF`, and governed reopen are explicit.

`HrPerformanceReview` stores employee/work-relationship/assignment snapshots, manager-at-cycle and reviewer-at-submission, exact template/profile/level versions, optimistic version, and correlation. Self and manager submissions are separate immutable versions. The manager evaluates results and behaviors separately and supplies rationale for judgment. Self-review remains employee evidence, not the official outcome.

### Ratings

Add stable rating-scale identity and immutable version/items. Recommend five descriptive categories initially: Does Not Meet, Partially Meets, Meets, Exceeds, Significantly Exceeds; labels remain configurable and require owner approval. Store item identity and narrative meaning, not arbitrary decimal averages. Section ratings may be supported, but the final outcome is an explicit governed decision with rationale.

### Calibration

`HrCalibrationSession` defines population, participant grants, confidentiality, exact review snapshots, and state. Candidates preserve manager-proposed outcome. `HrCalibrationDecision` stores calibrated outcome, rationale, decision maker/panel, exact candidate version, and immutable history. Calibration never edits manager review.

Calibration state: `DRAFT → POPULATION_LOCKED → IN_SESSION → DECISIONS_PENDING → FINALIZED`, with cancelled session retained. Access grants are session-specific, dated, tenant-scoped, and cannot be inferred merely from management hierarchy.

Employee-visible final review includes the approved outcome and employee-facing rationale. Panel deliberation and calibration-only notes remain restricted; auditors see decision metadata and redacted evidence unless separately authorized.

## 7D — development and career growth

`HrCareerInterest` records preferred track, target profile/level, mobility interest, effective dates, visibility, and employee assertion; it never creates entitlement or readiness.

`HrDevelopmentPlan` is a stable employee plan with immutable versions and state `DRAFT → ACTIVE → COMPLETED`, plus `REVISED`/`CANCELLED`. Structured actions contain a gap/desired capability, action type, owner, mentor/coach, due/review dates, required evidence, status, and exact expectation version. Mentors receive only action-level access they need.

Development action types include project experience, mentoring, learning, stretch assignment, observation, and demonstrated practice. Completion requires evidence but does not automatically change competency or readiness. Recommendation: employee and manager co-own plans; HR governs templates and exceptions.

## 7E — readiness and promotion cases

### Readiness

`HrPromotionReadinessAssessment` references employee, current assignment/profile/level snapshot, exact target profile/level/expectation versions, assessor, cycle/case, selected evidence across time, gaps, rationale, and state. It has no hidden composite score.

Recommended explainable states: `NOT_YET_READY`, `DEVELOPING`, `APPROACHING_READY`, `READY_NOW`. “Ready in 6–12 months” should be guidance/forecast text, not a state with false precision. `READY_NOW` requires evidence across the configured sustained-evidence window, but duration is job-family/policy guidance rather than a global hardcoded number.

Readiness is immutable when submitted/finalized. A later assessment supersedes it. Readiness is target-specific and expires/requires review when the target expectation, current assignment, or workforce state materially changes.

### Promotion case and decision

`HrPromotionCase` snapshots person, work relationship, assignment, current and target profile/level/track versions, promotion cycle, readiness assessment, evidence selection, business justification, proposed effective date, workflow instance, optimistic version, idempotency key, and correlation. Only one non-terminal case per employee/target/effective window is allowed.

State: `DRAFT → MANAGER_RECOMMENDED → CALIBRATION → HR_REVIEW → BUSINESS_APPROVAL → APPROVED`, with `RETURNED`, `DEFERRED`, `REJECTED`, `WITHDRAWN`, `CONFLICTED`, and `EXECUTION_PENDING/APPLIED/FAILED`. Self-approval is prohibited; stale snapshots fail safely.

`HrPromotionDecision` is an immutable approval/rejection/defer record. An approved decision does not change employment. It creates exactly one Unit 4 `PROMOTION` workforce event using an idempotency key derived from the decision and stores the event/version/correlation. Unit 4 validates target position, grade/job, conflicting events, separation/leave boundaries, and effective date. Failure marks the case conflicted/failed for governed resolution; Unit 7 never bypasses Unit 4.

Compensation calculation is out of scope. Stable outputs may later feed compensation. Succession planning and “high potential” labels are deferred pending separate approval.

## 7F — automation, reporting, governance, and recovery

### Authorization and privacy

| Actor | Record scope | Allowed content/actions |
|---|---|---|
| Employee | Own employment episode | Own goals, permitted evidence/feedback, check-ins, self-review, development/career interest, final employee-visible outcome; no panel notes or official decisions. |
| Manager | Effective direct reports/delegation | Propose/approve goals, feedback, check-ins, reviews, development, readiness recommendation; no unrelated employees, self-approval, HR-confidential identity data, or panel-only sessions. |
| Delegated manager | Explicit dated subject/action scope | Only delegated actions; no onward delegation; historical delegation preserved. |
| HR | Tenant plus granted permission | Cycle/template governance, review exceptions, development oversight, promotion validation; private feedback requires separate purpose permission. |
| Talent administrator | Tenant plus talent permissions | Framework, calibration, readiness, promotion workflows; no system administration or unrelated payroll/security authority. |
| Calibration participant/business leader | Explicit session/population grant | Snapshot and decision fields for that session only. |
| Administrator | Tenant configuration | Permission/configuration administration; sensitive narratives still need the relevant content permission. |
| Auditor | Authorized tenant history | Read-only final outcomes, transitions, version hashes, decision metadata, Unit 4 correlation; restricted narratives redacted. |

Every server command checks tenant, permission, subject scope, effective manager/delegation, visibility class, state, and expected version. Direct-ID and cross-tenant requests fail closed. UI hiding is supplementary only. Protected characteristics are excluded from rating/readiness inputs and routine calibration views.

### Concurrency contract

Use PostgreSQL serializable transactions with bounded retry, row/version guards, unique tenant/idempotency keys, immutable snapshots, and outbox writes in the same transaction.

| Race | Deterministic result |
|---|---|
| Goal edit vs approval | Approval claims exact version; edit becomes successor or loses stale-version conflict. |
| Self-review vs manager submission | Independent sections submit once; manager flow waits or applies configured skip rule. |
| Manager rating vs calibration | Manager submission remains immutable; calibration appends separate decision. |
| Recommendation vs transfer/separation | Workforce snapshot mismatch marks case stale/conflicted before approval/event creation. |
| Duplicate promotion approval | One decision and one Unit 4 event by unique decision/idempotency key. |
| Development edit vs finalization | Exact plan version wins; loser refreshes and creates successor. |
| Cycle close vs late submission | Close claims cycle/version; late submission is rejected or placed in governed exception queue. |
| Worker/outbox replay | One job-window/state transition/message; replay returns existing result. |

### Workers and notifications

Workers: cycle opening, self/manager reminders, overdue detection, check-in reminders, development-action reminders, calibration preparation, promotion reminders, cycle finalization, Unit 4 handoff reconciliation, and integrity reconciliation. Runs require organization/job/window uniqueness, lease token, attempts, checkpoint, bounded batch, safe error, retry/dead-letter state, and correlated audit.

Register Unit 7 templates under the existing HR sender category: goal action/due, feedback received when visible, check-in due, self-review open/due, manager review due, calibration task, development action due, promotion case submitted/decision, and review finalized. Unknown templates fail closed. Recipient comes from configured employee/user identity. Outbox/in-app notification keys include template, subject/version, recipient, and event correlation.

### Reporting and observability

Permission-scoped reports cover overdue/at-risk goals, check-in recency, review/manager backlog, development gaps, readiness by target, promotion backlog/duration, finalized calibrated outcomes, and distribution differences. Distribution analytics flag patterns for review; they do not accuse or automatically decide. Small groups require suppression.

Operational metrics proposed—not yet implemented—include stuck cycle stages, overdue submissions, calibration backlog, promotion handoff backlog, worker retries/dead letters, duplicate attempts, outbox backlog, unresolved Unit 4 events, stale snapshot conflicts, and reconciliation mismatches. Alerts contain IDs/counts, not sensitive narrative.

## Proposed data model

All records are tenant-owned (`organizationId`) and use `Restrict` for authoritative history. Names are recommendations subject to implementation review.

| Aggregate/entity | Keys, relationships, indexes, mutability, privacy |
|---|---|
| `HrJobFunction` | org/code unique; parent optional; effective status; HR-manage, employee-readable if published. |
| `HrCareerTrack` | org/code unique; effective status; immutable use in published profile versions. |
| `HrCompanyLevel` / `Version` | org/code and identity/version unique; rank only orders display, never scoring; published version immutable/content-hashed. |
| `HrJobProfileVersion` | profile/version unique; exact family/function/track/level-version; effective/status index; published immutable. |
| `HrCompetency` / `Version` | org/code and version unique; stable definition with immutable published meaning. |
| `HrCompetencyExpectation` | exact profile/level/competency versions; unique tuple; descriptive expectation/evidence guidance. |
| `HrPerformanceCycle` | org/code unique; type/status/date indexes; exact workflow/template versions; optimistic version. |
| `HrReviewTemplate` / `Version` | org/code and version unique; immutable sections/questions/rating-scale reference. |
| `HrRatingScale` / `Version` / `Item` | org/code, version, item order/code unique; descriptive categories only. |
| `HrPerformanceGoal` / `Version` | stable goal plus owner/scope/cycle; version unique; active owner/due/status indexes; submitted versions immutable. |
| `HrGoalAlignment`, `Milestone`, `Progress` | exact goal versions; unique edges/sequences; append progress; prevent alignment cycles. |
| `HrPerformanceEvidence` / link | subject/source/version/visibility/occurred dates; exact document/source; immutable when snapshotted. |
| `HrPerformanceFeedback` / `Version` | author/subject/kind/visibility/status; author/subject/date and scope indexes; submitted immutable; restricted content. |
| `HrPerformanceCheckIn` / `Version` | employee/manager/date; version unique; shared and restricted fields separated. |
| `HrPerformanceReview` | employee/work relationship/cycle unique; exact assignment/profile/template snapshots; state/version indexes. |
| `HrSelfReviewVersion`, `HrManagerReviewVersion` | review/version unique; submitted immutable; evidence selections normalized. |
| `HrCalibrationSession`, participant, candidate, decision | session/population grants; exact review/manager-outcome snapshot; one current decision version; panel-private. |
| `HrCareerInterest` / `Version` | employee/effective dates; exact target profile/track; employee/HR scoped. |
| `HrDevelopmentPlan` / `Version` / `Action` | employee/status/review-date indexes; structured gaps/actions; submitted versions immutable. |
| `HrPromotionReadinessAssessment` / evidence/gap | target-version specific; assessor/status/date indexes; finalized immutable; talent-confidential by policy. |
| `HrPromotionCase` / `Decision` | employee/target/effective/status, version/idempotency/correlation unique; decision immutable; exact Unit 4 event link. |
| `HrPerformanceJobRun` | org/job/window unique; lease/status/attempt/checkpoint; safe operational metadata only. |

Composite tenant integrity is enforced in commands and, where practical, composite foreign keys. Partial/exclusion constraints prevent overlapping published versions and duplicate active promotion cases after diagnostics.

## Effective dating and organizational change

- Manager change preserves original reviewer snapshot and future ownership. Governed reassignment records old/new reviewer and reason.
- Transfer/job/department/location changes preserve prior evidence context; future goals/reviews resolve the new assignment/profile. Open promotion cases become stale if a material snapshot field changes.
- Long-term leave pauses/extends due dates according to cycle policy without interpreting leave as poor performance.
- Separation closes or withdraws open employee workflows at the effective boundary while retaining history.
- Rehire preserves Person history but uses the new work relationship/assignment; prior reviews never attach to the new relationship accidentally.

## Migration strategy

1. Add stable job-function/track/level/competency identities and nullable version tables.
2. Backfill exact references from existing job families/profiles/grades only after diagnostics; do not infer career level from grade automatically.
3. Add cycles, templates, rating scales, goals/evidence, feedback/check-ins.
4. Add reviews/calibration, development/career, readiness/promotion aggregates.
5. Add nullable Unit 4 promotion-decision correlation and code that tolerates absent Unit 7 rows.
6. Add indexes and validated uniqueness/exclusion constraints after orphan/overlap diagnostics.
7. Move nullable references to required only in later forward migrations after reconciliation.

All migrations are additive and remain compatible with the deployed Unit 6 application. No Units 1–6 history is rewritten. Rollback disables Unit 7 routes/workers while leaving additive schema intact.

## Test and production-readiness matrix

Implementation must cover unit/domain, integration, browser, real PostgreSQL concurrency, security/privacy, worker recovery, email/outbox, load, and restore tests for every 7A–7F aggregate. Mandatory scenarios include published-version immutability, IC/manager tracks, goal revisions/alignment cycles, evidence/document versions, each feedback visibility class, manager changes, self/manager submission races, calibration privacy, readiness without scoring, stale/duplicate promotion decisions, Unit 4 transfer/separation conflicts, rehire relationship isolation, direct-ID/cross-tenant denial, worker replay/dead letter, and recipient-backed delivery.

Release gates: complete automated suite; TypeScript; ESLint zero warnings; Prisma validation; build; migration review/status; staging preflight; health/readiness; complete role privacy matrix; real PostgreSQL concurrency; safe load; encrypted fresh backup; isolated restore; zero relevant duplicates/orphans; and one coherent browser lifecycle.

## Full staging lifecycle and restore correlation

`Person → Work Relationship → Assignment → published Job Profile/Level Expectations → Goals → Check-ins → Feedback/Evidence → Self Review → Manager Review → Calibration → Final Outcome → Career Target → Development Gaps/Plan → Sustained Target Evidence → Readiness Assessment → Promotion Case/Decision → Unit 4 Promotion Event → New Assignment → Audit → Encrypted Backup → Isolated Restore`

The browser journey must prove separation of duties, stale-version rejection, employee/manager/HR/talent/auditor privacy, idempotent notifications/workers, and exact correlation throughout. Restore verifies all exact versions, prior/final assignment, decision lineage, Unit 4 event, documents, outbox, and audit with zero duplicates/orphans and plaintext cleanup.

## Known risks and deferred functionality

- Sensitive feedback/calibration can become a covert dossier if visibility, purpose, and retention are vague.
- Manager and organization changes create stale reviewer/population snapshots unless explicitly reconciled.
- Grade-to-level backfill can encode false assumptions; require owner-approved mappings.
- Rating distribution analytics can mislead for small populations; suppress and contextualize.
- GoDaddy-to-Outlook automatic Inbox placement remains an accepted production risk from prior units; Unit 7 does not weaken email controls.
- Compensation/reward calculation, broad succession planning, “high potential” labels, AI scoring, automated promotion decisions, and attendance-derived performance are deferred.

## Owner decisions required before implementation

| Decision | Recommendation |
|---|---|
| Internal level framework | Approve configurable Z1–Z8 scope levels, with definitions/versioning before data backfill. |
| Employee level-label visibility | Show titles/expectations first; expose Z labels only if owner chooses transparency after rollout review. |
| Readiness visibility | Show employee-facing gaps/development and finalized readiness only; never expose panel deliberation. |
| Initial rating scale | Approve five descriptive categories; no numeric composite. |
| Review cadence | Start annual formal review plus lightweight quarterly check-ins; keep configurable. |
| Goal approval | Manager approval for individual material goals; optional approval for simple developmental drafts. |
| Feedback visibility | Approve explicit employee-visible, manager-and-employee, HR-confidential, calibration-only classes. |
| Private manager notes | Recommend defer; if approved, narrow purpose/retention and prohibit undisclosed decision use. |
| Calibration participants | Explicit session grants for HR/talent, accountable business leaders, and designated managers; no hierarchy-wide access. |
| Readiness states | Approve NOT_YET_READY, DEVELOPING, APPROACHING_READY, READY_NOW. |
| Sustained evidence | Configure guidance per family/target; require multiple dated evidence items, no universal month threshold. |
| Promotion workflow | Manager → calibration/talent → HR validation → business approval → Unit 4 event. |
| Succession planning | Defer; preserve only target/readiness extensibility. |
| Development ownership | Employee-manager co-ownership; HR controls frameworks/exceptions. |
| Retention | Owner/legal decision required by jurisdiction; recommend employment plus seven years for finalized decisions/audit, shorter policy-defined retention for private narratives. |

These decisions are policy gates, not technical blockers to understanding the design. Broad implementation requires explicit owner approval after reviewing them.
