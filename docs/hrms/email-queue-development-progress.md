# HRMS email queue reconciliation — development ledger

Owner scope: consolidated Phases 1–3, November 16, 2026. Sole branch:
`feature/hrms-email-queue-safety`. No deployment or dev/main promotion is authorized.

## Preservation checkpoints

Initial local Q03-B1 commit `e0ce681f7b80c1077a0cecd2263fcdb190bded03` was recovered,
verified as a direct descendant of remote `23da55f06c857545d4c441329bcce62a43f159bf`,
and published after current Render/GitHub trigger checks. GitHub's resulting SHA
was independently verified. No new branch, merge or history rewrite was needed.
Subsequent unit SHAs are recorded in the external consolidated report and Git log;
this document does not attempt to contain its own commit SHA.

## Phase status

| Phase | Status | Evidence / limitations |
|---|---|---|
| 1 — preservation and source/schema contracts | CONDITIONAL | Q03-B1 published; all drift objects classified; representable metadata/default/nullability/index defects corrected; Prisma 6.10.1 validates and generates in an isolated dependency copy. A new live comparison is pending Docker recovery. |
| 2 — SQL upgrade, integrity and concurrency | BLOCKED | Owner explicitly authorized only new `q03_1960147fab_track_b` on original immutable Q03 resources. Docker Desktop currently fails to locate its installation Registry key; the approved engine pipe is absent. No Registry repair, replacement resource, new database or SQL execution was attempted in this continuation. Track A is preserved. |
| 3 — email/queue runtime integration | CONDITIONAL | Shared transport and batch/item queue integration implemented, with fake-provider/store tests and application regression verification. Actual SQL transactional/concurrency behavior and deployed configuration remain uncertified. |

## Schema drift classification and source corrections

`tests/fixtures/schema-contract-alignment.json` records source migration provenance
for the complete classification. No SQL proposal was applied and no historical
migration was edited.

- 23 FKs: explicit Prisma mapping/referential actions retain actual historical
  constraint names and behavior.
- 87 indexes: explicit names preserve existing indexes instead of renaming them.
- Timestamp defaults: `Offer.updatedAt` and `EmploymentAgreement.updatedAt` now
  retain SQL's CURRENT_TIMESTAMP default alongside Prisma update semantics.
- Creator fields: recruitment offer creators match historical NOT NULL; nullable
  legacy payroll creator records are represented honestly. The authorized payroll
  creation service still supplies its authenticated actor ID for new operations.
- `JobApplication_deletedAt_idx` remains represented and protected.
- 65 supplemental SQL-only FKs remain in migration history; no constraint removal
  is authorized merely because Prisma cannot express it as an existing relation.

The 68 migration hashes and original Q03 snapshots remain unchanged. The recorded
Track A replay passed before these source-only representation corrections; that
historical result is not presented as a fresh database test of changed code.

## Runtime integration

`email-runtime-policy.mjs` maps documented Render service/repository/branch/type
and explicit preview/process configuration onto the reviewed resolver and recipient
rules. Bindings are source-controlled, not derived from HTTP headers, hostnames or
the same untrusted snapshot. This is validated server configuration, not independent
cryptographic provider attestation. Administrative access to code/configuration
remains a trust boundary. Unknown/contradictory identity fails closed; local test
labels cannot bypass a recognized protected service.

Production valid external business recipients remain eligible. Staging requires
an operator-approved JSON mailbox list in `STAGING_EMAIL_RECIPIENT_ALLOWLIST`;
missing/invalid configuration blocks delivery. No live setting/credential was
created or changed, and the actual list/credential separation must be verified
before activation. Recipient containment is independent of HRMS account eligibility.

`sendHiringEmail` is the universal final transport boundary for existing direct
and queued pathways. It rechecks runtime policy before Resend, distinguishes
configuration blocks/holds/simulation/uncertainty, requires explicit provider
acceptance evidence, uses bounded requests and accepts queue idempotency keys.
Console simulation cannot be counted as delivery. Network failures and ambiguous
responses do not become ordinary retryable provider rejections.

