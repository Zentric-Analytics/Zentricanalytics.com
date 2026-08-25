# NG-CANDIDATE-2026.6 staging validation

Status: engineering and staging gates passed; `READY FOR STAGE 1 CLOSURE REVIEW — NOT CERTIFIED`.

## Exact deployment and database

- Implementation deployment: `dep-da6tsorl550s73fdmc60`, SHA `d9ee15ba151db8c35cd7c49cca735a72324a5be6`.
- Race-evidence deployment: `dep-da6tvv3l550s73fe0asg`, SHA `492f8f47c72eff4aa435ae2dc7fd21fc1fd50623`, live on August 25, 2026.
- Render environment: `Zentricanalytics.com-Staging` in the Staging workspace.
- PostgreSQL database: `zentric_analytics_staging` on host identity `dpg-d8s9itj6sc1c73c6vsl0-a`.
- Migrations: 62 found; none pending.
- Preflight: ready; database connectivity and HR, Core HR, Leave, Payroll, Documents/Assets, Onboarding/Offboarding, and Workflow tables queryable.
- Readiness: `/api/health/ready` returned `status=ready`, `database=ok`.

## Governed income-binding harness

Command: `HR_UNIT9_NG_2026_6_STAGING_CONFIRM=staging-only yarn hr:unit9-ng-2026-6-staging`.

- Marker: `ng-2026-6-1787682671968`.
- Run: `cmt903u1o0005x46cqm15pwfy`.
- Result: `cmt903u6v000hx46cuobg4m9m`.
- Binding hash: `be79d1515e74db65a03ee20b13e136ef2b1ad3fc7e6ce630b82cebf5f3b4f320`.
- Decision hash: `aea59987108b3d153188ecab78f196d292faf0306791a3721a0d9d7e361fc86f`.
- Partition hash: `54437d85eb6cf8bc9d78a4b62ce3ee697436c523f8dc4a0286f18b6191e001b5`.
- Standard case: Salary NGN 70,000; current Bonus zero; prior Bonus YTD zero; minimum-wage-exempt engineering branch; PAYE NGN 0.00.
- Negative cases: Salary mismatch, Bonus mismatch, prior-Bonus-YTD mismatch, and prior-employer mismatch all rejected fail-closed.
- Finalization: `REJECTED_NOT_CERTIFIED`.

## Real PostgreSQL concurrency

Command: `HR_UNIT9_NG_2026_6_CONCURRENCY_CONFIRM=staging-only yarn hr:unit9-ng-2026-6-concurrency`.

- Marker: `ng-2026-6-race-1787683061700`.
- Source snapshot: `cmt903u49000dx46cuccqtcam`.
- Duplicate binding winners: 1.
- Bonus-YTD winners: 1.
- Prior-employer same-version winners: 1; preserved versions after append: 2.
- Frozen binding remained immutable.
- Stale binding was rejected.
- Authoritative stale results: 0; mixed-version results: 0.

## Authorization and confidentiality

On August 25, 2026, a fresh authenticated staging administrator session opened `/hr/admin/unit-9-status` on the exact evidence deployment. The page retained the `NOT CERTIFIED` boundary and exposed only environment, branch, commit, migration, aggregate test, readiness, and control-state evidence. It contained no employee compensation, tax, bank, payment, password, MFA, connection string, or secret values. Direct evidence access remains guarded by authentication, `payroll.statutory.read`, tenant-scoped lookup, and private/no-store responses; absent or invalid record identities return only a generic denial/not-found payload. Automated server-side authorization tests cover permission denial, tenant scoping, and sensitive evidence non-disclosure.

Production was not accessed or modified. No previous candidate result was reused as 2026.6 execution evidence.
