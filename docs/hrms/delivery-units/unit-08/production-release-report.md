# Unit 8 controlled production release report

Date: 2026-08-14

## Verdict

**CONDITIONAL PASS — Unit 8 Production Ready and Operational**

All mandatory Unit 8 engineering, migration, deployment, authorization, worker, integrity, health, load, and backup gates passed. The previously accepted GoDaddy Advanced Email Security to Outlook automatic Inbox-placement risk remains open. This release does not claim that email trust gate passed and did not weaken any mail-security control.

## Release identity

- Pre-merge production baseline: `b20fc7db0fd5338fb73dd4fe304e2438345736b6`
- Validated development source: `d6cc96a39303fdf4cc64a9fe4c3624f319fe5ce3`
- History-preserving merge commit: `20055bc063a69d650388b95ded178daaa973c08c`
- Portable migration-test correction: `11e273cb3ffa50efc3e45f0c31a947ec5ad13244`
- Deployed application SHA: `c441344bafcfba9d1c6eac80549302d37d0e570b`
- Final production deployment: `dep-d9vifbe7bikc73dh9nlg`
- Production service: `srv-d8s89fbeo5us73e7ljk0`
- Production database: `zentric_analytics_43sq` on `dpg-d8s88jurnols738a7og0-a`

## Automated release gates

- Automated tests: 771/771 passing across 69 files.
- TypeScript: PASS.
- ESLint: PASS with zero warnings.
- Prisma schema validation: PASS.
- Production build: PASS; 121 routes built.
- Guarded release command: `yarn hr:release` PASS.
- Bootstrap: correctly skipped because production was already initialized.
- Built-in permission reconciliation: PASS; `staleGrantsRemoved=0` on the final deployment.
- Preflight: ready.

## Migrations

The first Unit 8 production deployment applied the eight reviewed additive Unit 8 migrations, increasing production from 43 to 51 migrations. The final corrective deployment found 51 migrations and reported `No pending migrations to apply.` No migration rollback occurred.

## Production validation

- Live health: HTTP 200.
- Readiness: HTTP 200.
- Public site, Careers, applicant tracking, and HR login routes: HTTP 200.
- Administrator session and MFA-protected access: PASS.
- Unit 8 worker authentication: unauthenticated request rejected with 401; authenticated production-equivalent invocation completed safely with one skipped/no-op job and no mutations.
- General administrator compensation boundary: compensation, budget, and payroll-handoff routes returned an accessible 403 with no sensitive data.
- Existing Unit 4 performance, Unit 5 leave, and Unit 6 time routes remained accessible to the authorized administrator.
- Safe production load smoke: 45 requests at concurrency 4, zero failures; p50 188 ms, p95 698 ms, max 1,085 ms.
- Runtime observation: no release-related restart or out-of-memory event.

Production contains no Unit 8 business population yet, so validation did not fabricate compensation employees, recommendations, email deliveries, or payroll handoffs. Direct integrity queries returned:

- compensation records: 0
- decisions: 0
- budgets: 0
- payroll handoffs: 0
- duplicate payroll handoffs: 0
- duplicate recommendation decisions: 0
- authoritative compensation overlaps: 0
- orphan compensation records: 0
- failed Unit 8 outbox records: 0

## Backup and recovery evidence

- Pre-release encrypted production archive: correlation `9df141e6336e`, daily tier, 1,125,762 encrypted bytes.
- Post-release encrypted production archive: correlation `505e4479ad40`, daily tier, 1,217,205 encrypted bytes.
- Both jobs completed successfully through the guarded archive implementation, which verifies the encrypted object's remote length and SHA metadata and confirms Object Lock before reporting success.
- The exact checksum is intentionally not reproduced here because it was not emitted by the Render run log and was unavailable from the later ephemeral shell. No checksum value has been inferred or fabricated.
- Prior isolated Unit 8 restore evidence remains correlation `ba3853c31247`, restored to temporary target `dpg-d9vgine1egvs73e6t4l0-a`, RTO 22.299 seconds, 51 migrations, zero relevant duplicates/orphans, followed by verified target deletion and zero ongoing temporary cost.

## Defects corrected during release

1. A migration-order test used a line-ending-sensitive assertion after the normal merge. The assertion was made portable and the complete release suite passed.
2. The Unit 8 status page retained staging-only wording in production. Environment-aware reporting and regression coverage were added; the final production page now shows the deployed SHA, 51/51 migrations, production backup evidence, and the conditional verdict.

## Rollback status and residual risk

Rollback was not required. The previous known-good application SHA remains documented, and all Unit 8 migrations are additive.

The only accepted operational exception is automatic GoDaddy-to-Outlook Inbox placement for authenticated HRMS transactional email. SPF, DKIM, DMARC, sender routing, Resend acceptance, quarantine lookup/release procedures, and monitoring are documented separately. The exception does not authorize broad allowlists, spam bypasses, or weakened malware/phishing controls.

Unit 9 was not started as part of this release.
