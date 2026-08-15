# Nigeria candidate taxable-base matrix

No generic taxable boolean is authoritative. Each effective earning/deduction version must name its exact bases. `REVIEW REQUIRED` means the engine can represent the decision but the legal/policy treatment is not approved.

| Payroll item | PAYE base | Pension base | Employer-contribution base | Candidate behavior / source |
| --- | --- | --- | --- | --- |
| Regular salary | REVIEW REQUIRED | REVIEW REQUIRED | REVIEW REQUIRED | explicit earning mapping; NG-SRC-001/002/004 review |
| Hourly regular pay | REVIEW REQUIRED | REVIEW REQUIRED | REVIEW REQUIRED | approved locked hours × rate; legal treatment pending |
| Overtime | REVIEW REQUIRED | REVIEW REQUIRED | REVIEW REQUIRED | only approved payable line; multiplier/treatment pending |
| Paid leave | REVIEW REQUIRED | REVIEW REQUIRED | REVIEW REQUIRED | policy and legal classification pending |
| Unpaid leave | reduces sourced earnings; exact proration REVIEW REQUIRED | REVIEW REQUIRED | REVIEW REQUIRED | no silent deduction; explicit proration line |
| Allowance | REVIEW REQUIRED per allowance type | REVIEW REQUIRED | REVIEW REQUIRED | blanket allowance treatment prohibited |
| Bonus/reward | REVIEW REQUIRED per award type | REVIEW REQUIRED | REVIEW REQUIRED | Unit 8 approved award only; exact tax treatment pending |
| Retro earning/correction | inherits exact corrected line’s approved bases | inherits exact corrected line’s approved bases | inherits exact corrected line’s approved bases | append-only delta; NG-RETRO-001 |
| Employee statutory deduction | not an earning; relief interaction REVIEW REQUIRED | n/a | n/a | separate employee-deduction line |
| Voluntary deduction | relief interaction REVIEW REQUIRED | n/a | n/a | requires effective authorization and approved ordering |
| Employer contribution | never reduces employee net; tax interaction REVIEW REQUIRED | n/a | explicit employer-cost/liability base | separate contribution line; NG-PEN-002 |
