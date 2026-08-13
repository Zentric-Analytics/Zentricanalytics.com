# Unit 6 production release report

## Verdict

**CONDITIONAL PASS — Unit 6 Production Ready and Operational with explicitly accepted non-blocking email-deliverability risk.**

Unit 6 time and attendance is deployed, migrated, healthy, and operational. The pre-existing Units 1–5 exception remains: automatic GoDaddy Advanced Email Security to Microsoft 365 Inbox placement for authenticated transactional mail is not yet proven without manual release. This report does not claim that email-trust gate passed and does not authorize a broad allowlist or security bypass.

## Release identity

- Pre-merge `main`: `1a33769aaf9bd17f26521864f1a276104b30712d`
- Validated `dev`: `4a7be8614a3036714a432274d2afc713a3269158`
- Staging release tag: `hrms-unit-06-v1.0.0`
- Staging tag target: `2a9bdfc5b51636d10a778ca247657958072b2c13`
- Staging evidence commit: `81071a`
- Production merge and application SHA: `62b49815383bc95461f86952171a37ef9326fdf4`
- Production deployment: `dep-d9ts55v40ujc73f1pb40`
- Production service: `srv-d8s89fbeo5us73e7ljk0`
- Production database: `zentric_analytics_43sq` (`dpg-d8s88jurnols738a7og0-a`)
- Production database migrations: 40 applied, none pending
- Unit 6 migration: `20260811160000_hrms_unit6_time_attendance_foundation`

The release used a normal merge and guarded `yarn hr:release`. The 39 previously applied migrations no-op'd and the single reviewed additive Unit 6 migration applied successfully. Bootstrap was already complete and was correctly skipped.

## Candidate validation

- Automated tests: 663/663 passing in 58 files
- TypeScript: PASS (`tsc --noEmit`)
- ESLint: PASS with zero warnings
- Prisma schema validation: PASS
- Production build: PASS
- Production preflight: PASS
- Live, readiness, root, Careers, applicant tracking, and Unit 6 status routes: HTTP 200
- Unauthenticated internal time-worker request: HTTP 401
- Administrator login and MFA: PASS; MFA shown enabled in production security settings

## Backup and recovery evidence

- Pre-release encrypted archive correlation: `90f164248c35`
- Pre-release archive tier: daily
- Pre-release encrypted size: 702,099 bytes
- Post-release encrypted archive correlation: `34f3f2a80887`
- Post-release archive tier: daily
- Post-release encrypted size: 785,042 bytes
- Backup cron: `crn-d9n53dp42hec73etr2jg`

The archive workflow verified encryption, SHA-256 metadata, uploaded size, Object Lock compliance retention, and plaintext cleanup. Existing isolated restore and disaster-recovery evidence remained current at release time.

## Production smoke evidence

A controlled production exception-based time policy was created through the governed HR interface:

- Code: `PROD_U6_EXCEPTION_SMOKE_20260811`
- Name: `Production Unit 6 Exception Smoke`
- Tracking mode: `EXCEPTION_BASED`
- Version: 1
- Time zone: `Africa/Lagos`
- Effective date: 2026-08-12 02:00
- Grace: 5 minutes before and after
- Employee: `ZA-EMP-2026-0001` / controlled Production Smoke fixture
- Assignment reason: `Controlled Unit 6 production exception-based smoke`

The policy was published and assigned through governed actions. Production audit evidence records `hr.time.policy.published` for `HrTimePolicyVersion` with correlation/entity ID `cmspehgcd00m9o02xp31u35gk`, and `hr.time.policy.assigned` for `HrTimePolicyAssignment` with correlation/entity ID `cmspehv7f00mro02xhaf333hx`.

Authenticated route smoke passed for workforce events, leave, employment lifecycle, secure documents, reports, and the Unit 6 time administration workspace. This confirms Units 4 and 5 surfaces remained available after the Unit 6 release.

No fabricated hourly or contractor employee was created. CLOCK and TIMESHEET tracking modes, raw-event lineage, corrections, attendance locking, overtime-candidate classification, concurrency, and authorization were proven by the complete automated and staging suites. Production validation used the legitimate existing exception-based employee fixture, so it did not manufacture clock punches, timesheets, wage calculations, GPS, kiosk, or biometric evidence.

## Worker, integrity, and load evidence

The authenticated effective-dated time worker was invoked twice through the production-equivalent path. Both calls returned safely and idempotently with no eligible work, and the database recorded no duplicate application.

Final production integrity result after the governed policy assignment:

```json
{
  "policies": 1,
  "assignments": 1,
  "events": 0,
  "authoritative": 0,
  "worker_succeeded": 37,
  "worker_failed": 0,
  "orphan_assignments": 0,
  "duplicate_events": 0,
  "duplicate_authoritative": 0,
  "orphan_events": 0,
  "time_audits": 2,
  "outbox_backlog": 0
}
```

Safe production load smoke: 100 requests at concurrency 5, zero failures, p95 255.0 ms. Current runtime health is normal on the existing 512 MB service. Historical out-of-memory events were associated with heavy release-shell activity and remain a monitoring item; no production capacity upgrade was required by the live smoke result.

## Security and scope confirmation

- Employee, manager, HR, and auditor boundaries passed in staging and regression coverage.
- Production internal worker authentication rejects unauthenticated calls.
- Tenant-scoped policy assignment and correlated immutable audit evidence passed.
- GPS collection is not implemented.
- Biometric collection is not implemented.
- Kiosk mode is not implemented.
- Overtime remains an `OVERTIME_CANDIDATE`; Unit 6 performs no automatic wage calculation.
- Category stacking defaults to disabled.
- Existing secure-document, GuardDuty, EventBridge, SQS DLQ, and authorization controls were not weakened.

## Rollback and monitoring

Rollback was not invoked. Readiness remained healthy, the migration completed, authorization stayed closed, workers remained safe, and integrity checks found no duplicate or orphan records. Additive migrations must remain in place if an application rollback is later required.

Continue monitoring error rate, database errors, latency, worker failures, outbox backlog, authorization failures, scanner/EventBridge failures, archive status, and memory pressure. The accepted email-deliverability exception remains separately tracked with GoDaddy; it must be retested with one controlled message after a narrow vendor-supported remediation.

## Freeze

Unit 6 feature behavior is frozen at the production application SHA above. Further feature development must occur on `dev`; production changes require a new controlled release. The Unit 6 feature branch may be removed only after its validated history is confirmed reachable from `dev` and `main` and preserved by the immutable staging and production tags.
