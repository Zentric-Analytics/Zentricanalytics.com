# Generic workflow engine

Milestone 7 provides a module-neutral approval engine. Consumers identify a definition by `key` and immutable `version`, start an instance against a subject type/ID, and observe the terminal status. The engine does not import or mutate a consuming module.

## Definition model

Each ordered stage supports one assignment strategy:

- explicit active organization users;
- the current effective-dated supervisor of a subject employee; or
- every active user whose current role grants a named permission.

Stages support `ANY`, `ALL`, or bounded `QUORUM` approval. A declarative condition may compare one safe context path with `EQUALS`, `NOT_EQUALS`, `IN`, or `EXISTS`. There is no script evaluation. Publishing creates a new version; definitions and stages cannot be updated or deleted.

## Runtime model

Starting an instance evaluates conditions, resolves approvers to immutable user-ID snapshots, calculates thresholds, materializes all matching stage runs, and activates the first stage. Approval activates the next stage only when its threshold is reached. A rejection terminates the instance and cancels pending stages. Decisions are unique per user/stage and immutable.

Serializable transactions, tenant predicates, a partial unique active-instance index and database state checks protect concurrent transitions. Context keys that resemble credentials, salary, banking, identity, tax or document content are rejected. Context is routing metadata, not a protected-data store.

## Integration contract

1. Publish a versioned definition for a module and subject type.
2. Start it with an opaque subject ID, optional employee ID and minimal safe routing context.
3. Store the returned instance ID in the consuming module if a direct association is needed.
4. Treat `APPROVED`, `REJECTED`, and `CANCELLED` as terminal.
5. Apply module effects in that module's own audited transaction after observing approval.

Notifications use reference-only outbox payloads. Definition publication, starts, decisions and cancellations are audited.
