# Unit 9 state machines

Transitions occur through commands that validate tenant, role, current version, prerequisites and idempotency inside a transaction. Status is not accepted directly from clients.

## Jurisdiction package

`NOT_CONFIGURED → DESIGN → TESTING → CERTIFIED → ACTIVE → SUSPENDED → RETIRED`

- TESTING permits simulation, never official calculation/finalization.
- CERTIFIED requires signed test evidence but is not selectable until activation.
- SUSPENDED blocks new runs immediately while preserving historical reproducibility.
- RETIRED is terminal for new work; historical package artifacts remain resolvable.

## Payroll run

`OPEN → COLLECTING_INPUTS → CERTIFYING → EXCEPTIONS_REQUIRED|INPUT_FROZEN → CALCULATING → CALCULATED → RECONCILIATION_REQUIRED → RISK_REVIEW_REQUIRED|APPROVAL_REQUIRED → APPROVED → FINALIZING → FINALIZED → PAYMENT_READY → PAYMENT_PROCESSING → PARTIALLY_SETTLED|SETTLED → CLOSED`

`OPEN` through `APPROVAL_REQUIRED` may move to CANCELLED with independent reasoned authority. A finalized run is never cancelled or reopened; corrections use retro/off-cycle runs. `EXCEPTIONS_REQUIRED` returns to CERTIFYING after resolutions. Failed calculation creates a failed attempt and returns the run to INPUT_FROZEN; it does not mutate prior attempts.

Input-freeze rules:

- before freeze: authoritative changes may be recollected and recertified;
- after freeze and before approval: an authorized recalculation creates a new snapshot version/attempt;
- after approval but before finalization: approval is invalidated and governed recertification is required;
- after finalization: create a retro trigger and future/off-cycle adjustment.

## Calculation attempt

`QUEUED → CLAIMED → CALCULATING → CALCULATED → RECONCILED → SELECTED|SUPERSEDED`, with `FAILED` and retry as a new attempt. Claim leases can expire; financial outputs remain keyed to attempt and cannot be adopted until complete and hash-verified.

## Risk finding

`OPEN → ACKNOWLEDGED → RESOLVED|WAIVED`

BLOCKER cannot be waived unless a versioned policy explicitly provides a higher independent authority. HIGH requires documented independent approval. Resolution never changes the computed result silently; it points to a new attempt or explicit adjustment.

## Payment batch

`DRAFT → VALIDATED → APPROVAL_REQUIRED → APPROVED → SUBMITTING → SUBMITTED → PARTIALLY_SETTLED|SETTLED`, plus `FAILED`, `PARTIALLY_RETURNED`, `RETURNED`, `CANCELLED_BEFORE_SUBMISSION` and `REVERSED` where supported.

Payroll approval cannot satisfy payment approval. Submission requires an approved immutable batch and provider/bank idempotency key. A submitted batch is corrected through return/reversal/replacement lineage, never editing instructions.

## Accounting/statutory batches

`DRAFT → VALIDATED → APPROVED → EXPORTED|SUBMITTED → ACCEPTED|PARTIALLY_ACCEPTED|REJECTED → RECONCILED`

Provider callbacks cannot skip validation or approval. Rejected outputs produce a correction batch linked to the original.

## Retro trigger

`DETECTED → IMPACT_ANALYSIS → REVIEW_REQUIRED → APPROVED → SCHEDULED → APPLIED → RECONCILED`, plus `NO_IMPACT`, `REJECTED` or `SUPERSEDED`.

The trigger preserves the original finalized period. Application produces delta lines in a later or off-cycle run and new accumulator entries.
