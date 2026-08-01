# Employee provisioning

## Purpose

The employee provisioning workflow replaces direct employee creation with a resumable, approval-controlled process. It creates the employee, first assignment, reporting line, optional compensation/payroll records, optional user account, and optional onboarding instance as one database transaction.

## Workflow

1. An authorized HR operator creates a draft.
2. The operator completes the eight wizard sections. Each save merges only that section and keeps the draft resumable.
3. Readiness checks identify missing personal, employment, assignment, manager, compensation, payroll, access, and onboarding data.
4. The operator submits the draft for approval.
5. A different authorized user approves and activates it.
6. Finalization runs in a serializable transaction. Any failed validation or database write rolls back the complete activation.

Draft states are `DRAFT`, `PENDING_APPROVAL`, `FINALIZED`, and `CANCELLED`.

## Security controls

- Drafts and all referenced records are organization-scoped.
- The draft creator cannot perform final activation.
- Initial account provisioning permits only the `EMPLOYEE` role. Privileged roles use the separate privileged-access approval workflow.
- Full bank, tax, pension, and identity values remain encrypted at rest and are only displayed to users with the existing sensitive-data permissions.
- Invitations use opaque, hashed, expiring tokens and the transactional email outbox.
- Every save, submission, cancellation, and final activation is audited.

## Deployment

Apply `20260730100000_hrms_employee_provisioning` with the normal Prisma deployment process before deploying the application. The migration is additive and can coexist with the previous employee admin route during a rolling deployment.

Rollback the application before rolling back the database. The draft table can remain safely unused; do not drop it while any deployment can still write provisioning drafts.

## Verification

Run:

```text
corepack yarn prisma validate
corepack yarn tsc --noEmit
corepack yarn lint
corepack yarn test
corepack yarn build
```

Test both roles in a staging organization: the creator submits a complete draft, a different approver activates it, and the resulting Employee 360 page exposes the assignment, protected payroll data according to permissions, account state, lifecycle state, assets, and documents.
