# Unit 8 — Compensation & Rewards Management blueprint

Status: architecture recommendation awaiting owner decisions and implementation approval. Repository facts are in `repository-audit.md`. No Unit 8 runtime implementation is authorized by this document.

## Boundaries and invariants

Job Architecture → Compensation Market → Band Version → Policy Version → Employee Compensation → Eligibility → Recommendation → Budget/Range Validation → Exception → Approval → Immutable Decision → Effective Record → Unit 9 payroll handoff.

- Unit 4 owns identity, assignment, job/position/grade/location/legal-entity and effective workforce state.
- Unit 7 owns finalized performance, calibrated outcome, readiness and promotion decisions; it never calculates salary.
- Unit 8 owns compensation structures, authoritative compensation history, recommendations, budgets, exceptions, rewards and approved payroll inputs.
- Unit 9 owns payroll calendars, taxes, deductions, gross-to-net, payslips, bank files, payments and statutory filing.
- Only approved/effective Unit 8 records become payroll-authoritative. Drafts and confidential deliberation never enter the handoff.

## 8A — Compensation architecture

### Markets, currencies and pay basis

`HrCompMarket` is a stable tenant-owned identity. Immutable `HrCompMarketVersion` records contain country/region/locality, contractual currency, differential policy, status and effective range. Applicability is a versioned rule referencing legal entity, location, assignment work arrangement, employment type and optional job family; physical location alone does not decide market.

Use validated ISO-4217 codes but keep authoritative amounts in contractual currency. `HrCompFxRateSnapshot` stores source/reporting currency, rate, provider/reference, as-of time and content hash solely for analytics and budget conversion. Historic pay never changes when FX changes.

Initial pay bases: `SALARIED` and `HOURLY`. Store an amount per basis and an explicit annualized reference calculated under a versioned hours/calendar assumption. Daily, piece-rate and commission-heavy modes are deferred.

### Grade, band, policy and benchmarks

- `HrCompGrade`: stable compensation-grade identity, separate from Unit 7 Z-level and legacy `HrGrade`.
- `HrCompBand`: stable tuple of organization + job profile/family + optional company level + compensation grade + market + currency + pay basis.
- `HrCompBandVersion`: immutable published minimum/midpoint/maximum, effective range, reason, content hash, creator/publisher and supersession lineage. Published versions are insert-only.
- `HrCompPolicy` / `HrCompPolicyVersion`: versioned new-hire placement, promotion minimum, below/above-band guidance, geographic differential, merit guidance, budget and exception rules.
- `HrCompBenchmarkSnapshot`: separate provider/survey/date/market/job/level/percentile/currency/amount/confidence record. Bands may cite snapshots but never mutate when a survey changes.

Range position is deterministically computed against the exact band version: below minimum, lower, midpoint vicinity, upper, above maximum, plus an internal compa-ratio. It is decision support, never an entitlement or opaque score.

## 8B — base pay and authoritative history

`HrEmployeeCompensation` is the stable aggregate for organization + employee + work relationship. Rehire normally creates a new aggregate for the new work relationship; Person identity is preserved.

`HrCompensationRecord` is append-only and effective-dated. It records employee/work relationship/assignment, event type, currency, pay basis, base amount, annualized reference, market version, band version, grade, policy version, decision, effective range, recorded/approved/payroll-ready dates, correlation and content hash. A PostgreSQL exclusion constraint prevents overlapping authoritative records for one work relationship and component.

Recommended event vocabulary: `INITIAL`, `MERIT`, `PROMOTION`, `MARKET_ADJUSTMENT`, `RETENTION_ADJUSTMENT`, `TRANSFER_ADJUSTMENT`, `LEGAL_ADJUSTMENT`, `CORRECTION`. Awards remain separate event types and tables.

Corrections never update/delete history. A correction decision references the incorrect record, creates a corrected authoritative record and a `HrCompRetroactiveSignal` describing the affected window and old/new record IDs. Unit 9 computes money deltas. Off-cycle changes use the same decision pipeline.

Conflicts are resolved explicitly: legal adjustments take mandatory precedence; corrections block payroll claim for the affected version; promotion/transfer use the post-event assignment; merit may be merged, superseded or separately effective only under policy; unresolved overlapping events block approval.

## 8C — merit and compensation cycles

`HrCompCycle` and immutable versions define effective date, cutoff, population rule, policy version, recommendation/calibration/approval windows, FX snapshot policy, payroll handoff date and workflow definition. `HrCompCyclePopulation` snapshots employee, assignment, manager, current record, band, range position, Unit 7 outcome and eligibility explanation.

Budgets use a ledger, not a mutable total:

