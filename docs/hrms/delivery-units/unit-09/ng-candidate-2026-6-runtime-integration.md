# NG-CANDIDATE-2026.6 runtime integration

Governed call trace:

`certifyUnit9Population` → `freezeUnit9Inputs` → `deriveFrozenNg2026_6Binding` → `deriveAndValidateNg2026_6IncomeBinding` → snapshot binding/hash persistence → `complianceEligibility` → `partitionPayrollPopulation` with binding hash → independent partition approval → `calculateUnit9Run` stale-hash comparison → `calculateFrozenPayroll2026_6` → `calculateNg2026_6Paye` using the same binding → authoritative result hash persistence.

The service rejects a decision-hash match when the full income-binding hash is stale. 2026.5 and earlier candidates remain routed through their original engines.
