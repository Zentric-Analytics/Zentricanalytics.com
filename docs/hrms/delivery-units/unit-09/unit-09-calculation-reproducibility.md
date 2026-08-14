# Unit 9 calculation reproducibility

Required invariant:

`canonical authoritative inputs + exact rule/package versions + payroll period + engine version = identical canonical result`

## Money representation

Use Prisma/PostgreSQL fixed precision Decimal for authoritative arithmetic and serialize canonical decimal strings. Never convert authoritative values to IEEE floating point. Currency metadata defines exponent (including 0, 2 and 3 decimal currencies); rule versions may impose finer internal precision.

Rounding is explicit and versioned at line, taxable-base, tax, deduction, aggregate, FX and residual-allocation stages. The default is not assumed globally. Every rounded value retains unrounded canonical input, policy/version, mode and sequence. Residual allocation uses a deterministic documented algorithm and records each residual line.

## Frozen input

For each worker/run snapshot, persist ordered canonical facts with:

- source unit/type/id/version/content hash;
- work relationship/assignment/legal entity;
- effective interval and period intersection;
- compensation/bonus handoff version;
- locked time and overtime-candidate reference;
- paid/unpaid leave reference;
- deduction/tax/payment-readiness fact;
- jurisdiction/pay-group/package/rounding/FX references;
- normalized value and fact hash.

The snapshot hash is computed from stable sorted canonical serialization, never database row order or display formatting. Mutable current rows are not consulted during replay.

## Manifest and trace

The attempt manifest includes run/attempt/snapshot IDs, engine build SHA, jurisdiction and rule-package hashes, earning/deduction/tax definition versions, provider adapter version, rounding/FX context, ordered input hashes, calculation timestamp, output hash and trace hash. It contains no secret.

Each result line records rule, dependencies, taxable-base membership where applicable, basis, rate/threshold/ceiling reference, unrounded amount, rounded amount, currency and source facts. An authorized user can reconstruct base, overtime, bonus, gross, taxable earnings, PAYE, each deduction/contribution and net without seeing restricted provider or employee secrets.

## Rule engine

Adopt a hybrid model: vetted code-defined Nigeria and future jurisdiction packages plus a typed declarative graph for definitions/mappings. The graph is schema-validated, acyclic, bounded, deterministic and effective-dated. No dynamic code evaluation, SQL formulas, network requests, current-clock dependency or nondeterministic iteration is permitted inside calculation. Nigeria PAYE uses certified package/YTD context; a successful source poll or AI output is never a calculation input by itself.

## Proration and FX

Proration produces explicit lines for hire, separation, salary/assignment/schedule/frequency change and unpaid leave. The exact interval, denominator, timezone/calendar and rule version are in the trace. Unit 6 overtime candidates become payable only through a governing Unit 9 rule.

Earning, payroll, payment and accounting currencies remain distinct. Any conversion stores source, as-of time, rate, precision and version. Later rates cannot change historical results.

## Reproduction proof

Restore validation must independently retrieve encrypted evidence, restore the database, resolve all referenced immutable package artifacts, recompute representative results in a no-side-effect verification mode and compare input, result, trace and aggregate hashes. A database that merely starts is not sufficient DR evidence.
