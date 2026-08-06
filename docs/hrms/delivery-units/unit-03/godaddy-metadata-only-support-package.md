# GoDaddy Advanced Email Security metadata-only support package

Classification: operational metadata only. This package deliberately excludes the message body, reset URL/token, passwords, MFA material, and secret values.

## Message metadata

- GoDaddy message ID: `9E0lZ-NA5XpT`
- GoDaddy MRID: `2246954606`
- SMTP envelope / Return-Path identifier: `0100019fd728464f-3734e485-b498-4f93-b41b-201ff8aaf7c2-000000@send.zentricanalytics.com`
- Visible sender: `Zentric Account Security <accounts@zentricanalytics.com>`
- Recipient domain: `zentricanalytics.com`
- Subject: `Reset your Zentric HR password` (may be supplied as `Reset your Zentric HR...`)
- Timestamp: `2026-08-06 07:59:29 CDT`
- Resend production-validation message ID: `03360844-5b4e-4747-a441-fe0ed2a03de1`
- Sending IP: `54.240.9.22`
- Attachment: none
- Link policy: the CTA uses only the canonical HTTPS production origin, `https://www.zentricanalytics.com`

## Authentication and DNS metadata

- SPF: PASS for the approved Resend/Amazon SES envelope path.
- DKIM: PASS and aligned with the verified Zentric/Resend sending identity. The exact raw `d=` header remains in restricted mailbox evidence and is not copied into this repository.
- DMARC: PASS; aligned with `zentricanalytics.com`.
- GoDaddy verdict: Spam / Domain Spoofing; Medium; quarantined before automatic delivery.
- Root SPF:
  `v=spf1 include:_spf-usg2.ppe-hosted.com include:secureserver.net include:dc-fd741b8612._spfm.send.zentricanalytics.com ~all`
- `send.zentricanalytics.com` is the verified Resend-managed Return-Path/SPF domain and resolves transitively to the approved Amazon SES SPF policy.
- Exactly one root SPF record was verified; the evaluated policy remains below the RFC ten-lookup limit.

## Provider-processing evidence

- GoDaddy custom inbound filter: `authenticated-resend` (`7905673`).
- Filter state: enabled.
- Usage: `0 email(s)`.
- The filter can match untrusted header strings, but the tenant rule surface cannot predicate safely on GoDaddy/Proofpoint's computed SPF, DKIM, and DMARC results before proprietary anti-spoof quarantine.
- The observed ordering is therefore anti-spoof quarantine before the custom filter can provide a safe authenticated-sender decision.

## Questions for GoDaddy / Proofpoint

1. What exact Proofpoint rule, classifier, or signal caused the domain-spoof verdict?
2. Is authenticated third-party transactional mail with aligned DKIM and a Resend-managed Return-Path supported?
3. What is the narrowest supported configuration that avoids this false-positive without a domain-wide bypass?
4. Can GoDaddy create a provider-side exception scoped to the four exact visible HRMS senders, the verified DKIM signing identity, `send.zentricanalytics.com` Return-Path, and the approved Resend/Amazon SES sending infrastructure?
5. Is the complete original message strictly required for further analysis? Do not request or receive it until separate owner approval is recorded and the reset token is expired or invalidated.

## Safety boundary

Do not implement an address-only allowlist, whole-domain allowlist, SCL bypass, malware/attachment bypass, or an exception for messages that fail SPF, DKIM, or DMARC. Automatic Inbox delivery remains a release blocker until one controlled message passes GoDaddy and Microsoft 365 without manual release.
