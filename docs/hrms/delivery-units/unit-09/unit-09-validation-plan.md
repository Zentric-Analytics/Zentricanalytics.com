# Unit 9 implementation and validation plan

This is the mandatory future gate plan; no gate was executed as Unit 9 runtime validation during blueprinting.

## Unit and integration tests

- Decimal precision for 0/2/3-decimal currencies, every rounding stage, residual allocation and FX.
- Salary/hourly/proration, overtime candidate treatment, paid/unpaid leave, deduction ordering, ceilings and employer contributions.
- Package/definition effective dating, dependency-cycle rejection, deterministic traces and hash reproduction.
- Every legal/illegal state transition, maker/checker rule, risk severity and reconciliation identity.
- Unit 4/5/6/8 exact-version ingestion, duplicate handoff, cutoff, freeze, late event and retro delta.
- Simulation cannot finalize/pay; finalized results cannot mutate; corrections append deltas.
- Payment/provider/accounting/statutory canonical contracts and duplicate callbacks.

## Privacy and authorization

Signed-in browser and direct-route/direct-ID tests for employee, manager, HR, payroll processor/admin/approver, payment operator/approver, finance, statutory operator, auditor and general admin. Test own/unrelated worker, assigned/unassigned legal entity, cross-tenant, export, bank/tax fields, draft/finalized results, mutations and denied partial payloads.

## Full staging lifecycle

`active worker → assignment/legal entity → pay group/calendar → Unit 8 compensation → Unit 6 locked time if required → Unit 5 leave if applicable → certification → frozen snapshot → simulation → exception/risk review → calculation → employee/run reconciliation → independent approval → immutable finalization → payslip → payment batch → independent payment approval → simulated/provider settlement → accounting/statutory batches → reconciliation`

Then apply a retroactive Unit 8 correction and prove trigger, affected-period analysis, delta, approval, next/off-cycle run, accumulator/YTD update and downstream correction lineage without changing the original.

## Concurrency, worker and provider gates

Execute every race in `unit-09-concurrency-idempotency.md` against real PostgreSQL. Kill/restart workers at each checkpoint. Test temporary/permanent provider errors, unknown submission outcome, retries, dead letter and recovery. No mocked concurrency result qualifies.

## Integrity and reconciliation

Queries must prove zero duplicate finalizations, result lines by idempotency, payment instructions, provider events and accumulator entries; zero orphan input facts/results/retro impacts/payments/batches; no overlapping active configuration/pay-group assignment; employee/run/settlement/accounting/statutory totals exactly reconcile; all audit correlations exist.

## Load

Use synthetic staging-only populations at increasing sizes with deterministic expected totals. Exercise population, certification, sharded calculation, manifest generation, reconciliation, payroll screens and concurrent employee payslip reads. Record throughput, p50/p95/p99, database contention, memory, worker lag, retries and error rate. Establish initial SLOs from measured capacity rather than inventing them in the blueprint.

## Backup and recovery

Create a fresh encrypted durable staging archive, independently retrieve and checksum it, restore to an isolated non-HA target, verify all migrations and the full chain from Units 4/5/6/8 through snapshot, manifest, finalization, payslip metadata, payment/settlement, accounting/statutory and audit. Recompute representative hashes/results, verify zero duplicates/orphans and reconciliations, record RPO/RTO, remove plaintext/secrets and delete the target.

## Observability

Verify metrics/alerts for certification blockers, calculation duration/failures, risk findings, reconciliation mismatch, retries/stale leases, provider latency/errors, duplicate prevention, payment rejection/settlement lag, retro volume, outbox lag and backup readiness. Confirm logs redact financial/identity secrets.

## Release gate

Full automated suite, TypeScript, ESLint zero warnings, Prisma validation, production build, migration review, preflight, browser lifecycle, real delivery where applicable, concurrency, privacy, load and restore must pass on one exact staging SHA. No jurisdiction/payment/filing capability may be labelled supported without its own ACTIVE/certified evidence.
