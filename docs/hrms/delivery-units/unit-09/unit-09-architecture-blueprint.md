# Unit 9 architecture blueprint

## Core flow

```text
Units 4 + 5 + 6 + 8 immutable truth
  → population and certification
  → frozen canonical input snapshot
  → deterministic calculation attempt + manifest
  → employee reconciliation
  → run reconciliation
  → explainable risk gate
  → independent payroll approval
  → immutable finalization
  → payslips
  → independently approved payment batch
  → provider/bank submission
  → settlement reconciliation
  → accounting and statutory batches
```

Each arrow is a persisted, tenant-scoped, idempotent transition with correlation evidence. Calculation never authorizes payment.

## Global core, jurisdiction packages and providers

The global core owns orchestration and canonical contracts. Jurisdiction packages own versioned tax/statutory definitions, taxable bases, ceilings, tax years, required identifiers, rounding, prorations, payslip fields and statutory outputs. External adapters translate canonical input/result contracts without leaking provider types across the domain.

Recommended jurisdiction lifecycle:

`NOT_CONFIGURED → DESIGN → TESTING → CERTIFIED → ACTIVE → SUSPENDED → RETIRED`

Only ACTIVE package versions may enter official native payroll. TESTING may run simulations only. Provider-backed jurisdictions require an ACTIVE provider configuration plus an approved adapter contract. SUSPENDED/RETIRED packages cannot start new official runs but remain resolvable for historical reproduction.

## Payroll population and cutoff

A pay group is a stable tenant/legal-entity/jurisdiction/population identity with effective versions for frequency, calendar, currency, method/provider, cutoff policy and payment timing. A period stores distinct start/end, cutoff, input freeze, approval deadline, intended payment, accounting date, tax period/year and IANA timezone.

Population is materialized from eligible work relationships and assignments at the period boundary. Certification assigns issues as RUN_BLOCKER, EMPLOYEE_BLOCKER, WARNING or INFO. Employee blockers quarantine only those workers unless policy makes the issue run-blocking. Freeze writes canonical normalized input versions and hashes. A later upstream event is routed to authorized pre-finalization recalculation, next-period input, retro trigger or explicit exception; it never mutates the frozen snapshot.

## Calculation architecture

Use a hybrid rule system:

- code-defined, signed/versioned jurisdiction packages for legally sensitive algorithms;
- typed declarative earning, deduction, taxable-base, ceiling, ordering and mapping definitions;
- no arbitrary JavaScript, SQL or administrator code;
- bounded dependency graph with cycle detection, deterministic ordering and an explanation trace.

Workers shard by run/attempt/population partition. Each employee calculation is isolated and replayable. Results are combined only after all successful partitions are hash-verified. A failed worker cannot corrupt another employee or the authoritative attempt.

## Reconciliation, risk and approval

- Employee: gross minus employee taxes/deductions plus/minus adjustments equals net; employer liabilities reconcile separately.
- Run: employee lines exactly equal aggregate earning, deduction, tax, contribution, net and adjustment totals.
- Settlement/accounting: payment instructions, settlements, rejected/returned amounts, journal debits/credits and statutory liabilities reconcile to finalized payroll.

Risk findings are deterministic rule/version outputs with BLOCKER/HIGH/MEDIUM/LOW/INFO severity. Findings never auto-correct pay. Required findings are independently resolved or waived with reason, evidence, authority and audit before approval.

## Scale and failure isolation

Runs are orchestration aggregates, not giant transactions. Population, certification and calculations use bounded batches, database leases, `FOR UPDATE SKIP LOCKED`, unique idempotency keys and serializable transactions for financial state changes. Target 100k+ workers through partitioned work queues and aggregate reconciliation, while finalization remains one short exactly-once transaction selecting the authoritative attempt.

## Migration sequence

1. Add jurisdiction, pay-group/calendar/period versioning and new least-privilege roles.
2. Add input facts, population, certification, snapshots and handoff acknowledgements.
3. Add definitions, package versions, attempts, manifests, results and line models.
4. Add reconciliation, risks, approvals and finalization.
5. Add retro triggers/impacts, accumulator ledger and payslips.
6. Add payment batches/instructions/approvals/provider events/settlement ledger.
7. Add accounting and statutory batches.
8. Add compatibility projection/reconciliation with legacy payroll; disable legacy writes only after parity evidence.

All migrations are additive and forward-only. Existing 51 migrations are never edited. Legacy records remain queryable and protected.

## Explicitly rejected patterns

One mutable salary field, one giant payroll table, floats, universal `isTaxable`, mutable final results/YTD counters, arbitrary formulas, direct calculation-to-payment, one-user end-to-end authority, provider-specific core models, in-memory locks, non-idempotent retries, historical rewrites and database-only restore evidence are prohibited.
