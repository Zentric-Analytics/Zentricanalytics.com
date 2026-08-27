# NG-CANDIDATE-2026.8 immutable Stage 1 closure-review package

Status: **READY FOR INDEPENDENT STAGE 1 CLOSURE REVIEW — NOT CERTIFIED**.

## Immutable identities

- Runtime implementation SHA: `4d233f3f70425c7b0a58e89331bc8780ba31f0cb`.
- Runtime tree: `6598170c7f45ecd0b215a3a93305a131a5a4c46d`.
- Reviewed payroll implementation tree: `f48aa7b29b78371fea67bdd7e4cb8724eb5e5ecc`.
- Implementation merge: `6bebae20172ed4289cbe180a8c9500f94996b005`; status-only feature: `880e1ef7173d47a7eb25b19f4c8e2f357155f61a`.
- Successful staging deployment: `dep-da7ncu49v7es73f1ub00`; service: `srv-d8s6ovvavr4c73fctksg`.

The evidence-seal commit is documentation/package metadata only and is not the deployed runtime SHA. It must not be deployed.

## Numeric engineering evidence

- Minimum-wage standard: governed monthly Salary 70,000 × 12 periods = authoritative annual Salary 840,000; classification `MINIMUM_WAGE_EXEMPT`; PAYE 0.
- Mismatch: authoritative annual 840,000 versus caller annual 1,200,000 fails with `ANNUAL_SALARY_BINDING_MISMATCH`.
- Bonus fixture intermediates: governed annual Salary 3,000,000; prior Bonus YTD 150,000; current Bonus 250,000; total Bonus 400,000; prior-employer income 500,000; eligible deductions 100,000; annual taxable 3,800,000; annual liability 474,000; salary-only liability 402,000; period 8/12 salary target 268,000; incremental Bonus tax 72,000; cumulative target 340,000; current-employer PAYE 180,000 plus prior-employer PAYE 30,000 = valid prior PAYE 210,000; current PAYE 130,000; refund candidate 0.

## Package and review boundary

The package includes exact deployed-lineage calculation/security code, relevant 2026.7 inherited implementation and fixture, Prisma schema and reviewed annualization migration, 2026.8 tests and concurrency harness, role-permission reconciliation code/tests, sanitized provider/runtime/database/signed-in evidence, predecessor preservation artifacts, and deterministic path/hash indexes.

No secret, credential, cookie, authorization material, raw payroll value, raw evidence ID, build cache, dependency tree, or unrelated repository file is included. The package does not certify Nigerian payroll law or authorize production, finalization, payslips, payment, settlement, filing/remittance, Stage 2, or Unit 10.

