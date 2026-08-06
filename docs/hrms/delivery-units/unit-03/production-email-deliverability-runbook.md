# Unit 3 production email deliverability runbook (GoDaddy + M365 + Resend)

Scope: production HRMS email flow from `sendHiringEmail` to final mailbox placement.
Do not publish secrets, raw headers, or tokenized credentials in changelogs.

## Approved HRMS sender identities

- `careers@zentricanalytics.com` -> Recruitment and applicant communication
- `offers@zentricanalytics.com` -> Offer communication
- `hr@zentricanalytics.com` -> HR handover, document, onboarding, and employment communication
- `accounts@zentricanalytics.com` -> Invitations, password resets, MFA, account activation, and security communication
- `support@zentricanalytics.com` -> reply-to for security messages where configured

## Authentication requirements for trusted inbound delivery

- SPF pass required
- DKIM pass required
- DMARC pass required
- Return-path/authenticated envelope domain alignment must match the approved Resend subdomain (`send.zentricanalytics.com`) or equivalent approved return-path infrastructure.

## GoDaddy Advanced Email Security

1. Use a conditional filter only for the four approved HRMS sender identities above.
2. Evaluate each rule with the three auth checks above and sender/return-path alignment.
3. Do not allow all `@zentricanalytics.com` or all Resend traffic.
4. Do not bypass malware or attachment checks.
5. Do not bypass messages that fail SPF, DKIM, or DMARC.
6. Keep quarantine workflow enabled and auditable.

The generic **Allow List** accepts only an address/domain/IP and cannot require
SPF, DKIM, and DMARC results. It must not be used for HRMS senders because an
attacker could spoof the visible address. The custom filter must match the
authenticated Resend envelope and approved visible sender at the processing
stage where GoDaddy exposes those authentication results. If the tenant UI
cannot express that predicate, keep quarantine enabled and escalate to GoDaddy
Advanced Email Security support; do not replace it with an address-only allow.

Production finding recorded 2026-08-06:

- The existing `authenticated-resend` custom filter did not register a rule hit
  for the authenticated Account Security messages.
- GoDaddy classified the messages as `Spam` / domain spoofing before manual
  release even though SPF, DKIM, and DMARC passed and the envelope sender was
  under `send.zentricanalytics.com`.
- The filter UI could match visible headers or addresses, but the tested rule
  could not safely predicate on GoDaddy's computed authentication verdicts at
  the anti-spoof decision stage. This indicates that the custom filter executes
  without the required computed verdict fields, or after the proprietary
  anti-spoof engine has already quarantined the message.
- Therefore an address-only allow, root-domain allow, SES-wide allow, or
  Resend-wide allow is prohibited. The supported remediation is a GoDaddy
  authenticated-sender/anti-spoof exception or provider-side false-positive
  correction that binds the four exact visible senders to aligned SPF, DKIM,
  DMARC, and the `send.zentricanalytics.com` envelope path.
- Preserve the provider case/reference and the exact message identifiers in the
  restricted operational evidence store. Do not copy reset tokens, raw private
  message content, or credentials into this repository.

Provider-console verification recorded later on 2026-08-06:

- Global inbound DMARC remains on the recommended sender-policy enforcement
  setting. DKIM failure and SPF hard failure remain configured to quarantine.
- GoDaddy's DMARC, DKIM, and SPF exception lists are domain-level lists that
  explicitly ignore the applicable policy. They cannot require a passing,
  aligned result and therefore must remain empty for `zentricanalytics.com`.
- Inbound filter `authenticated-resend` (provider filter ID `7905673`) is
  enabled, but its usage remains `0 email(s)`. It searches untrusted string
  content in `Email Headers` for `spf=pass`, `dkim=pass`, `dmarc=pass`, the
  Resend envelope domain, and one of the four approved visible senders. It does
  not consume GoDaddy's computed authentication verdicts and did not run as a
  safe exception before proprietary spam/domain-spoof quarantine.
- The provider's built-in **Report as false positive** action requires sharing
  the complete message body with the spam team. Do not submit a password-reset
  message through that action without explicit authorization because the body
  contains a sensitive reset URL. Prefer a metadata-only GoDaddy support case
  containing message identifiers, timestamps, sender identities, aligned
  authentication results, classification, and filter ID.

Validation checklist:

- Sender rule hit/miss logs include exact sender, reason, and message ID.
- Quarantine events are reviewed before release.
- Any message accepted by upstream but placed in spam/junk is treated as control failure until message-placement issue is resolved.

### Quarantine lookup and controlled release