New HR outbox rows declare contract v1. Invitations/reset messages bind actual
credential IDs and expiry. Enqueue rejects tenant/idempotency conflicts. Batch and
immediate invitation dispatch share `dispatch-engine.ts`; immediate lookup requires
the initiating organization. Existing route authentication/RBAC is retained.

The dispatcher uses version/claim CAS within database transactions, bounded leases,
intent/reservation/invocation journals, attempt increment only at the invocation
boundary, current credential checks and a final pre-provider gate. Reservation
cancellation requires durable absence of an invocation boundary and a winning CAS.
Post-boundary denial remains uncertain without a counter refund. Provider outcomes,
attempt records, linked audit and journal changes commit together. Expired intent/
reserved/attempted claims become HELD rather than replaying. A claim with no intent
may be recovered through its durable audit; no fictitious dispatch journal kind is
invented for that pre-dispatch recovery. No exactly-once DB/HTTP guarantee is claimed.

## Validation and defects addressed

- Generated Prisma Client 6.10.1 in a separate dependency copy using verified cached
  Windows engines; no installation or live database connection was required.
- Fixed the dual node:test/Vitest callback typing incompatibility without changing
  assertions; the TypeScript check passed after this correction.
- Application Vitest discovery explicitly targets application tests; archived
  node:test harness suites keep their separately guarded execution convention.
- Historical checks recovered missing referenced Git objects. Original attributes
  and verified backup bytes were retained after reverting an overly broad LF rule.
  Only exact source bytes already retained in immutable correction archives received
  narrow checkout rules. Historical claims, archives and test expectations were not
  rewritten to make them pass.
- Full application regression reached 177 files / 2,974 passing tests before the
  final control-character regression expansion. Current final counts and build/lint
  results are recorded in the external report; historical counts are not substitutes
  for fresh verification of later changes.
- Fake-store concurrency and fake-provider tests exercise ownership conflicts,
  recipient holds, configuration pauses, cancellation, uncertainty and retry
  containment. They do not establish actual PostgreSQL concurrency behavior.

Final checkpoint verification: **3,040 application tests / 178 files passed**;
**157 separately guarded harness tests passed**; the strengthened 66-case ASCII
control-character suite also passed. Prisma validation, isolated client generation,
TypeScript checking, changed-file lint and the local production build passed.
The build was allowed to fetch only the existing Google font assets; external
provider/API destinations remained denied. An initial build caught the old
control-character regex lint issue; equivalent character scanning fixed it without
weakening validation. Full SQL-backed queue verification remains blocked.

## Activation / completion blockers

1. Restore the existing Docker installation through an owner-approved repair, then
   verify exact original container/network/volume/image identities. Do not reset,
   reinstall, recreate resources or substitute another database automatically.
2. Execute the authorized Track B sequence only after fresh identity/security gates:
   66 historical migrations, deterministic synthetic legacy baseline, two unchanged
   Q02-B migrations, exact row preservation, SQL constraint/journal and bounded
   concurrency tests. Preserve both databases. Failure injection remains unapproved.
3. Verify actual SQL transactions, outcome persistence, credential and tenant guards
   against generated client queries. Until then, runtime integration remains WIP.
4. Unversioned legacy queue rows are deliberately not dispatched automatically. Their
   classification/upgrade needs verified historical-state and credential evidence;
   no worker may infer non-invocation from an old timeout or reset counters.
5. HELD rows have no automatic release. An authorized reviewer/permission, retention
   policy and auditable release procedure with current policy/credential re-evaluation
   are still required. This implementation does not invent a new business permission
   or expose an unaudited release endpoint.
6. Before activation, verify distinct provider credentials, exact runtime metadata,
   approved staging recipients, production account compatibility and recovery/rollback
   evidence. Existing internal HRMS login/MFA/RBAC and public candidate authentication
   were not replaced by email-recipient eligibility checks.

Before any merge, the separately authorized full debugging, compilation, regression,
security, database safety, deployment-readiness and recovery assessment must resolve
all critical/high-risk blockers and receive explicit owner approval.
