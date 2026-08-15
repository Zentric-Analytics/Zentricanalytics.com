# Unit 9 NG-CANDIDATE-2026.2 final staging evidence

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

- Focused 2026.2 closure: 113/113 across the four final candidate/package suites; governed-workflow suite is 17/17 after the retro-lineage regression.
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
