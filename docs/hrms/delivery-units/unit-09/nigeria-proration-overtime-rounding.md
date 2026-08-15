# Nigeria candidate proration, overtime, and rounding

## Proration

| Scenario | Candidate convention | Classification | Reviewer status |
| --- | --- | --- | --- |
| Mid-period hire | exact effective interval must produce an explicit sourced quantity/rate; denominator and inclusivity not assumed | Zentric payroll policy subject to legal constraints | REVIEW REQUIRED |
| Mid-period separation | same; no pay after governed effective boundary | policy + legal constraints | REVIEW REQUIRED |
| Unpaid leave | explicit reduction line from approved Unit 5 facts; no silent balance overwrite | policy + tax treatment | REVIEW REQUIRED |
| Compensation change | split exact effective versions; preserve both sources | technical invariant + policy | REVIEW REQUIRED |
| Frequency/schedule change | split/future-period or explicit correction; no current-config rewrite | policy/implementation | REVIEW REQUIRED |

For each decision the reviewer/policy owner must specify calendar/work-day/hour denominator, inclusive/exclusive dates, timezone, pay-frequency behavior, and rounding point.

## Overtime

Unit 6 recorded time → approved/locked authoritative time → overtime candidate → governed eligibility/multiplier rule → payable earning. Recorded extra time is not automatically approved, eligible, or payable. Salaried workers are not assumed eligible; hourly extra time has no assumed multiplier. Legal questions go to the qualified reviewer; company eligibility and multiplier choices go to the payroll-policy owner.

## Rounding

All money uses Prisma Decimal. The current candidate uses configurable scale (0–4) and half-up default. Earning lines, proration, taxable bases, PAYE bands/aggregate, deductions, employer contributions, adjustments, net, retro deltas, YTD, and journals must each declare scale, mode, sequence, and residual handling. Official Nigeria rounding authority is unresolved; no silent behavior change is permitted during review. Boundary tests must cover one smallest currency unit below, at, and above every threshold plus half-unit rounding points.
