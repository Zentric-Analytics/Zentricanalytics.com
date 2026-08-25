# Minimum-wage governed-runtime integration

Runtime call chain:

1. `decideNg2026_5MinimumWage` creates the canonical deterministic decision.
2. `complianceEligibility` incorporates its blockers before READY/held partitioning.
3. `partitionPayrollPopulation` binds per-employee decision hashes into the partition hash.
4. `freezeUnit9Inputs` re-evaluates the same frozen evidence and persists evidence, classification and decision hash.
5. `calculateUnit9Run` requires an approved partition, verifies the employee decision hash, and invokes `calculateFrozenPayroll2026_5`.
6. The engine selects explicit `MINIMUM_WAGE_EXEMPT` or normal cumulative PAYE and binds the decision to result lineage.
7. Jurisdiction certification remains mandatory for finalization.

Any mismatch fails with `STALE_MINIMUM_WAGE_DECISION`.
