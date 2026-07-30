# Deployment

## Prerequisites

- Approved design and reviewed migration SQL.
- Current provisioning migration deployed successfully.
- Production backup and restore point verified.
- At least two test HR users for separation-of-duties scenarios.
- Scheduled-activation worker and monitoring configuration available.

## Staged rollout

1. Deploy additive schema with legacy application compatibility.
2. Run idempotent backfill in bounded organization batches and retain reconciliation output.
3. Deploy dual-compatible application code with Unit 2 mutations behind an organization feature flag.
4. Enable a staging tenant; execute the full test plan and migration rehearsal.
5. Enable selected production tenants, monitor conflicts, failures, latency, and reconciliation.
6. Enable remaining tenants only after the observation window passes.

## Production verification

- Existing employee and provisioning pages load.
- Existing assignments retain identical effective history.
- Default dimension mappings reconcile to all legacy records.
- Creator cannot approve a position.
- Concurrent fill attempts cannot exceed capacity.
- Org chart and headcount totals reconcile to assignments.
- Cross-organization identifiers are rejected.
- Scheduled future change activates once and is observable.
- Audit events and notification outbox records are present.

## Required commands

Run Prisma validation, migration dry run against a production-like copy, TypeScript, ESLint, complete unit/integration/E2E suites, production build, dependency/security checks, and HR release preflight.
