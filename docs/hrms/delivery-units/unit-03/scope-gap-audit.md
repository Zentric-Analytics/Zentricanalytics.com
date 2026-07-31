# Unit 3 — recruitment-to-employee scope gap audit

## Baseline

Unit 3 starts from commit `723c840835f5ed3326fa2ad5e7c9a6b9f0781751`.
The existing product has secure HR authentication and MFA, organization-scoped
permissions, immutable HR audit events, an idempotent email outbox, private
document storage, employee provisioning, workflow approvals, lifecycle
templates, and staging release safeguards.

## Reusable foundations

| Capability | Existing foundation | Unit 3 use |
| --- | --- | --- |
| Tenant isolation | `organizationId` authorization and query scopes | Required on every recruitment command and query |
| Authorization | Role-permission catalogue and server guards | Extended with recruitment permissions |
| Audit | `HrAuditEvent` with redaction and correlation IDs | One event for every transition and sensitive decision |
| Notifications | Idempotent email outbox and in-app notifications | Application review and handover delivery |
| Employee creation | Transactional provisioning and number sequence | Conversion target, changed to PRE_HIRE-first semantics |
| Lifecycle | Versioned templates and dependent tasks | Onboarding generation |
| Documents | Private versioned HR documents and access logging | Handover verification and replacement evidence |

## Missing or incompatible baseline behavior

| Brief requirement | Baseline status | Required remediation |
| --- | --- | --- |
| Hiring Teams and member capabilities | Missing | New scoped entities, management UI, department defaults |
| Governed vacancies and public publishing | Missing; careers roles are static | New vacancy aggregate, approval state machine, public-safe query |
| Applicant vs application identity | Partial | Immutable applicant number and vacancy-linked application reference |
| Recruitment state machine and stage history | Legacy free-form strings | Typed command layer and immutable transition history |
| Versioned offers and acceptance evidence | Single mutable offer | Offer versions, approvals, deliveries, immutable acceptance |
| Automatic HR handover | Missing | Idempotent acceptance-to-handover transaction and routing |
| HR new-hire workspace | Missing | Linked read model, document-version decisions, requirements |
| Pre-hire conversion | Generic employee provisioning only | Handover-locked idempotent PRE_HIRE conversion |
| Activation readiness | Employees are currently created ACTIVE | Separate PRE_HIRE and account activation command/worker |
| Recruitment concurrency and performance suite | Missing | Database-backed contention, load, worker-restart tests |

## Delivery rule

No Unit 3 release is production-ready until the database models, command
services, administrator and applicant workflows, worker behavior, migration
drill, tenant isolation, concurrency suite, browser critical paths, monitoring,
and business acceptance all pass in staging. A passing unit-test-only milestone
is a foundation milestone, not production approval.
