# Unit 8 repository audit

Status: repository facts captured from `dev` at `c57c21d7827b099fc3abea12a1c946f3c58f65ff` on 2026-08-13. This is blueprint evidence only. No runtime migration, staging deployment, or production change was performed.

## Baseline and topology

- The blueprint branch `feature/hrms-unit-08-compensation-rewards-blueprint` was created from a clean `dev` worktree.
- `dev` contains the validated Unit 7 feature SHA `affcb536ae628f919eb93a1c0f95642306670d94` and all 43 migrations.
- The production merge SHA `b20fc7db0fd5338fb73dd4fe304e2438345736b6` and documentation-only commits are on `main`, not ancestors of `dev`. This is expected branch topology after the controlled production merge; the Unit 7 implementation is present on both histories.
- `main` and production were not modified or queried during this blueprint audit.

## Search classification

| Area | Class | Repository fact and Unit 8 consequence |
|---|---|---|
| Person, employee, work relationship, assignment | Reusable | `HrPerson`, `HrEmployee`, `HrWorkRelationship`, and effective `HrEmployeeAssignment` are authoritative. Compensation must bind to the applicable work relationship and assignment episode. |
| Job architecture | Reusable/partial | `HrJobFamily`, `HrJobProfile`, immutable `HrJobProfileVersion`, `HrCompanyLevelVersion`, `HrGrade`, position, legal entity, location and cost center exist. A company Z-level is not a salary band. |
| Existing grade ranges | Legacy/conflicting | `HrGrade.minimumSalary/midpointSalary/maximumSalary` and `HrPosition.salaryBandMinimum/Maximum` are mutable, single-currency conveniences. They cannot reproduce market-specific published band history and must not remain authoritative after Unit 8 cutover. |
| Recruitment/offer salary | Reusable input only | Vacancy ranges and immutable accepted offer versions capture proposed/contracted starting terms. The accepted offer may seed an `INITIAL` compensation decision, but must not become ongoing compensation history. |
| Salary history | Partial/legacy | `HrSalaryRecord` is effective-dated, tenant-scoped and approved, with an immutability database trigger. It lacks work-relationship/assignment, band, market, policy, event, decision, correction, idempotency and payroll-handoff references. Treat it as the Unit 9 compatibility projection during transition, not the Unit 8 aggregate. |
| Payroll | Conflicting boundary | Payroll runs, items, components, adjustments, approvals, payslips and exports already exist. Unit 8 must supply approved inputs without calculating tax, deductions, gross-to-net, payslips or payments. |
| Pay basis/currency | Partial | `HrPayFrequency` and several free-form currency strings exist; decimal money storage is sound. There is no governed currency catalogue, contractual pay basis, dated FX snapshot, or market-currency rule. |
| Bonuses/rewards/equity | Missing/partial | Payroll components can pay an amount but do not represent governed award eligibility and approval. Full equity administration is absent and remains deferred. |
| Compensation market/bands/benchmarks/policy | Missing | No market identity/version, geographic differential, immutable market band version, benchmark snapshot or compensation philosophy exists. |
| Merit cycle/budget/recommendation/exception | Missing | No compensation cycle, population snapshot, atomic budget reservation, manager recommendation, calibration, exception or final decision exists. |
| Unit 7 performance/promotion | Reusable | Finalized review/calibration and `HrPromotionDecision` provide immutable input IDs. Unit 7 never writes pay; Unit 8 must reference exact versions and independently approve compensation. |
| Unit 4 workforce events | Reusable | Versioned events, effective worker, execution attempts and conflict checks remain authoritative for promotion/transfer/separation. Unit 8 reads workforce state and emits compensation decisions, never overwrites assignments. |
| Workflow/approval | Reusable | Versioned workflow definitions, instances, stages and approvals support configurable chains. Dedicated Unit 8 immutable recommendation, exception and decision tables remain necessary. |
| Audit | Reusable | Tenant-scoped `HrAuditEvent`, correlations and sensitive-key redaction are reusable. Audit should store identifiers, states, hashes and money summaries, not confidential calibration narrative. |
| Notifications/outbox | Reusable | In-app notifications, preferences, fail-closed email sender registry, outbox idempotency and retry workers exist. Unit 8 templates should use the governed HR sender category; no new sender identity is needed. |
| Permissions | Partial | Existing granular permissions and manager scope are reusable. `ADMIN` currently has broad catalog access, while the owner requires admin alone not to reveal salary. New compensation permissions and field-level policies are mandatory. |
| Documents/storage | Reusable | Private exact-version documents, scanning, retention and access logging can store finalized statements. Do not store generated files in compensation tables. |
| Workers/idempotency | Reusable | Claim tokens, deterministic idempotency keys, bounded retries and serializable PostgreSQL transactions are established patterns. |
| Backup/restore | Reusable | Encrypted durable archives, checksums, isolated restore, orphan/duplicate reconciliation and plaintext cleanup exist. Unit 8 extends the relationship chain and budget reconciliation. |

## Existing components to reuse directly

Identity and workforce: `HrOrganization`, `HrPerson`, `HrEmployee`, `HrWorkRelationship`, `HrEmployeeAssignment`, `HrSupervisorAssignment`, `HrJobProfileVersion`, `HrCompanyLevelVersion`, `HrGrade`, `HrPosition`, `HrLegalEntity`, `HrLocation`, `HrCostCenter`, `HrWorkforceEvent`, `HrPromotionDecision`.

Governance and operations: `HrWorkflowDefinition`, `HrWorkflowInstance`, `HrWorkflowStageRun`, `HrWorkflowApproval`, `HrAuditEvent`, `HrEmailOutbox`, `HrNotification`, `HrNotificationPreference`, `HrEmployeeDocument`, `HrEmployeeDocumentVersion`, the internal-worker authentication mechanism, backup/archive tooling, and permission/scope helpers.

## Principal gaps and conflicts

1. Mutable grade/position salary ranges conflict with immutable, market-specific band versions.
2. `HrSalaryRecord` cannot explain which policy, recommendation, budget, exception, promotion or assignment produced pay.
3. Payroll currently reads salary records directly; Unit 8 needs an explicit, versioned compatibility projection/handoff so drafts never reach payroll.
4. Free-form currency codes require validation without rewriting historic contractual currency.
5. General administrator access must be decoupled from individual compensation visibility.
6. No atomic budget reservation ledger exists; overspend races would be release-blocking.
7. No correction/supersession chain represents retroactive authoritative timelines without deletion.
8. No distinction exists between manager recommendation, calibrated recommendation and final decision.
9. Payroll components are not a bonus-award governance model.

## Audit conclusion

Unit 8 should be an additive compensation bounded context beside workforce and payroll. It should introduce stable identities plus immutable versions, append-only effective compensation records, atomic budget ledgers, governed recommendations/exceptions/decisions, and a narrow payroll-authoritative handoff. Existing salary and grade range fields remain compatibility data until a reconciled cutover; they are not silently rewritten or deleted.
