# Units 1–3 production readiness audit — Render policy

Audit date: 2026-08-01. Scope: read-only Render and repository inspection. Production was not deployed, migrated, written to or modified.

## Recovery-policy decision

Render is the production platform. The production PITR gate is the maximum supported Render window of seven days. The previous 30-day PITR requirement is retired and must not be used to justify a second database platform.

Long-term recovery is a separate logical-archive control:

| Control | Required implementation | Audit status |
| --- | --- | --- |
| PITR | Render PostgreSQL, seven days | **Available** — the production Recovery page offers restoration to timestamps in the past seven days. |
| Daily | Encrypted logical archive every day; retain 90 days | **Blocking** — no production schedule, archive manifests or retention evidence exists. |
| Weekly | Promote a verified weekly archive; retain 365 days | **Blocking** — no production schedule or retention evidence exists. |
| Monthly | Promote a verified monthly archive; retain 15 years | **Blocking** — no production schedule or retention evidence exists. |
| Restore drill | Isolated restore at least quarterly | **Blocking** — staging evidence exists, but no current isolated production-source restore evidence exists. |
| DR exercise | Full exercise at least annually | **Blocking** — no current evidence exists. |

Render retains database logical exports for at least seven days. Meeting the longer tiers requires a dedicated scheduled backup process and protected capacity. A Render worker/cron service plus persistent archive disk keeps execution on Render, but provisioning incurs a paid infrastructure purchase and therefore requires explicit product-owner approval. Before acceptance, validate that the chosen Render storage arrangement provides the required deletion protection and durability for 15-year archives; environment variables alone are not evidence.

## Current production identity

- Workspace/project: Production / Zentric Analytics (`prj-d8s88bb7uimc7382jeh0`).
- Web service: `srv-d8s89fbeo5us73e7ljk0`, branch `main`, Starter instance.
- Database: `dpg-d8s88jurnols738a7og0-a`, Basic-256mb.
- The service remains on the legacy production release. The Units 1–3 candidate has not been deployed.

## Re-audited release blockers

### Blocking

- Long-term backup schedules, protected archive capacity, manifests, monitoring and restore/DR evidence are absent.
- Production HRMS secrets and independent worker/scanner/monitoring secrets are absent.
- Production private, encrypted, versioned HR document storage and a real malware-scanner integration are absent. Render does not supply an S3-compatible object-storage product; this is a document-security blocker independent of backup retention.
- Twenty-two additive HRMS migrations remain pending. They must only run through the governed pre-deploy release command after explicit migration authorization.
- The current build command runs `prisma migrate deploy` during the build. It must be replaced by a non-migrating build and `yarn hr:release` as the pre-deploy command before promotion.
- No production health-check path is configured; current production does not contain the candidate health routes.
- Current production has no successful isolated restore using a production recovery point.

### High risk

- Database ingress is open broadly, HA is disabled, connection pooling is disabled and the Basic-256mb database has not been capacity-approved for HRMS production traffic.
- Auto-deploy is enabled on commits to `main`, which is incompatible with the governed migration and release sequence.
- Notifications cover failures only; no log stream or HRMS metrics/alert integration is configured.
- Email-domain provider alignment, bounce/complaint webhooks and suppression handling remain unverified.

### Non-blocking before implementation completes

- Product-owner governance fields, communication arrangements and maintenance-window details are intentionally deferred to the actual release process.
- Staging email placement initially included junk-folder delivery; reputation monitoring remains operational work after provider-domain alignment.

## Next authorized sequence

1. Approve the paid Render database capacity/HA choice and the paid Render backup job plus archive capacity.
2. Provision the long-term logical-archive schedules and monitoring without changing production data.
3. Resolve the independent private document-storage and malware-scanner provider blocker.
4. Configure production-only secrets and safe service commands; disable auto-deploy and set `/api/health/ready` only when the candidate is ready for controlled promotion.
5. Create an isolated restore target from a production recovery point, verify it, and delete the temporary target after recording evidence.
6. Rerun repository gates and production preflight. Stop if any gate is not ready.
7. Request explicit authorization for the irreversible production migration and deployment step.

No production deployment or migration is authorized by this document.
