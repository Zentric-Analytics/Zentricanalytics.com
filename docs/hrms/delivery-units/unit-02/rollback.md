# Rollback

## Application rollback

Disable the Unit 2 feature flag, stop scheduled organization-change activation, and deploy the prior application. Because all legacy columns remain and compatibility writes are maintained, existing pages continue to operate.

## Data handling

Do not drop Unit 2 tables during an incident rollback. Preserve new records for investigation and later replay. Export pending approvals, imports, and scheduled changes before corrective work.

If a backfill batch is invalid, mark the batch failed and run a reviewed compensating script limited to its recorded organization and created record IDs. Never issue a broad delete or rewrite historical assignments.

## Database rollback

Schema reversal is only allowed before Unit 2 writes are enabled and after confirming that no Unit 2 records exist. After enablement, use a forward fix. Destructive reversal requires a verified backup, maintenance window, explicit approval, and a restore rehearsal.

## Recovery checks

Verify legacy routes, assignment counts, audit integrity, outbox processing, and organization isolation. Record the incident correlation IDs and reconciliation report.
