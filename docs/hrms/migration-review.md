# HRMS migration review

## Safety findings

- The milestone sequence is strictly additive: foundation, Core HR, leave, payroll, documents/assets, lifecycle, workflow, reports, hardening, completion audit.
- No HRMS migration drops or truncates application data. No migration-reset or `db push` release path exists.
- Legacy recruitment tables are referenced but not rewritten or used as an HRMS authentication source.
- Enum evolution in `20260730080000` uses append-only PostgreSQL `ADD VALUE IF NOT EXISTS`.
- The completion migration introduces workflow approval fields through nullable columns, deterministic legacy backfill, `NOT NULL`, and a unique correlation index.
- Organization-owned top-level entities carry `organizationId`, indexed for common tenant/status/time queries. Child records inherit ownership through restrictive foreign keys and are cross-checked in server actions.
- Financial snapshots, approvals, audit events, leave ledger entries, lifecycle/workflow evidence, document access, and delivery attempts are retained. Database triggers reject mutation/deletion for the designated immutable histories.
- Effective-dated assignments are validated transactionally and use active-period uniqueness/overlap controls where the business rule requires one active record.

## Staging procedure

1. Record a database backup/PITR point and row counts for recruitment and HR tables.
2. Run `yarn prisma migrate status`.
3. Run `yarn prisma migrate deploy`; never use `db push` or reset.
4. Run `yarn hr:preflight`.
5. Compare migration history and pre/post counts; sample recruitment links, audit rows, encrypted fields, and immutable triggers.

Rollback is application-first. Because migrations are additive, roll back code while retaining new tables/columns. Restore the isolated backup only for a verified data-integrity failure; never delete retained history as a shortcut.
