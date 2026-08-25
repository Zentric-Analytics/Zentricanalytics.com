# NG-CANDIDATE-2026.5 staging validation

Status: engineering and database gates passed on 2026-08-25. Candidate remains `NOT_CERTIFIED`; Stage 2, production use, official finalization, payslip publication, payment, settlement and statutory filing remain prohibited.

## Exact candidate and deployment

- Baseline: `5ed5afe649d31962eb1ad2817476dd2c59de2f5c`
- Feature implementation: `3dbe264`
- First dev merge: `078362af4bc9f17a2be4d9e525b40dc8ab71451a`
- Staging-evidence harness: `a78aac5dbf1c858ece9db0aa4bcd3d0577bc64b4`
- Final implementation dev merge: `8123c4ddd7840c396042a8477f320e7a5e543f1e`
- Implementation deployment: `dep-da6qgo5g1s2s73a0heig`
- Database: `zentric_analytics_staging` on staging host `dpg-d8s9itj6sc1c73c6vsl0-a`
- Migration state: 61 found, 61 applied, none pending, none failed

## Governed runtime evidence

The production-equivalent staging command `HR_UNIT9_NG_2026_5_STAGING_CONFIRM=staging-only yarn hr:unit9-ng-2026-5-staging` passed against the real staging PostgreSQL database.

- Correlation marker: `ng-2026-5-1787668808832`
- Run: `cmt8rupi60005sm52etnkha4x`
- Result: `cmt8rupyq000hsm529ibosnqj`
- Standard case: Salary NGN70,000.00, classification `MINIMUM_WAGE_EXEMPT`, PAYE `0.00`
- Frozen decision hash: `57d43a3d2eb85a01292006432e1e5f03e0e4b6ccd57c9dee1d714d352fddd21b`
- Other-income case: Salary NGN70,000.00 plus other taxable income `PRESENT` produced `COMPLIANCE_HOLD` with `OTHER_TAXABLE_EMPLOYMENT_INCOME_UNSUPPORTED`
- Approved partition hash: `20f9d062d36f9d9f16ce3a0aa94808860016587174d5f8ee77c289c953527cf5`
- Idempotent calculation replay produced no duplicate work
- Official finalization was rejected as `REJECTED_NOT_CERTIFIED`

Runtime call trace: `unit9-service.freezeUnit9Inputs` evaluates frozen eligibility; `unit9-service.calculateUnit9Run` checks the approved partition decision hash and dispatches to `calculateFrozenUnit9Employee2026_5`; that engine invokes `assertNg2026_5Decision`, which invokes the canonical `decideNg2026_5MinimumWage`. The resulting evidence, classification, blockers, decision hash, threshold and PAYE path are bound into frozen manifests/results.

## PostgreSQL concurrency and integrity

- Concurrency marker: `unit9-concurrency-1787668870344`
- Run: `cmt8rw0nb0000sm5smmtd4wyq`
- Exactly one duplicate-run winner, one completed calculation, one selected authoritative result and one approval/recalculation winner
- Prior-YTD race: one winner and immutable two-version lineage
- YTD ledger races: exactly one authoritative entry for gross, taxable income, PAYE deducted, PAYE repaid, employee pension and employer pension
- Retro trigger: exactly one
- Conflicting remittance acknowledgement: rejected
- Statutory amendment lineage: two append-only versions
- Integrity: zero failed migrations, orphan runs/snapshots/results/candidate evidence, duplicate selected results/attempts, broken gross-to-net rows, overlapping RTA/pension/BIK evidence

## Fresh release gates

- Focused 2026.5 package/runtime tests: 18/18
- Unit 9 and full repository suite: 999/999 across 85 files
- TypeScript: PASS
- ESLint: PASS, zero warnings
- Prisma validation: PASS
- Production build: PASS, 125 routes
- Health: `/api/health/live` 200 `ok`
- Readiness: `/api/health/ready` 200 `ready`, database `ok`
- Deterministic replay, stale-decision rejection, ambiguous/unknown fail-close, Salary/Bonus-only taxonomy, legacy-candidate preservation and finalization denial: PASS in focused and full suites

## Signed-in authorization and privacy

The authenticated staging browser session for `admin@zentricanalytics.com` reached the non-sensitive Unit 9 status page. A direct navigation to `/hr/admin/payroll/unit9` returned the accessible 403 experience and explicitly confirmed that no data was disclosed because the role lacks payroll authority. The status page exposed no employee payroll, tax, bank, payment, evidence-document or BIK detail. Automated permission, tenant, direct-ID and mutation tests remained green in the fresh 999-test run.

During this check the status page was found to contain stale 2026.4 deployment counters despite rendering the current 2026.5 candidate and SHA. The counters were corrected to the 61-migration, 998-test 2026.5 baseline, covered by the existing status-page regression checks, and redeployed before closure.
