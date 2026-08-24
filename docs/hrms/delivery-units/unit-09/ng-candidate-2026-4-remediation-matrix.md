# NG-CANDIDATE-2026.4 remediation and decision matrix

| Requirement | Engineering decision | Evidence |
| --- | --- | --- |
| Salary + Bonus only | Implemented | `NG_2026_4_ACTIVE_EARNINGS`; unsupported synonyms rejected |
| Preserve Unit 8 | Implemented | No Unit 8 model, migration, history or handoff deleted/renamed |
| Legacy Compensation | Implemented | Replay-only deprecated classification; new creation rejected; draft explicit reclassification |
| Sick leave | Implemented | Approved leave produces zero new earnings; Salary proration boundary preserved |
| Bonus PAYE | Implemented for candidate review | Payment-period inclusion; cumulative target minus valid prior PAYE; no special bonus rate |
| Prior employer | Implemented | Verified income/PAYE included; unverified PAYE ignored and identified |
| Negative PAYE | Implemented fail-closed | Credit preserved; execution held pending approved RTA procedure |
| Minimum wage standard case | Implemented for candidate review | NGN70,000 boundary and partial-year NGN80,000 case separated from ordinary zero PAYE |
| Minimum wage edge cases | Fail closed | Explicit RTA-rule-required hold |
| Lagos/Oyo/FCT | Preserved | Common federal/JRB path; adapter retained for future legitimate overrides; Ibadan maps to Oyo |
| Deterministic replay | Implemented | Frozen Salary, Bonus, prior PAYE, RTA, versions and period bind the manifest hash |
| Authoritative use | Prohibited | `NG-CANDIDATE-2026.4_NOT_CERTIFIED` |

