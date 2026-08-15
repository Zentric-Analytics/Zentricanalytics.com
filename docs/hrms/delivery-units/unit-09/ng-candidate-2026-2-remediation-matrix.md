# NG-CANDIDATE-2026.2 remediation matrix

Status: **NOT CERTIFIED — PENDING NEW STAGE 1 REVIEW**. NG-CANDIDATE-2026.1 remains immutable and not certified.

| Review item | Required correction | Implementation / evidence | Remediation state |
| --- | --- | --- | --- |
| NG-PAYE-002/005 | Default employment-income inclusion; unknown/exclusion blockers; BIK | Earning/BIK guards; effective-dated BIK evidence; overlap and append-only PostgreSQL controls | REMEDIATED — PENDING NEW COMPLIANCE REVIEW |
| NG-PAYE-003 | Annual expected income, cumulative target, prior deducted/repaid, refund | Decimal annualization engine; boundary, cumulative, refund and replay fixtures | REMEDIATED — PENDING NEW COMPLIANCE REVIEW |
| NG-PAYE-004 | Evidenced typed reliefs; remittance condition; rent cap | Typed evaluation; versioned evidence; official JRB rent illustration; immutability proof | REMEDIATED — PENDING NEW COMPLIANCE REVIEW |
| NG-PAYE-006 | High precision; aggregate then final 2dp rounding | Decimal engine; positive/negative half-kobo and boundary tests | REMEDIATED — PENDING NEW COMPLIANCE REVIEW |
| Joiner YTD | Evidence or governed RTA handling; no silent zero | Joiner guard; complete append-only prior-YTD versions; race and correction tests | REMEDIATED — PENDING NEW COMPLIANCE REVIEW |
| NG-PEN-001/002 | Applicability, BHT basis, 8/10 and employer-all 20, remittance evidence | Effective profiles; calculator; due date; remittance eligibility; overlap/immutability proof | REMEDIATED — PENDING NEW COMPLIANCE REVIEW |
| Broader schemes | Explicit NHF/NHIS/NSITF/ITF/group-life state | Effective-dated applicability records and fail-closed review state | REMEDIATED — PENDING NEW COMPLIANCE REVIEW |
| RTA routing | State/FCT effective configuration and adapter | Encrypted effective-dated RTA profiles; single-match/overlap blockers | REMEDIATED — PENDING NEW COMPLIANCE REVIEW |
| NG-RETRO-001 | Annualized debit/refund and downstream correction lineage | Immutable retro triggers/impacts, YTD, journal/liability and append-only amendment lineage | REMEDIATED — PENDING NEW COMPLIANCE REVIEW |
| NG-PS-001 | Candidate control fields and correction lineage | Candidate-only payslip representation; version/supersedes/reason/hash controls | REMEDIATED — PENDING NEW COMPLIANCE REVIEW |
| NG-STAT-001 | PAYE/annual return, due dates, amendment/ack | Simulation-only outputs; atomic acknowledgement; immutable amendments | REMEDIATED — PENDING NEW COMPLIANCE REVIEW |
| NG-RET-001 | Six years after assessment plus holds | Append-only retention versions/holds and deterministic minimum date | REMEDIATED — PENDING NEW COMPLIANCE REVIEW |
| Minimum wage/proration/overtime | Effective policies, blockers and expected values | Explicit policy inputs; locked-time/approval/policy blockers; no universal multiplier | REMEDIATED — PENDING NEW COMPLIANCE REVIEW |
| Authoritative fixtures/JRB comparisons | Independent source-backed expected values | Frozen evidence-classified fixtures; official JRB rent example kept separate from independently derived PAYE values | REMEDIATED — PENDING NEW COMPLIANCE REVIEW |
| Labour/minimum-wage primary-source certification | Qualified interpretation of applicability and exact primary-law source | Engineering fails closed unless an evidenced governed value/applicability is configured | EXTERNAL COMPLIANCE DECISION REQUIRED |

No engineering-remediable row remains `OPEN`. Nothing in this matrix is an approval or certification decision.
