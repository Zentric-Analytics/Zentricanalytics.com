# NG-CANDIDATE-2026.3 Stage 1 closure-review package

Status: **NOT_CERTIFIED**

This additive package preserves the immutable 2026.1 and 2026.2 candidates. It binds the 2026.3 implementation, independent fixtures, source register, remediation matrix, deterministic replay, fail-closed evidence and staging evidence.

## Calculation semantics

- Employment-law minimum-wage applicability and the PAYE minimum-wage exemption are independent decisions.
- The employment control requires governed headcount/worker-category evidence and never silently infers an exemption.
- The PAYE threshold result records comparison method, compared gross, threshold, source and RTA rule version.
- Current PAYE fixtures separately identify annual liability, incremental annual tax effect, cumulative target, prior net PAYE and current debit/refund.
- Non-periodic pay requires one certified effective RTA adapter. Missing, overlapping or uncertified adapters fail closed.
- Joiner, leaver, partial-year and irregular-pay threshold cases remain fail closed where the official RTA comparison basis is unresolved.

## Included artifacts

- `src/lib/hr/payroll/nigeria-2026-3.ts`
- `tests/fixtures/ng-candidate-2026-3-expected-values.json`
- `tests/hrms-unit9-ng-2026-3.test.ts`
- `ng-candidate-2026-3-source-register.md`
- `ng-candidate-2026-3-remediation-matrix.md`
- `ng-candidate-2026-3-stage1-manifest.json`
- `ng-candidate-2026-3-stage1-package.sha256`

## Required reviewer decisions

The qualified reviewer must answer the three questions in the source register. Engineering does not infer a universal RTA rule. Stage 1 closure and separate Stage 2 certification remain pending; official finalization, payslips, payment and filing remain prohibited.
