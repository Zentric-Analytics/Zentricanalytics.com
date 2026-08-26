# NG-CANDIDATE-2026.8 concurrency design

The new harness must use separate Prisma clients labelled with PostgreSQL `application_name` identifiers. Each race has an explicit database-backed barrier, captures backend PID and transaction timestamps, verifies simultaneous active transactions through an observer connection, and fails if overlap is not observed.

All winner, stale-result, mixed-version, finalization, and official-output mutation counts are queried from PostgreSQL after the race. Persisted source manifests are reloaded and independently reconciled to Salary, annualization, YTD, relief, and prior-employer rows, including hashes, amounts, versions, effective dates, evidence references, and source scope. Candidate-version equality is only one lineage rule and is not treated as complete mixed-version evidence.

The downstream backstop uses a marker-scoped forced `FINALIZED`/`NOT_CERTIFIED` historical-style fixture. It invokes the real payslip, payment, accounting, liability, and remittance services and compares database-derived before/after counts. Synthetic prerequisites are recorded separately from prohibited output mutations; the prohibited mutation aggregate must remain zero.