- `HrCompBudget`: cycle/currency/scope identity (company, business unit, department, manager or exception pool).
- `HrCompBudgetAllocation`: approved source amount plus reporting FX snapshot where needed.
- `HrCompBudgetEntry`: immutable `ALLOCATE`, `RESERVE`, `RELEASE`, `CONSUME`, `ADJUST` entries with idempotency and correlation keys.

Submission may reserve budget; draft never does. Approval/final decision atomically converts reservation to consumption. Return/rejection/withdrawal releases it. An approved over-budget exception either consumes an explicit exception pool, creates an audited allocation adjustment, or remains visibly over budget according to owner policy—never hidden.

`HrCompRecommendation` has stable identity and immutable submitted versions. Capture current record/band/range, exact Unit 7 outcome reference, policy guidance, proposed amount/increase, budget impact and manager rationale. Calibration creates a separate `HrCompCalibratedRecommendation`; it never overwrites the manager submission.

`HrCompException` records type (above band, budget, eligibility, policy), variance, exact inputs, restricted rationale and independent decisions. `HrCompDecision` is the immutable approved/rejected outcome; maker/checker rules prohibit self-approval and duplicate final decisions.

Suggested state machines:

- Cycle: `DRAFT → PUBLISHED → OPEN → REVIEW → FINALIZING → CLOSED`, with `CANCELLED` before closure.
- Recommendation: `DRAFT → SUBMITTED → HR_REVIEW → APPROVED`, plus `RETURNED`, `REJECTED`, `WITHDRAWN`, `SUPERSEDED`.
- Exception: `REQUESTED → REVIEW → APPROVED|REJECTED|WITHDRAWN`.
- Decision: `PENDING → APPROVED → SCHEDULED → EFFECTIVE`, plus `CANCELLED`, `SUPERSEDED`, `CORRECTED`, `FAILED`.

## 8D — bonus, incentive and reward awards

`HrBonusProgram`/version defines eligibility, target mode (percentage or amount), currency, budget and policy. `HrBonusAward` captures target reference, approved actual amount, award type, decision, effective/payment-reference date and payroll handoff. Initial award types: annual bonus, discretionary bonus, spot/recognition award, retention bonus and incentive award. Target is not actual award.

Complex incentive formula engines and equity administration are deferred. A future-safe external equity grant reference may exist, but no cap table or vesting engine belongs in Unit 8.

## 8E — total rewards and statements

Employee **My Compensation** shows only their finalized current base pay, basis, currency, bonus target, approved awards, effective history and released statements. It excludes peer pay, manager notes, calibration deliberation, exception rationale and diagnostics.

`HrCompStatement` is immutable metadata linking exact decisions/records/awards and an exact scanned private `HrEmployeeDocumentVersion`. Generate only after final approval. Statement types cover annual review, promotion, market adjustment and bonus award.

## 8F — payroll handoff, governance and recovery

`HrPayrollCompHandoff` is an immutable, idempotent contract containing employee/work relationship/assignment, compensation record or award ID, event type, amount/currency/basis, effective date, retroactive affected window, correlation, schema version and claim state. It excludes manager notes, diagnostics, benchmark internals and unapproved data. During transition, a reconciler may project effective Unit 8 base records into `HrSalaryRecord`; provenance and hash must prove exact equivalence until Unit 9 consumes handoffs directly.

### Proposed entity catalogue

All entities carry `organizationId`; direct-ID queries require it. Money uses `Decimal`, never float.

| Entity | Purpose / key constraints | Mutability, privacy and retention |
|---|---|---|
| `HrCompMarket`, `HrCompMarketVersion` | Stable market and unique version/content hash/effective range | Draft mutable; published versions immutable; retain indefinitely |
| `HrCompPolicy`, `HrCompPolicyVersion` | Stable philosophy and exact governed rules | Published immutable; restricted administration |
| `HrCompGrade` | Compensation grade identity | Archived, not deleted; not equal to Z-level |
| `HrCompBand`, `HrCompBandVersion` | Unique job/market/currency/basis identity and range versions | Published immutable; band amount access restricted |
| `HrCompBenchmarkSnapshot`, `HrCompFxRateSnapshot` | External evidence and reporting conversion context | Append-only; provider details restricted |
| `HrEmployeeCompensation` | Work-relationship aggregate | Stable; highly confidential |
| `HrCompensationRecord` | Effective authoritative base history | Append-only; exclusion constraint; indefinite employment/audit retention |
| `HrCompCycle`, `HrCompCyclePopulation` | Cycle configuration and frozen eligibility population | Published/snapshotted immutable |
| `HrCompBudget`, `HrCompBudgetAllocation`, `HrCompBudgetEntry` | Scoped funding and atomic reservation ledger | Ledger append-only; finance/comp restricted |
| `HrCompRecommendation`, version, calibrated recommendation | Manager proposal and separate calibration | Submitted versions immutable; restricted narrative |
| `HrCompException` and decisions | Explicit policy/band/budget override | Approved decision immutable; restricted rationale |
| `HrCompDecision` | One final decision per subject/version | Immutable; unique idempotency and subject decision keys |
| `HrBonusProgram`, version, `HrBonusAward` | Governed targets and actual awards | Published/approved immutable |
| `HrCompStatement` | Exact released statement/document linkage | Immutable, employee-readable only after release |
| `HrCompRetroactiveSignal` | Changed effective window for payroll | Immutable, replay-safe |
| `HrPayrollCompHandoff` | Minimal Unit 9 input | Append-only, claim/retry metadata separated from payload |

