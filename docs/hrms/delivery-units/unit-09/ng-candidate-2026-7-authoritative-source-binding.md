# NG-CANDIDATE-2026.7 authoritative source binding

Resolution order is enforced before hashing: tenant/employee/work-relationship/assignment/period identity; approved effective Salary; certified annualization rule; strict period and money domains; prior-period YTD ledger aggregate; latest append-only prior-employer version; frozen Salary/Bonus lines; duplicate-field reconciliation; canonical hash; minimum-wage decision; approved partition; calculation.

- Salary: approved effective `HrSalaryRecord`, including record ID, amount, NGN currency, monthly frequency, effective interval, approval and deterministic version hash.
- Bonus and PAYE YTD: `HrPayrollYtdLedgerEntry` entries effective strictly before the current period start. Frozen IDs, accumulator codes, result references, values, cutoff and aggregate hash prevent self-contamination.
- Prior employer: latest `HrPayrollPriorEmployerYtdVersion`, with record ID/version, handling, income, PAYE, repayment and evidence reference.
- Annualization: certified `HrPayrollAnnualizationRuleVersion`.

Caller copies cannot override these sources. Mismatches fail closed before a trusted binding hash exists.
