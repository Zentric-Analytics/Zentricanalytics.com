# Unit 9 retroactivity and corrections

Retroactivity is delta processing, never rewriting finalized payroll.

## Sources

Triggers may originate from Unit 4 effective-dated workforce corrections, Unit 5 leave corrections/reversals, Unit 6 locked-time corrections, Unit 8 compensation/bonus handoffs, tax/deduction configuration corrections, provider settlement returns or authorized payroll adjustments.

Each trigger has a tenant/idempotency key, exact source event/version, detected time, affected interval and correlation. Duplicate delivery creates one trigger.

## Dependency analysis

The engine finds snapshots/manifests whose source intervals and dependency hashes overlap the corrected fact. `HrPayrollRetroImpact` records original run/result/line/accumulator references, old/new fact hashes, affected period and provisional disposition. It does not change the original result.

Cutoff behavior is deterministic:

- open/unfrozen run: recollect and recertify;
- frozen, unapproved run: create a new snapshot version and attempt after authorization;
- approved but unfinalized: invalidate approval and return to certification;
- finalized run: schedule a next-period or approved off-cycle delta;
- settled payment return: settlement correction plus payroll impact if the underlying entitlement changes.

## Delta calculation

Recalculate the affected historical slice using the package/rule versions legally applicable to that slice unless an approved correction explicitly changes the rule version. Compare canonical old and corrected results, emit positive/negative retro earning, tax, deduction, contribution and accumulator delta lines, and record both manifests.

Original payslips and accounting/statutory batches remain immutable. A correction produces a linked adjustment payslip and correction batches. YTD is an append-only accumulator ledger; deltas alter the derived balance without updating prior entries.

## Governance

Retro impact requires reason, evidence, impact period, amount/risk classification and independent approval above owner-defined thresholds. Negative-net, prior-tax-year, terminated-worker, currency-change and already-filed statutory impacts are blockers or high-risk conditions routed to the applicable package/provider workflow.

Exactly one disposition may be authoritative: NO_IMPACT, NEXT_REGULAR_RUN, OFF_CYCLE_RUN, PROVIDER_CORRECTION or REJECTED. Application is idempotent and reconciles through payroll, payment, accounting and statutory outputs.
