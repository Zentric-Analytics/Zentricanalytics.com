# Nigeria candidate PAYE calculation specification

This describes the implemented candidate mechanism, not an approved Nigerian legal interpretation.

## Inputs

Frozen employee/work relationship/assignment, period, approved compensation and awards, locked approved time, governed leave, prior accumulator/YTD values, exact jurisdiction/rule versions, taxable-base mappings, deductions/contributions, currency, and source hashes. Missing or unsupported identity, employment, jurisdiction, compensation, currency, or time evidence produces a blocker.

## Candidate steps

1. Calculate each sourced earning using fixed-precision Decimal: fixed amount, quantity × rate, or quantity × rate × explicit multiplier (`NG-SAL-001`, `NG-HOUR-001`).
2. Sum gross earnings. Select PAYE-base earnings only through explicit taxable-base codes (`NG-PAYE-002`).
3. Candidate annual/YTD taxable amount = prior YTD taxable income + current PAYE base. Reviewer must decide whether/when annualization, proration, reliefs, or cumulative methods alter this model.
4. For ordered bands, candidate taxable amount in band = `max(0, min(YTD taxable, upper) - lower)`; band tax = taxable amount × rate. Sum rounded band tax using the rule’s scale (`NG-PAYE-003`, `NG-PAYE-006`).
5. Candidate current PAYE = `max(0, rounded annual/YTD tax - prior YTD PAYE)`. Refund/negative-tax treatment remains `REVIEW REQUIRED`; the current floor must not be approved silently.
6. Employee net = gross − PAYE − employee deductions ± adjustments. Employer contributions are reconciled independently and never reduce net (`NG-PEN-002`).
7. Persist explanation lines, exact rule/source versions, manifest hash, output hash, and reconciliation evidence.

Official 2026 worked examples, bands/rates, relief formulae, annualization method, refund treatment, and rounding must be annotated from NG-SRC-001/002 and reproduced exactly before certification.
