# Monitoring and incident response

## Probes and signals

- `GET /api/health/live`: process liveness.
- `GET /api/health/ready`: database-backed readiness; returns 503 on failure.
- `GET /api/internal/hr/metrics`: bearer-protected operational counters for outbox backlog/failures, failed logins, overdue lifecycle/workflow work and pending document scans.

Recommended alerts:

- readiness fails twice in two minutes;
- abandoned outbox count is nonzero;
- oldest pending notification exceeds ten minutes;
- failed logins materially exceed the established hourly baseline;
- document scans remain pending over fifteen minutes;
- workflow/lifecycle overdue counts rise continuously;
- backup/PITR or restore-test evidence expires.

Never place request bodies, tokens, bank data, salaries, identity data, document content or raw workflow context in logs or alert payloads.

## Incident flow

1. Acknowledge and assign an incident commander.
2. Classify availability, confidentiality, integrity and affected organizations/modules.
3. Preserve audit/provider logs and isolate compromised credentials or integrations.
4. Revoke sessions and rotate the smallest affected secret set.
5. Use documented recovery procedures; do not rewrite immutable history.
6. Validate health, authorization boundaries, outbox, storage and critical workflows.
7. Notify legal/business owners under the applicable incident and privacy policy.
8. Publish a blameless review with timeline, root cause, impact, corrective actions and owners.
