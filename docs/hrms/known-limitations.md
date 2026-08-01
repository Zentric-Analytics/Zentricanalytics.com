# HRMS known limitations

- Staging migrations, provider integrations, runtime authorization, worker scheduling, monitoring, backups, restore drill, load behavior, and penetration testing are `ENVIRONMENT_PENDING`.
- Cross-year leave is intentionally rejected and must be submitted as one request per calendar year so each request maps to one annual balance.
- Workflow delegation/reassignment fields are schema-ready, but interactive delegation and escalation automation are not enabled; this remains a documented future capability rather than a placeholder claim.
- Large report exports are synchronously bounded by current query limits. A background export job is required before raising those limits materially.
- MFA has no self-service recovery codes. ADMIN emergency reset is audited, requires an explicit reason, and revokes sessions.
- First initialization creates an ADMIN without MFA because MFA enrollment requires a running application. The guarded release allows that one initialization only; the operator must enroll MFA, remove bootstrap secrets/flag, and redeploy. Later releases fail preflight while privileged MFA is missing.
- Local tests do not substitute for PostgreSQL concurrency/integration execution. Transaction/constraint behavior must be repeated on an authorized disposable staging-class database.
- Production CSP still permits framework-required inline bootstrap/styles as documented. Per-request nonces are a future hosting-level hardening item.
