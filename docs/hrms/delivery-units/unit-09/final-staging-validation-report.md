# Unit 9 staging production-readiness evidence

Status: **IN PROGRESS — NOT PRODUCTION READY**

Production was not accessed or modified. No real payment or statutory filing was attempted.

## Candidate and deployment

- Branch: `dev`
- Evidence candidate: `562ed839c007b3eb211fb1d9ac3d59fd9b984ccc`
- Render staging deployment: `dep-d9vo83ugekts73dgenmg`
- Staging database: `zentric_analytics_staging`
- Migrations: 54 applied, none pending
- Automated gate: 802/802 tests across 72 files; TypeScript, ESLint zero warnings, Prisma validation and production build pass
- Routes built: 125

## Executed staging evidence

- Health/live and readiness: HTTP 200; database ready.
- Public website, Careers, applicant tracking and HR login: HTTP 200.
- Unauthenticated private payroll pages redirect to HR login; unauthenticated payroll mutations return HTTP 401.
- Security headers include HSTS, CSP, `nosniff`, `DENY` framing and strict-origin referrer policy.
- Governed salaried simulation: run `cmstfueug000csza744v581d1`, result `cmstfueyk000lsza7n9dmcmq7`; frozen calculation, replay idempotency and independent approval pass. The approved Unit 8 staging handoff currency is USD, so this proves the global-core currency-preserving path, not a certified NGN payroll.
- Legal boundary: the Nigeria jurisdiction version remains `TESTING`; finalization is rejected, run remains `APPROVED`, and `finalizedAt` remains null.
- PostgreSQL concurrency: correlation `unit9-concurrency-1786741660210`; exactly one run, completed calculation, selected authoritative result and approval/recalculation outcome.
- Integrity: zero relevant orphans, duplicates, gross-to-net mismatches, employer-contribution/net errors, maker/checker violations, uncertified finalizations, unbalanced journals, invalid payslips or payment instructions.
- Regulatory Watch: source `cmstg1zf00000rjctlrqskpei`, candidate `cmstg1zq80005rjctwpazh23w`, correlation `76c2712a-e1b8-483a-9f88-e225a067cb44`; unchanged and changed replay are idempotent, exactly one review candidate is created, no rule is auto-activated, and provider failure becomes `DEGRADED`.
- Real FIRS reachability from the staging service timed out at the controlled eight-second boundary; no response content was accepted.
- Load: 250 mixed frozen calculations/database reads, concurrency 10, zero failures; p50 90.3 ms, p95 299.5 ms, p99 1088.8 ms, maximum 1289.9 ms.

## Defects found and corrected

1. The first Unit 9 migration contained a UTF-8 BOM rejected by PostgreSQL. The failed migration was safely marked rolled back, the BOM was removed, and a regression guard was added.
2. Vitest execution inside the small live staging web instance exhausted service capacity. Staging gates now use a lightweight guarded TypeScript loader; the service recovered without database corruption.
3. The first fixture used NGN while its approved Unit 8 handoff was USD. Certification correctly blocked the mismatch. The simulation now preserves the governed handoff currency throughout and explicitly asserts zero certification blockers.
4. The legal rejection evidence matcher did not recognize the public certification error. Persisted data proved fail-closed behavior; the matcher now recognizes the public message.

## Mandatory gates still open

- Signed-in browser role/privacy matrix and employee IDOR checks.
- Certified Nigeria NGN salaried and hourly lifecycles.
- Finalization-dependent retro, payslip, payment, accounting and statutory/remittance staging workflows.
- Finalization/payment concurrency and downstream worker replay tests.
- Complete authoritative Nigeria rule evidence and independent certification decision.
- Fresh encrypted durable staging archive and isolated restore, after all non-restore gates pass.

Nigeria remains **NOT CERTIFIED**. This report does not claim that the email, payment, filing, finalization, backup, restore, or overall Unit 9 release gate has passed.
