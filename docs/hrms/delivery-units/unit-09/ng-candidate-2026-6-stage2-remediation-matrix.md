# NG-CANDIDATE-2026.6 Stage 2 remediation matrix

| Finding | Control | Fail-closed result |
|---|---|---|
| Evidence Salary differs from frozen `SALARY` | derive Salary from actual frozen lines and compare certified evidence | `PAYROLL_INCOME_BINDING_MISMATCH` |
| Bonus differs across earnings/evidence/PAYE | derive Bonus and require normalized exact equality | `BONUS_INPUT_BINDING_MISMATCH` |
| Annual Salary is arbitrary | bind PAYE annual Salary to governed recurring Salary fact | `ANNUAL_SALARY_BINDING_MISMATCH` |
| Bonus YTD could be omitted | bind authoritative prior-Bonus accumulator and use it for exemption and PAYE | `YTD_INPUT_BINDING_MISMATCH` |
| Prior-employer amounts are detached from evidence | require state, identity/version, income and PAYE equality | `PRIOR_EMPLOYER_INPUT_BINDING_MISMATCH` |
| Potential exemption plus prior-employer income is unresolved | explicit hold; no invented rule | `PAYE_MINIMUM_WAGE_PRIOR_EMPLOYER_RULE_REQUIRED` |
| Partition can outlive changed amounts | partition stores complete income-binding hash | `STALE_EMPLOYMENT_INCOME_BINDING` |
