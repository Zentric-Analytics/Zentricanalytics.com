# NG-CANDIDATE-2026.7 Stage 1 remediation matrix

| Review finding | Control | Evidence |
|---|---|---|
| Agreeing wrong annual values | Derive annual Salary from approved monthly Salary × certified rule | 70k/1.2m rejection test |
| Caller Salary authority | Resolve approved effective Salary record in serializable freeze | service resolver and frozen lineage |
| Caller YTD authority | Aggregate persisted prior-period ledger entries | ledger hash/cutoff/IDs and mismatch tests |
| Uncertified periods | Resolve certified monthly-12 rule; reject other configurations | period/rule tests |
| Invalid numeric domain | Reject non-finite, fractional periods and negative money | focused tests |
| Optional expected hashes | Both binding and decision hashes mandatory | authoritative-path tests |
| Stale partition | Compare both frozen hashes with approved partition | service integration and mutation matrix |
| Prior candidate integrity | Byte-level predecessor manifests | preservation gate |

2026.7 remains NOT CERTIFIED.
