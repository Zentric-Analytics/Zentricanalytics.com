# Nigeria candidate certification test matrix

Existing engineering tests prove mechanics and fail-closed safety; they do not certify legal parameters.

| Test ID | Scenario | Required expected evidence | Current automated reference | Status |
| --- | --- | --- | --- | --- |
| NG-T-001 | Full-period salaried | intermediate earnings/base/PAYE/deductions/contributions/net/YTD/hash | `hrms-unit9-engine`: sourced deterministic earnings | ENGINEERING PASS; legal expected values pending |
| NG-T-002 | Hourly locked time | locked hours, rate, payable overtime rule | engine input certification/hourly test | ENGINEERING PASS; legal/policy expected values pending |
| NG-T-003 | Unlocked time | blocker and no official calculation | input-certification test | PASS |
| NG-T-004 | Progressive/YTD | below/at/above every band; prior PAYE | progressive-rule test | MECHANISM PASS; official bands/examples pending |
| NG-T-005 | Low/zero/high income | exact gross/base/PAYE/net | candidate matrix to populate after review | PENDING REVIEW |
| NG-T-006 | Bonus/allowance | separate source and base mappings | deterministic earnings test | PENDING TREATMENT |
| NG-T-007 | Pension | employee deduction and employer cost separated | domain/engine contribution tests | SEPARATION PASS; rates/basis pending |
| NG-T-008 | Paid/unpaid leave | sourced earning/proration lines | frozen-input lifecycle | PENDING POLICY/LEGAL EXPECTED VALUES |
| NG-T-009 | Mid-period hire/separation/change | exact interval and rounding | calculation mechanics | PENDING POLICY/LEGAL EXPECTED VALUES |
| NG-T-010 | Retro compensation/time/leave | immutable original plus deltas/YTD | `retroDelta`, late-input tests | MECHANISM PASS; legal allocation pending |
| NG-T-011 | Reproducibility | identical frozen inputs → identical manifest/output semantics | stable manifest/hash tests | PASS |
| NG-T-012 | Fail closed | uncertified finalization/payslip/payment/statutory rejected | domain, engine, governed-workflow and staging lifecycle tests | PASS |
| NG-T-013 | Maker-checker | actor cannot approve own run/adjustment/payment | domain/governed-workflow tests | PASS |
| NG-T-014 | Official reference examples | official inputs equal Zentric output exactly | to be added after section annotation | PENDING REVIEW |

Required certification expansion: salaried cases (ordinary, low, every band boundary, high, bonus, allowance, pension, paid/unpaid leave, hire, separation, change, retro) and hourly cases (normal, locked/unlocked, zero, partial, overtime candidate/approved/rejected, leave, bonus, PAYE/YTD, retro). Each fixture must record frozen inputs, package/rule/source versions, all intermediate amounts, manifest and output hashes.
