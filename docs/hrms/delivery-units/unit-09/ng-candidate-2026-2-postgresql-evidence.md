# NG-CANDIDATE-2026.2 PostgreSQL evidence

Status: engineering evidence only; candidate remains **NOT_CERTIFIED**.

## Environment

- Execution date: 2026-08-15
- Application environment: `staging`
- Database host identity: `dpg-d8s9itj6sc1c73c6vsl0-a`
- Database name: `zentric_analytics_staging`
- Isolated schema: `ng_candidate_2026_2_proof`
- Candidate SHA: `14632a33b2cf2644089e54399412c7e94ce5dbbd`
- Production was not connected to or modified.

## Migration proof

Migration `20260815053000_hrms_unit9_ng_2026_2_evidence`, additive overlap-guard migration `20260815064500_hrms_unit9_ng_2026_2_overlap_guards`, and append-only trigger migration `20260815073000_hrms_unit9_ng_2026_2_immutability` were retrieved from exact repository SHA `8be40db2b0cd519be6843cfacda66285dd94e8c1` and applied with `ON_ERROR_STOP=1` to the isolated schema. The functional candidate identity remains `14632a33b2cf2644089e54399412c7e94ce5dbbd`; the later SHA contains evidence controls and tests.

Observed after application:

- seven evidence/version tables created;
- four PostgreSQL GiST exclusion constraints created;
- seven append-only mutation-rejection triggers created;
- `btree_gist` was already installed;
- no migration error;
- persistent staging application tables were not targeted.

## Constraint and concurrency proof

### Duplicate relief race

Two independent PostgreSQL connections simultaneously attempted the same logical pension-relief claim/version. One insert succeeded, the losing insert received `HrPayrollTaxReliefClaimVersion_logical_key`, and the authoritative row count was exactly one.

### RTA effective-date overlap

An effective Lagos RTA row was inserted. A second version overlapping the same tenant, employee, and tax year was rejected by `HrPayrollEmployeeRtaProfileVersion_no_overlap`. The original row remained present and the resulting count was one.

### Tenant predicate check

The synthetic tenant-B query returned zero rows for tenant-A relief evidence. Application-layer authorization remains separately required; this database proof verifies that the new records carry tenant identity and support scoped predicates.

### Prior-employer YTD

Two governed versions for the same tenant, employee, and tax year were preserved: one fully evidenced prior-employer record and one explicit `RTA_APPROVED_NO_PRIOR_VALUES` record. The resulting valid version count was two. An incomplete `RTA_APPROVED_NO_PRIOR_VALUES` insert without an RTA approval reference was rejected by `HrPayrollPriorEmployerYtdVersion_handling_check`.

This sequential version/history proof does not replace the still-required independent-connection race for equivalent prior-employer evidence.

### Pension intervals

Adjacent `[2026-01-01, 2026-07-01)` and `[2026-07-01, infinity)` pension versions for tenant A were accepted. An interval beginning `2026-06-01` was rejected by `HrPayrollPensionProfileVersion_no_overlap`. Tenant B could independently store the same employee identifier and effective range. Final counts were tenant A = 2 and tenant B = 1.

### Statutory-applicability intervals

Adjacent `REVIEW_REQUIRED` and `APPLICABLE_CONFIGURED` versions were accepted and preserved, with count two. An unknown state was rejected by `HrPayrollStatutoryApplicabilityVersion_state_check`. A later interval overlapping the open configured version was rejected by `HrPayrollStatutoryApplicabilityVersion_no_overlap`.

### BIK intervals

The original tenant-A `CAR` valuation was accepted. An overlapping correction was rejected by `HrPayrollBikEvidenceVersion_no_overlap`, leaving one tenant-A row. The same employee/code range for tenant B was independently accepted, leaving tenant B count one. A valid correction therefore requires a non-overlapping new effective interval/version; the original row is not mutated.

### Append-only immutability

After inserting a relief evidence version, direct PostgreSQL `UPDATE` and `DELETE` attempts each failed with SQLSTATE class `55000` and public marker `PAYROLL_EVIDENCE_IMMUTABLE`. The row count remained exactly one. The isolated schema contained seven non-internal immutability triggers, covering BIK, relief, prior-YTD, RTA, pension, statutory applicability, and retention evidence/version tables.

## Cleanup

Before final cleanup the proof schema contained seven tables, four exclusion constraints, seven append-only triggers, and their trigger function. The isolated schema was dropped with cascade after evidence capture. The final schema-existence query returned `PROOF_SCHEMA_REMAINING=0`.

## Persistent staging transaction evidence

The exact merged staging candidate executed `hr:unit9-staging-concurrency` against `zentric_analytics_staging` with correlation `unit9-concurrency-1786804018841`.

- independent run creation: one winner, one row;
- calculation: one completed attempt and one selected authoritative result;
- approval/recalculation: one winning transition and one approval;
- prior-YTD equivalent-version race: one winner; an explicit correction appended version 2;
- YTD retry races: one winner each for `GROSS`, `TAXABLE_INCOME`, `PAYE_DEDUCTED`, `PAYE_REPAID`, `PENSION_EMPLOYEE`, and `PENSION_EMPLOYER`; each aggregate matched its fixed expected amount;
- retro trigger replay: one logical trigger;
- simulated acknowledgement replay: state `ACKNOWLEDGED`, original `TEST:` reference retained, conflicting reference rejected;
- statutory amendment replay: one version for the raced idempotency identity; a legitimate later correction appended version 2 with an explicit supersedes link.

These are application/transaction proofs backed by database uniqueness. The earlier isolated-schema section remains the database-constraint and mutation-trigger proof. Service/API tenant isolation is separately covered by organization-scoped lookups and nine regression tests across all registered evidence kinds; the API returns a privacy-safe 404 for unknown or foreign IDs and excludes encrypted RTA tax identifiers and pension RSA values.

The legacy/downstream boundary is classified record-by-record in `ng-candidate-2026-2-immutability-boundaries.md`; it does not overstate database enforcement where the architecture relies on a governed service boundary.
