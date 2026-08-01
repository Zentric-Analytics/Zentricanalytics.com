# Units 1–3 production subscription and cost audit

Prepared 2026-08-01 from read-only inspection of the Production workspace in Render. No plan, service, disk, database, worker, cron job, add-on, or payment setting was changed. Prices exclude tax and variable overage.

## Current paid baseline

| Component | Observed configuration | Recurring price | Units 1–3 classification |
| --- | --- | ---: | --- |
| Render workspace | **Pro**, one member; 1,000 included pipeline minutes; 15 included custom domains; 25 GB included bandwidth | **$25/month** | **Already sufficient — no change.** It provides the production workspace controls and the database Recovery page confirms seven-day PITR. |
| Zentricanalytics.com web service | **Starter**, 0.5 CPU, 512 MB RAM, one instance | **$7/month** | **Already sufficient — no change for initial release.** The same-sized staging service passed the Unit 3 production-like load gate. Reassess from post-release CPU, memory, latency, and restart evidence. |
| Zentric Analytics PostgreSQL | **Basic-256mb**, 0.1 CPU, 256 MB RAM | **$6/month** | **Upgrade required.** It is below the explicit 1 GB minimum and therefore does not qualify for a keep-current capacity test. |
| PostgreSQL storage | **15 GB**, autoscaling disabled | **$4.50/month** | **Already sufficient — no immediate capacity increase.** Enable a bounded autoscaling maximum as a no-cost configuration control when the database tier is changed. |
| PostgreSQL PITR | Restore to any timestamp in the past **7 days**; logical exports retained at least seven days | Included | **Already sufficient — no change** for the adopted Render recovery window. It does not satisfy the separate long-term archive tiers. |
| Web persistent disk | **1 GB** at `/var/data`; daily snapshots available for seven days | **$0.25/month** at Render's published disk rate | **Already paid, but not suitable for private HR documents or 15-year archives.** Retain only for its existing non-HR purpose unless a later inventory proves it unused. |
| HRMS cron jobs | **None** in the Zentric Analytics production environment | $0 | **New service required** for scheduled logical backups. The workspace's existing cron job belongs to Kurioticket and must not be reused. |
| HRMS background workers | **None** in the Zentric Analytics production environment | $0 | **New service required** for malware scanning unless an approved managed scanner is selected. Existing in-process outbox/activation scheduling can remain initially, subject to monitoring. |
| HRMS paid add-ons | **None observed** | $0 | **No duplicate purchase.** |

The production workspace also contains Kurioticket and PecuniarRemit services and databases, plus one Kurioticket cron job. Render projects **$92.55** for the entire workspace for August; that figure is not the HRMS cost. The currently attributable Zentric Analytics infrastructure is approximately **$17.75/month** (`$7 + $10.50 + $0.25`), plus the already-paid shared **$25/month** Pro workspace subscription.

## Smallest qualifying Render changes

### PostgreSQL capacity

| Item | Current | Proposed | Increment |
| --- | ---: | ---: | ---: |
| Compute | Basic-256mb, $6/month | **Basic-1gb, $19/month** | **+$13/month** |
| Storage | 15 GB, $4.50/month | 15 GB, $4.50/month | $0 |
| Database total | $10.50/month | **$23.50/month** | **+$13/month** |

Reason: Basic-1gb is the smallest Render PostgreSQL tier meeting the required 1 GB RAM floor. It satisfies the minimum-capacity prerequisite for migration, real concurrency, and production-like load gates. Basic-256mb is cheaper but cannot qualify because it has only 256 MB. Pro-4gb is not required by current evidence. High availability remains an optional improvement and may be deferred if the product owner accepts temporary downtime risk.

After an approved upgrade, rerun migration preflight, database-backed contention/idempotency, connection saturation, memory/CPU, and production-like load tests. Retain Basic-1gb only if every gate passes; otherwise report the evidence and quote the next-smallest tier before another paid change.

### Scheduled backup execution

Add one Zentric Analytics Render Cron Job running `yarn hr:database-archive` daily. Render's minimum cron charge is **$1/month**, with usage above the minimum prorated by runtime. The existing Kurioticket cron job is unrelated and cannot safely share HRMS database/archive credentials.

### Long-term archives and private HR documents

Render's seven-day PITR and seven-day export retention require a separate object store for 90-day daily, one-year weekly, and 15-year monthly retention. The existing web disk is instance-attached, has only seven-day snapshots, and lacks object versioning/bucket-lock controls.

The lowest-cost option remains private Cloudflare R2 Standard storage: the first 10 GB-month is currently free, then $0.015/GB-month plus operations beyond allowances. Use separate private buckets or prefixes and bucket-scoped credentials for HR documents and database archives; block public access, enable encryption/version controls, and apply retention locks. This is a **new external service**, but it is required by private-document and durable-archive controls, not by the seven-day PITR policy alone. Provider authorization is required before configuration.

### Malware scanning

A dedicated scanner is a **new service required** before production HR document upload. The lower-cost Render option is a Starter background worker at **$7/month**, but 512 MB may be insufficient for ClamAV signatures and concurrent scans. Run a non-paid staging memory profile first. Use Starter only if it passes bounded-file, concurrent-scan, signature-update, restart, and failure-recovery gates; otherwise the smallest safe option is Standard at **$25/month**. No worker purchase should be approved until that test fixes the exact tier.

## Cost decision

No web, workspace, storage-capacity, Pro-4gb, or high-availability upgrade is justified now.

The presently fixed minimum Render increase is:

- Basic-1gb PostgreSQL: **+$13/month**
- Daily backup Cron Job: **at least +$1/month**

**Fixed Render increase awaiting approval: at least +$14/month.**

The malware scanner adds either **+$7/month** if Starter passes staging profiling or **+$25/month** if Standard is required. Private R2 storage is expected to start at $0 within its allowance but remains a new provider configuration and usage-priced service. Therefore the likely minimum total increase is **+$21/month**, subject to scanner evidence and actual checkout confirmation.

Do not purchase or provision any item until the product owner explicitly approves the net additional cost. Existing Pro workspace, Starter web service, 15 GB database storage, and 1 GB disk must not be purchased again.

## Sources

- Read-only Render Production workspace Billing, service Plan, database Plan, Recovery, and Disk pages inspected 2026-08-01.
- [Render Cron Jobs](https://render.com/docs/cronjobs)
- [Render PostgreSQL backups](https://render.com/docs/postgresql-backups)
- [Render compute plans](https://render.com/docs/compute-plans)
- [Render persistent disks](https://render.com/docs/disks)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare R2 bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/)
