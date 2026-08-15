# NG-CANDIDATE-2026.2 source register

This additive register does not modify the 2026.1 evidence set. Exact provisions and fingerprints remain required before Stage 1 review can approve affected rules. Primary legislation controls over conflicting guidance.

| ID | Official authority/material | Intended remediation use | Fingerprint / exact reference status |
| --- | --- | --- | --- |
| NG2-SRC-001 | Federal Republic of Nigeria, Nigeria Tax Act 2025, Act No. 7, Official Gazette No. 117, 26 June 2025 | employment income, bands, reliefs, BIK, retention | NASS official copy SHA-256 `41abf6887bc58a3c97116fd9a048aa91ad49c1cab156f39065a58401c0fce94f`; ss. 28 and 30 (individual total/chargeable income and eligible deductions), Fourth Schedule (employment benefit valuation), and Eleventh Schedule (individual rates). |
| NG2-SRC-002 | Federal Republic of Nigeria, Nigeria Tax Administration Act 2025, Act No. 5, Official Gazette No. 117, 26 June 2025 | administration, returns, PAYE deduction/remittance, records | NASS official copy SHA-256 `eb3ea717052f48492cc6441ad23f9e7ac2ad4782395db1c391580cc1adef20e2`; ss. 34 (self-assessment), 51(6)-(8) (PAYE deduction/cumulative operation), 70 (records) and applicable return/remittance provisions. |
| NG2-SRC-003 | JRB Personal Income Tax Guidelines 2026, 24 February 2026, official JRB PDF | PAYE operation, eligible deductions, rent relief, BIK, employer returns/remittance, RTA outputs | SHA-256 `99ec0d0bcc5b1f4e1d592e15d4728715e8758fb3724fab4dcd495f389d5b22a8`; §§6–13, 25; pp. 5–8, 11; Appendix 1 p. 13. Appendix 1 is a blank computation format, not a numeric worked PAYE example. Numeric source examples are the rent illustration on p. 7 and severance example on p. 9. |
| NG2-SRC-004 | National Pension Commission, Pension Reform Act 2014 | coverage, BHT basis, 8/10, employer-all minimum, remittance | official PenCom PDF SHA-256 `66c91953049132f1eb69f030282b8c0005ec89f31af8e1f87546a03f7f413889`; ss. 3-4 (coverage/rates), s. 11 (RSA and remittance). The scanned PDF text is not a reliable extraction oracle, so provision meaning remains a Stage 1 review item. |
| NG2-SRC-005 | National Pension Commission, Frequently Asked Questions and Answers on the Contributory Pension Scheme in Nigeria, 3rd ed., May 2020 | regulator operational guidance | official PenCom PDF SHA-256 `9cef51e3e6daa9d24ac2df04f1f9d2928ea845c5ab72a2142433100e4cd440a3`; contribution/remittance FAQ entries. Guidance cannot override NG2-SRC-004. |
| NG2-SRC-006 | Labour Act and applicable National Minimum Wage legislation | pay interval, minimum-wage applicability and overtime context | `EXTERNAL COMPLIANCE DECISION REQUIRED`: exact official consolidated primary-law copy, provision annotation, and applicability interpretation must be supplied/approved by the new qualified reviewer. Engineering remains fail-closed and does not embed an unverified universal value or overtime multiplier. |

Known conflict control: any guidance suggesting an 18% employer-paid-all minimum cannot override the reviewed primary-law interpretation requiring at least 20% for the 2026.2 candidate.

## JRB example availability finding

The reviewed official 19-page PDF contains no completed numeric PAYE computation in Appendix 1: the amount cells are placeholders. Engineering must not invent an “official Appendix expected value.” The source-backed numeric fixtures available in this edition are:

- p. 7 rent illustration: NGN 2,000,000 covering 24 months; NGN 1,000,000 attributable to 2026; NGN 200,000 rent relief.
- p. 9 severance example: NGN 12,000,000 annual salary plus NGN 75,000,000 severance; NGN 50,000,000 exempt compensation; NGN 25,000,000 taxable compensation; NGN 2,500,000 WHT at 10%, with final tax computed using the applicable bands and credits.

This is recorded for the new qualified reviewer. A different JRB document containing completed PAYE examples must be identified by exact official source before such examples can be treated as an authoritative oracle.
