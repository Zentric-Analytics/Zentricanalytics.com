# NG-CANDIDATE-2026.7 runtime integration

`freezeUnit9Inputs` resolves 2026.7 authoritative sources inside its serializable transaction and persists the resolved manifest, binding and decision hashes. `calculateUnit9Run` requires an independently approved population partition containing both hashes and calls the 2026.7 engine, whose authoritative API requires both expected hashes. Finalization remains blocked by `NG-CANDIDATE-2026.7_NOT_CERTIFIED`.
