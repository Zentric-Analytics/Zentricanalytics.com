# NG-CANDIDATE-2026.3 Stage 1 remediation matrix

| Review finding | Engineering state | Evidence |
| --- | --- | --- |
| Minimum-wage employment-law treatment | REMEDIATED — PENDING STAGE 1 CLOSURE REVIEW | Separate effective-dated applicability result and explicit exemption evidence in `nigeria-2026-3.ts` |
| PAYE minimum-wage exemption | REMEDIATED — PENDING STAGE 1 CLOSURE REVIEW | Independent threshold evaluator; never derived from employment exemption |
| Monthly/annual threshold fixtures | REMEDIATED — PENDING STAGE 1 CLOSURE REVIEW | Exact ±NGN0.01 boundary matrix |
| Partial-year/joiner/irregular method | FAIL CLOSED — EXTERNAL COMPLIANCE DECISION REQUIRED | Explicit `PAYE_MINIMUM_WAGE_RTA_RULE_REQUIRED` fixtures |
| Current-PAYE fixture completeness | REMEDIATED — PENDING STAGE 1 CLOSURE REVIEW | Mandatory reproducibility schema and validation |
| PAYE-ONE-TIME-BONUS | REMEDIATED FOR REVIEW ADAPTER; RTA CERTIFICATION PENDING | Annual liability, incremental effect, prior net PAYE and payment-period amount separated |
| PAYE-ALLOWANCE-INCLUDED | REMEDIATED — PENDING REVIEW | Explicitly recurring allowance and complete period facts |
| PAYE-BONUS-PLUS-BIK | REMEDIATED FOR REVIEW ADAPTER; RTA CERTIFICATION PENDING | Cash/bonus/BIK and annual/current effects separated |
| PAYE-RELIEF-INTRODUCED-300K | REMEDIATED — PENDING REVIEW | Complete period 6 facts and prior net PAYE |
| RTA non-periodic allocation | FAIL CLOSED — EXTERNAL COMPLIANCE DECISION REQUIRED | Effective-dated RTA adapter; no universal fallback |
| Cumulative PAYE source mapping | REMEDIATED — PENDING REVIEW | NTA/JRB mechanics separated from NTAA administration |
| Approved-with-clarification controls | PRESERVED | 2026.2 files unchanged; full regression gate required |
| Tests/hashes/package identity | REMEDIATED — PENDING FINAL EVIDENCE SHA | New candidate, fixtures and package only |

No row is an engineering certification decision. Candidate status remains `NOT_CERTIFIED`.
