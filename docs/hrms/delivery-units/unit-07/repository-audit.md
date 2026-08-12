# Unit 7 repository audit

Status: repository facts captured from `dev` at `4a7be8614a3036714a432274d2afc713a3269158` on 2026-08-12. This document is evidence for an architecture blueprint, not implementation or release validation.

## Baseline

- Long-term branches were `dev` and `main`; the Unit 7 blueprint branch was created from current `dev`.
- `dev` contains the Units 1–6 history. `main` contains the Unit 6 production merge plus its evidence-only report commit.
- Prisma has 40 migrations on `dev`.
- Unit 6 release evidence records 663/663 automated tests passing.
- No Unit 7 production schema, runtime, worker, or deployment exists.
- Production was not queried, migrated, deployed, or modified during this audit.

## Search classification

| Area searched | Classification | Repository evidence and consequence |
|---|---|---|
| Person / employee identity | Reusable | `HrPerson`, `HrEmployee`, `HrWorkRelationship`, and `HrEmployeeAssignment` preserve identity, employment episodes, and effective assignments. Unit 7 must reference them, not clone them. |
| Organization / job data | Partial | `HrJobFamily`, `HrJobProfile`, `HrGrade`, `HrPosition`, department/team, legal entity, location, and cost center exist. Job function, career track, company level, competency framework, and immutable job-profile expectations do not. Existing job profiles are mutable master data and require a separate published-version layer. |
| Manager scope | Reusable | Effective supervisor assignments and `supervisedEmployeeIds` support direct-report authorization. Snapshot reviewers must be added for historical review ownership when managers change. |
| Workforce events | Reusable | Unit 4 provides versioned `HrWorkforceEvent`, immutable versions/execution attempts, idempotency/correlation uniqueness, independent approval, effective dating, conflict checks, and promotion application. Unit 7 must create a governed Unit 4 `PROMOTION` event after approval rather than update assignments. |
| Probation | Partial | `HrProbationCase` and `HrProbationReview` contain objectives and outcomes. They are lifecycle evidence, not a general performance-cycle engine. Unit 7 may reference finalized probation evidence without repurposing these tables. |
| Goals / objectives | Missing | No general employee/company goal aggregate exists. `objectives` in probation and free-text/application fields are context-specific and must not become Unit 7 goals. |
| Skills / competencies | Conflicting/legacy fragments | Applicant `skills` is free text; job-profile `minimumRequirements` and `responsibilities` are JSON. They are not versioned competency definitions or demonstrated-skill evidence. Preserve them for recruitment compatibility; build a governed shared competency catalogue and optional skill catalogue. |
| Feedback | Partial | Recruitment interview feedback supports draft/submitted locking and private comments, but is candidate-selection evidence. Its immutability pattern is reusable; its table and numeric score are not. |
| Performance reviews / ratings | Missing | No performance cycle, review template, rating scale, self-review, manager review, calibration, or finalized outcome model exists. Supervisor `/reviews` is not a Unit 7 review engine. |
| Career / development / readiness | Missing | No career-interest, development-plan, target-level readiness, calibration, promotion case, succession, or talent model exists. Employee provisioning readiness is operational completeness and is unrelated. |
| Workflow / approvals | Reusable | `HrWorkflowDefinition`, versioned stages, instances, stage runs, approvals, quorum modes, correlation uniqueness, and independent-review conventions can govern review/calibration/promotion workflows. Subject-specific immutable Unit 7 decisions still require dedicated tables. |
| Permissions / roles | Partial | Permission catalogue, role mapping, tenant authentication, MFA, direct-report scope, and server-side checks exist. Unit 7 requires granular performance, feedback, calibration, development, and talent permissions. A separate Talent Administrator role is an owner decision; permission bundles can initially sit on existing roles. |
| Audit | Reusable | `appendHrAudit` creates tenant-scoped, correlated events and redacts sensitive key names. Unit 7 must avoid copying narrative feedback into generic audit JSON; record state/IDs/version hashes instead. |
| Notifications / email | Reusable/partial | `HrEmailOutbox`, in-app `HrNotification`, preferences, idempotent upsert, retry worker, and fail-closed sender registry exist. Unit 7 templates must be registered under the existing HR sender category and use real configured recipients. |
| Tasks | Partial | Lifecycle tasks and generic workflow stage runs exist. Review/promotion approvals fit workflows; lightweight due actions need either workflow tasks or a small Unit 7 action/task aggregate without overloading onboarding/offboarding lifecycle tasks. |
| Effective dating / versioning | Reusable | Unit 4 effective snapshots, Unit 5 policy/request versions, and Unit 6 policy/template/interpretation versions establish stable identity plus immutable published version. Unit 7 should use that pattern. |
| Concurrency / idempotency | Reusable | Serializable transactions, bounded retries, expected-version guards, unique organization/idempotency keys, claim tokens, and deterministic conflicts are proven in Units 4–6. |
| Period locks | Reusable pattern | Unit 6 attendance-period locks and hashes demonstrate how finalized review/calibration snapshots can be sealed. Unit 7 must not reuse time tables but should reuse the snapshot-hash concept. |
| Documents | Reusable | Private versioned documents, exact-version scan results, fail-closed access, retention, and audit exist. Unit 7 evidence and generated letters should reference exact `HrEmployeeDocumentVersion` records rather than store files again. |
| Backup / restore | Reusable | Encrypted archive, checksum, retention, Object Lock, isolated restore, reconciliation, and plaintext cleanup procedures exist. Unit 7 must extend restore correlation and orphan queries. |
| Status pages | Reusable | Units 4–6 expose public and authenticated status artifacts with environment, SHA, tests, phase, gates, and next action. Unit 7 can add a blueprint-only page without business runtime. |

