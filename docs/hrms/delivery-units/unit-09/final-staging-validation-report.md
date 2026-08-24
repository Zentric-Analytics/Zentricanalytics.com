# Unit 9 Nigeria limited-launch final staging evidence

Status: **UNIT 9 NIGERIA LIMITED-LAUNCH OPERATING CONTROLS — STAGING READY**.

`NG-CANDIDATE-2026.3` remains **NOT CERTIFIED**. Production was not accessed or modified. No real payment, payslip publication, filing, submission, settlement, or remittance occurred.

## Limited-launch candidate and deployment

- History-preserving feature merge: `854073f07d6f20411bfc9bfd2b1f77c9779e4f84`.
- Repeatable concurrency correction: `e88b49f1b18d95e88227c232754f41f758656221`.
- Atomic exception-resolution correction: `27ff5d53779889a8e08648c8e8afd51f3395217b`.
- Persisted tenant-RBAC backfill: `7cde24b0b9326d6f6aab51af0fa85f8bbbb860d4`.
- Canonical guarded-release RBAC reconciliation correction: `0a367bbc79ef9f9bb041ab6ff839abfeacd0b7f6`.
- Corrected staging deployment: `dep-da67hcfqj5pc73ean2og`.
- Staging database: `zentric_analytics_staging`; 60 migrations applied, none pending or failed.

## Limited-launch gate evidence

- Full repository gate: 959/959 tests across 81 files.
- Focused limited-launch and concurrency suites: 15/15.
- TypeScript: PASS.
- ESLint: PASS with zero warnings.
- Prisma validation: PASS.
- Production build: PASS; 125 routes generated.
- Health and readiness: PASS (`status=ok`; database ready).
- PostgreSQL Unit 9 concurrency: PASS at correlation `unit9-concurrency-1787588153889`.
- Limited-launch exactly-once concurrency: PASS at correlation `limited-launch-1787588448587`; one exception creation winner, one resolution winner and one population-partition winner.
- Integrity: zero checked duplicates, orphans, maker/checker violations, uncertified finalizations, or broken limited-launch relationships.
- Bounded load: 250 requests, zero failures; p95 300.8 ms in the recorded final Unit 9 staging load run.
- Candidate preservation: byte hashes recorded in `ng-candidate-2026-3-limited-launch-preservation.md`; the certified-status boundary remains unchanged and fail-closed.

## Browser privacy and authorization

- A generic `ADMIN` received the expected 403 for the payroll workspace with the explicit no-data-disclosed response.
- A staging-safe employee was temporarily granted `PAYROLL_COMPLIANCE_ADMIN` through the governed Users UI.
- Initial positive access found a release defect: the application catalog contained the limited-launch permissions, but persisted tenant RBAC did not. The first migration-only correction was then removed by the guarded release reconciler because its canonical list was stale.
- The smallest correct fix backfilled the database grants and aligned the guarded reconciler, with regression coverage for both paths.
- On corrected deployment `dep-da67hcfqj5pc73ean2og`, the compliance account accessed `/hr/admin/payroll/unit9/compliance-exceptions` successfully.
- The rendered queue exposed only Employee, Run, RTA, Blocker, Input, Opened, Owner and Status. Bank, tax identifier, pension identifier and reviewer-note fields were omitted.
- Direct access to `/hr/admin/users` returned 403 and disclosed no sensitive payload.
- Cross-tenant and unknown-record denial are covered by the server-side tenant filters and automated privacy contracts; staging contains no authorized second-tenant fixture from which to fabricate live evidence.
- The temporary role was removed through the governed UI. The account is again `EMPLOYEE` only. Audit correlations: assignment `7d43c45a-7532-4f00-af9c-c764564ec6e0`; revocation `b2b9d0c5-8e47-4eee-a216-7d82a8fa86c5`.

## External compliance boundary

- Lagos, Oyo and FCT are the only limited-launch RTAs; Ibadan deterministically resolves to Oyo.
- Monthly nominal payment date is the 29th, adjusted to the immediately preceding business day using a frozen versioned calendar.
- `SALARY` is recurring. `COMPENSATION` and `BONUS` are non-periodic and remain held where an authoritative RTA allocation rule is unresolved. Sick-leave payroll earning is excluded.
- `NOT_CONFIGURED` pension setup is not treated as a legal exemption.
- Unsupported minimum-wage edge cases and unresolved RTA rules remain structured compliance holds; held employees are not silently dropped.
- Official finalization, official payslips, real payments and statutory filing remain prohibited while the candidate is `NOT CERTIFIED`.

## Prior NG-CANDIDATE-2026.2 evidence

Status: **READY FOR NEW QUALIFIED STAGE 1 COMPLIANCE REVIEW — NOT CERTIFIED**.

Production was not accessed or modified. No real payment, filing, submission, or remittance occurred.

## Candidate identity

