# Unit 9 concurrency and idempotency

Critical correctness uses PostgreSQL constraints/transactions, not in-memory locks. Commands accept a tenant-scoped idempotency key and expected version. External delivery uses inbox/outbox records and stable logical keys.

## Transaction patterns

- Serializable transaction with bounded retry for run creation, freeze, attempt selection, approval, finalization and payment approval.
- `SELECT ... FOR UPDATE` for short aggregate transitions and ledger balance decisions.
- `FOR UPDATE SKIP LOCKED` with hashed claim token, lease expiry, attempt count and checkpoint for batch workers.
- Unique/exclusion constraints decide the winner; losing requests return a safe already-applied, stale-version or conflict result.
- Network/provider calls occur outside financial transactions. A persisted transmission intent is committed first, then reconciled by idempotent response/callback.

## Mandatory real PostgreSQL races

| Race | Expected proof |
|---|---|
| two official runs for same pay group/period | one run; loser idempotent/conflict; no orphan population |
| freeze versus late Unit 4/5/6/8 event | one deterministic cutoff disposition; frozen hash unchanged |
| two workers claim same population shard | one lease/attempt result; no duplicate lines |
| recalculation versus payroll approval | approval binds exact attempt/version or loses stale |
| double finalization | exactly one finalization and accumulator set |
| retro trigger versus frozen calculation | one trigger; routed according to cutoff, never silently included |
| duplicate Unit 8 handoff | one consumed input fact/acknowledgement |
| manual payment submit versus worker retry | one logical provider transmission/idempotency key |
| duplicate provider callback | one provider event and settlement outcome |
| payment approval versus destination change | stale destination/batch rejected; no submission |
| settlement versus return | ordered append-only entries and deterministic terminal/partial state |
| accounting/statutory export retry | one logical batch/version and one acknowledgement outcome |
| remittance batch selection race | each liability selected at most once; loser conflict/idempotent result |
| payslip publication versus correction | exact finalized result/version published; correction creates lineage, never overwrites |
| regulatory activation versus payroll freeze | run binds exactly one certified effective package; stale activation loses safely |

For every race verify one authoritative result, correct loser, no duplicate ledger/audit/notification/provider record, no orphan, complete correlation and replay-safe retry.

## Worker recovery

Test process termination before claim, after claim, after result persistence, after intent persistence and after provider acceptance but before acknowledgement. Expired leases are recoverable; completed immutable work is detected by unique key/hash. Temporary failures retry with bounded backoff. Permanent failures enter governed dead-letter/recovery state. Operators may replay by logical ID, never fabricate a new payment identity.

## Partitioning

Calculation tasks use stable run/attempt/shard keys. A deterministic partition function prevents population movement between retries. Aggregate reconciliation waits for all expected partitions and verifies counts/hashes before selection. Finalization is short and does not hold a transaction across the whole enterprise population.
