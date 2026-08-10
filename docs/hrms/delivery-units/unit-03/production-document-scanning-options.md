# Production document-scanning engineering review

Prepared 2026-08-01. No scanner, object store, workflow, cloud account, or paid service was provisioned during this review.

## Required security outcome

Every untrusted document version must enter an inaccessible quarantine state, pass structural/type controls, receive a malware decision for that exact immutable version, and remain unavailable to HR until the decision is `CLEAN`. A timeout, provider error, ambiguous result, stale callback, or version mismatch must fail closed. Malicious content must remain quarantined with complete audit evidence.

The current release already provides a useful base: bounded file size, byte-signature recognition for PDF/JPEG/PNG, equality between detected and declared MIME type, filename normalization, private storage abstraction, per-version checksum/storage key, `PENDING` scan state, exact-version callback, idempotent terminal results, and protected downloads with `nosniff`, no-store and sandbox headers. Before production, also enforce extension-to-signature mapping, reject archives and active formats, validate PDF structure/trailing content, keep quarantine and clean prefixes/permissions separate, and prevent downloads based on storage tags as well as database state.

## Option comparison

| Architecture | Security | Operations and resources | Current cost | Limitations | Meets HRMS requirement? |
| --- | --- | --- | ---: | --- | --- |
| Continuous ClamAV background worker | **High** for known malware when signatures and engine are current. Documents can remain between Render and private storage. | High operational ownership: engine/signature updates, health checks, daily reload behavior, restart recovery and queue management. Requires 4 GB RAM because ClamAV recommends 3 GiB minimum and 4 GiB for containers. | Render Pro worker **$85/month**, plus object storage | Signature-based detection; no managed SLA; daily reload can cause memory spikes; continuous cost when idle. | **Yes, conditionally**, after workload, update, EICAR, failure and recovery tests. Not cost-effective at startup volume. |
| On-demand ClamAV on Render Workflows | Same engine-level security as continuous ClamAV if every exact version is scanned with current signatures and fails closed. | High engineering complexity: task registration/API key, secure object retrieval, signature refresh/caching, cold starts, retries, callback authentication and result reconciliation. A Pro workflow task supplies 4 GB only while running. | **$0.40/hour**, billed by second. 1,000 one-minute scans ≈ **$6.67**; 1,000 five-minute scans ≈ **$33.33**. | Render Workflows is beta; ephemeral tasks make signature freshness/caching harder; cold-start and signature downloads can dominate duration. | **Potentially**, but only after a feasibility spike proves image packaging, signature freshness, bounded latency and fail-closed retries. |
| Cloudmersive Virus Scan API, Basic | **High managed scanning** with continuously updated signatures; advanced API can also flag executables, scripts, invalid files, macros and unsafe archives. | Low infrastructure burden and no customer RAM. HTTPS API integration, retry/outbox, exact-version correlation and provider monitoring remain required. | **$19.99/month**, 10,000 calls, 2 calls/second, 1 GB maximum file size | Sensitive HR documents are transmitted to a multi-tenant processor. Requires DPA, subprocessors, residency, deletion/statelessness and breach/SLA review. North America regions on Basic. | **Yes, conditionally**, after privacy/legal/vendor approval and live failure/retry tests. Best fallback if AWS is rejected. |
| Amazon S3 + GuardDuty Malware Protection for S3 | **High managed, event-driven scanning.** Every new object/version can be scanned automatically; results support EventBridge and object tags for quarantine/access enforcement. | Medium setup, low ongoing operations. Requires private S3, IAM, KMS/SSE, versioning, public-access block, event handling and tag-based access control. No scanner RAM or signature maintenance. | Monthly allowance currently includes **1,000 objects and 1 GB**. Example US East paid rates are **$0.09/GB + $0.215/1,000 objects**, plus S3 storage/API charges. Startup usage should normally remain below a few dollars. | Adds AWS as the private-storage/security provider and requires AWS authorization. Region-specific pricing/quotas apply. Scan completion is asynchronous and must fail closed. | **Yes. Recommended**, after an isolated proof and security configuration review. It can also provide locked long-term archive storage, avoiding two separate external vendors. |
| Layered validation without malware scanning | Good prevention of simple spoofing, oversized files, dangerous extensions and parser abuse. Near-zero compute. | Low to medium. Enforce allowlisted extensions, MIME/signature equality, structural parsing, size/decompression limits, safe names, private quarantine, no execution, CSP/download headers, checksums and audit. | Approximately **$0 incremental infrastructure** | Cannot reliably identify valid-looking files containing known malware or malicious document payloads. | **No by itself.** Mandatory defense-in-depth alongside one scanning option. |

VirusTotal's standard public submission flow is unsuitable for confidential HR documents. Its private product requires a special license, and its private analyses do not provide antivirus partner verdicts, so it is not the preferred control for this requirement.

## Recommendation

For a startup, use **private Amazon S3 plus GuardDuty Malware Protection for S3**, while keeping the application, PostgreSQL and scheduled execution on Render. This exception introduces AWS for the independent private-document security blocker, not merely to extend Render PITR. It has the strongest cost/security balance because scanning is managed and usage-based, no always-on 4 GB worker is needed, documents remain within the selected storage provider, and the same provider can supply encryption, versioning, public-access block and object-lock controls for database archives.

Required flow:

1. Validate name, extension, claimed MIME, magic bytes, supported structure and size before accepting the upload.
2. Store the immutable version under a private quarantine prefix with a checksum and `PENDING` database state.
3. Deny all application downloads unless both the exact database version and the S3 scan-result tag are clean.
4. Consume the GuardDuty/EventBridge result through an authenticated, idempotent callback; verify bucket, key, version ID and checksum.
5. Mark clean, quarantine or failed; never treat timeout/provider failure as clean.
6. Test EICAR, clean files, MIME/extension mismatches, polyglots, oversized input, duplicate events, stale versions, provider delay and permanent failure.

If the product owner does not want AWS, choose **Cloudmersive Basic at $19.99/month** after DPA/residency review. Keep on-demand Render Workflows as an engineering fallback, not the first production choice, because its low compute price is offset by signature-management and beta-platform complexity.

## Primary references

- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [ClamAV system requirements](https://docs.clamav.net/)
- [ClamAV container memory behavior](https://docs.clamav.net/manual/Installing/Docker.html)
- [Render Workflows limits and pricing](https://render.com/docs/workflows-limits)
- [Amazon GuardDuty Malware Protection for S3](https://docs.aws.amazon.com/guardduty/latest/ug/gdu-malware-protection-s3.html)
- [Amazon GuardDuty pricing](https://aws.amazon.com/guardduty/pricing/)
- [Cloudmersive small-business pricing](https://cloudmersive.com/pricing-small-business)
- [Cloudmersive Virus Scan API](https://api.cloudmersive.com/docs/virus.asp)
- [Cloudmersive security](https://cloudmersive.com/security)
