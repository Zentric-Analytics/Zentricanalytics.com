# Candidate portal reliability fixes

Baseline: `dev` at `2cc94886f4b398c05720c94c5c8d6479663bfe8e`.

## Behaviour

- Candidate authentication uses a 30-minute HttpOnly, SameSite=Lax cookie scoped to `/track`, with Secure enabled in production. Server actions and assessment submissions read that cookie, not a hidden field or query string. Sign out expires the stored session and clears the cookie.
- Previously bookmarked token URLs are stripped and are no longer accepted as authentication. Candidates without a current cookie must request a new passcode. Tokens are never rendered into portal markup, navigation or redirects. Tracking pages use no-index and no-referrer metadata.
- Passcodes are conditionally consumed only if unused and unexpired. Consumption and its audit event commit together; only the winning request receives a cookie.
- Stage submissions lock the application and stage, then recheck session expiry, deletion, terminal/forward progress, stage availability and prerequisite approval. The lock order matches HR stage decisions. Screening metadata and agreement state are checked again before persistence. Assessment submissions use the same lock order and retry serialization/deadlock aborts.
- Legacy offer decisions serialize with application decisions; stale accepts cannot regress onboarding, and declines conditionally claim an unexpired released offer. Governed-offer failures return safe candidate feedback.
- Versions use the highest existing version plus one. A unique `(stageId, version)` constraint prevents duplicate submission versions from any writer.
- Rate-limit counting and event creation hold one PostgreSQL transaction advisory lock per scope/key, preventing concurrent overshoot across instances.
- Submission failures and confirmations are displayed. Submit controls show pending states. Rejected stage links say “View decision.” Progress exposes its role and numeric values to assistive technology.
- The selected workspace precedes full progress navigation in mobile document order; desktop retains its two-column grid. A short mobile link provides access to stage navigation.
- Governed issued/declined offers show the offer-focused summary. Accepted offers retain access to agreement and onboarding stages; the explanatory copy now accurately describes this behaviour.
- The identity form, progress component, feedback, upload-aware form wrapper, submit control and status helpers are separate from the portal page. Rendered regression tests supplement existing source-contract tests.

## Upload policy

The existing 20 MiB per-file default remains. Candidate forms advertise and enforce a **24 MiB combined upload limit**, reserving 1 MiB below Next's 25 MiB request limit for multipart headers and other fields. Client validation prevents oversized requests without clearing the form; server actions independently enforce the combined limit. Single-file validation remains in the existing storage validator. Requests that bypass the browser and exceed Next's transport limit are still rejected by Next before action execution.

## Migration

Apply `20260921150000_candidate_submission_versions` through the normal release process. It is additive and never edits or renumbers historical submissions. If duplicate versions already exist, it stops with an explicit reconciliation message. Inspect duplicates before release:

```sql
SELECT "stageId", "version", count(*)
FROM "StageSubmission"
GROUP BY "stageId", "version"
HAVING count(*) > 1;
```

Reconcile any historical duplicates through the existing reviewed data process, preserving signatures, documents and audit references. No live database migration was performed as part of this change.

## Verification

- TypeScript, lint and the production Next.js build passed.
- Focused candidate/recruitment regression selection: **133 tests passed across 16 files**.
- Full suite: **1,934 passed; 23 failed**, across 168 files. All 23 failures are existing payroll evidence/preservation hash assertions, reproduced on an untouched checkout of the baseline. No new failing test names remain. The baseline additionally had one bcrypt timing timeout under concurrent load.
- New tests cover rendered portal states, token-free HTML, cookie options/logout, competing passcode verification, safe offer failure feedback, stage locking and changed-state rejection, version gaps, combined upload limits, advisory-lock ordering, and legacy offer non-regression.
- SQL was exercised in a temporary PGlite PostgreSQL runtime: migration refuses duplicate history without rewriting it, uniqueness is enforced, advisory-lock SQL executes, and conditional passcode consumption has one winner. This is not a multi-connection PostgreSQL load/concurrency certification.
- The environment browser rejected local navigation with `net::ERR_BLOCKED_BY_CLIENT`. Authenticated visual/responsive browser QA remains outstanding. Rendered tests do not certify pixel layout, focus behaviour or live form interactions.
- No live candidate records, outbound emails, deployments or payroll evidence files were changed.
