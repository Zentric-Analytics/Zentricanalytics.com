# Test plan

## Automated coverage

- Unit: input validation, interval overlap, hierarchy cycles, position transitions, grade/budget rules, capacity, FTE, and as-of selection.
- Service: every command happy path and invalid transition.
- Authorization: missing permission, suspended user, creator self-approval, report/export permission, and eventual scoped-resource contract.
- Isolation: foreign identifiers from another organization for every relationship and mutation.
- Transaction: injected failures roll back position, occupancy, assignment, supervisor, audit, and outbox changes.
- Concurrency: simultaneous fills and transfers cannot overfill a position or create overlapping primary assignments.
- Audit: correct previous/new safe values, reason, actor, approval context, and correlation ID; sensitive values are redacted.
- Integration: provisioning against approved/open positions, transfer history, freeze/close dependencies, future activation, and notification failure.
- Migration: legacy/current/archived/empty organization fixtures, idempotent backfill, reconciliation, and compatibility.
- E2E: structure setup, position request/approval/open/fill, transfer, org chart, headcount, import validation, export authorization, and keyboard/screen-reader basics.
- Regression: all existing HRMS, hiring, payroll, leave, document, asset, lifecycle, workflow, report, and provisioning tests.

## Required failure scenarios

- Self/circular parent links and position reporting cycles.
- Inactive or future-invalid structure assignment.
- Effective-date overlap.
- Cross-organization relationship injection.
- Position filled, frozen, closed, cancelled, or outside effective dates.
- Headcount/FTE exceeded under race.
- Close/freeze with active occupants where policy disallows it.
- Failed audit or outbox write.
- Scheduled activation replay.
- Legacy employee with default backfill mappings.

## Release evidence

Record exact command output, migration rehearsal results, test counts, build route output, E2E screenshots, reconciliation totals, performance results, dependency scan, and known limitations in the pull request.