1. In GoDaddy Advanced Email Security, open **Log Search** and select inbound mail.
2. Search by the approved recipient domain, sender identity, redacted subject, and narrow timestamp window. Do not search with or expose the reset token or URL.
3. Open **Detail**, not the private message body, and record the GoDaddy message ID/MRID, envelope sender, sending IP, SPF/DKIM/DMARC results, alignment, classification, size, and attachment presence.
4. Confirm the visible sender is one of the four registered HRMS senders, the Return-Path is the approved `send.zentricanalytics.com` path, authentication passes, there is no unexpected attachment, and the CTA uses the canonical HTTPS production origin.
5. If any condition fails, keep the message quarantined and escalate as a security event.
6. If every condition passes and the message correlates to one expected HRMS outbox/provider ID, use **Release from quarantine**. Do not select an address/domain-wide approval action.
7. Record the release actor, reason, message IDs, and time in restricted operational evidence.
8. Verify Microsoft 365 Message Trace and the final Outlook folder. A GoDaddy release alone is not delivery evidence.

## Microsoft 365 / Exchange Online

1. When GoDaddy Advanced Email Security is the third-party filter in front of
   Microsoft 365, enable **Enhanced Filtering for Connectors** on the inbound
   `GD Encryption Integrated Inbound Return` connector.
2. Initially scope Enhanced Filtering to the approved smoke mailbox; expand
   only after authenticated delivery is verified.
3. Disable transport rules that set SCL to `-1` for this connector after
   Enhanced Filtering is enabled. Microsoft documents that SCL bypass is not
   the safe fix for high-confidence phishing in a third-party-filter topology.
4. Preserve baseline anti-malware, anti-spam, phishing, and attachment
   protection behavior.
5. Verify connector, alias routing, Message Trace, quarantine, and final Inbox
   placement.

Production configuration verified 2026-08-06:

- Enhanced Filtering: `On`, automatically skip the last connector IP.
- Initial scope: `admin@zentricanalytics.com`.
- Obsolete `Authenticated HRMS Senders` SCL `-1` rule: disabled.
- A released authenticated HRMS message subsequently showed `Delivered` in
  Microsoft 365 and appeared in Outlook Inbox without a Microsoft quarantine
  release.

Validation checklist:

- Message Trace result confirms delivered status.
- Inbox location is verified, not just provider acceptance.
- Spam/Junk/Quarantine checks are reviewed per test message.
- Alias routing shows expected address-to-recipient behavior.

## Alias architecture

- `admin@zentricanalytics.com`, `accounts@zentricanalytics.com`, `careers@zentricanalytics.com`, `offers@zentricanalytics.com`, and `hr@zentricanalytics.com` are sender identities/aliases for the same tenant mailbox.
- They are routing identities only; application accounts are not created per alias.
- Same-domain alias-to-primary looping is expected to trigger provider-side scrutiny; controls above must therefore be explicit.

## Sender registry enforcement (application-side)

- Every template must map to one category in `emailTemplateSenderRegistry`.
- Unknown or unmapped templates must fail closed.
- Reply-To values are category-specific.
- Account-security templates must never resolve to recruitment/offers/hr sender identities.
- Sender addresses and reply-to addresses are `@zentricanalytics.com`.

## Regression checks to keep permanently

- Password reset and invitation mails cannot resolve to `careers@` or `offers@`.
- Security vs. non-security sender category mapping is enforced by tests.
- SPF/DKIM/DMARC failures are treated as delivery failure states.

## Monitoring and release checklist

- Until GoDaddy supplies a safe event/API integration, the accepted-risk monitoring control is a documented provider-console review rather than a fabricated automated alert:
  - review GoDaddy quarantine at least every four hours during business operations and at the start/end of each release window;
  - escalate immediately when any approved HRMS sender is quarantined, two or more HRMS messages are quarantined in one hour, or a released message does not appear in Microsoft 365 Message Trace;
  - review Resend bounces, complaints, and suppressions at least daily; escalate on any complaint, any new suppression of an approved operational recipient, or a bounce-rate increase above the established daily baseline;
  - review Microsoft 365 Message Trace, Quarantine, and repeated Junk placement for approved HRMS messages daily;
  - correlate provider message ID, GoDaddy ID/MRID, M365 trace, outbox ID, final disposition, and remediation action without storing private bodies or tokens.
- Configure automated provider notifications/webhooks only when a reviewed authenticated endpoint exists. Until then, do not claim automated quarantine/bounce/complaint/suppression alerting is configured.
- Add end-to-end mailbox-delivery verification to production release smoke:
  - provider response ID,
  - message trace ID and result,
  - provider and domain checks,
  - final mailbox placement.
