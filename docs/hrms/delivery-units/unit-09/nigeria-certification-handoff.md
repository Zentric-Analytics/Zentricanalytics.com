# Nigeria payroll candidate — qualified-review handoff

Status: **NOT CERTIFIED**. Candidate jurisdiction: `NG-CANDIDATE-2026.1`. This package is engineering evidence, not tax, legal, payroll, or regulatory advice. It must be reviewed by a person with current Nigerian payroll/tax compliance expertise who is independent of the implementing engineer, followed by a separate authorized certification decision.

## Scope and boundary

Unit 9 consumes governed employment (Unit 4), leave (Unit 5), locked time (Unit 6), and compensation (Unit 8) facts. It freezes exact inputs, calculates deterministic candidate earnings/PAYE/deductions/contributions, reconciles, records approval and risk evidence, and—only for an ACTIVE certified package—may finalize and produce payslip, simulated-payment, accounting, and statutory outputs. Contractors, real bank movement, real filing/remittance, benefits enrolment, and legal advice are out of scope.

The initial candidate supports salaried and hourly employees and monthly candidate examples. Payroll frequencies, overtime eligibility/multipliers, proration policy, voluntary deductions, and any statutory item not expressly approved in the rule matrix remain `REVIEW REQUIRED`.

## Review method

Stage 1, compliance review: decide every in-scope row in `nigeria-rule-source-matrix.md`, answer every question in `nigeria-reviewer-questions.md`, and request corrections. Stage 2, independent certification: after corrections and complete tests, bind the exact source set, configuration hash, engine version, test-suite hash, reviewer and certifier identities to one immutable jurisdiction version. Review is not certification; silence is not approval.

## Reproducible engineering chain

Frozen source manifest → `calculateFrozenPayroll` → explicit earnings/taxable-base/PAYE/deduction/contribution lines → canonical manifest/output hashes → reconciliation → independent approval → `finalizeUnit9Run`. `assertCertifiedJurisdictionPackage` and `assertFinalizationReady` keep official finalization closed while this package is not certified. Official payslips and downstream financial/statutory outputs require finalized authoritative results.

## Package contents

- `nigeria-authoritative-source-register.md`
- `nigeria-rule-source-matrix.md`
- `nigeria-paye-calculation-spec.md`
- `nigeria-taxable-base-matrix.md`
- `nigeria-pension-contribution-spec.md`
- `nigeria-proration-overtime-rounding.md`
- `nigeria-ytd-retro-spec.md`
- `nigeria-certification-test-matrix.md`
- `nigeria-reviewer-questions.md`
- `nigeria-certification-signoff-template.md`
- `nigeria-certification-manifest.json`

## Post-review sequence

Classify findings → create a new candidate version when calculation meaning changes → implement corrections → focused and full tests → regenerate hashes/matrices → independent certification → activate only the exact certified version in staging → finalized salaried/hourly/retro lifecycles → downstream/privacy/concurrency/integrity gates → encrypted archive and isolated restore → staging verdict.
