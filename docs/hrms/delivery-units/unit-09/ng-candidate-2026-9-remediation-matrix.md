# NG-CANDIDATE-2026.9 remediation traceability matrix

Candidate status: **NOT_CERTIFIED**

| Finding | Pre-review area | Affected rule/source | Affected code/schema | Required fixture and test | Required staging evidence | Professional decision required | Implementation | Verification | Closure evidence |
|---|---|---|---|---|---|---|---|---|---|
| NG9-01 | Candidate identity | All current candidate records | 2026.9 docs, manifests, status page | stale-identity rejection | exact SHA/runtime correlation | confirm review identity | IN PROGRESS | PENDING | 2026.9 manifest |
| NG9-02 | Calculation dependency closure | Transitive calculation sources | package inventory builder; no schema change anticipated | omitted-import failure | package rebuild | confirm review scope | IN PROGRESS | PENDING | dependency inventory |
| NG9-03 | Authority and rule model | Acts, gazettes, instruments, guidance, RTA material | versioned authority/rule registry | unresolved/superseded source cases | source fingerprint verification | approve every rule/source mapping | IN PROGRESS | PENDING | source/rule matrices |
| NG9-04 | Taxable income and benefits | employment-income classification | 2026.9 treatment matrix | salary, hourly, bonus, commission, overtime, allowances, leave, retro, BIK, reimbursement, unsupported | governed classification evidence | approve classifications and valuation | IN PROGRESS | PENDING | fixture families 1, 3, 7, 17 |
| NG9-05 | Minimum-wage exemption | NTA/JRB/RTA interpretation | 2026.9 exemption classifier | zero, threshold boundaries, partial year, mixed earnings, prior employer, Lagos/Oyo/FCT | signed-in holds and supported path | approve exemption method per jurisdiction | IN PROGRESS | PENDING | fixture families 1-3, 5, 8, 14 |
| NG9-06 | PAYE, YTD, bonus and refunds | annual/cumulative computation | 2026.9 PAYE trace | bonus, prior PAYE, negative cumulative difference | deterministic replay | approve bonus allocation and refund procedure | IN PROGRESS | PENDING | fixture families 4, 6, 12, 13 |
| NG9-07 | Reliefs and deductions | pension, NHF, NHIS, mortgage, life, rent | typed evidence-bound claims | each claim, combined, duplicate, superseded, stale | known-ID and evidence isolation | approve eligibility/caps/remittance effects | IN PROGRESS | PENDING | fixture family 9 |
| NG9-08 | Pension | PRA/PenCom coverage and rates | employee/population pension decision | covered, exempt, voluntary, unresolved | pension liability lineage | approve coverage/rates/emoluments | IN PROGRESS | PENDING | fixture family 10 |
| NG9-09 | Proration, overtime and rounding | employer policy constrained by law | versioned policy records | calendar/workday/hour, leave, salary change, band and half-unit boundaries | deterministic output hashes | approve policy and rounding stages | IN PROGRESS | PENDING | fixture families 4, 11, 15 |
| NG9-10 | Payslip, filing, remittance and retention | jurisdiction procedures | shared certification guard and downstream policies | corrected output, liability, return, failed remittance | all nine downstream boundaries; zero mutation | approve forms, deadlines and retention | IN PROGRESS | PENDING | fixture family 16 |
| NG9-11 | Certification fixtures | all calculation rules | 17-family deterministic corpus | complete numeric/hold fixtures | regeneration and hash match | sign official expectations | IN PROGRESS | PENDING | fixture inventory |
| NG9-12 | Security, concurrency and immutability | tenant/role/maker-checker/binding rules | services, guards and PostgreSQL harness | IDOR, stale, duplicate, mixed-version, race | separate-session concurrency | approve operational roles | IN PROGRESS | PENDING | security/concurrency evidence |
| NG9-13 | Validation, staging and package | review/release evidence | tests, scripts, status and package | full gates and missing-artifact failures | exact-SHA deployment, cleanup | independent Stage 1 review | IN PROGRESS | PENDING | immutable 2026.9 package |

No row may be removed to obtain a passing result. `CHANGE_REQUIRED` and `INSUFFICIENT_AUTHORITY` outcomes remain fail-closed.
