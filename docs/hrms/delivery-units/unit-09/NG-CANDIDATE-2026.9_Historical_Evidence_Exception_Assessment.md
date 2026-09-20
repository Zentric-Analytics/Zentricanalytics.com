# NG-CANDIDATE-2026.9 Historical Evidence Exception Assessment

**Assessment date:** 20 September 2026  
**Scope:** Two unresolved historical-evidence checksum mismatches only.  
**Status:** Owner decision required. No exception has been accepted, waived, repaired, replaced, regenerated, or re-hashed.

## Executive conclusion

Both mismatches are historical-evidence integrity failures. They do **not** alter the current payroll calculation code, PAYE rules, expected-value fixtures, runtime configuration, database schema, security controls, maker-checker controls, certification guard, staging, or production.

The original matching bytes for neither record are currently available. The correct recommendation is **INSUFFICIENT INFORMATION**: preserve the recorded checksums and keep the release blocked pending either recovery of the original bytes or an independent evidence-review decision. Do not accept an exception merely to make the test suite pass.

## Repository state at assessment

- Branch: `feature/hrms-unit-09-ng-candidate-2026-10-owner-remediation`
- HEAD: `7c11a11613b9eda55f36396ca929498b2e60d059`
- Existing exception record: `docs/hrms/delivery-units/unit-09/ng-candidate-2026-10-historical-evidence-exception.md`
- Working tree at assessment: clean.
- No production, staging, database, payroll, or certification action was performed during this assessment.

## Mismatch A — 2026.2 PostgreSQL evidence

| Item | Finding |
| --- | --- |
| Exact repository path | `docs/hrms/delivery-units/unit-09/ng-candidate-2026-2-postgresql-evidence.md` |
| Candidate affected | `NG-CANDIDATE-2026.2` |
| Sealed record | `docs/hrms/delivery-units/unit-09/ng-candidate-2026-2-stage1-manifest.json`, `artifacts.postgresqlEvidenceSha256`; also line 5 of `ng-candidate-2026-2-stage1-package.sha256` |
| Expected SHA-256 | `bd1906347d019c23d1ccf1f01d4072bff457badca80efb5c7beeacedc59aca68` |
| Currently available file SHA-256 | `f6bb9e1dfd23245e2640ad9a45b61ef583411e0ce6db78f6b3c12f4761596504` (current working-tree bytes) |
| Current file size | 6,316 bytes |
| Current Git blob | `15e6cf14c953b6bbb5ded950f33fba9898cf5034`, 6,233 bytes |
| Earliest commit referencing expected checksum | `21d70f577d286a7d2745a249e13bc66a7eb4209f` — 15 August 2026, “record Nigeria 2026.2 PostgreSQL proof” |
| Original matching file ever committed? | No. Three reachable historical versions were examined; none has the sealed SHA-256. |
| Reachable / unreachable Git object result | Not found in the path history. The 149 unreachable blobs were examined for the expected content hash; no match was found. |
| Immutable-package result | Not present in any locally available Zentric or NG-CANDIDATE ZIP inspected. |
| Byte-for-byte reconstruction possible now? | No. Doing so would require an external original source; creating bytes to match the hash is neither feasible nor an acceptable evidence process. |

### Complete known file history

| Commit | Date | Change | Git blob | Blob size |
| --- | --- | --- | --- | --- |
| `21d70f577d286a7d2745a249e13bc66a7eb4209f` | 15 Aug 2026 | Initial PostgreSQL proof record | `53ec65f1f883d44beeadfe072f4c3242106d3d96` | 2,312 |
| `5201ca087c1e6eda7790698b45a2c019a8fd5d9e` | 15 Aug 2026 | Evidence matrix record | `53aa3c1a33108cacb610def62692196a2d42e6b8` | 4,873 |
| `a793a25416f98ca41c47c3e71fd25ecc4423f849` | 15 Aug 2026 | Finalized Nigeria staging evidence | `15e6cf14c953b6bbb5ded950f33fba9898cf5034` | 6,233 |

All three commits are reachable from `dev`, `origin/dev`, and the current review branch. No tag specifically identifies this candidate.

