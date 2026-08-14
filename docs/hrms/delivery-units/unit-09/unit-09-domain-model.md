# Unit 9 domain model

All records are tenant-scoped. Financial source/content fields become immutable after their governed boundary; operational lease fields are isolated from immutable payloads. Foreign keys use RESTRICT for preserved financial history.

## Foundation and configuration

| Model | Purpose and principal invariants |
|---|---|
| `HrPayrollJurisdiction` | Stable tenant/country or tax-authority identity; unique tenant/code. |
| `HrPayrollJurisdictionVersion` | Package/provider mode, lifecycle, effective range, tax year, required identifiers, package hash; immutable after TESTING. No overlapping ACTIVE version. |
| `HrPayrollProviderConfiguration` | Encrypted/provider-token reference, adapter version, scope and effective status; secrets never stored in manifests. |
| `HrPayrollPayGroup` / `Version` | Stable legal entity + jurisdiction + population; version stores frequency, currencies, method, provider and cutoff policy. One active assignment per work relationship/date. |
| `HrPayrollCalendar` / `Period` | Immutable period schedule with distinct cutoff/freeze/payment/accounting/tax timestamps and timezone. Unique pay group + period boundaries. |
| `HrPayrollEarningDefinitionVersion` | Typed earning behavior, taxable-base memberships and accounting mapping. |
| `HrPayrollDeductionDefinitionVersion` | Employee/employer side, priority, pre/post-tax behavior, ceilings, arrears and mapping. |
| `HrPayrollRulePackageVersion` | Signed content hash, engine compatibility, dependency graph and activation evidence. |

## Inputs and calculation

| Model | Purpose and principal invariants |
|---|---|
| `HrPayrollRun` | Stable pay group/period/mode aggregate. Unique official run per tenant/pay-group/period/run type; simulations separately keyed. |
| `HrPayrollRunPopulation` | Exact work relationship/assignment inclusion and disposition; unique run/worker relationship. |
| `HrPayrollCertificationIssue` | Typed severity, source reference, resolution/waiver evidence; append-only after freeze. |
| `HrPayrollInputSnapshot` | Stable worker/run snapshot identity and authoritative version number. |
| `HrPayrollInputFact` | Canonical typed fact referencing exact Unit 4/5/6/8 or configuration source, effective interval, canonical value/hash. Unique source event consumption. |
| `HrPayrollCalculationAttempt` | Immutable numbered attempt over one frozen snapshot set; exactly one may be selected for finalization. |
| `HrPayrollCalculationManifest` | Engine/package/rule/provider/rounding/FX versions, ordered source hashes, input/output hash and explanation trace hash. |
| `HrPayrollEmployeeResult` | Worker-level totals and status for an attempt; unique attempt/work relationship. |
| `HrPayrollResultLine` | Typed EARNING, DEDUCTION, EMPLOYEE_TAX, EMPLOYER_TAX, EMPLOYER_CONTRIBUTION, REIMBURSEMENT or ADJUSTMENT line with definition/rule/source refs and Decimal amount. |
| `HrPayrollAccumulatorEntry` | Append-only YTD/lifetime/tax-period ledger entry derived from a finalization or correction; never a mutable balance. |

## Governance and outputs

| Model | Purpose and principal invariants |
|---|---|
| `HrPayrollReconciliation` | Employee, run or settlement/accounting assertion with exact expected/actual/delta. Finalization requires zero unexplained delta. |
| `HrPayrollRiskFinding` | Versioned rule result, severity, evidence and governed resolution. |
| `HrPayrollApproval` | Transition evidence and maker/checker identity; append-only. |
| `HrPayrollFinalization` | Selects one attempt, manifest and result set; unique per official run and immutable. |
| `HrPayrollAdjustment` | Explicit reasoned line/correction authority; never overwrites a computed line. |
| `HrPayrollPayslip` | Metadata linking exact finalization/result to private immutable document version and checksum. |
| `HrPayrollPaymentBatch` | Stable settlement-currency/grouped batch for one or more finalized results. |
| `HrPayrollPaymentInstruction` | One logical employee/payment destination instruction; unique final result + destination/version + purpose. |
| `HrPayrollPaymentApproval` | Independent payment authority; append-only. |
| `HrPayrollProviderTransmission` | Adapter request hash, provider idempotency key/reference, attempt and safe response metadata. |
| `HrPayrollProviderEvent` | Tenant/provider/event ID unique inbox record; raw secrets excluded, duplicate delivery idempotent. |
| `HrPayrollSettlementEntry` | Append-only submitted/settled/rejected/returned/reversed movement ledger. |
| `HrPayrollAccountingBatch` / `Line` | Balanced canonical debit/credit output tied to finalization and mapping version. |
| `HrPayrollStatutoryBatch` / `Line` | Jurisdiction/package/tax-period output and filing/provider state. |
| `HrPayrollRetroTrigger` / `Impact` | Immutable late source event, affected periods/results and disposition. |

## Database-enforced invariants

- unique tenant/idempotency and tenant/correlation keys for every command/event boundary;
- no overlapping active pay-group assignments or effective configuration versions;
- exactly one official run per pay group/period/type and one authoritative finalization per run;
- one employee result per attempt/work relationship and one payment instruction per finalized result/purpose;
- exactly one consumed Unit 8 handoff version; duplicate provider event forbidden;
- Decimal precision/check constraints, currency-code and non-negative/allowed-negative-by-type checks;
- output hashes and immutable triggers for snapshots, manifests, results, finalizations, approvals, ledgers and submitted batches;
- balanced journal constraint checked at batch finalization;
- all direct subject references include tenant validation in commands; compound tenant keys where practical.

Use separate stable identities and immutable versions rather than proliferating mutable JSON. JSON is acceptable only for canonical typed facts/traces validated against a schema version and hashed.
