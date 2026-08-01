# Units 1–3 production change record

## Release identity

- Release: HRMS Units 1–3 production integration
- Frozen release tag: `hrms-unit-03-v1.0.0`
- Frozen tag target: `558b5217eae01d6009383e4b41f782401fe471dd`
- Approved Unit 3 feature baseline: `c522e02cee50d876d6b63761ce9606aa2c593626`
- Current production branch: `main`
- Current production commit: `5aac0c6cc03d693a45699b4f65c3cba2a39cc0f8`
- Integration branch: `release/hrms-units-01-03-production`
- Production Render service: `srv-d8s89fbeo5us73e7ljk0`
- Production database service: `dpg-d8s88jurnols738a7og0-a`
- Production database name: `zentric_analytics_43sq`
- Last known-good production deployment: `dep-d92r4u3tqb8s73cm9btg`
- Last known-good production artifact: commit `5aac0c6cc03d693a45699b4f65c3cba2a39cc0f8`

## Integration result

The integration branch was created from the exact production commit and merged the frozen annotated tag with `--no-ff`. Git reported no textual conflicts. The merge therefore retains the current production public-site ancestry and adds the complete Units 1–3 HRMS ancestry without selecting one side over the other.

The candidate adds the HRMS database schema and 22 additive migrations, authentication and MFA, organization management, recruitment-to-activation workflows, protected document storage, email outbox, governed workers, monitoring/health routes, release tooling and regression coverage. It also retains the existing public site, careers, applicant tracking and legacy recruitment configuration compatibility.

## Product-owner release-time fields

The product owner will record the following before the actual production release. These fields are governance prerequisites, not implementation blockers:

- Release owner
- Deployment operator
- Migration operator
- Database/data owner
- Security reviewer
- Email owner
- Storage owner
- Monitoring owner
- Rollback decision owner
- Incident commander
- Maintenance window and timezone
- Communication plan and audience
- Approved smoke mailbox
- Authorization, if any, for clearly labelled transactional smoke records

## Stop conditions

Stop before or during release for a migration failure, persistent readiness failure, destructive or unresolved data risk, data corruption, authorization or tenant-isolation leak, document exposure, broken MFA/login, worker duplication, duplicate employee/application creation, critical email misrouting, backup/PITR discontinuity or unacceptable production error rate.

## Infrastructure gates

Production deployment remains prohibited until the engineering readiness report proves: restricted database ingress; reviewed capacity; production-only secrets; verified email domain and failure handling; private encrypted/versioned object storage and malware scanning; governed workers and protected metrics; alert routing; at least 30-day PITR; 90-day daily, one-year weekly and 15-year monthly backups; and a successful isolated production restore drill.

Never record credentials, tokens, connection strings, backup encryption material, mailbox content or secret values in this file.
