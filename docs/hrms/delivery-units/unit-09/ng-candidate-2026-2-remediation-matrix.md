# NG-CANDIDATE-2026.2 remediation matrix

Status: **NOT CERTIFIED — PENDING NEW STAGE 1 REVIEW**. NG-CANDIDATE-2026.1 remains immutable, not certified, and superseded only as a candidate.

| Review item | Decision | Required correction | Implementation / persistence | Expected-value evidence | Remediation state |
| --- | --- | --- | --- | --- | --- |
| NG-PAYE-002/005 | CHANGES REQUIRED | Default employment-income inclusion; unknown/exclusion blockers; BIK | `nigeria-2026-2.ts` earning/BIK guards; persistence pending | `hrms-unit9-ng-2026-2` BIK/classification | PARTIAL — PENDING REVIEW |
| NG-PAYE-003 | CHANGES REQUIRED | Annual expected income, cumulative target, prior deducted/repaid, refund | `calculateNg2026_2AnnualizedPaye` | 15 boundaries + refund | REMEDIATED — PENDING REVIEW |
| NG-PAYE-004 | CHANGES REQUIRED | Evidenced typed reliefs; remittance condition; rent cap | `evaluateNg2026_2Relief`, rent formula; persistence pending | relief/remittance/rent tests | PARTIAL — PENDING REVIEW |
| NG-PAYE-006 | CHANGES REQUIRED | High precision; aggregate then final 2dp rounding | annualized engine | boundary/refund tests; half-kobo matrix pending | PARTIAL — PENDING REVIEW |
| Joiner YTD | CHANGES REQUIRED | Evidence or governed RTA handling; no silent zero | `assertNg2026_2JoinerYtd`; persistence pending | joiner blocker/evidenced tests | PARTIAL — PENDING REVIEW |
| NG-PEN-001/002 | CHANGES REQUIRED | Applicability, BHT basis, 8/10 and employer-all 20, remittance evidence | pension calculator/due date; persistence pending | basis/rate/applicability/due-date tests | PARTIAL — PENDING REVIEW |
| Broader schemes | CHANGES REQUIRED | Explicit NHF/NHIS/NSITF/ITF/group-life state | `assertStatutoryApplicability`; persistence pending | unresolved blocker test | PARTIAL — PENDING REVIEW |
| RTA routing | CHANGES REQUIRED | State/FCT effective configuration and adapter | `assertRtaConfiguration`; persistence pending | missing/complete routing tests | PARTIAL — PENDING REVIEW |
| NG-RETRO-001 | CHANGES REQUIRED | Annualized debit/refund and downstream amendment lineage | existing `retroDelta`; 2026.2 integration pending | pending | OPEN |
| NG-PS-001 | CHANGES REQUIRED | Candidate control fields and correction lineage | pending domain representation | pending | OPEN |
| NG-STAT-001 | CHANGES REQUIRED | PAYE/annual return, due dates, amendment/ack | candidate due-date functions; persistence pending | due-date tests | PARTIAL — PENDING REVIEW |
| NG-RET-001 | CHANGES REQUIRED | Six years after assessment plus holds; scheme-specific policies | `taxRetentionUntil`; persistence pending | minimum/hold tests | PARTIAL — PENDING REVIEW |
| Minimum wage/proration/overtime | CHANGES REQUIRED | Effective policies, blockers and expected values | pending | pending | OPEN |
| Authoritative fixtures/JRB comparisons | CHANGES REQUIRED | Independent source-backed expected values | boundary fixtures exist; official examples pending exact annotations | pending | OPEN |

Summary counts must be derived from individually labelled review items; any mismatch with the review summary remains recorded and must not erase a row.
