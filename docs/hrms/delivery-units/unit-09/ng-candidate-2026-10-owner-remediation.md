# NG-CANDIDATE-2026.10 — owner-accepted engineering remediation

This candidate succeeds the immutable `NG-CANDIDATE-2026.9` package. It records owner-accepted engineering decisions from the accepted owner review, whose PDF SHA-256 is `9f1ae0b58d78b6814f6c05c21b2f3b85a6bd2b25d47087187d68a5daf558ed9a`.

## Safety boundary

- Status remains `NOT_CERTIFIED`.
- Owner acceptance is represented as engineering authority only; it is not represented as professional certification or as primary legislation.
- The existing official payroll certification guard remains the only route to official payroll state. The new candidate's own official-use guard always rejects.
- No migration, finalization, payslip publication, payment, remittance, filing, or production action is included.

## Implemented owner-accepted rules

- Annual PAYE bands and cumulative liability less verified prior PAYE.
- Evidence-gated pension, NHF, NHIS, mortgage interest, life/annuity and rent relief, including the 20%/N500,000 rent cap and allocation-month check.
- BIK valuation for owned and hired assets, plus the accommodation cap and specified exclusions.
- Pension coverage and minimum-rate controls, preserving a hold when population, RSA/PFA, base, or remittance evidence is incomplete.

## Mandatory holds retained

The candidate continues to hold minimum-wage treatment without the required gazette record; ambiguous RTA treatment; unsupported allocation policy; individual pension population/base uncertainty; jurisdiction-specific correction and refund procedure; deduction-priority ambiguity; and independent numeric certification.

The F01–F17 expected outcomes are versioned in `tests/fixtures/ng-candidate-2026-10-owner-remediation-families.json`.

## Independent-review remediation

The four findings were reproduced before implementation changes: five regression
tests failed (two rounding inputs, negative relief, negative headcount and absent
executable fixture inputs/outcomes).

External monetary inputs retain the existing fixed-precision contract (at most
four decimal places). Internal finite Decimal calculations are rounded half-up
to two decimals only at monetary output; they no longer re-enter the external
input parser. Band liabilities and relief totals retain their unrounded Decimal
string evidence. Tax bands are summed without prematurely rounding each segment.
No binary floating-point monetary calculation or shared payroll-domain change is
introduced.

Negative relief claims are held with `COMPLIANCE_HOLD_NEGATIVE_RELIEF`, remain
negative in claim evidence and are excluded from the accepted aggregate. They
are not corrections, are not converted to positive amounts and are not silently
clamped. A mixed input remains held even when it contains some accepted amounts.
Unsupported relief types are held separately. Pension headcount must be a
non-negative safe integer number before population logic runs; invalid inputs
return `COMPLIANCE_HOLD_PENSION_HEADCOUNT_INVALID` without contribution outputs.
Coverage decisions, statutory minimum rates and official-output guards remain
unchanged.

All seventeen fixture families now have input and exact structured expected
outcomes. The prior descriptive decisions are preserved as `ownerDecision`.
The executable test adapter never reads expected values while computing results.
It executes calculations for F01/F04/F06/F09/F10/F13/F15 and the rejecting
official-output guard for F16. F02/F03/F05/F07/F08/F11/F12/F14/F17 exercise
explicit held rule records through the real engineering-rule guard. These are
hold proofs, not claims that minimum-wage, joiner/leaver, other-employment,
prior-employer verification, proration, retro, or RTA adapters have been
implemented or certified. No new legal or allocation policy is inferred.

Mutation-sensitivity tests reject changed expected outcomes, missing/duplicate/
unknown families, a hold becoming supported and an enabled official-output guard.
Additional regressions cover monetary boundaries, repeating rent allocations,
half-up rounding, invalid precision, all six relief types, mixed claims, and
invalid/covered/uncovered/unresolved pension populations.

The approved historical-integrity artifacts and ZIPs are outside this change.
Unit 9 remains `NOT_CERTIFIED`; Stage 2 and Unit 10 are not authorized.
