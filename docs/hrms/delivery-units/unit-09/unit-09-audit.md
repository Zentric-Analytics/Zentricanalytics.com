# Unit 9 repository audit

Audit baseline: `0a096929b573a9090b73c46ea8ea8ef0d9c01ce9`, 51 migrations, clean synchronized `dev`/`main` ancestry after the Unit 8 production evidence merge. Audit operations were repository-only; staging and production were not accessed or modified.

## Existing payroll implementation

The 2026-07-30 payroll milestone introduced `HrSalaryRecord`, payroll component definitions and assignments, periods, versioned runs, immutable employee items/lines, approvals, adjustments, payslips and exports. It provides:

- PostgreSQL `Decimal` storage and Prisma Decimal calculation rather than JavaScript number arithmetic;
- salary/component effective dates;
- one run version per period and one item per worker/run;
- a simple `DRAFT → CALCULATED → REVIEWED → APPROVED → LOCKED → PAID` lifecycle;
- serializable creation/calculation transactions and independent creator/reviewer/approver checks;
- database triggers protecting salary approvals, item snapshots, lines, approvals, adjustments, payslips and exports;
- private object-storage payslips, checksums, no-store downloads, recipient ownership checks and separate bank-export authority;
- reference-only payroll email notifications and tenant-scoped audit events.

## Unit 8 handoff contract

`HrPayrollCompHandoff` is the stable additive boundary available to Unit 9:

| Field group | Current contract |
|---|---|
| Identity | organization, employee, work relationship, assignment |
| Subject | exactly one compensation record or bonus award; optional retroactive signal |
| Financial | Decimal(18,4) amount, currency, pay basis |
| Timing | effective date and optional affected window |
| Control | schema version, idempotency key, correlation ID |
| Delivery | PENDING, CLAIMED, READY, EXPORTED, FAILED plus claim token/timestamps/safe error |

The key is `unit8:{record|award}:{subjectId}:v{version}`. Effective Unit 8 records are applied under serializable retry, then the handoff is upserted by tenant/idempotency key. The payload excludes recommendation, benchmark, calibration and exception narratives. Unit 8 concurrency tests cover replay and correction-versus-claim races.

The contract is a good authoritative event envelope but is not a complete payroll snapshot. Unit 9 must consume it into versioned input facts, acknowledge it idempotently, and add a backwards-compatible schema version only when new facts cannot be resolved from immutable source references.

## Classification

| Existing element | Classification | Reason / future treatment |
|---|---|---|
| Unit 4/5/6/8 authoritative records | Authoritative input | Reference exact versions; do not copy mutable current values. |
| `HrPayrollCompHandoff` | Reusable authoritative contract | Consume and acknowledge; preserve v1 compatibility. |
| `HrSalaryRecord` | Transitional compatibility projection | Effective-dated and protected, but lacks assignment, decision, policy and handoff lineage. Stop direct authority after reconciled cutover. |
| `HrPayrollPeriod` | Reusable concept, insufficient schema | Lacks pay group, jurisdiction, cutoff/freeze, approval/accounting/tax dates and timezone. |
| `HrPayrollRun` | Transitional | Versioned and tenant-scoped, but state model and population/certification are too small. |
| `HrPayrollItem` snapshot | Reusable migration evidence | Immutable and reconciled, but lacks calculation attempt/manifest, rule versions, source hashes and jurisdiction trace. |
| Components and assignments | Transitional | Fixed/percentage types and `taxable`/`pensionable` booleans cannot represent localized taxable bases, ceilings, ordering or versioned rules. |
| `markPayrollItemPaid` | Unsafe for Unit 9 authority | A manual per-item flag is not a payment batch, independent approval, provider submission or settlement ledger. |
| `HrEmployeeBankAccount` | Partial/restricted | Encrypted account number and last four exist; it lacks routing/IBAN/SWIFT schema, verified ownership, effective versions and payment-token/provider references. |
| Payslips/private storage | Reusable | Must bind to an immutable finalized result and exact document version. |
| CSV export | Compatibility-only | Safe formula escaping and audit are useful; bank/provider/accounting formats require versioned adapters and approvals. |
| `PAYROLL_ADMIN` | Transitional overly broad role | Currently spans calculation, approval, payment marking, bank details and exports; Unit 9 requires separated roles. |
| Notifications/outbox/worker | Reusable | Tenant scoping, idempotency, retry and safe templates are established. |
| Audit/storage/backup tooling | Reusable | Extend restore validation through payroll manifests, ledgers, payments and downstream batches. |
| Benefits administration | Missing | Only payroll component assignment and offer JSON exist; define an inbound deduction-election contract, not a benefits suite. |
| Expense management | Missing | Workflow examples are not an authoritative expense system; allow future non-earning reimbursement inputs only. |
| Contractor payments | Unresolved boundary | Unit 6 timesheets exist, but no contractor tax/payment authority exists. Owner decision required. |

## Critical gaps and legacy risks

1. Payroll calculation reads `HrSalaryRecord` directly instead of consuming exact Unit 8 handoffs and source versions.
2. Period-end selection can miss mid-period changes and explicit proration.
3. A universal `taxable` boolean and three calculation modes cannot model real tax bases or jurisdiction packages.
4. The hard-coded two-decimal half-up rounding policy is not currency/jurisdiction/version aware.
5. There is no certified population, frozen source snapshot, input hash, output hash or engine/rule manifest.
6. There are no calculation attempts, risk findings, employee/run/settlement reconciliations, YTD ledger, retro dependency graph or correction deltas.
7. Payroll finalization and payment are insufficiently separated; no payment batch, independent payment approval, provider event deduplication or settlement reconciliation exists.
8. No canonical accounting journal or statutory output contract exists.
9. General payroll access is concentrated in `PAYROLL_ADMIN`; manager/general admin/auditor/finance boundaries need dedicated least-privilege permissions.
10. There is no jurisdiction lifecycle. Native calculation must fail closed unless the package is ACTIVE and certified evidence is recorded.

## Audit conclusion

Unit 9 must be an additive bounded context. Preserve legacy payroll as read-only compatibility history during migration, dual-reconcile it against Unit 9, prohibit dual authority, and retire legacy write paths only after exact parity/cutover evidence. No legacy table is deleted in the initial Unit 9 migrations.
