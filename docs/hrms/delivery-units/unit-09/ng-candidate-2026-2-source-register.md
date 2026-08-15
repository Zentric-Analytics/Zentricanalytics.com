# NG-CANDIDATE-2026.2 source register

This additive register does not modify the 2026.1 evidence set. Exact provisions and fingerprints remain required before Stage 1 review can approve affected rules. Primary legislation controls over conflicting guidance.

| ID | Official authority/material | Intended remediation use | Fingerprint / exact reference status |
| --- | --- | --- | --- |
| NG2-SRC-001 | Nigeria Tax Act 2025 | employment income, bands, reliefs, BIK, retention | inherited reviewed hash reference; exact provisions pending annotation |
| NG2-SRC-002 | Nigeria Tax Administration Act 2025 | administration, returns, remittance, retention | fingerprint and exact provisions pending |
| NG2-SRC-003 | JRB Personal Income Tax Guidelines 2026, 24 February 2026, official JRB PDF | PAYE operation, eligible deductions, rent relief, BIK, employer returns/remittance, RTA outputs | SHA-256 `99ec0d0bcc5b1f4e1d592e15d4728715e8758fb3724fab4dcd495f389d5b22a8`; §§6–13, 25; pp. 5–8, 11; Appendix 1 p. 13. Appendix 1 is a blank computation format, not a numeric worked PAYE example. Numeric source examples are the rent illustration on p. 7 and severance example on p. 9. |
| NG2-SRC-004 | Pension Reform Act 2014 | coverage, BHT basis, 8/10, employer-all minimum, remittance | inherited reviewed hash reference; exact provisions pending annotation |
| NG2-SRC-005 | PenCom FAQ 2020 | regulator operational guidance | fingerprint pending; conflicts never override NG2-SRC-004 |
| NG2-SRC-006 | Labour Act | pay interval, employment/minimum-wage/overtime constraints where applicable | fingerprint and exact provisions pending |

Known conflict control: any guidance suggesting an 18% employer-paid-all minimum cannot override the reviewed primary-law interpretation requiring at least 20% for the 2026.2 candidate.

## JRB example availability finding

The reviewed official 19-page PDF contains no completed numeric PAYE computation in Appendix 1: the amount cells are placeholders. Engineering must not invent an “official Appendix expected value.” The source-backed numeric fixtures available in this edition are:

- p. 7 rent illustration: NGN 2,000,000 covering 24 months; NGN 1,000,000 attributable to 2026; NGN 200,000 rent relief.
- p. 9 severance example: NGN 12,000,000 annual salary plus NGN 75,000,000 severance; NGN 50,000,000 exempt compensation; NGN 25,000,000 taxable compensation; NGN 2,500,000 WHT at 10%, with final tax computed using the applicable bands and credits.

This is recorded for the new qualified reviewer. A different JRB document containing completed PAYE examples must be identified by exact official source before such examples can be treated as an authoritative oracle.
