# Nigeria PAYE, deductions and regulatory governance

> Certification state (reviewed 2026-08-14): **NOT CERTIFIED**. The software engine and evidence model are implemented, but no Nigeria jurisdiction package may be activated until a qualified compliance reviewer approves the complete interpretation, effective-date matrix and reference calculations described below.

Nigeria is the first approved Unit 9 jurisdiction. The architecture remains global: Nigeria behavior lives in an effective-dated jurisdiction package, never scattered conditionals. This document defines structure and governance, not current tax rates or a certification claim.

## Nigeria payroll tax engine

The engine consumes the exact employee tax profile, tax year/period, taxable-base facts, governed relief/deduction facts, prior accumulator/YTD entries, previous tax paid, retro impacts and certified Nigeria rule package. It emits explainable current-period PAYE lines, refunds/corrections where governed, liability entries, YTD entries and hashes.

Gross earnings, taxable earnings/income and PAYE liability are distinct. Earning definitions map into one or more versioned taxable-base definitions with inclusion/exemption/partial/ceiling treatment. There is no universal `isTaxable` authority.

### Smallest coherent conceptual model

- `HrPayrollEmployeeTaxProfileVersion`: employee/work relationship, jurisdiction, effective interval, encrypted statutory identifiers and validated elections/status.
- `HrPayrollTaxableBaseDefinitionVersion`: stable base code, included definition categories, relief/ceiling behavior and package version.
- `HrPayrollTaxRuleVersion`: PAYE bracket/annualization/YTD/relief/rounding/explanation graph tied to a certified package and official sources.
- `HrPayrollTaxLine`: employee result, tax/base/rule versions, basis, period/YTD context, unrounded/rounded amount and explanation reference.
- `HrPayrollTaxLiabilityEntry`: append-only employee deduction or employer liability linked to finalization, statutory period and correlation.
- `HrPayrollRemittanceBatch` / `Line`: groups exact liabilities for submission/payment; preserves external reference, acknowledgement and reconciliation.

Do not duplicate a tax result table when typed result lines suffice; use the models above only where they add lifecycle, profile, liability or remittance identity.

## Deduction and employer-contribution engine

Definitions are stable identities with immutable effective versions. Supported categories include statutory employee deduction, voluntary deduction, recovery/arrears/correction and other explicitly supported jurisdiction deductions. A version specifies basis, fixed/percentage/constrained formula, pre/post-tax interaction where applicable, order/priority, minimum/maximum, arrears, YTD, source/election and explanation.

Employee elections/authorizations are separately effective-dated and reference an authoritative source. Unit 9 applies them; it does not become a benefits-enrollment system. Result lines reference the exact definition, election, rule and source.

Employer contributions use separate definitions/result/liability entries. They contribute to employer cost, accounting and statutory outputs but never reduce employee net pay. Reconciliation explicitly proves:

`gross - PAYE - employee contributions - other employee deductions ± adjustments = net`

and independently reconciles employer taxes/contributions/liabilities.

## Liability and remittance

Finalization posts append-only statutory liability entries stating who, period, rule version, amount and source result. Remittance batches select exact unremitted liabilities, require validation and independent approval, then record submission/payment, authority/provider reference, acknowledgement, rejection/return and reconciliation. A retry uses one logical batch/idempotency key. Original liabilities and failed submissions remain immutable.

The same framework supports PAYE and other approved Nigeria statutory liabilities without pretending their rules are identical. Direct filing/remittance is not supported until the owner selects scope and the relevant adapter/package is ACTIVE.

## Regulatory Watch

Automation detects; humans interpret and approve; certified rules calculate payroll.

Conceptual records:

- `HrRegulatoryAuthority` and `HrRegulatorySource`: approved authority, canonical URL/reference, jurisdiction/domain, schedule and trust status.
- `HrRegulatoryPoll`: attempted/successful retrieval, timestamp, safe status and error.
- `HrRegulatoryPublication`: publication metadata, published/retrieved dates, fingerprint/hash and durable official reference; retain raw content only when justified.
- `HrRegulatoryChangeCandidate`: affected jurisdiction/domain, classification, priority, detected differences and review state.
- `HrJurisdictionRuleChange`: candidate interpretation, source links, predecessor, drafted package/rule versions and effective-date assessment.
- `HrJurisdictionCertificationEvidence`: schema/boundary/rounding/YTD/retro/reference tests, reviewer/approver, hashes and certification result.