Indexes cover `(organizationId,status,effectiveFrom)`, subject/effective history, cycle/manager/status, budget/scope/currency, correlation, idempotency, exact Unit 4/7 references and worker claim windows. Restrictive FKs preserve history; no cascade from workforce masters.

## Promotion compensation

An approved Unit 7 promotion references exact promotion decision, target job-profile version and company-level version. Unit 8 resolves the effective Unit 4 target assignment, market and target band, snapshots current pay/range, applies versioned guidance and creates a recommendation. It never lets Unit 7 set salary or directly updates the assignment. Whether a promotion must reach the new band minimum is an owner decision. Above maximum always requires a governed exception unless policy explicitly forbids it entirely.

## Eligibility and policy explainability

Eligibility is a separate versioned evaluation with machine-readable reasons: recent hire, cutoff, separation, pending promotion/compensation event, leave, contract/employment type and policy exclusion. Ineligibility blocks recommendation but can enter an explicit exception workflow if policy permits. No performance label directly determines an increase without an exact policy rule and human approval.

## Privacy and authorization matrix

| Actor | Permitted | Denied |
|---|---|---|
| Employee | Own finalized records, awards and released statements | Drafts, notes, exceptions, peers, budgets, benchmarks |
| Manager | In-scope team current pay and cycle recommendations when process requires | Unrelated/direct-ID records, confidential HR notes, band/policy mutation |
| HRBP | Assigned population according to permission and scope | Global access by role name alone |
| Compensation administrator | Markets, bands, policy, cycles, budgets and decisions | Self-approval; unrelated tenant |
| Executive/budget owner | Required aggregate/population and approval data | Unnecessary employee narrative or other scopes |
| Payroll reader | Effective payroll-authoritative handoff fields | Draft recommendations, calibration, diagnostics |
| Auditor | Read-only authorized versions, decisions, exception metadata and correlations | Mutation; sensitive narrative unless separately granted |
| General administrator | System administration only | Individual compensation unless separately granted |

Proposed permission families: `compensation.architecture.*`, `compensation.cycle.*`, `compensation.budget.*`, `compensation.recommendation.*`, `compensation.decision.*`, `compensation.exception.*`, `compensation.reward.*`, `compensation.read_self`, `compensation.read_team`, `compensation.read_scoped`, `compensation.payroll_handoff.read`, `compensation.audit.read`. Scope and field policy are enforced server-side; UI hiding is supplementary.

Pay-equity diagnostics use legitimate job/level/market/basis cohorts and minimum cohort sizes. Protected characteristics are never scoring inputs. Where legally approved for compliance analysis, protected data stays in a separately permissioned query path. Results are human-review signals, not automatic accusations or pay changes.

## Concurrency and idempotency

Use short serializable transactions, row locks on budget aggregates, expected-version predicates, deterministic idempotency keys and bounded retries. Budget availability is derived and checked inside the same transaction that appends a reservation. Two $8k/$7k requests cannot consume a $10k budget: one wins, the other receives an explainable conflict with no partial audit/outbox side effect.

Mandatory PostgreSQL races: duplicate recommendation; recommendation versus cancellation; two managers/shared budget; approval versus promotion/separation; correction versus payroll claim; cycle close versus late submission; duplicate decision/award; effective-worker replay; handoff replay. Expected result is one authoritative winner, safe loser, balanced budget ledger, one notification/handoff and correlated audit.

## Notifications, workers and observability

Register templates under the existing HR sender category: cycle open, recommendation due/returned, exception requested/decided, compensation approved/effective, statement available and bonus awarded. Outbox idempotency key includes template + subject/version + recipient. No new sender identity.

Idempotent tenant-aware workers: cycle opening, population snapshot, reminders, budget reconciliation, effective compensation, statement generation, payroll handoff, retroactive signal and integrity reconciliation. Each uses claim/lease/attempt/dead-letter evidence and authenticates through the existing internal-worker mechanism.

Metrics to implement—not claim now: pending approvals, overspend attempts, budget imbalance, duplicate conflicts, worker failures, effective-event delay, handoff backlog, statement failure, outbox backlog and reconciliation mismatch. Alerts must avoid amount/employee labels.

