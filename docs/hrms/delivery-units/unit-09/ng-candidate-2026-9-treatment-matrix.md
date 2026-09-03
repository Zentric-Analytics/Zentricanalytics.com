# NG-CANDIDATE-2026.9 employment-income treatment matrix

Status: **NOT_CERTIFIED**. Every row requires an effective rule, evidence, jurisdiction match and qualified approval before runtime support.

| Category | Gross-income membership | Taxable-base membership | Recognition | Valuation | Evidence | Current state / unresolved behavior |
|---|---|---|---|---|---|---|
| Salary | candidate included | candidate included | current period | governed salary record | effective Unit 8 handoff and assignment | INSUFFICIENT_AUTHORITY; hold unless rule approved |
| Hourly wages | candidate included | candidate included | locked approved time period | governed rate x authoritative time | Unit 6 lock and effective rate | INSUFFICIENT_AUTHORITY; hold |
| Bonus | candidate included | candidate included | payment period candidate | approved award amount | Unit 8 award and payment timing | bonus allocation method unresolved; hold |
| Commission | professional decision required | professional decision required | unresolved | unresolved | contract/plan and approved result | hold |
| Overtime | professional decision required | professional decision required | approved locked period | governed hours x approved multiplier | Unit 6 lock and policy | hold; no inferred multiplier |
| Allowances | per allowance type | per allowance type | unresolved | rule-specific | typed allowance/evidence | hold |
| Paid leave | professional decision required | professional decision required | payroll period | governed leave/pay rule | Unit 5 leave and salary | hold |
| Retroactive earnings | candidate included | professional decision required | correction period with historic lineage | immutable delta | source correction and prior result | hold |
| BIK - employer asset | candidate included | professional decision required | benefit period | NTA Fourth Schedule method pending review | asset and usage evidence | hold |
| BIK - hired asset | candidate included | professional decision required | benefit period | rule-specific cost/benefit method | contract/payment evidence | hold |
| Employer-paid expense | per expense class | professional decision required | payment/benefit period | rule-specific | expense and business-purpose evidence | hold |
| Loss-of-employment compensation | split may apply | professional decision required | payment date | source-specific exempt/taxable split | separation and payment evidence | hold |
| Reimbursement | candidate excluded only when substantiated | candidate excluded only when substantiated | reimbursement date | verified actual expense | receipt and business purpose | hold unless approved |
| Unsupported earning | unknown | unknown | unknown | none | none | `COMPLIANCE_HOLD_UNCLASSIFIED_EARNING` |
