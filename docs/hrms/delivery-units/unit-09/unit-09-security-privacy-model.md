# Unit 9 security and privacy model

Payroll data is restricted financial and identity data. Authorization is permission + tenant + subject/scope + state, enforced server-side. UI hiding is never the control.

## Segregated roles

| Role | Allowed scope | Explicit exclusions |
|---|---|---|
| Payroll Processor | collect/certify, simulate/calculate, resolve assigned input exceptions | final approval, payment approval/submission, unrestricted bank/tax identifiers |
| Payroll Administrator | configuration and operational oversight for assigned legal entities/jurisdictions | self-approval, payment approval, unrestricted security administration |
| Payroll Approver | reconciliation/risk review and payroll approval | create/alter source inputs, payment submission/approval |
| Payment Operator | build/validate and submit approved payment batches | calculate payroll, approve same batch, view unnecessary narratives |
| Payment Approver | independently approve payment batch | create batch, submit as same actor, payroll-source mutation |
| Finance Reader | aggregate liabilities, balanced journals, settlement reconciliation | employee bank/tax details, draft calculations, manager rationale |
| Statutory Operator | scoped statutory identifiers/outputs and submission state | bank details, unrelated HR or compensation deliberation |
| Payroll Auditor | read-only manifests, lineage, approvals, reconciliation and provider evidence | all mutations; secrets displayed only as redacted references |
| Employee | own finalized payslip/YTD/payment status and permitted tax documents | peers, drafts, rules, bank schedules |
| Manager | aggregate workforce/cost information only if separately authorized | net pay, taxes, deductions, bank, tax IDs, payslips |

`ADMIN`, `HR_ADMIN`, `COMPENSATION_ADMIN`, and the current `PAYROLL_ADMIN` do not automatically receive the new end-to-end role set. The legacy role is migrated into scoped bundles and cannot satisfy maker/checker by itself.

## Sensitive data controls

- Bank/tax/statutory identifiers are envelope-encrypted or provider-tokenized; display last four only by default.
- Secrets live in the environment secret manager, never database manifests, logs, exports or audit payloads.
- Payslips, bank files and statutory/accounting exports use private versioned object storage, TLS, encryption, scan policy where applicable, exact-version authorization and short-lived retrieval.
- CSV formula neutralization remains mandatory. Large exports require purpose, scoped approval, audit, expiry and watermark/reference.
- Logs and metrics use IDs, counts, states, timing and hashes—not gross/net pay, identifiers, account numbers, addresses or provider credentials.
- Audit records preserve action/state/hash/correlation; confidential calculation trace content is separately permissioned.

## Tenant and direct-ID controls

Every lookup includes organization identity. Worker leases, provider callbacks, object keys, idempotency keys and external references are tenant-scoped. Cross-tenant and unrelated direct IDs return 404 where existence itself is sensitive, otherwise 403 with no partial payload. Denied mutation creates no side effect.

## Provider callbacks

Require TLS, authenticated signature/secret, timestamp/replay window, provider configuration and tenant scope, unique provider event ID, exact batch/transmission correlation, body-size limits and fail-closed parsing. Persist a sanitized inbox event before processing; retries cannot duplicate settlement.

## Retention and privacy requests

Retention categories distinguish finalized results/manifests, payslips, tax/statutory records, payments, journals, provider evidence, audits, drafts and simulations. Jurisdiction package configuration supplies approved periods; this blueprint invents no legal duration. A privacy deletion request cannot erase legally retained financial truth. Disable account access and apply lawful tombstoning/anonymization only to fields not required for financial, statutory or defense evidence.

## Verification matrix

Later tests must cover each role through browser and direct route/ID calls, unrelated employees, unassigned legal entities, cross-tenant IDs, denied mutations, response-field allowlists, export scopes, callback replay and audit redaction. Expected denial is 403/404, no sensitive payload and no mutation.
