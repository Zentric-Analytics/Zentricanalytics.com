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

Migration `20260815053000_hrms_unit9_ng_2026_2_evidence` and additive overlap-guard migration `20260815064500_hrms_unit9_ng_2026_2_overlap_guards` were retrieved by exact candidate SHA and applied with `ON_ERROR_STOP=1` to the isolated schema.

Observed after application:

- seven evidence/version tables created;
- four PostgreSQL GiST exclusion constraints created;
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

## Cleanup

Before cleanup the proof schema contained seven tables and four exclusion constraints. The isolated schema was dropped with cascade after evidence capture. The final schema-existence query returned `proof_schema_remaining=0`.

This evidence does not claim the complete PostgreSQL matrix is finished. Prior-YTD, pension, statutory-applicability, YTD/refund, acknowledgement, amendment, immutability, and service-level tenant tests remain tracked until separately executed.
