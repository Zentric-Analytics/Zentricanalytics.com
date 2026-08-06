# Unit 1-3 Operations Handbook Index

## Scope

Units 1-3 production operations and runbooks, with only production-safe, non-implementing entry points for Unit 4 planning.

## Deployment and release

- [Production deployment runbook](delivery-units/unit-03/production-deployment-runbook.md)
- [Staging verification runbook](staging-verification-runbook.md)
- [Deployment sequence and one-time initialization](deployment.md)
- [Production readiness audit (Render)](delivery-units/unit-03/production-readiness-audit-render.md)

## Email and communications

- [Production email deliverability runbook](delivery-units/unit-03/production-email-deliverability-runbook.md)
- [Notification model and intent handling](notification-model.md)
- [Secure sender registry tests](../tests/email-sender-registry.test.ts) *(local regression tests)*

## Backup, recovery, and continuity

- [Backup and DR runbook](backup-disaster-recovery.md)
- [Production change record](delivery-units/unit-03/production-change-record.md)
- [Production readiness/staging evidence](delivery-units/unit-03/staging-validation-report.md)
- [Production operations costs and architecture](delivery-units/unit-03/production-cost-architecture-report.md)

## Storage and document security

- [Storage model](storage-model.md)
- [Documents and assets](documents-assets.md)
- [Production document scanning options](delivery-units/unit-03/production-document-scanning-options.md)
- [Private document protection (runbook-aligned behavior)](delivery-units/unit-03/production-deployment-runbook.md#private-object-storage)

## Workers and platform operations

- [Monitoring and incident response](monitoring-incident-response.md)
- [Security model and protected routes](security-model.md)
- [Authorization matrix](authorization-matrix.md)
- [Architecture overview](architecture.md)

## Validation and readiness evidence

- [Blueprint completion evidence](blueprint-completion-evidence.md)
- [Security review and test plan](security-review.md), [security test plan](security-test-plan.md)
- [Scope-gap audit](delivery-units/unit-03/scope-gap-audit.md)
- [Production readiness evidence report](delivery-units/unit-03/production-readiness-audit-render.md)
- [Final production validation report template](delivery-units/unit-03/final-production-validation-report.md)

## Runbook governance

- This index is a Unit 1-3 operational entrypoint only.
- Unit 4 changes must not alter production behavior covered here until a new release cycle.
- Store all run evidence in the appropriate runbook sections and never include secrets, mailbox contents, or raw credentials.
