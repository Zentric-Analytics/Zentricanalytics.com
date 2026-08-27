# NG-CANDIDATE-2026.8 staging validation

Status: **STAGING VALIDATED — READY FOR EVIDENCE SEAL — NOT CERTIFIED**.

## Machine / provider evidence

- Render deployment `dep-da7ncu49v7es73f1ub00` on service `srv-d8s6ovvavr4c73fctksg` reports Git SHA `4d233f3f70425c7b0a58e89331bc8780ba31f0cb` and final state **live**.
- Build completed at 2026-08-26 16:29:51 PDT; `yarn hr:release` pre-deploy ran from 16:29:52 through 16:30:29 PDT; service reported ready at 16:31:00 and live at 16:31:07 PDT.
- Provider logs report no pending migrations, successful permission reconciliation, successful preflight, configured email/outbox workers, and no exposed secret values.
- The signed-in runtime page returned HTTP 200 and independently rendered the exact runtime SHA, service ID, candidate version, and **NOT CERTIFIED** status. Its sanitized response-body SHA-256 is `7d0869c16c0eac96a216640aeba6a49c8ea2cdc6ccfc719b68ce350515ce4fc7`.

## Database evidence

- Database: `zentric_analytics_staging` / `dpg-d8s9itj6sc1c73c6vsl0-a`; migrations 63 applied, 0 pending, 0 failed.
- The persisted `Ng2026_8ConcurrencyEvidence` audit event created at `2026-08-26T23:33:13.023Z` reports PASS for 8/8 genuine actual-operation overlaps, zero adjacent-probe-only races, one duplicate-binding winner, zero stale/mixed authoritative results, valid Salary/annualization/YTD/relief/prior-employer/candidate lineage, deterministic replay, and immutable frozen binding.
- Finalization remained rejected with `PAYROLL_CANDIDATE_NOT_CERTIFIED`; finalized run/result, period-result YTD, and finalization-audit mutation counts are all zero.
- All nine official downstream entry points returned `PAYROLL_CANDIDATE_NOT_CERTIFIED`; database-derived before/after counts are identical and the prohibited official-output mutation aggregate is zero. Baseline fixtures are explicitly prerequisites, not mutations caused by blocked operations.
- Cleanup counts are zero and `HrPayrollRetentionPolicyVersion_immutable` plus `HrAuditEvent_immutable` were restored to enabled state.

## Signed-in HTTP evidence

- Own-tenant known evidence: A 200 and B 200.
- Known-ID cross-tenant probes: A→B 404 and B→A 404 with privacy-safe identical denial bodies and no sensitive payload.
- Same-tenant general ADMIN and EMPLOYEE evidence probes: 403; general ADMIN payroll workspace: 403.
- Authorized evidence responses used `Cache-Control: private, no-store`; denied responses disclosed no salary, PAYE, bank/tax/pension identifiers, evidence body, cross-tenant metadata, stack traces, or database details.
- Maker-checker probes rejected payroll creator, adjustment creator, and payment maker self-approval with HTTP 422; corresponding database approval states remained unchanged and no financial release occurred.

## Code / test evidence

- Focused NG-CANDIDATE-2026.8 tests: 21/21 PASS.
- Preservation: 11/11 PASS (the 2026.8 seal test plus the ten inherited predecessor checks).
- Repository: 1115/1115 tests across 95 files PASS.
- TypeScript PASS; ESLint zero warnings; Prisma validation PASS; production build PASS with 125/125 static pages.
- Reviewed payroll implementation tree remains `f48aa7b29b78371fea67bdd7e4cb8724eb5e5ecc`; no runtime, calculation, test, schema, migration, fixture, or 2026.7 sealed artifact was changed in this evidence phase.

## Certification boundary

This evidence does not perform the independent Stage 1 closure review and does not provide professional Nigerian tax/legal certification. NG-CANDIDATE-2026.8 remains **NOT CERTIFIED**. Production payroll activation, official finalization, official payslip publication, real payment/settlement, statutory filing/remittance, Stage 2, and Unit 10 remain prohibited.

