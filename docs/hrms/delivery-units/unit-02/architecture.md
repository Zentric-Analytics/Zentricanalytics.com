# Architecture

## Service boundaries

Add code under the repository's existing `src/lib/hr` convention:

```text
src/lib/hr/organization/
  permissions.ts
  validation.ts
  hierarchy.ts
  queries.ts
  commands/
    create-structure.ts
    submit-position.ts
    approve-position.ts
    change-position-state.ts
    fill-position.ts
    transfer-employee.ts
    schedule-restructure.ts
```

Server actions remain thin adapters: authenticate, parse input, invoke a command/query, revalidate affected routes, and return a safe view model.

## Domain rules

- Every foreign record is loaded with the authenticated organization ID.
- Parent and reporting links are checked for self-reference and cycles before writes.
- Referenced structures must be active for the command's effective date.
- Effective intervals use `[effectiveFrom, effectiveTo)` and may not overlap for the same versioned business key.
- A position's occupied FTE and occupant count may not exceed its approved limits.
- Closing or cancelling a position with effective occupants is rejected.
- Filling, transfer, position approval, and restructuring activation use serializable transactions.
- Versioned records are closed and replaced; historically significant fields are not overwritten.
- Approval initiator and approver must differ.
- Notifications are enqueued transactionally and are non-sensitive.

## Position state machine

```text
DRAFT -> PENDING_APPROVAL -> APPROVED -> OPEN
  |             |               |         |
  +-> CANCELLED +-> REJECTED    +-> FROZEN
                                      |
OPEN <-> PARTIALLY_FILLED -> FILLED   |
  |             |              |       |
  +-----------> FROZEN <-------+-------+
                    |
                  CLOSED
```

Only explicit commands can transition state. Rejection returns a new draft revision rather than editing an approved record. `CLOSED` and `CANCELLED` are terminal.

## Command authorization matrix

| Command | Permission | Approval | Audit event |
|---|---|---|---|
| Maintain structure | `organization.structure.manage` | No | `hr.organization.structure.*` |
| Submit position | `organization.position.create` | No | `hr.position.submitted` |
| Approve position | `organization.position.approve` | Different actor | `hr.position.approved` |
| Freeze/close position | `organization.position.manage_state` | Reason required | `hr.position.state_changed` |
| Fill position | `organization.position.fill` | Approved/open position | `hr.position.filled` |
| Transfer employee | `organization.assignment.transfer` | Policy-dependent | `hr.employee.transferred` |
| Import structures | `organization.structure.import` | Validated staging batch | `hr.organization.import.*` |
| Export/report | `organization.report.read` / `organization.report.export` | Field filtering | `hr.organization.report_exported` |

Until Unit 3 adds scoped grants, these permissions authorize only organization-wide access. Command interfaces still accept a resource context so scoped enforcement can be introduced without rewriting business logic.

## Query architecture

Queries return paginated view models, never raw Prisma records. Filters include status and effective/as-of dates plus dimension relationships. Headcount and org-chart queries derive occupancy from effective assignments, not mutable counters alone. Data-quality reports expose identifiers and remediation links but no protected payroll or identity values.

## UI route plan

Implement the blueprint routes with a shared organization workspace shell, search/filter/status controls, breadcrumbs, effective-date context, relationship warnings, vacancy indicators, and accessible tables/cards. Mutations show impact summaries and explicit confirmations. Bulk import uses upload, validation preview, error download, and commit stages.

## Audit and observability

Use `appendHrAudit` inside each transaction with previous/new safe snapshots, reason, request/correlation ID, and approval context. Add counters/timers for position commands, capacity conflicts, hierarchy validation failures, import failures, scheduled activation failures, and organization-report latency.
