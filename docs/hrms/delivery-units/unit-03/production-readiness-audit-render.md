# Units 1–3 production readiness audit — Render policy

Audit date: 2026-08-01. Initial scope: read-only Render and repository inspection. Production was not deployed, migrated or written to.

Follow-up remediation: production web-service auto-deploy was disabled on 2026-08-01. This configuration-only guard did not start a deployment; Render still reported deployment `dep-d92r4u3tqb8s73cm9btg` at commit `5aac0c6cc03d693a45699b4f65c3cba2a39cc0f8` as live. No production code, database data, migration or secret changed.

The no-cost remediation candidate was deployed only to staging as `dep-d9n491laeets73b6jh10` from commit `72f3738033da422c2398f7b4747fdedcf8a32970`. Build and governed pre-deploy completed, 29 migrations were present with none pending, staging preflight reported ready, live/ready/login smoke passed, and the 100-request concurrency-10 load smoke had zero failures (`p50=98.0 ms`, `p95=280.8 ms`).

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

Render retains database logical exports for at least seven days. The dedicated HRMS backup cron is now scheduled at 03:00 UTC daily, but protected archive object storage remains unapproved. A guarded verification run stopped before dumping because the required S3-compatible archive configuration was absent. Environment variables and a schedule are not successful-backup evidence.

## Current production identity

- Workspace/project: Production / Zentric Analytics (`prj-d8s88bb7uimc7382jeh0`).
- Web service: `srv-d8s89fbeo5us73e7ljk0`, branch `main`, Starter instance.
- Database: `dpg-d8s88jurnols738a7og0-a`, **Basic-1gb**, 15 GB storage, HA disabled.
- Backup cron: `crn-d9n53dp42hec73etr2jg`, Starter, daily 03:00 UTC, release commit `793c2888462454353f2e1d9bb251bce1b6244cd6`.
- The service remains on the legacy production release. The Units 1–3 candidate has not been deployed.

## Re-audited release blockers

### Blocking

- The long-term backup schedule now exists, but protected archive capacity, successful manifests, monitoring and restore/DR evidence remain absent.
- Production HRMS secrets and independent worker/scanner/monitoring secrets are absent.
- Production private, encrypted, versioned HR document storage and a real malware-scanner integration are absent. Render does not supply an S3-compatible object-storage product; this is a document-security blocker independent of backup retention.
- Twenty-two additive HRMS migrations remain pending. They must only run through the governed pre-deploy release command after explicit migration authorization.
- The current build command runs `prisma migrate deploy` during the build. It must be replaced by a non-migrating build and `yarn hr:release` as the pre-deploy command before promotion.
- No production health-check path is configured; current production does not contain the candidate health routes.
- Current production has no successful isolated restore using a production recovery point.

### High risk

- Database ingress is open broadly, HA is disabled and connection pooling is disabled. Basic-1gb meets the approved RAM floor but must still pass the post-migration capacity gates.
- Auto-deploy is now disabled. Keep it disabled through release and use only the explicitly authorized manual deployment sequence.
- Notifications cover failures only; no log stream or HRMS metrics/alert integration is configured.
- Email-domain provider alignment, bounce/complaint webhooks and suppression handling remain unverified.

### Non-blocking before implementation completes

- Product-owner governance fields, communication arrangements and maintenance-window details are intentionally deferred to the actual release process.
- Staging email placement initially included junk-folder delivery; reputation monitoring remains operational work after provider-domain alignment.

## Next authorized sequence

1. Basic-1gb database capacity and the dedicated backup cron are complete; do not add HA or more storage without separate approval.
2. Approve protected object storage, then complete successful logical-archive, retention and monitoring evidence.
3. Resolve the independent private document-storage and malware-scanner provider blocker.
4. Configure production-only secrets and safe service commands; disable auto-deploy and set `/api/health/ready` only when the candidate is ready for controlled promotion.
5. Create an isolated restore target from a production recovery point, verify it, and delete the temporary target after recording evidence.
6. Rerun repository gates and production preflight. Stop if any gate is not ready.
7. Request explicit authorization for the irreversible production migration and deployment step.

No production deployment or migration is authorized by this document.
