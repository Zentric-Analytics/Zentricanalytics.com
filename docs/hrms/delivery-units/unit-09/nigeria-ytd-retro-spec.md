# Nigeria candidate YTD and retro specification

Authoritative YTD is an append-only accumulation over exact finalized result versions. It includes gross, taxable earnings, PAYE, relevant employee deductions, employer contributions, adjustments, and source/rule hashes. Reproduction uses historical rule versions, never current configuration.

Example lineage: January original → February original → January correction trigger → hypothetical corrected January → explicit delta → current-period/off-cycle adjustment → corrected current YTD. January remains immutable. `retroDelta` groups original and corrected lines by category/code and emits only differences.

| Trigger | Required evidence | Candidate processing | Unresolved review |
| --- | --- | --- | --- |
| Unit 8 compensation correction | old/new effective versions and affected interval | recompute historical hypothetical; append earning/tax/deduction/contribution/YTD deltas | tax/YTD allocation and filing correction |
| Unit 6 time correction | original/approved corrected time versions | recompute hourly/overtime lines; append delta | tax-period and overtime treatment |
| Unit 5 leave correction | original/corrected leave facts | recompute paid/unpaid effect; append delta | tax/proration treatment |

Reversal/refund behavior, negative PAYE, liability amendments, corrected payslip disclosure, and remittance-period handling remain `REVIEW REQUIRED`.