## Additive migration strategy

1. Currency validation, markets and immutable market versions.
2. Compensation grade/band identity and versions, then policy and benchmark snapshots.
3. Employee compensation aggregate, events and append-only effective records.
4. Cycles, population snapshots, budgets and immutable budget ledger.
5. Recommendations, calibration, eligibility, exceptions and decisions.
6. Bonus programs/awards, statements and retroactive signals.
7. Payroll handoff and temporary `HrSalaryRecord` compatibility projection.
8. Backfill from approved salary/offer/workforce data into reconciled shadow records.
9. Validate zero overlaps/orphans, budget balance and projection equivalence.
10. Add publication/immutability/exclusion constraints and switch reads only after staged reconciliation.

No Units 1–7 table/column is dropped or rewritten in Unit 8. Legacy grade ranges and salary records remain until a later separately approved deprecation.

## Test and staging strategy

Unit tests: market/band resolution, currency/basis, compa-ratio categories, policy/version hashes, event conflict rules, eligibility, guideline explainability, privacy redaction and payroll contract serialization.

PostgreSQL integration: effective range exclusion, append-only triggers, budget races/reserve-release-consume, duplicate decisions/awards, correction/handoff races, tenant/direct-ID isolation, worker leases and replay.

Browser matrix: employee own view; manager direct-report scope; HRBP assigned scope; compensation admin; budget owner; payroll reader; auditor read-only; general admin denied individual pay. Test UI and forged direct requests.

Full staging lifecycle: assignment/job/Z-level → market and band → initial compensation → Unit 7 outcome → merit cycle/population → manager recommendation → budget reservation → calibration → exception/approval → effective record → Unit 7 promotion → target band/promotion decision → retroactive correction → bonus award → employee statement → payroll handoff → encrypted backup → isolated restore.

Restore must prove Person → work relationship → assignment → job profile/Z-level → market → band version → employee compensation → recommendation → budget/exception → decision → effective record → award → statement → payroll handoff → audit, with zero duplicates/orphans, balanced ledger, correct effective history and preserved privacy.

## Known risks and deferred functionality

- Legacy payroll directly consumes `HrSalaryRecord`; compatibility cutover needs dual-read prohibition and reconciliation evidence.
- Currency, market and legal pay rules require owner-approved policy and later jurisdictional review.
- Compensation confidentiality raises insider/direct-ID and report-export risk; role names alone are insufficient.
- Budget reservation races and retroactive correction/payroll claim races are release blockers.
- Historical legacy ranges may be ambiguous; preserve as migrated provenance rather than invent precision.
- Full equity, commission-heavy plans, complex incentive formulae, market-data provider automation and payroll calculation are deferred.
- The accepted global GoDaddy Inbox-delivery exception is not a Unit 8 architecture issue, but compensation notifications inherit it and must be reaccepted or resolved before release.

## Owner decisions required before implementation

Recommendations are proposals, not silently adopted policy.

1. Initial markets — recommend only markets with current workers, with effective assignment rules.
2. Currency policy — recommend contractual currency authoritative; dated FX snapshots for budgets/reporting.
3. Z-level display — recommend contextual display beside, never as, compensation grade.
4. Promotion minimum — recommend at least new band minimum unless legal/policy exception explicitly permits otherwise.
5. Below-band treatment — recommend flag + governed remediation, never automatic adjustment.
6. Above-band policy — recommend mandatory compensation-admin and executive exception approval.
7. Merit cadence — recommend annual cycle plus governed off-cycle events.
8. Guideline philosophy — recommend transparent performance × range-position ranges, not automatic awards.
9. Budget semantics — recommend reserve on submission, consume on final decision, release on return/reject/withdraw.
10. Approval workflow — recommend manager → compensation/HR → budget owner; executive for exception; strict maker/checker.
11. Bonus scope — recommend annual, discretionary, recognition and retention initially; defer complex incentives.
12. Pay-equity diagnostics — recommend minimum cohort thresholds and restricted compensation/auditor access.
13. Benchmarks — recommend manual governed snapshots initially; provider integration later.
14. Statement visibility — recommend employee access only after final approval/effective release.
15. Recommendation/calibration retention — recommend employment plus statutory/audit retention, with restricted narrative.
16. Retroactive governance — recommend mandatory reason, cutoff, payroll acknowledgement and correction lineage.
17. Individual-pay access — owner must name permission/scope bundles; recommend no implicit general-admin access.
18. Equity — recommend deferred reference-only extensibility.

## Blueprint gate

Broad implementation, runtime migrations and staging deployment remain prohibited until the owner approves this blueprint and resolves or explicitly delegates the policy decisions above.