Approved Nigeria source sets may include official revenue/tax, Joint Revenue Board, pension regulator, legislation/gazette and other owner/compliance-approved authorities. Arbitrary websites are never trusted sources.

Regulatory rule lifecycle:

`DETECTED → REVIEW_REQUIRED → INTERPRETED → RULE_DRAFTED → TESTING → APPROVAL_REQUIRED → CERTIFIED → SCHEDULED → ACTIVE → SUPERSEDED → RETIRED`

No scraper or AI may set a rate, activate rules, approve certification, override reconciliation, release payroll or release payment. AI may classify/summarize and draft candidate tests only.

## Monitoring and fail-closed behavior

Regulatory monitoring health is HEALTHY, DEGRADED, STALE or FAILED, with last success, failures, last change, unresolved high-priority candidates and upcoming effective-date exposure.

- No certified Nigeria package covering the payroll date: payroll cannot finalize.
- A source poll fails while a still-valid certified package covers the period: show DEGRADED/STALE health; do not corrupt calculation or automatically stop payroll solely for that failure.
- An unresolved candidate may block based on governed severity, credible effective date and package-coverage risk. The decision and evidence are audited.

Every historical result references the exact Nigeria package (for example a stable scheme such as `NG-PAYE-2026.1`), source references, test/certification evidence and hashes. Reproduction never reads current rules.

## Authoritative-source evidence register

The following sources were retrieved directly from Nigerian government or regulator domains on 2026-08-14. Hashes identify the exact bytes reviewed; they are evidence inputs, not an automatic certification.

| Authority | Official source | SHA-256 / evidence | Confirmed scope |
| --- | --- | --- | --- |
| Joint Revenue Board | `https://www.jrb.gov.ng/assets/2026-pit-guidelines-TJG3n9-T.pdf` | `99ec0d0bcc5b1f4e1d592e15d4728715e8758fb3724fab4dcd495f389d5b22a8` | 2026 PAYE operation, employer registration, deduction/remittance timing, employee deduction records |
| Federal Republic of Nigeria (official state revenue copy of Gazette) | `https://irs.gm.gov.ng/docs/national/NIGERIA_TAX_ACT_2025.pdf` | `e13ea10a605079e6da827ad29a40cd0ab426b4ef1c2fab4fee48263048782848` | Nigeria Tax Act 2025, including individual income-tax framework and schedules |
| Federal Ministry of Finance | `https://finance.gov.ng/federal-government-issues-transition-guidelines-for-tax-acts-2025/` | page reference; durable evidence capture still required | Confirms the Nigeria Tax Act 2025 transition applies from 2026-01-01 and pre-2026 periods remain under repealed law |
| National Pension Commission | `https://www.pencom.gov.ng/wp-content/uploads/2018/01/PRA_2014.pdf` | `66c91953049132f1eb69f030282b8c0005ec89f31af8e1f87546a03f7f413889` (1,246,811 bytes) | Official Pension Reform Act 2014 publication retrieved from the regulator's current Act page; interpretation and applicability review remain required |

### Open certification items

Nigeria remains fail-closed because the evidence set has not yet completed all of the following:

- qualified interpretation of taxable employment income, exemptions and relief inputs across salaried, hourly, overtime, allowance, bonus, leave and retro cases;
- exact annual/YTD PAYE treatment, proration and rounding reference examples from the 2026 PIT Guidelines;
- qualified interpretation of the fingerprinted Pension Reform Act 2014 employee/employer percentages, covered-emolument basis, employer-paid alternative and coverage/exemption matrix (older PenCom FAQ pages expose superseded 7.5% language and therefore cannot drive payroll);
- any other enabled statutory deduction or employer contribution, including scope, basis, ceiling, remittance and effective date;
- payslip/statutory-output and record-retention obligations applicable to the initial employer scope;
- compliance reviewer and independent certifier approval over boundary, YTD, retro, rounding, salaried and hourly reference tests.

Until those items are closed, `assertCertifiedJurisdictionPackage` must prevent finalization. Regulatory Watch may create `REVIEW_REQUIRED` candidates, but must never change or activate a payroll rule.
