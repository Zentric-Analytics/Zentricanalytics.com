# Units 1–3 paid infrastructure cost and architecture report

Prepared 2026-08-01. Prices are published list prices or Render-dashboard observations and exclude tax, data growth, excess bandwidth and provider-negotiated discounts. No component in this report has been purchased or provisioned.

## Recommended architecture

Keep the application, workers and PostgreSQL primary on Render. Use one external S3-compatible object-storage provider only because private, durable HR document storage is an independent security requirement that Render does not supply. If Cloudflare R2 is approved for that requirement, use a separate R2 bucket and separate bucket-scoped token for database archives. This avoids introducing a second provider solely for backup retention.

### 1. Scheduled backup execution

**Why required:** Render PITR and Render-generated logical exports stop at seven days. A daily portable `pg_dump` is required for the 90-day, one-year and 15-year tiers.

| Option | Monthly cost | Operational/security impact |
| --- | ---: | --- |
| Render Cron Job, Starter compute only while running | Minimum **$1/month**, then prorated active compute | Single-run guarantee prevents overlap. Ephemeral filesystem requires immediate upload. Database URL, archive encryption key and bucket-scoped write token remain in Render secrets. Lowest operational burden. |
| Render background worker, Starter | Approximately **$7/month**, plus disk if used | Continuous process and more monitoring. A persistent disk prevents zero-downtime worker deploys and remains a single-service storage attachment. Unnecessary if archives upload directly to protected object storage. |
| Run from the production web service | No separate line-item cost | Rejected: backup CPU, memory and credentials would share the user-facing process and could affect availability. |

**Recommendation:** one daily Render Cron Job executing `yarn hr:database-archive`; expected base charge $1/month at current minimum billing, subject to run duration.

