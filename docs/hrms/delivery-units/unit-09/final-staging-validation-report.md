# Unit 9 staging production-readiness evidence

Status: **IN PROGRESS — NOT PRODUCTION READY**

Production was not accessed or modified. No real payment or statutory filing was attempted.

## Candidate and deployment

- Branch: `dev`
- Evidence candidate: `f052d7b68ba6ec5a32e768d38695bad8a6e4222b`
- Render staging deployment: `dep-d9vqf9nlk1mc73ed7hdg`
- Staging database: `zentric_analytics_staging`
- Migrations: 54 applied, none pending
- Automated gate: 805/805 tests across 72 files; TypeScript, ESLint zero warnings, Prisma validation and production build pass
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
- Regulatory Watch (fresh rerun): source `cmstqcxw60000rk7nkmphuciw`, candidate `cmstqcy9p0005rk7nu59ia124`, correlation `e5c88802-bf8a-4ed4-a771-46d45db4c944`; unchanged replay is idempotent, exactly one review candidate is created, no rule is auto-activated, and provider failure becomes `DEGRADED`.
- Real FIRS reachability from the staging service timed out at the controlled eight-second boundary; no response content was accepted.
- Load: 250 mixed frozen calculations/database reads, concurrency 10, zero failures; p50 90.3 ms, p95 299.5 ms, p99 1088.8 ms, maximum 1289.9 ms.
- Signed-in payment-role boundary: `workingemail20266@gmail.com` temporarily held `PAYMENT_OPERATOR` plus `EMPLOYEE`; it could read the governed payroll run and payment-operator scope but received a privacy-safe 403 with no disclosed data for `/hr/admin/users`.
- Signed-in independent approval boundary: `sweetcathytelano@gmail.com` temporarily held `PAYMENT_APPROVER` plus `EMPLOYEE`; unrelated user administration and compensation routes returned privacy-safe 403 responses with no disclosed data.
- Governed role cleanup: both temporary payment roles were revoked, leaving each account with `EMPLOYEE` only. Revocation audit correlations are `75d262b1-f075-450e-b586-650b3a5007e7` and `9fce3f8f-5fb0-431c-8daa-c6c8035a1661`; the affected sessions were revoked automatically.

## Defects found and corrected

1. The first Unit 9 migration contained a UTF-8 BOM rejected by PostgreSQL. The failed migration was safely marked rolled back, the BOM was removed, and a regression guard was added.
2. Vitest execution inside the small live staging web instance exhausted service capacity. Staging gates now use a lightweight guarded TypeScript loader; the service recovered without database corruption.
3. The first fixture used NGN while its approved Unit 8 handoff was USD. Certification correctly blocked the mismatch. The simulation now preserves the governed handoff currency throughout and explicitly asserts zero certification blockers.
4. The legal rejection evidence matcher did not recognize the public certification error. Persisted data proved fail-closed behavior; the matcher now recognizes the public message.

## Mandatory gates still open

- Remaining payroll-role/employee signed-in matrix cases not covered by the payment-operator/payment-approver evidence above.
- Certified Nigeria NGN salaried and hourly lifecycles.
- Finalization-dependent retro, payslip, payment, accounting and statutory/remittance staging workflows.
- Finalization/payment concurrency and downstream worker replay tests.
- Complete authoritative Nigeria rule evidence and independent certification decision.
- Fresh encrypted durable staging archive and isolated restore, after all non-restore gates pass.

Nigeria remains **NOT CERTIFIED**. This report does not claim that the email, payment, filing, finalization, backup, restore, or overall Unit 9 release gate has passed.

The blocking certification work is not an ordinary engineering task. A qualified compliance reviewer and an independent certifier must approve the complete taxable-income, exemptions, reliefs, PAYE annual/YTD, proration, rounding, pension, statutory deduction, retention, salaried, hourly and retro interpretation/reference-test matrix. The application correctly fails closed until that evidence is approved; no test fixture or developer action may substitute for the required legal certification.
