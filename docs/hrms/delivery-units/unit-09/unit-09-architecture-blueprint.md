# Unit 9 Nigeria-first architecture blueprint

## Core flow

```text
Units 4 + 5 + 6 + 8 immutable truth
  → population and certification
  → cutoff and frozen canonical input snapshot
  → certified Nigeria jurisdiction package
  → earnings and taxable-base determination
  → Nigeria PAYE + employee deductions + employer contributions
  → deterministic gross-to-net attempt + manifest
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

The global core owns canonical truth, orchestration, frozen inputs, gross-to-net execution, manifests, reconciliation, finalization, retro/YTD, payslips, payment orchestration and downstream contracts. The first jurisdiction package is Nigeria. It owns versioned PAYE/statutory definitions, taxable bases, relief/deduction treatment, ceilings, tax years, required identifiers, rounding, prorations, payslip requirements and statutory outputs. The approved hybrid model permits future provider payment, remittance, filing, verification or calculation services through canonical adapters without transferring Zentric's source-of-truth authority.

Recommended jurisdiction lifecycle:

`NOT_CONFIGURED → DESIGN → TESTING → CERTIFIED → ACTIVE → SUSPENDED → RETIRED`

Only ACTIVE package versions may enter official payroll. Nigeria rule packages progress through governed detection, interpretation, drafting, testing, approval, certification and activation. TESTING may run simulations only. Provider-backed functions require an ACTIVE provider configuration plus an approved adapter contract. SUSPENDED/RETIRED packages cannot start new official runs but remain resolvable for historical reproduction. If no certified Nigeria version covers the payroll date, payroll cannot finalize.

## Payroll population and cutoff

A pay group is a stable tenant/legal-entity/jurisdiction/population identity with effective versions for frequency, calendar, currency, method/provider, cutoff policy and payment timing. A period stores distinct start/end, cutoff, input freeze, approval deadline, intended payment, accounting date, tax period/year and IANA timezone.

Population is materialized from eligible salaried and hourly employee work relationships and assignments at the period boundary. Contractors are excluded and later connect to a contractor-pay/accounts-payable boundary. Certification assigns issues as RUN_BLOCKER, EMPLOYEE_BLOCKER, WARNING or INFO. Employee blockers quarantine only those workers unless policy makes the issue run-blocking. Freeze writes canonical normalized input versions and hashes. A later upstream event is routed to authorized pre-finalization recalculation, next-period input, retro trigger or explicit exception; it never mutates the frozen snapshot.

## First-class calculation subsystems

The ordered calculation is earnings → taxable-base determination → Nigeria PAYE → employee deductions → adjustments → net pay, with employer contributions/liabilities calculated and reconciled separately. Employee contributions may reduce net pay; employer contributions never do. Taxes and deductions are typed/versioned domains rather than numeric columns or a universal `isTaxable` flag. Detailed models and regulatory governance are in `unit-09-nigeria-tax-regulatory.md`.

Official payslips derive only from immutable FINALIZED results. Secure HRMS publication is authoritative; notification success is independent. Corrections produce linked replacement/adjustment payslips and preserve the original. See `unit-09-payslips.md`.

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

## Revised implementation sequence

1. 9A: jurisdiction registry, Nigeria framework, pay groups/calendars/periods, rule versions, regulatory-source registry and permissions.
2. 9B: Unit 4/5/6/8 inputs, population, certification, exceptions, cutoff/freeze and snapshots.
3. 9C: earnings, taxable bases, Nigeria PAYE, deduction engine, employer contributions, rounding and proration.
4. 9D: calculation attempts, deterministic execution, traces, manifests, hashes and sharding.
5. 9E: reconciliation, risk, approval and immutable finalization.
6. 9F: retro triggers, dependency analysis, deltas, accumulators/YTD, corrections and off-cycle runs.
7. 9G: payslip versions, secure publication, employee explanation/history and notification.
8. 9H: payment batches/instructions, independent approval, provider boundary, settlement and financial reconciliation.
9. 9I: accounting outputs, liability ledgers, remittance batches/acknowledgement and statutory reconciliation.
10. 9J: Regulatory Watch, provider adapters, localization, enterprise validation, recovery, concurrency, load and browser E2E.

Each runtime migration remains additive and preserves legacy history. Existing 51 migrations are never edited. Compatibility reconciliation precedes disabling legacy writes.

All migrations are additive and forward-only. Existing 51 migrations are never edited. Legacy records remain queryable and protected.

## Explicitly rejected patterns

One mutable salary field, one giant payroll table, floats, universal `isTaxable`, mutable final results/YTD counters, arbitrary formulas, direct calculation-to-payment, one-user end-to-end authority, provider-specific core models, in-memory locks, non-idempotent retries, historical rewrites and database-only restore evidence are prohibited.