Sources: [Render Cron Jobs](https://render.com/docs/cronjobs), [Render PostgreSQL backups](https://render.com/docs/postgresql-backups).

### 2. Long-term database archive storage

**Why required:** Render retains logical exports for seven days. Fifteen-year archives require durable storage, independent credentials and deletion protection.

| Option | Monthly cost | Operational/security impact |
| --- | ---: | --- |
| Cloudflare R2 Standard | First 10 GB-month free; then **$0.015/GB-month**; Class A $4.50/million and Class B $0.36/million after free allowances; egress free | Eleven-nines designed durability, AES-256 at rest, TLS, bucket-scoped tokens and bucket locks. Separate locked bucket prevents the HR application from deleting backups. |
| Cloudflare R2 Infrequent Access | **$0.01/GB-month**, plus retrieval and higher operation charges; 30-day minimum | Cheaper at larger volumes but restore drills incur retrieval charges. The free tier does not apply. |
| Render persistent disk | **$0.25/GB-month** plus a paid worker | Stays on Render, but is attached to one service, cannot be used by Cron Jobs and lacks the cross-service durability and bucket-lock control expected for 15-year archives. Not recommended as the sole archive. |
| AWS S3/Glacier classes | Region- and tier-dependent usage pricing | Mature object-lock and archival tiers but adds another provider. No benefit over R2 for the initial HRMS volume unless corporate policy mandates AWS. |

**Recommendation:** a dedicated locked R2 bucket, reusing the provider selected for HR documents but with distinct credentials. Initial storage is likely within the 10 GB Standard free tier; actual cost is `max(0, stored_GB - 10) × $0.015` plus operations. Retention prefixes must be locked for 90 days, 365 days and 15 years.

Sources: [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/), [R2 durability](https://developers.cloudflare.com/r2/reference/durability/), [Render persistent disks](https://render.com/docs/disks).

### 3. Private HR document storage

**Why required:** resumes, identity documents, contracts and onboarding files must not live on the web service's local or ephemeral filesystem. Production preflight requires private S3-compatible storage with encryption and least-privilege access.

| Option | Monthly cost | Operational/security impact |
| --- | ---: | --- |
| Cloudflare R2 Standard | First 10 GB-month free, then **$0.015/GB-month** | S3-compatible with bucket-scoped tokens, encryption at rest, TLS and no egress fee. Use a private bucket without an `r2.dev` public endpoint. Separate application and scanner tokens. |
| AWS S3 Standard | Usage-based by region; current public pricing must be calculated for the selected region | Strong IAM, versioning, KMS and Object Lock. Higher configuration complexity and introduces AWS solely for documents. |
| Render persistent disk | **$0.25/GB-month** plus paid service compute | Rejected for HR documents: tied to one instance, prevents zero-downtime deploys and does not provide S3-compatible versioning/access controls. |

**Recommendation:** private R2 Standard bucket. Expected initial storage charge is $0 while total Standard usage remains within the 10 GB-month allowance; operation charges are also expected to remain within the published free allowance at initial volume. Provider authentication is still required before configuration.

Sources: [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 data security](https://developers.cloudflare.com/r2/reference/data-security/), [R2 overview](https://developers.cloudflare.com/r2/).

### 4. Malware scanning

**Why required:** uploaded files remain unavailable while `PENDING`; a trusted scanner must classify each exact version as `CLEAN`, `QUARANTINED` or `FAILED`. Manual simulation is prohibited in production.

| Option | Monthly cost | Operational/security impact |
| --- | ---: | --- |
| Dedicated ClamAV scanner on a Render Starter worker | Approximately **$7/month** compute; no ClamAV license fee | Documents remain between Render and the approved private bucket. Requires signature updates, worker health monitoring, memory validation and secure callback credentials. Starter's 512 MB may prove insufficient; validate in staging before purchase. |
| ClamAV on Render Standard worker | Approximately **$25/month** | 2 GB RAM provides safer scanning headroom, but still requires signature and engine operations. |
| Cloudmersive Virus Scan API | **Quote-based** on the currently published pricing page | Lower engine-maintenance burden, but confidential HR files are transmitted to an additional processor; requires privacy, retention, residency, DPA and SLA review. |
| Enterprise multi-engine scanner | **Quote-based** | Stronger detection/SLA options, highest cost and procurement overhead. |

**Recommendation:** stage a dedicated Render Standard ClamAV worker first, with no public endpoint, read-only document access, quarantined-result callback, signature freshness alerts and strict file/time limits. If operational testing or detection requirements fail, obtain a Cloudmersive or equivalent enterprise quote rather than weakening the gate.

Sources: [Render compute plans](https://render.com/docs/compute-plans), [Cloudmersive pricing](https://cloudmersive.com/pricing).

### 5. Production capacity upgrades

**Why required:** the current production database is Basic-256mb (0.1 CPU/256 MB), without HA or pooling. It is below a prudent HRMS production baseline. The current web service is Starter (0.5 CPU/512 MB).

| Component/option | Estimated monthly cost | Impact |
| --- | ---: | --- |
| Keep web Starter | Current plan, approximately **$7/month** | Acceptable only after post-release load observation; limited headroom for Next.js plus in-process workers. |
| Upgrade web to Standard | Approximately **$25/month** | 1 CPU/2 GB; more reliable build/runtime headroom. Recommended initial web tier. |
| Database Basic-1gb | **$19/month compute + $0.30/GB-month storage**; current 15 GB storage implies about **$23.50/month** | 0.5 CPU/1 GB. Minimum economical baseline, but no HA. Brief downtime when changing instance type. |
| Database Pro-4gb | **$55/month compute + $0.30/GB-month storage**; 15 GB would total about **$59.50/month** if retained | 1 CPU/4 GB and HA eligibility. Recommended production tier before enabling HA. |
| High availability | Dashboard quote required; expect an additional standby-resource charge | Protects against instance failure but increases cost and operational complexity. Must be priced in Render before approval. |
| Render Pro workspace | **$25/month flat** under the 2026 plan | Required for a seven-day PITR window; Hobby receives three days. Also adds audit/compliance capabilities. Confirm whether Production workspace already incurs this charge. |

**Recommendation:** Render Pro workspace, Standard web service, Pro-4gb PostgreSQL, at least 15 GB storage with autoscaling, managed pooling and HA if the final Render quote is approved. A lower-cost conditional option is Standard web plus Basic-1gb database, accepting no HA during the initial monitored period.

Sources: [Render flexible PostgreSQL plans](https://render.com/docs/postgresql-refresh), [Render compute plans](https://render.com/docs/compute-plans), [Render workspace plans](https://render.com/docs/new-workspace-plans).

## Estimated recommended monthly total

Excluding usage growth and HA's still-unquoted standby charge:

- Render Pro workspace: $25
- Standard web service: about $25
- Pro-4gb PostgreSQL plus 15 GB storage: about $59.50
- Daily Render Cron Job: at least $1
- Standard malware scanner worker: about $25
- R2 documents and archives: initially $0 if combined Standard usage stays within 10 GB-month; otherwise $0.015/GB-month beyond the allowance

**Estimated base: $135.50/month plus HA, excess storage/operations, bandwidth and tax.** If the workspace fee or current Starter web cost is already being paid, calculate approval on the incremental amount rather than double-counting it.

No purchase or provider configuration should occur until the product owner approves the exact Render checkout quote and external-provider terms.