### Existing correction record

`docs/hrms/delivery-units/unit-09/ng-candidate-2026-2-integrity-correction.md` already records that the sealed claim remains unchanged, the retained Git bytes do not match it, line-ending normalization does not restore it, and a reviewer must decide whether retained evidence is acceptable. That document does not repair or waive the discrepancy.

## Mismatch B — 2026.3 remediation matrix

| Item | Finding |
| --- | --- |
| Exact repository path | `docs/hrms/delivery-units/unit-09/ng-candidate-2026-3-remediation-matrix.md` |
| Candidate affected | `NG-CANDIDATE-2026.3` |
| Sealed record | `docs/hrms/delivery-units/unit-09/ng-candidate-2026-3-stage1-manifest.json`, `artifacts.remediationMatrixSha256`; also line 3 of `ng-candidate-2026-3-stage1-package.sha256` |
| Expected SHA-256 | `517b048c6689d1a872fdbd2d6b87401c033c83101cfe598a2fd569d1352cd7a9` |
| Currently available file SHA-256 | `d7bf9466ed568b350d9d3e11d41f7b393a312e04f522b553123cc121852f3dec` (current working-tree bytes) |
| Current file size | 2,003 bytes |
| Current Git blob | `7853154d2614296f4923af5945a5ebfcdc6f15ac`, 2,003 bytes |
| Earliest commit referencing expected checksum | `f13696df41a20f07a165215c0b1a57e376b4b16b` — 15 August 2026, “create Nigeria payroll candidate 2026.3” |
| Original matching file ever committed? | No. The sole reachable file version has a different digest. |
| Reachable / unreachable Git object result | Not found in the path history. The 149 unreachable blobs were examined for the expected content hash; no match was found. |
| Immutable-package result | Not present in any locally available Zentric or NG-CANDIDATE ZIP inspected. |
| Byte-for-byte reconstruction possible now? | No. The required original bytes are unavailable; a reconstructed substitute would not be historical evidence. |

### Complete known file history

| Commit | Date | Change | Git blob | Blob size |
| --- | --- | --- | --- | --- |
| `f13696df41a20f07a165215c0b1a57e376b4b16b` | 15 Aug 2026 | Created Nigeria payroll candidate 2026.3 | `7853154d2614296f4923af5945a5ebfcdc6f15ac` | 2,003 |

This commit is reachable from `dev`, `origin/dev`, and the current review branch. No tag specifically identifies this candidate.

`docs/hrms/delivery-units/unit-09/ng-candidate-2026-3-limited-launch-preservation.md` repeats the expected digest as a preservation claim. It does not supply the missing matching bytes.

## Locations searched

The following locations were examined for both exact filenames and, where content was available, the expected SHA-256 values:

1. Reachable Git history for each exact repository path, including every commit listed above.
2. The current `dev`, `origin/dev`, and the current Unit Nine review branch; no candidate-specific tag exists.
3. All 149 unreachable Git blobs returned by `git fsck --no-reflogs --unreachable --full`.
4. The locally available archives:
   - `Zentric_Analytics_All_Documents.zip`
   - `zentric_analytics_strengthened_employment_packet.zip`
   - both `Zentric_NG-CANDIDATE-2026.5_Complete_Evidence_Review_Package` archives
   - `Zentric_NG-CANDIDATE-2026.6_Immutable_Review_Package.zip`
   - `Zentric_NG-CANDIDATE-2026.7_Immutable_Review_Package.zip`
   - `Zentric_NG-CANDIDATE-2026.8_Independent_Compliance_Review_Handoff.zip`
   - both locally available `Zentric_NG-CANDIDATE-2026.9_Immutable_Review_Package` archives
5. The sealed manifests and package checksum lists for candidates 2026.2 and 2026.3.
6. The existing 2026.2 integrity-correction record, 2026.3 limited-launch preservation record, and related staging-reference documents.

Neither original matching artifact was found in any searched location.

## Functional impact

