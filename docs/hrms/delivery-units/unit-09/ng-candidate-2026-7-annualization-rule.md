# NG-CANDIDATE-2026.7 annualization rule

Current certified engineering control: `NG-2026.7-MONTHLY-12`, version 1, `MONTHLY`, 12 periods, method `GOVERNED_PERIODIC_SALARY_X_PERIODS_IN_TAX_YEAR`.

`derivedExpectedAnnualSalary = governedMonthlySalary × 12`.

Therefore NGN 70,000.00 × 12 = NGN 840,000.00. Governed Salary is resolved at freeze from the approved, effective `HrSalaryRecord`; its identity and deterministic version hash are frozen. The rule is resolved from `HrPayrollAnnualizationRuleVersion` for the tenant, candidate, tax year, frequency and effective period. Caller annual amounts are reconciliation fields only.

Partial-year PAYE uses validated `periodsElapsed` against the certified 12-period rule; it does not change the annual Salary derivation. Non-12 configurations have no launch certification and fail closed. Money is rounded with the repository payroll decimal policy. Replay over identical source identities, values and rule version produces identical hashes.

This is an engineering/payroll control, not a claim that Nigerian statute prescribes this annualization formula.
