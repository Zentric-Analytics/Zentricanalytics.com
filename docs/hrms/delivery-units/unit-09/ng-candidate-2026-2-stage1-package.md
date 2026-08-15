# NG-CANDIDATE-2026.2 Stage 1 review package

Status: **NOT CERTIFIED — qualified review pending**.

This package preserves `NG-CANDIDATE-2026.1` and binds the separate 2026.2 functional candidate `14632a33b2cf2644089e54399412c7e94ce5dbbd` to its remediation, test, PostgreSQL, staging, privacy, and fail-closed evidence. It is a review handoff, not a certification or activation event.

## Review index

- Candidate and prior-review handoff: `nigeria-certification-handoff.md`, this document, and `ng-candidate-2026-2-remediation-matrix.md`
- Sources and rules: `ng-candidate-2026-2-source-register.md`, `nigeria-authoritative-source-register.md`, and `nigeria-rule-source-matrix.md`
- Calculation semantics: `nigeria-paye-calculation-spec.md`, `nigeria-taxable-base-matrix.md`, `nigeria-pension-contribution-spec.md`, `nigeria-proration-overtime-rounding.md`, and `nigeria-ytd-retro-spec.md`
- Controls and downstream behavior: `unit-09-payslips.md`, `unit-09-payments-accounting-statutory.md`, `unit-09-retroactivity-model.md`, and `unit-09-security-privacy-model.md`
- Expected values and replay: `tests/fixtures/ng-candidate-2026-2-expected-values.json`, `tests/hrms-unit9-ng-2026-2-matrix.test.ts`, and `tests/hrms-unit9-ng-2026-2.test.ts`
- Database and staging proof: `ng-candidate-2026-2-postgresql-evidence.md`, `ng-candidate-2026-2-immutability-boundaries.md`, and `final-staging-validation-report.md`
- Outstanding questions and signoff: `nigeria-reviewer-questions.md` and `nigeria-certification-signoff-template.md`
- Machine-readable binding: `ng-candidate-2026-2-stage1-manifest.json` and `ng-candidate-2026-2-stage1-package.sha256`

## Mandatory reviewer findings

The JRB 2026 PIT Guidelines Appendix 1 is a blank format, not a completed numeric PAYE example. Independent source-backed expected values are not presented as official examples. The Labour/minimum-wage source and exact applicability interpretation remain an external compliance decision. These limitations are explicit and fail closed.

No official Nigeria payroll may be finalized, no official payslip or payment instruction may be issued, and no filing or remittance may be made unless a later immutable package completes independent Stage 1 review and separate Stage 2 certification.