| Area | 2026.2 PostgreSQL evidence | 2026.3 remediation matrix |
| --- | --- | --- |
| Payroll calculations | No direct effect | No direct effect |
| PAYE bands or expected values | No | No |
| Minimum-wage treatment | No | No |
| Pension calculations | No | No |
| Runtime configuration | No | No |
| Database schema or migrations | No | No |
| Security and tenant isolation | No | No |
| Maker-checker controls | No | No |
| Certification conclusions | Yes — it prevents a clean historical-evidence integrity conclusion | Yes — it prevents a clean historical-evidence integrity conclusion |

## Test impact

| Test | Why it fails | What it validates |
| --- | --- | --- |
| `tests/hrms-unit9-ng-2026-2-stage1-package.test.ts` | Expected SHA-256 for the 2026.2 PostgreSQL evidence does not equal the retained file bytes. | Historical package integrity only. It does not execute payroll calculations. |
| `tests/hrms-unit9-ng-2026-3-stage1-package.test.ts` | Expected SHA-256 for the 2026.3 remediation matrix does not equal the retained file bytes. | Historical package integrity only. It does not execute payroll calculations. |

Latest complete suite: **1,762 passing tests, 2 failing integrity tests**. The failures are exactly the two tests above. The focused Unit Nine owner-remediation tests previously passed (40 tests), and the recoverable 2026.4–2026.8 preservation/package checks passed (25 tests). No staging test was run for this assessment.

## Recovery-work record

### Commits created during this work

| Commit | Purpose |
| --- | --- |
| `3237690ddc33daa5de0cb55fe2bb754584590095` | Adds the owner-accepted 2026.10 engineering rules and tests; remains `NOT_CERTIFIED`. |
| `7c11a11613b9eda55f36396ca929498b2e60d059` | Adds the existing historical-evidence exception hold. |

### Files changed by committed recovery work

`3237690ddc33daa5de0cb55fe2bb754584590095`:

- `src/lib/hr/payroll/nigeria-2026-10.ts`
- `tests/hrms-unit9-ng-2026-10-owner-remediation.test.ts`
- `tests/fixtures/ng-candidate-2026-10-owner-remediation-families.json`
- `docs/hrms/delivery-units/unit-09/ng-candidate-2026-10-owner-remediation.md`

`7c11a11613b9eda55f36396ca929498b2e60d059`:

- `docs/hrms/delivery-units/unit-09/ng-candidate-2026-10-historical-evidence-exception.md`

Authenticated copies of historical files were compared and restored in the clean worktree only where they matched existing tracked content; they produced no additional committed diff. No historical expected checksum was changed.

## Confirmations

- No historical expected checksum was changed.
- No payroll calculation or fixture expectation was changed by the evidence-recovery work.
- No certification control was weakened.
- No production environment, staging environment, database, migration, merge, or deployment was changed.
- No test or checksum assertion was weakened.
- No exception has been accepted.

## Decision analysis

### Risk of accepting an exception

Accepting an exception would leave two sealed historical attestations unverified. It could allow later reviewers to rely on a package whose claimed evidence bytes cannot be independently reproduced. It must therefore be limited to historical-evidence disposition, explicitly preserve `NOT_CERTIFIED`, and never be interpreted as validation of payroll outputs or authorization for production.

### Risk of refusing an exception

Refusing an exception preserves the strongest evidence standard but blocks clean validation, staging advancement, certification, and any production decision until the original bytes are recovered. It does not create a known payroll-calculation defect; it delays release because evidence provenance remains incomplete.

### Recommendation

**INSUFFICIENT INFORMATION.** Recover the original evidence if an authoritative external copy exists. If it cannot be recovered, require an independent qualified evidence reviewer to decide whether to accept a narrowly scoped historical-evidence exception. Do not merge, deploy, certify, or treat the candidate as production-ready before that decision.

## Proposed wording if an exception is accepted

> The owner accepts a narrowly scoped historical-evidence exception for the two named legacy artifacts only. Their recorded original checksums remain unchanged and unverified. This decision does not certify payroll calculations, does not authorize finalization, payment, remittance, filing, staging release, or production deployment, and requires any subsequent certification decision to consider the missing original evidence explicitly.