- Preserved functional candidate: `14632a33b2cf2644089e54399412c7e94ce5dbbd`
- Evidence branch head before merge: `85f099be7b309adda88d84e73a2c4ce00586f6d1`
- History-preserving merge into `dev`: `15b65249dfa91ff801b8031ad5d91722cabab4f1`
- Candidate-aware integrity correction: `1fb4320f7c77df781d8a6f5829c21d003b557d6f`
- Final implementation and integrity correction: `0ddde7e9c11ffc7a96e773bfd665377bc4465cd5`
- Validated implementation deployment: `dep-da07quojo6nc73du5eg0`
- Visible evidence/status deployment: SHA `d54b37b24abee3f6b4a8c695c9037072a13cd591`, deployment `dep-da07uhflk1mc73fc16f0`
- Staging database: `zentric_analytics_staging` at staging host identity `dpg-d8s9itj6sc1c73c6vsl0-a`
- Migrations: 58 applied, zero pending, zero failed

## Automated and build evidence

- Focused 2026.2 closure: 114/114 across the four final candidate/package suites; governed-workflow suite is 17/17 after the retro-lineage regression.
- Full repository gate: 919/919 across 77 files.
- TypeScript: PASS.
- ESLint: PASS with zero warnings.
- Prisma validation: PASS.
- Production build: PASS; 125 routes generated.

## Live staging evidence

- Health/live returned `{"status":"ok"}` and readiness returned `{"status":"ready","database":"ok"}` after the corrected deployment; deployment preflight also reported ready.
- Pre-deploy safely no-oped bootstrap and reconciled canonical roles without stale grants.
- PostgreSQL concurrency correlation `unit9-concurrency-1786804018841`: prior-YTD one winner plus append-only v2; six YTD categories one winner each; one retro trigger; replay-safe acknowledgement; conflicting acknowledgement rejected; statutory amendment v1 plus governed superseding v2.
- Lifecycle correlation `unit9-staging-1786804493276`: simulation calculated; employer contribution remained outside employee net; finalization rejected because jurisdiction status is `TESTING`/not certified.
- Regulatory Watch correlation `54db8a63-6e1f-4a37-b2be-d6f68a7ff3d7`: unchanged replay idempotent, exactly one change candidate, no automatic activation, provider failure recorded as degraded.
- Integrity: 58 migrations and zero failed migrations. Every enhanced candidate invariant returned zero, including payroll/evidence orphans; duplicate relief, prior-YTD, refund, acknowledgement, amendment, attempt and selected-result truth; RTA, pension and BIK overlaps; broken payslip corrections and retro lineage; gross-to-net and employer-contribution/net errors; maker/checker violations; uncertified finalizations; unbalanced journals; invalid payslips; and invalid/duplicate payment instructions.
- Bounded load: 250 operations, concurrency 10, zero failures; p50 94.5 ms, p95 300.8 ms, p99 1042.5 ms, maximum 1143.2 ms.
- Signed-in generic administrator direct route to `/hr/admin/payroll/unit9`: privacy-safe 403 and explicit `No data was disclosed`; no payroll payload rendered.
- Evidence read API: tenant ID is mandatory in every lookup; known foreign/unknown IDs receive privacy-safe 404; encrypted RTA tax ID and pension RSA fields are excluded.

## Defect found and corrected

The first post-migration integrity run failed because the runner hard-coded the old count of 54. The database correctly contained 58 successfully applied migrations. The runner now derives the expected count from the exact candidate migration directories, regression coverage forbids another numeric constant, and the affected gate passed after redeployment.

The first enhanced retro-lineage query then referenced a nonexistent `correctionResultId`. The persisted model links a retro impact to `correctedAttemptId` and an optional `adjustmentResultId`. Commit `0ddde7e9c11ffc7a96e773bfd665377bc4465cd5` corrected the query to those exact relationships, added regression coverage that rejects the invalid column name, passed all 919 tests and build gates, and produced a clean live PostgreSQL integrity result after redeployment.

## Human boundary and evidence gap

Both `NG-CANDIDATE-2026.1` and `NG-CANDIDATE-2026.2` remain `NOT_CERTIFIED`. Candidate calculations and simulations do not authorize official finalization, payslips, payments, accounting output, filings, or remittances.

The fingerprinted JRB 2026 PIT Guidelines Appendix 1 is a blank computation format, not a completed numeric PAYE worked example. The official rent illustration is labelled `OFFICIAL_NUMERIC_EXAMPLE`; PAYE fixture values are honestly labelled `SOURCE_BACKED_INDEPENDENT_EXPECTED_VALUE` and require new qualified review.

The remaining decision is human compliance review, not ordinary engineering: exact Labour/minimum-wage primary-law applicability and the independent expected-value interpretations must be reviewed. Stage 1 reviewer and decision remain null/pending; Stage 2 certifier and certification event remain null.
