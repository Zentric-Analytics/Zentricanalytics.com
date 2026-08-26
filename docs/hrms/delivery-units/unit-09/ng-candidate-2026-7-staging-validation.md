# NG-CANDIDATE-2026.7 staging validation

Status: **STAGING VALIDATED — NOT CERTIFIED**.

## Runtime correlation

- Runtime implementation SHA: `d9556924247461e9c8fcb4db0343d8b2bc8b28b1`.
- Successful Render deployment: `dep-da732t61egvs73f6vqlg` on `srv-d8s6ovvavr4c73fctksg`.
- Provider status: build PASS, guarded pre-deploy PASS, final status `live`.
- Independent runtime signal: the authenticated, non-sensitive `/hr/admin/unit-9-status/2026-7` page reported the same full SHA and `NG-CANDIDATE-2026.7 — NOT CERTIFIED`.
- Prior negative evidence remains `dep-da72esnavr4c7389du90` at SHA `255a7c23bf3e8efa1b4976ddf8cde70e1408c8f9`: build PASS, pre-deploy FAIL, runtime validation not run.

Provider-generated fields and timestamps are preserved in `ng-candidate-2026-7-deployment-correlation.json`. No bearer token, environment secret, database URL, cookie, authorization header, or employee payroll data is included.

## Final gates

- Focused release/candidate/preservation gates: 56/56 PASS.
- Repository suite: 1,093/1,093 across 93 files PASS.
- TypeScript PASS; ESLint PASS with zero warnings; Prisma validation PASS; production build PASS.
- Staging database: `zentric_analytics_staging`; 63 migrations applied, zero pending, zero failed.
- `yarn hr:release` PASS; health `status=ok`; readiness `status=ready`, `database=ok`.
- Predecessor byte-preservation hashes for 2026.1 through 2026.6 PASS.

## Governed numeric evidence

The reviewed numeric fixture is `tests/fixtures/ng-candidate-2026-7-expected-values.json`.

### Standard case

- Monthly authoritative Salary: `70,000.00`.
- Periods: `12`.
- Derived annual Salary: `840,000.00`.
- Prior Bonus YTD: `0.00`; current Bonus: `0.00`; total Bonus: `0.00`.
- Prior-employer income: `0.00`; eligible deductions: `0.00`.
- Classification: `MINIMUM_WAGE_EXEMPT`.
- Current PAYE: `0.00`.

### Annual Salary mismatch

- Monthly authoritative Salary: `70,000.00`.
- Derived annual Salary: `840,000.00`.
- Caller annual Salary: `1,200,000.00`.
- PAYE annual Salary input: `1,200,000.00`.
- Result: `ANNUAL_SALARY_BINDING_MISMATCH`.

### Bonus/YTD case

- Derived annual Salary: `3,000,000.00`.
- Prior Bonus YTD: `150,000.00`.
- Current Bonus: `250,000.00`.
- Total Bonus: `400,000.00`.
- Prior-employer income: `500,000.00`.
- Eligible deductions: `100,000.00`.
- Annual taxable amount: `3,800,000.00`.
- Cumulative target: `340,000.00`.
- Valid prior PAYE: `210,000.00`.
- Current PAYE: `130,000.00`.
- Refund candidate: `0.00`.
- Rounding: two decimal places.

## Real PostgreSQL evidence

The guarded staging PostgreSQL harness recorded PASS with exactly one duplicate-binding winner, zero authoritative stale results, zero mixed-version results, latest-version-only relief selection, pending-newest relief failing closed, same-period off-cycle YTD inclusion, Salary ambiguity rejection, stale binding rejection, immutable frozen binding, and deterministic replay. The environment was verified as staging and the database URL was not emitted.

## Release reconciliation evidence

- Fix SHA: `9c03cff73d75fb35038bf7ea0e6805a4de59518e`.
- Merge SHA: `854fa7a91347de2af94eb1f21e13047b2c7cce4f`.
- First guarded reconciliation: 1,605 ms total; 1,409 ms maximum organization transaction.
- Second guarded reconciliation: 818 ms total; 739 ms maximum transaction; `rolesCreated=0`; `staleGrantsRemoved=0`.
- Render pre-deploy reconciliation: 56 ms total; 54 ms maximum organization transaction.
- Security reconciliation suite: 12/12 PASS.

The remediation replaced sequential per-pair upserts with bounded set-based role, permission, grant, stale-removal, and audit operations. It did not change calculation-driving payroll code, payroll schema, migrations, numeric fixtures, role semantics, binding hashes, or decision hashes.

## Authorization and confidentiality

A signed-in general `ADMIN` received an accessible 403 from the payroll workspace, and the response disclosed no payroll data. Tenant isolation, IDOR rejection, maker-checker separation, payroll evidence isolation, and server-side permission enforcement passed. Canonical `ADMIN` and `HR_ADMIN` retained no `payroll.*` or `compensation.*` wildcard authority. Evidence is sanitized and contains no credential, cookie, session token, bank detail, tax identifier, or employee-sensitive payroll value.

## Certification boundary

The candidate is `NOT_CERTIFIED`. Official finalization remains `REJECTED_NOT_CERTIFIED`. This is an engineering Stage 1 closure-review package only. It authorizes no Stage 2 work, production deployment, payroll activation, payslip publication, real payment or settlement, filing or remittance, or Unit 10 work.
