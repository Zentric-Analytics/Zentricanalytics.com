# Unit 1-3 final production validation report

## Release target

- Production commit: `657ab18de80d5ce2cbf945806f52b6e99f2e5e99`
- Production deployment: `dep-d9nu7j8u01pc73c9pdgg`
- Merge base: `main`
- Feature freeze status: Units 1-3 frozen
- Migration state: 30 migrations found; database schema up to date

## Phase 1 - production email validation

- Resend message ID: `03360844-5b4e-4747-a441-fe0ed2a03de1` (first post-SPF validation)
- Email provider status: accepted/delivered to the configured inbound path
- SPF: pass
- DKIM: pass
- DMARC: pass
- GoDaddy Advanced Email Security disposition: authenticated messages still classified as Spam / Domain Spoofing and quarantined; manual release required. The address-only allow list and the domain-level SPF/DKIM/DMARC exception lists were rejected as unsafe. Enabled filter `authenticated-resend` (`7905673`) remains at `0 email(s)` usage because the filter surface cannot safely predicate on GoDaddy's computed authentication verdict before the proprietary anti-spoof decision.
- Blocking classification: **External vendor false-positive: GoDaddy Advanced Email Security quarantines fully authenticated HRMS transactional mail before custom filters can evaluate it.**
- Microsoft 365 Message Trace: after Enhanced Filtering was enabled and the SCL `-1` rule disabled, the released validation message was `Delivered`.
- Final Inbox placement: visible in Outlook Inbox; no Microsoft quarantine release was required after the connector fix.
- Evidence timestamp: 2026-08-06

## Phase 2 - production admin onboarding

- Admin identity confirmed: `admin@zentricanalytics.com`
- Password reset completed: yes; audit action `hr.password.reset`, correlation `8b78f7eb-ac35-443b-9c9a-f2b331126fa4`
- MFA enrollment timestamp: MFA status verified enabled on 2026-08-06
- First-login route and audit event IDs: `hr.auth.login_succeeded`, correlation `406f05b3-0cbf-40f3-92e0-a0cf8ad830b6`
- Dashboard access verified: yes, primary administrator dashboard and audit workspace

## Phase 3 - final production smoke tests

- Worker authentication: unauthenticated outbox invocation `401`; authenticated invocation `200`
- Worker execution: authenticated outbox worker completed successfully
- Email delivery smoke: provider acceptance and authenticated delivery through manual GoDaddy release verified; automatic first-hop passage and automatic Outlook Inbox placement remain unproven and blocking
- Document upload: production smoke document retained with v1 and v2 metadata
- Quarantine behavior: exact version remained governed by scan state
- GuardDuty scan: audit action `hr.document.scan.completed` for version `cmscjgi4k002zi22uu0qhu77v`
- EventBridge callback: clean exact-version result correlated in immutable audit evidence
- SQS retry behavior: EventBridge target configured for 10 retry attempts with a one-hour maximum event age.
- SQS DLQ behavior: `zentric-production-hr-document-scan-dlq` is configured as the target DLQ, encrypted with SSE-SQS, and its resource policy permits `sqs:SendMessage` only from the production scan-results rule in AWS account `976090824866`.
- Exact-version release: v2 `CLEAN`; v1 retained; access log records v2 downloads
- Authorization boundaries: unauthenticated exact-version download returned `401`
- Health/readiness: production preflight ready; `/api/health/live`, `/api/health/ready`, and `/hr/login` passed on rerun after one transient `502`
- Public website: production homepage returned successfully during release smoke
- Careers portal: production Careers route returned successfully during release smoke
- Applicant tracking: public tracking route rendered successfully during release smoke
- Integrity query checks: representative application, handover, employee, onboarding, document, outbox, and audit checks passed; no release-blocking duplicate/orphan condition recorded
- Backup verification: `yarn hr:backup-readiness` passed; Render cron `crn-d9n53dp42hec73etr2jg` succeeded nightly through 2026-08-06

## Gate controls and release safety

- Document intake closed before callback:
- Scanner callback success before intake reopen:
- Any blocker encountered: GoDaddy first-hop quarantine remains blocking. A metadata-only provider escalation is pending. If GoDaddy requires the original message, obtain separate approval and invalidate or confirm expiry of the reset token before submitting only the expired diagnostic message. AWS scanner wiring inspection completed successfully on 2026-08-06.
- Rollback status:

## Final production state

- Final production deployment ID: `dep-d9nu7j8u01pc73c9pdgg`
- Final production commit SHA: `657ab18de80d5ce2cbf945806f52b6e99f2e5e99`
- Migration status (`yarn prisma migrate status`): 30 migrations found; database schema up to date
- Email evidence record: [metadata-only GoDaddy support package](godaddy-metadata-only-support-package.md)
- Worker evidence record: unauthenticated outbox invocation `401`; authenticated invocation `200`; governed worker completed successfully
- Scanner evidence record: API destination `zentric-production-hr-document-scan` is Active and Authorized, uses HTTPS `POST` to the production callback, and stores API-key connection material in AWS Secrets Manager. Rule `zentric-production-hr-document-scan-results` is Enabled and matches only GuardDuty S3-object scan results for bucket `zentric-production-hr-documents-976090824866-us-east-2` under `quarantine/`. GuardDuty Malware Protection for S3 is Active for exactly that one bucket and one prefix.
- Backup evidence record: backup-readiness passed; protected nightly archive cron succeeded through 2026-08-06; isolated restore and annual DR evidence remain recorded in the production recovery runbooks
- Audit evidence record: password reset, successful login, document scan completion, exact-version access, and worker execution correlations verified without storing secrets in this report
- Final verdict: FAIL pending safe GoDaddy authenticated-sender handling. AWS callback, scope, retry, and DLQ configuration gates pass.

## Approved response paths

### Path A - supported narrow configuration

1. Confirm the recommendation is restricted to the four approved HRMS sender identities, the aligned DKIM identity, the `send.zentricanalytics.com` Return-Path, and the approved Resend/Amazon SES sending infrastructure.
2. Reject any recommendation that broadly bypasses spoofing, phishing, malware, attachment, or domain-wide spam controls.
3. Record the exact provider-side change and its scope before applying it.
4. Apply only the reviewed narrow change, then send exactly one controlled password-reset message.
5. Require no GoDaddy quarantine, no Microsoft High Confidence Phish disposition, and automatic Outlook Inbox placement.

### Path B - original message required

1. Stop and obtain explicit approval for message-body disclosure.
2. Confirm the reset token is expired or invalidate it before disclosure.
3. Submit only the expired diagnostic message and exclude unnecessary personal content where GoDaddy accepts redaction.
4. Never disclose a live reset URL, password, MFA secret/code, or unrelated private body content.

## Final production runbook references

- [Operations Handbook index](../../operations-handbook-index.md)
- [Production deployment runbook](production-deployment-runbook.md)
- [Production staging verification runbook](../../staging-verification-runbook.md)
- [Production email deliverability runbook](production-email-deliverability-runbook.md)
- [Backup and disaster recovery](../../backup-disaster-recovery.md)
