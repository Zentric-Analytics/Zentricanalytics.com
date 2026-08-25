# NG-CANDIDATE-2026.7 authoritative source binding

Resolution order is enforced before hashing: tenant/employee/work-relationship/assignment/period identity; approved effective Salary; certified annualization rule; strict period and money domains; prior-period YTD ledger aggregate; latest append-only prior-employer version; frozen Salary/Bonus lines; duplicate-field reconciliation; canonical hash; minimum-wage decision; approved partition; calculation.

- Salary: exactly one approved effective `HrSalaryRecord`, including record ID, amount, NGN currency, monthly frequency, effective interval, approval and deterministic version hash. Zero matches fail `AUTHORITATIVE_SALARY_SOURCE_REQUIRED`; more than one overlapping match fails `AUTHORITATIVE_SALARY_SOURCE_AMBIGUOUS`. The current schema keys Salary to tenant and employee; work-relationship and assignment identity are independently validated against the frozen payroll candidate because those dimensions are not columns on `HrSalaryRecord`.
- Bonus and PAYE YTD: `HrPayrollYtdLedgerEntry` entries in the tax year effective strictly before the serializable freeze timestamp, excluding result IDs belonging to the current run. This includes earlier authoritative off-cycle activity in the same calendar period, excludes later entries, and prevents current-result self-contamination. Frozen IDs, accumulator codes, effective timestamps, result references, values, cutoff and aggregate hash make replay deterministic.
- Eligible annual deductions: latest per-type `HrPayrollTaxReliefClaimVersion` records effective before freeze, limited to the reviewed claim taxonomy and requiring `ELIGIBLE_FOR_PAYE_RELIEF`, election, evidence and source-rule identity. Record IDs, versions, evidence and aggregate hash are frozen. Pending/incomplete or unsupported claims fail closed; caller values are reconciliation-only.
- Prior employer: latest `HrPayrollPriorEmployerYtdVersion`, with record ID/version, handling, income, PAYE, repayment and evidence reference.
- Annualization: certified `HrPayrollAnnualizationRuleVersion`.

Caller copies cannot override these sources. Mismatches fail closed before a trusted binding hash exists.
