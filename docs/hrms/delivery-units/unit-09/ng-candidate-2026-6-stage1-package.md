# NG-CANDIDATE-2026.6 Stage 1 closure-review package

Status: `READY FOR STAGE 1 CLOSURE REVIEW — NOT CERTIFIED`.

## Review baseline

- Immutable predecessor: `NG-CANDIDATE-2026.5`.
- Implementation merge: `d9ee15ba151db8c35cd7c49cca735a72324a5be6`.
- Database-race evidence commit: `492f8f47c72eff4aa435ae2dc7fd21fc1fd50623`.
- Exact staging deployment: `dep-da6tvv3l550s73fe0asg` (`492f8f47c72eff4aa435ae2dc7fd21fc1fd50623`).
- Staging database: `zentric_analytics_staging` on the staging-only Render database host; secrets and connection values are excluded.
- Schema: 62 migrations recognized, none pending.

## Closed engineering finding

One canonical, deterministic employment-income binding now connects frozen Salary, current Bonus, prior Bonus YTD, annual recurring Salary, PAYE YTD, prior-employer identity/version and amounts, the minimum-wage decision, population partition, PAYE calculation, and authoritative result. Exact normalized equality is required across duplicated certified facts. A stale binding is rejected even when a narrower decision hash still matches.

The governed staging harness proved the standard case plus Salary, Bonus, Bonus-YTD, and prior-employer mismatch cases. The real PostgreSQL race harness proved exactly one winner for binding persistence, Bonus-YTD posting, and prior-employer version writes, while stale calculation produced zero authoritative or mixed-version results.

## Deliberate boundary

This package does not certify Nigerian legal or tax correctness. Official finalization, payslip publication, real payment, settlement, filing, submission, and remittance remain fail-closed. Stage 2 is not started by this package.

Machine-readable package metadata is in `ng-candidate-2026-6-stage1-manifest.json`; deterministic file hashes are in `ng-candidate-2026-6-stage1-package.sha256`.