## Existing models to reuse directly

`HrOrganization`, `HrUser`, `HrRole`, `HrPermission`, `HrPerson`, `HrEmployee`, `HrWorkRelationship`, `HrEmployeeAssignment`, `HrSupervisorAssignment`, `HrDepartment`, `HrTeam`, `HrPosition`, `HrJobFamily`, `HrJobProfile`, `HrGrade`, `HrLegalEntity`, `HrLocation`, `HrWorkflowDefinition`, `HrWorkflowDefinitionStage`, `HrWorkflowInstance`, `HrWorkflowStageRun`, `HrWorkflowApproval`, `HrWorkforceEvent`, `HrWorkforceEventVersion`, `HrWorkforceEventExecutionAttempt`, `HrEmployeeDocument`, `HrEmployeeDocumentVersion`, `HrAuditEvent`, `HrEmailOutbox`, `HrNotification`, and `HrNotificationPreference` remain authoritative in their existing domains.

## Gaps and conflicts

1. `HrJobProfile` and `HrGrade` cannot reproduce historic expectations because they lack immutable published versions and explicit career/level semantics.
2. Grade level is compensation/organization data, not automatically a career level; Unit 7 must not equate them.
3. Applicant skill text and job requirement JSON are unsuitable as reusable competency definitions.
4. Interview scores are recruitment-specific and must not seed a hidden performance score.
5. Probation objectives and employee-provisioning readiness must remain isolated from performance and promotion readiness.
6. Existing roles lack talent/calibration-specific permission vocabulary.
7. No safe location exists for classified feedback or calibration narrative; generic notes and audit JSON are inappropriate.
8. No immutable linkage currently explains why a Unit 4 promotion event was authorized by a Unit 7 decision.

## Repository-appropriate conclusion

Unit 7 should add tenant-owned performance aggregates beside—not inside—the existing workforce masters. It should extend job architecture through versioned expectation records, reuse generic workflow and notification infrastructure, and hand only an approved promotion decision to Unit 4. General succession/high-potential classification and compensation calculation remain deferred.
