# Unit 9 payments, accounting and statutory outputs

## Payment boundary

Finalized payroll creates payment-ready entitlements; it never sends money. A payment operator builds an immutable batch from exact finalized result IDs and versioned payment destinations. Validation checks currency, destination readiness, duplicates, totals, provider limits and sanctions/compliance hooks where configured. A different payment approver authorizes submission.

Provider-neutral flow:

`finalized results → payment batch → independent approval → transmission → provider events → settlement ledger → reconciliation`

The adapter receives canonical instructions and returns canonical accepted/rejected/pending/settled/returned states. Provider request/response bodies are encrypted or redacted; the core stores hashes, references and safe status. Provider and bank idempotency keys are stable across retries. A timeout is unknown outcome, not permission to submit a second logical batch.

Initial modes may be simulation, governed bank-file export or API provider, as selected by the owner. Simulation can prove orchestration but is never reported as real payment.

## Payment destination

Evolve `HrEmployeeBankAccount` additively into effective, verified destination versions supporting domestic routing, IBAN/SWIFT or provider token as applicable. Account data remains encrypted/tokenized. Destination changes near cutoff generate a high-risk finding and require independent verification; historical instructions retain the exact destination version.

## Settlement

Append-only settlement entries record submitted, accepted, settled, rejected, returned, reversed and fee/variance movements. The batch is SETTLED only when every instruction and batch total reconciles. Partial outcomes remain visible and retry/replacement references the failed logical instruction.

## Accounting contract

`HrPayrollAccountingBatch` is derived from one finalization/correction and an immutable mapping version. Lines include legal entity, accounting date, ledger account reference, cost center/dimensions, debit/credit Decimal amount, currency/FX context, payroll source and correlation. Validation requires debits equal credits per currency/accounting policy and totals reconcile to payroll liabilities/cost. Export/posting acknowledgement is distinct from batch approval.

Unit 9 does not become the general ledger. It emits a canonical balanced journal and consumes an idempotent acknowledgement/correction response.

## Statutory contract

Jurisdiction packages define tax-period outputs, required identifiers, employee/employer liabilities, filing schema/version and due dates. `HrPayrollStatutoryBatch` captures exact finalized results, package version, totals, file/payload hash, submission/reference and acceptance/rejection lineage. Unit 9 does not claim direct filing support until an adapter/jurisdiction reaches ACTIVE with evidence.

Nigeria PAYE and other approved statutory deductions post separate append-only liability entries at payroll finalization. A governed remittance batch selects exact liabilities, reconciles deducted/employer amounts, requires independent approval, records submission/payment and authority/provider acknowledgement, and proves final reconciliation. It must answer how much was deducted, from whom, for which period/rule version, which batch included it, whether it was remitted and under which external reference. Calculation alone never means remittance.

## Reimbursements, benefits, contractors and equity

- Future approved reimbursements may be non-earning payment lines with explicit tax treatment; Unit 9 does not implement expense management.
- Future benefits feed a versioned deduction-election contract; Unit 9 does not invent benefits enrollment.
- Contractors are excluded from employee payroll until the owner selects a contractor-payment scope and jurisdiction treatment.
- Equity remains outside Unit 9 except future taxable-event inputs from an authoritative equity system.

## Failure handling

Retries use persisted leases, bounded backoff and dead-letter/recovery state. Permanent provider failure never marks payment settled. Manual remediation records reason and independent approval; it cannot edit a submitted payload. Accounting/statutory rejection creates linked correction output, preserving the original.
