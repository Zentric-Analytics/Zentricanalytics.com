# Unit 5 controlled production release

Verdict: **CONDITIONAL PASS — Unit 5 Production Ready and Operational with accepted email-deliverability risk**

## Release identity

- Validated Unit 5 tag: `hrms-unit-05-v1.0.0` at `37a135d2144ff0cab03368440b65e8733aee0164`.
- Reconciled development merge: `56cee8bb80cda6a662e60780d7c255d29827bd94`.
- Pre-release production main: `04568a3b2cbff2bb354643ea0bac926eaa5bc502`.
- Unit 5 production merge: `297e90ecadc64dd682deb1ef5b309c786014829a`.
- Initial Unit 5 deployment: `dep-d9thtb3m8hqs73d6jjq0`.

## Validation evidence

- 618/618 automated tests pass; TypeScript, ESLint with zero warnings, Prisma validation, and the production build pass.
- Guarded pre-deploy applied the four reviewed additive Unit 5 migrations. Production has 39 applied migrations and none pending.
- Live and ready endpoints, Careers, and the Unit 5 status route pass.
- Safe production readiness load: 50 requests, zero failures, p50 94.3 ms, p95 114.9 ms, maximum 352.5 ms.
- Production backup cron was corrected from `dev` to `main`. Pre-release encrypted archive correlation `740af0012e0f` completed with checksum, daily retention, remote upload, and object-lock validation.
- Staging restore correlation archive `c41f55510b8a` proved all 39 migrations and the linked Unit 4/5 lifecycle with zero relevant duplicates or orphans; the temporary target and plaintext artifacts were deleted.

## Operational boundary

- GoDaddy Advanced Email Security automatic Inbox placement remains unproven. SPF, DKIM, DMARC, sender registry, message generation, and Resend acceptance passed. The owner has accepted this temporary risk.
- This exception does not permit a broad allowlist or bypass of spoofing, phishing, malware, or attachment protections.
- No fabricated employee, recipient, or delivery evidence is claimed. Production validation uses read-only integrity checks and safe endpoint smoke tests unless explicitly identified otherwise.
- The Starter 512 MB application instance restarted after an out-of-memory event during unusually heavy interactive release-shell validation. The replacement instance recovered and remained healthy; memory and worker backlog require continued monitoring.

## Rollback

- Previous application SHA: `04568a3b2cbff2bb354643ea0bac926eaa5bc502`.
- Additive migrations remain applied during application rollback unless a separately approved data-recovery action is required.
- Roll back for persistent readiness failure, authorization leakage, duplicate lifecycle application, unsafe worker/email behavior, or document access before a clean exact-version scan result.
