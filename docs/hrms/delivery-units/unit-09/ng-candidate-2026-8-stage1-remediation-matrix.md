# NG-CANDIDATE-2026.8 Stage 1 remediation matrix

| 2026.7 independent-review finding | 2026.8 remediation | Status |
|---|---|---|
| Candidate-status boundary missing on finalization and downstream official financial outputs | One persisted-manifest resolver and tenant-scoped shared guard protect finalization, payslips, payment states, accounting, statutory liabilities, and remittance simulations. Real service calls against a forced historical `FINALIZED`/`NOT_CERTIFIED` fixture remain mutation-free. | IMPLEMENTATION-REVIEW EVIDENCE PASS; RE-REVIEW PENDING |
| Concurrency evidence used asserted/sequential outcomes instead of genuine overlapping PostgreSQL transactions and database-derived counts | New 2026.8 harness uses separate sessions, actual concurrent source mutation/freeze operations, explicit barriers, observer evidence, full persisted financial-lineage validation, and database-derived counts. | 8/8 IMPLEMENTATION-REVIEW EVIDENCE PASS; RE-REVIEW PENDING |
| Signed-in staging tenant-isolation/known-ID IDOR evidence was not preserved | A sanitized machine evidence contract is defined for two real staging tenants and permission-denied actors after exact-SHA deployment. | PENDING EXACT-SHA STAGING DEPLOYMENT |

The 2026.7 verdict remains **CHANGES REQUIRED — STAGE 1 NOT CLOSED**. The sealed 2026.7 package is immutable failed-review evidence.
