# NG-CANDIDATE-2026.7 immutable Stage 1 closure-review package

Status: **READY FOR INDEPENDENT STAGE 1 CLOSURE REVIEW — NOT CERTIFIED**.

## Immutable baseline

- Runtime implementation SHA: `d9556924247461e9c8fcb4db0343d8b2bc8b28b1`.
- Exact successful staging deployment: `dep-da732t61egvs73f6vqlg`.
- Prior failed deployment retained as negative evidence: `dep-da72esnavr4c7389du90`.
- Staging service: `srv-d8s6ovvavr4c73fctksg`; branch `dev`; database `zentric_analytics_staging`.
- Migrations: 63 applied, zero pending, zero failed.
- Immutable predecessor: NG-CANDIDATE-2026.6 at `14850c8b1ee68baaf4156725e6751fb7549348a3`.

The evidence-seal commit is documentation/package metadata only and must never be represented as the deployed runtime SHA.

## Package contents

The archive contains complete calculation-driving files from the immutable runtime tree, the Prisma schema and reviewed 2026.7 migration, authoritative source-binding and annualization evidence, numeric fixtures, focused tests, real PostgreSQL concurrency harness, role-permission reconciliation implementation and tests, sanitized provider/runtime correlation, final gate evidence, and predecessor preservation artifacts.

The deterministic path/hash index is `ng-candidate-2026-7-stage1-package.sha256`. The manifest records package metadata and payload hashes. Because a file cannot contain its own digest without changing that digest, the manifest and hash index are independently hashed by the ZIP checksum and verification report rather than self-referentially embedded.

## Reproducibility and confidentiality

All packaged source paths resolve to the exact runtime implementation tree or new evidence-only files. The archive uses sorted paths, fixed timestamps, stable ZIP attributes, and no caches, `node_modules`, build output, secrets, database URLs, credentials, cookies, session tokens, authorization headers, or employee-sensitive payroll records.

## Review boundary

This package does not certify Nigerian law or tax correctness. Official payroll finalization, payslip publication, real payment, settlement, filing, submission, and remittance remain fail-closed. Stage 2, production deployment, and Unit 10 remain out of scope.
