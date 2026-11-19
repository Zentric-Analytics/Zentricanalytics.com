# Synthetic application integration plan

Run database-backed scenarios only after approval for a separate prepared test
target. The reusable identity baseline stays empty. Use `example.invalid`
addresses, fake provider implementations, fictional records, generated
disposable authentication material and two deliberately separate tenants.
Fix the clock and seed for deterministic replay. Restore test state with
transaction rollback or separately approved fresh test targets.

| Area | Fictional fixtures | Positive and negative checks |
| --- | --- | --- |
| Organization | Aurora and Cobalt tenants, separately scoped administrators, managers, business units and departments | Create and assign units and roles within scope. Reject foreign IDs, cross-tenant list/count/search and permission elevation beyond the actor's grant. Check audit actor, tenant and before/after values. |
| HR | A hire, reporting lead, cross-unit transfer and departing employee in each tenant | Verify onboarding, reporting changes and deactivation. Reject unauthorized transfers and foreign supervisor assignment. Verify audit history and denied access after deactivation. |
| Recruitment | Candidate, recruiter, hiring manager and unrelated employer per tenant | Drive application, offer and acceptance through approved states. Reject skipped or replayed transitions and cross-tenant reads or mutations. Verify candidate and employer projections mask private notes and unrelated records. |
| Authentication | Fictional accounts, synthetic passwords, reset challenges, MFA credentials and sessions | Test successful login, wrong credentials, expiry, single-use reset, MFA replay, revocation, stale session denial and tenant switching. Confirm secrets and challenge values are absent from logs and evidence. |
| Payroll | Fictional salaries, deductions, balances, payslips and tenant-specific payroll roles | Verify salary-detail and export permissions independently. Reject unauthorized and cross-tenant export by API and direct object ID. Preserve existing official-use and legal-certification gates. |
| Notifications | Fictional recipients, synthetic outbox and attempts, fake transport, audit and HELD events | Check claim/version fences, stale writes, bounded retry, unknown provider outcome, no replay and correct audit/recovery markings. Assert the fake transport receives only expected calls and no provider credentials or workers are enabled. |
| Migrations and transactions | Pinned 66+2 migration bytes, five legacy outbox rows, ten attempts, two audits | Verify ordered checksums, before/after projections, constraints, indexes, triggers and journals. Run generated Prisma transaction/rollback checks and the seven bounded races, verifying the blocking chain, exact cancellation identity and final version/event counts. |

## Execution and evidence

1. Verify exact engine, target, artifacts, migration fingerprints, authorization,
   fixture scope, no host ports, and default-deny egress. Keep the baseline
   out of the application connection settings.
2. Record fixture version, clock, seed, and scenario IDs. Use generated test
   identities per tenant and wipe secrets from diagnostic output. Exercise
   authorization through real application handlers and verify database state
   with narrow assertions against the authorized target.
3. Verify both positive and negative paths and compare observed outcomes with
   the existing application policy. Stop on unexpected writes, sensitive
   output, identity mismatch, or uncertain provider or database outcomes.
4. Record only sanitized pass/fail results, fixed failure reasons, counts and
   checksums. Keep resource and authorization evidence outside Git under the
   operator's approved storage and recovery terms.

The existing Vitest suites exercise application and policy behavior offline.
The Q03 harness covers pinned inputs, synthetic legacy fixtures, stage order
and failure paths offline. The future database run supplies live PostgreSQL
and Prisma evidence. Provisioning the empty baseline authorizes neither that
run nor application seeding.
