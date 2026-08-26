# NG-CANDIDATE-2026.8 concurrency design

The new harness must use separate Prisma clients labelled with PostgreSQL `application_name` identifiers. Each race has an explicit database-backed barrier, captures backend PID and transaction timestamps, verifies simultaneous active transactions through an observer connection, and fails if overlap is not observed.

All winner, stale-result, mixed-version, and official-output counts are queried from PostgreSQL after the race. Persisted source manifests are reloaded and reconciled to Salary, annualization, YTD, relief, and prior-employer source rows. No literal zero is accepted as evidence.
