# NG-CANDIDATE-2026.5 remediation matrix

| Stage 1 finding | Remediation | Evidence |
|---|---|---|
| 2026.4 classifier was helper-only | Canonical evaluator wired into eligibility, freeze, partition, calculation and persisted result | Multilayer 2026.5 tests and runtime call trace |
| Salary + Bonus was narrower than gross employment income | Explicit tri-state other-income evidence; presence/unknown fail closed | Allowance, BIK and unknown fixtures |
| TOCTOU between partition and calculation | Persisted decision hash and approved-partition comparison | Stale-hash and partition-hash tests |
| Exempt employee could enter banded PAYE | Explicit exempt branch produces zero with distinct treatment | Engine integration fixture |

`NG-CANDIDATE-2026.4`: **CHANGES REQUIRED — STAGE 1 NOT CLOSED**.
