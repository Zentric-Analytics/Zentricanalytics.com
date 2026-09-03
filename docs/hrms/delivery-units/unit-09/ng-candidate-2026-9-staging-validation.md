# NG-CANDIDATE-2026.9 staging validation

Candidate status: **NOT_CERTIFIED**

## Exact runtime

- Merge/runtime SHA: `8932d51a90769276d73a3b5415378fa834032240`
- Runtime tree: `7a3cfa71a9ae62ac2c4e7c55d061da8692c5a12f`
- Render deployment: `dep-dacrg8n40ujc739vjlu0`
- Render service: `srv-d8s6ovvavr4c73fctksg`
- Database identity: `zentric_analytics_staging`
- Migration state: 63 applied, 0 pending, 0 failed
- Health: HTTP 200, `{"status":"ok"}`, `Cache-Control: no-store`
- Readiness: HTTP 200, `{"status":"ready","database":"ok"}`, `Cache-Control: no-store`

Render checked out the full runtime SHA. The build passed, `hr:release` identified staging, found 63 migrations, applied none, skipped completed bootstrap without reading bootstrap secrets, reconciled no stale grants, and completed preflight ready.

## Database boundary evidence

The preserved production-equivalent PostgreSQL race harness was rerun from this exact 2026.9 tree. It used separate sessions and recorded 8/8 real overlaps, one duplicate-binding winner, zero mixed-version snapshots/results, stale binding rejection, immutable replay, all nine `PAYROLL_CANDIDATE_NOT_CERTIFIED` downstream rejections, and zero prohibited mutations.

## Signed-in boundary

The protected status URL correctly redirected an unauthenticated session to `/hr/login`. After the private owner sign-in, the exact candidate status rendered at the protected URL and reported runtime SHA `8932d51a90769276d73a3b5415378fa834032240`. A direct request by the signed-in general administrator to the Unit 9 payroll operations route produced the application access-denied state. The unchanged multi-role known-ID and tenant boundary remains covered by the fresh full suite and the preserved 2026.8 signed-in matrix.

Production was not accessed or modified.
