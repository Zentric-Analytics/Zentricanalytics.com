# Unit 3 — recruitment-to-employee scope gap audit

## Baseline

Unit 3 starts from commit `723c840835f5ed3326fa2ad5e7c9a6b9f0781751`.
The existing product has secure HR authentication and MFA, organization-scoped
permissions, immutable HR audit events, an idempotent email outbox, private
document storage, employee provisioning, workflow approvals, lifecycle
templates, and staging release safeguards.

## Phase 0 checkpoint verification

Checkpoint `e7c80b269b61fca2104947cf35d070a6c485007b` exists locally and contains
exactly four changed files: the recruitment state/gate module, recruitment
permission additions, exhaustive state/gate tests, and this audit.

Validation performed on 30 July 2026:

| Gate | Result |
| --- | --- |
| Vitest | PASS — 35 files, 344 tests |
| TypeScript | PASS — `tsc --noEmit` |
| ESLint | PASS — zero warnings |
| Prisma schema | PASS — validation used a non-routable placeholder URL and made no database connection |
| Next.js production build | PASS — 90 routes |

The transition test iterates the Cartesian product of each domain's statuses.
Every declared edge must succeed and every undeclared edge must throw. This is
stronger than checking only a few examples, but it does not replace
database-backed command, authorization, concurrency, and audit tests.

## Actual repository architecture

- Next.js 15 App Router with React 19 and server actions/routes.
- PostgreSQL through Prisma 6, with additive timestamped SQL migrations.
- Cookie-backed HR sessions, password hashing, required privileged MFA, and
  organization-scoped users/roles/permissions.
- Vitest for automated tests; many existing tests are source-contract tests,
  so Unit 3 must add database-backed integration tests rather than inflate
  completion counts with source assertions.
- Transactional `HrEmailOutbox` plus an authenticated worker, bounded retries,
  delivery attempts, idempotency keys, in-app notifications, and metrics.
- Private local storage in development and S3-compatible private object storage
  for deployed HR documents.
- Render pre-deploy release command with environment guard, Prisma migration
  deployment, bootstrap/preflight checks, backup-readiness and restore-drill
  scripts.

## Architectural and migration risks

1. The legacy `JobApplication.status` and offer status are unconstrained strings.
   Unit 3 must introduce typed aggregates without corrupting existing candidate
   portal records.
2. Existing `Applicant` records lack immutable applicant numbers and may contain
   duplicate normalized emails. Backfill must detect and report ambiguity rather
   than merging people.
3. Existing applications are not linked to governed vacancies. Migration must
   preserve them as legacy/general applications and must not fabricate approval
   history.
4. The current single mutable `Offer` cannot safely represent issued-version
   evidence. Existing offers require a version-one backfill with explicit
   provenance.
5. Generic employee provisioning currently creates `ACTIVE` employees. The
   recruitment conversion path must be a separate `PRE_HIRE` transaction and
   must not silently change the behavior of unrelated manual provisioning.
6. Current HR lifecycle tables are reusable for onboarding, but recruitment
   conversion needs a unique case/conversion relationship and deterministic
   template selection.
7. Adding permission keys requires migration/bootstrap reconciliation so
   existing roles receive only the intended grants.

## Security and testing gaps

- No Hiring Team, vacancy, application-owner, or HR-handover scope exists yet.
- No database constraints currently guarantee one acceptance, one handover, or
  one candidate conversion.
- No cross-team/direct-object-reference test suite covers recruitment records.
- No database-backed contention tests cover recruitment identifiers or commands.
- No applicant-facing signed-link model exists for versioned offers.
- No Unit 3 load targets or worker/dead-letter recovery evidence exists.

## Planned implementation phases

1. Hiring Teams, member permissions, defaults, HR routing and fallback queues.
2. Governed vacancies, approvals, immutable numbers and public-safe publishing.
3. Candidate/application identity, submission transaction, routing and portal.
4. Interviews, feedback isolation and assessments.
5. Versioned offers, approvals, delivery and idempotent acceptance.
6. Automatic HR handover, new-hire workspace and document verification.
7. Requirement rules, evaluations, overrides and eligibility.
8. Atomic PRE_HIRE conversion, onboarding generation and employee linkage.
9. Onboarding readiness plus separate employee/user activation commands/workers.
10. Full API/UI completion, reliability/security/concurrency/load verification,
    recovery drill, operational documentation and acceptance evidence.

## Assumptions requiring verification before release

- The organization will nominate Hiring Team owners, responsible HR users, and
  a fallback queue in staging.
- Legal-entity/location/department data used by routing is complete.
- A valid active onboarding template exists for every supported hire category.
- Business owners will define approval chains, salary-visibility policy,
  retention rules, response-time targets, and formal UAT actors.
- Staging database backup/restore and worker credentials will be reverified
  before applying Unit 3 migrations. Production access is outside this task.

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
