# Unit 7 staging production-readiness report

## Current verdict

**BLOCKED — isolated restore evidence incomplete.** Unit 7 must not be declared production ready until a durable encrypted staging archive is restored and its complete Unit 7 to Unit 4 lineage is verified.

## Validated candidate and gates

- Candidate before restore-tool remediation: `4b76089c5e9806f4f16fbaf9abb3e8429bfe278d`.
- Guarded restore remediation: `fefccea58729e88caa7125e79d9fa03b61f14d3b`.
- Staging deployment: `dep-d9utjoe1egvs73e0q15g`.
- Database: 43 migrations applied; none pending.
- Automated validation: 717 tests across 65 files passed.
- TypeScript, ESLint with zero warnings, Prisma validation, and production build passed.
- Real PostgreSQL concurrency: 16 races passed with 16 correlated audit records under `unit7-concurrency-1786631174407`.
- Load smoke: 250 requests at concurrency 15, zero failures, p50 200.1 ms, p95 696.0 ms.
- Health, readiness and staging preflight passed.
- Locked effective-dated promotion evidence remains unchanged: `WFE-2026-5B0A5F70`, assignment `U7-IMM-PROMO2`, exactly one application.

## Restore attempt

- Approved archive correlation: `6a30e21b4372`.
- Archive creation reported AES-256-GCM encrypted output, daily retention tier and 1,285,926 encrypted bytes.
- Temporary target: `dpg-d9utfte417fc73943m30-a`, Basic-256 MB, PostgreSQL 16, 1 GB, non-HA.
- The restore guard rejected the first attempt until Unit 7 target naming was explicitly supported.
- After the guarded fix deployed, restore was blocked before database writes because the archive was unavailable on the replacement application instance and remote archive-store configuration was incomplete.
- No substitute archive was used because approval was limited to correlation `6a30e21b4372`.
- No lineage, confidentiality, duplicate/orphan, RPO or RTO claims are made from the blocked restore.

## Cleanup

- Temporary `RESTORE_DATABASE_URL` was removed from Render staging configuration.
- Temporary database `dpg-d9utfte417fc73943m30-a` was deleted immediately.
- The staging project returned to its three persistent services; ongoing temporary database cost is zero.
- Production was not accessed or modified.

## Required next action

Create a fresh encrypted archive in durable configured object storage, record its correlation, approve that correlation for restore, provision the smallest temporary non-HA target again, and complete the full lineage and integrity verification before issuing `PASS — Unit 7 Production Ready`.
