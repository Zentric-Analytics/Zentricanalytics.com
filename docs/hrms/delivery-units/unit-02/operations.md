# Operations

## Scheduled work

An idempotent worker activates approved future-dated organization changes. Each job claims a change once, validates the latest hierarchy and dependencies, applies it transactionally, and records completion or a diagnosable failure. Retries must not duplicate versions, occupancy, audit, or notifications.

Invoke `POST /api/internal/hr/organization-changes` with `Authorization: Bearer <ORGANIZATION_WORKER_SECRET>` at least once per minute. The secret must contain at least 64 random characters. Alert when no successful invocation is observed for five minutes.

## Metrics

- Organization command latency and failure rate.
- Hierarchy-cycle and invalid-relationship rejections.
- Position approvals, state transitions, fill conflicts, and capacity conflicts.
- Scheduled changes due, completed, failed, and retrying.
- Import rows validated, rejected, committed, and rolled back.
- Headcount reconciliation variance and orphaned assignment count.
- Org-chart and report latency.

## Alerts

Alert on scheduled worker silence, repeated activation failures, non-zero headcount reconciliation variance, sustained import failure rate, capacity invariant violation, authorization-denial spikes, and organization-report latency regression.

## Support diagnostics

Support users receive safe, organization-scoped diagnostics by correlation ID: command/state, entity IDs, validation code, retry state, and audit/outbox references. Protected tax, identity, compensation, and address values are excluded.

## Runbooks

Document and test: failed scheduled activation, stuck position approval, capacity conflict, orphaned assignment, import partial failure, hierarchy cycle detected after legacy backfill, report reconciliation variance, and feature-flag rollback.

New tables are covered by the normal database backup. Restore drills must verify dimension versions, position approvals, occupancy, assignments, and scheduled changes.
