# NG-CANDIDATE-2026.9 rule/source matrix

Status: **NOT_CERTIFIED**

| Rule | Source bindings | Effective status | Rule state | Runtime behavior |
|---|---|---|---|---|
| Employment-income membership and BIK valuation | NTA ss. 28, 30; Fourth Schedule; JRB guidance | 2026 candidate | INSUFFICIENT_AUTHORITY | Unapproved category returns `COMPLIANCE_HOLD_EARNING_RULE_NOT_APPROVED` |
| Annual rates/bands | NTA Eleventh Schedule | 2026 candidate | INSUFFICIENT_AUTHORITY | No official downstream use |
| Minimum-wage PAYE exemption | NTA/JRB plus final NMW amendment and RTA clarification | incomplete | CHANGE_REQUIRED | Partial-year, other income, unknown prior employer or unapproved authority holds |
| Cumulative PAYE and prior-employer credit | NTAA s. 51; JRB | 2026 candidate | INSUFFICIENT_AUTHORITY | Only verified version-bound prior facts enter a candidate calculation |
| Irregular payment/bonus allocation | JRB ss. 13.1-13.2 plus RTA clarification | incomplete | INSUFFICIENT_AUTHORITY | `COMPLIANCE_HOLD_BONUS_ALLOCATION_METHOD_REQUIRED` |
| Refund/credit execution | NTAA/JRB plus RTA procedure | incomplete | INSUFFICIENT_AUTHORITY | Candidate recorded; no cash refund or remittance offset |
| Pension eligibility/rate/remittance | PRA ss. 2-4, 11; current PenCom instrument | incomplete | INSUFFICIENT_AUTHORITY | Explicit population decision required; missing configuration never means exempt |
| NHF/NHIS/mortgage/life/rent relief | NTA/JRB and program-specific authority | incomplete | INSUFFICIENT_AUTHORITY | Latest claim version controls; evidence/rule failure holds |
| Proration | Labour/wage/contract and employer policy | incomplete | INSUFFICIENT_AUTHORITY | Payroll proration kept separate from PAYE annualisation |
| Overtime | Labour/wage/collective agreement and employer policy | incomplete | INSUFFICIENT_AUTHORITY | No inferred multiplier; locked time required |
| Rounding | Professionally approved employer payroll policy | incomplete | INSUFFICIENT_AUTHORITY | High-precision intermediates; candidate policy not official |
| Payslip/returns/remittance/retention | Labour, NTAA, JRB, pension and privacy authority | incomplete | INSUFFICIENT_AUTHORITY | All official actions remain blocked for NOT_CERTIFIED |

Only `APPROVED` and `APPROVED_WITH_CLARIFICATION` rules signed by a qualified professional can become certification-eligible. This matrix contains no such certification decision.
