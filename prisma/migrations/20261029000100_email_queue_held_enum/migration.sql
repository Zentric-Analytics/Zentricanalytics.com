-- OFFLINE ARTIFACT ONLY. PostgreSQL 16-18 authoring envelope; execution unverified.
-- Q03 must prove this migration COMMITs before migration 20261029000200 uses HELD.
-- Never wrap both migrations in one outer transaction. Preserve all existing values.
ALTER TYPE "HrOutboxStatus" ADD VALUE 'HELD';
