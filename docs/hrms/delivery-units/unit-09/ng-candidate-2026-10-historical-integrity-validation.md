# Unit 9 historical-integrity local validation

Date: 20 September 2026. Scope: owner-authorized historical-integrity correction and exact sealed source-register recovery only.

## Status

- HISTORICAL EVIDENCE DISCREPANCIES CLOSED BY VERSIONED CORRECTION
- SOURCE-REGISTER SEALED REPRESENTATION EXACTLY RECOVERED
- LOCAL ENGINEERING VALIDATION COMPLETE on the implementation tree identified below
- UNIT 9 NOT CERTIFIED

This is not payroll certification, Stage 2 authorization, a staging release, or production approval.

## Commit and tree identity

| Record | Identity |
| --- | --- |
| Branch | feature/hrms-unit-09-ng-candidate-2026-10-owner-remediation |
| Baseline / implementation parent | 7c11a11613b9eda55f36396ca929498b2e60d059 |
| Implementation commit | c5ea3d2a25f5b9a30511a95bb110052bf45cf7ac |
| Implementation tree | 53dd33f7458ef0c0ea7277efe2f9eb157970a1e9 |
| Implementation subject | fix(hrms): close Unit 9 historical integrity discrepancies |
| Evidence-only commit | The separate commit introducing this report, with the implementation commit as parent |

All complete-suite, type, lint, schema and build results below apply to the implementation commit with a clean tracked worktree. This report is added afterward in a separate evidence-only commit. The final evidence commit/tree and post-commit integrity rerun are recorded in the accompanying delivery receipt, not self-embedded here: embedding this file's containing tree hash would change that hash. Resolve the exact evidence identity using `git log -1 --format="%H %T %P" -- docs/hrms/delivery-units/unit-09/ng-candidate-2026-10-historical-integrity-validation.md`. The earlier full-suite run is not represented as a run on the later evidence tree.

## Two superseded claims — scope unchanged

Paths in this table are beneath `docs/hrms/delivery-units/unit-09/`.

| Artifact | Original claimed SHA-256, preserved | Authoritative retained raw Git SHA-256 |
| --- | --- | --- |
| ng-candidate-2026-2-postgresql-evidence.md | bd1906347d019c23d1ccf1f01d4072bff457badca80efb5c7beeacedc59aca68 | 0c220b75ec03045644ffa8d8dcb29610a26e209314ab53e1d4823863a4dac7e2 |
| ng-candidate-2026-3-remediation-matrix.md | 517b048c6689d1a872fdbd2d6b87401c033c83101cfe598a2fd569d1352cd7a9 | d7bf9466ed568b350d9d3e11d41f7b393a312e04f522b553123cc121852f3dec |

2026.2 retained commit: `a793a25416f98ca41c47c3e71fd25ecc4423f849`; blob: `15e6cf14c953b6bbb5ded950f33fba9898cf5034`; size: 6,233 bytes.

2026.3 retained commit: `f13696df41a20f07a165215c0b1a57e376b4b16b`; blob: `7853154d2614296f4923af5945a5ebfcdc6f15ac`; size: 2,003 bytes.

Neither missing original artifact is claimed recovered. Both original claims remain in their original records; only these two claims are superseded by the owner-authorized, versioned correction chain. The correction register still has exactly two rows.

## Source register — recovered, NOT superseded

| Field | Verified value |
| --- | --- |
| Repository path | docs/hrms/delivery-units/unit-09/ng-candidate-2026-2-source-register.md |
| Authoritative commit | 85f099be7b309adda88d84e73a2c4ce00586f6d1 |
| authoritativeGitBlobId | 32dd4ca7ce494299887db159b35946205b1607da |
| authoritativeGitBlobSha256 | 2c4220c6f25f03eb3a74e99b9cb4e9ac84c743a7290f49cdc2712e55c16add5b |
| authoritativeGitBlobSize | 4016 |
| recoveredSealedSha256 / unchanged original claim | cb9f11bafa82627f389e62e97de6160143f56db94b8e3598d7ede94d91f32015 |
| recoveredSealedSize | 4039 |
| lineEndingTransformation | LF_TO_CRLF |
| transformedLineEndingCount | 23 |
| recoveryStatus | EXACT_SEALED_REPRESENTATION_RECOVERED |
| Recovery ZIP payload | recovered-sealed/ng-candidate-2026-2-source-register.md |

The tracked source register equals the authoritative raw LF Git blob. Recovery inserts exactly one CR before each of its 23 LF bytes. The output contains exactly 23 CRLF sequences and zero bare LF bytes. Reversing CRLF to LF returns the original bytes exactly. No text, Unicode, other whitespace, or trailing-line change is performed. The stored ZIP payload equals this reconstruction exactly. Tests reject textual mutation, added lines, and changed line counts.

## Package identities and approved pre-commit document updates

All deliverables are in `docs/hrms/delivery-units/unit-09/historical-integrity-corrections/`.

| ZIP | Final SHA-256 |
| --- | --- |
| Zentric_NG-CANDIDATE-2026.2_Historical_Integrity_Correction.zip | 71c3bed4ea1ed0111b8973fee6580321a485f2dbfbd22ffd1e7247a40cec6e9b |
| Zentric_NG-CANDIDATE-2026.3_Historical_Integrity_Correction.zip | e5d061455df092a803668d7f116d1c3e6b30d68af287b98be222de14202384d5 |

The previously approved ZIP hashes were respectively `72b7a2d406d469f0250139a591d74cf8adeacc35956ea472bb26a8d0b8a7ff30` and `9de0fed80936b9e6bd63409378cbe1a44e61b1429b5c6a896b016aac23f3c385`. The authorized pre-commit assessment relocation changes its archive path, and the owner document now states the exact requested decision. These two shared-document changes require deterministic regeneration of both packages. The assessment's content hash remains `6ae60001ec82c152d1dfffdee4ddaf77a03bf8b4ae22f84ba9093c55af833ccb`. Retained evidence, recovered source-register bytes, original records, and supersession scope did not change.

Both ZIPs are committed, with explicit ignore-rule exceptions and binary attributes. JSON and checksum deliverables are also committed. New correction documents have LF checkout attributes to preserve deterministic payload bytes on Windows.

Independent verification used Python's zipfile CRC validation and SHA-256 hashing. Two separate builder executions into temporary directories produced byte-identical ZIPs matching the committed deliverables. All 8 payloads in 2026.2 and all 7 payloads in 2026.3 match their manifest digests. Every archive entry passed ZIP CRC checks. Temporary reconstruction directories were cleaned up.

## Original-record preservation proof

The following originals are byte-identical between baseline Git blobs, current Git blobs and the corresponding packaged originals:

| Original record beneath Unit 9 | SHA-256 |
| --- | --- |
| ng-candidate-2026-2-stage1-manifest.json | e1306597e807f977e158a6279d493e43ebe0e87b7069223eea28ae8bd6e93e3a |
| ng-candidate-2026-2-stage1-package.sha256 | cb914f5e01cfe52bc43f4aa78cd7b774577b3d15cddb045896c54fdc16e47c60 |
| ng-candidate-2026-3-stage1-manifest.json | 5d10d678e6e2a7ec2b397d26f1fc794d9679609e446ec4341fc34d3551b407dd |
| ng-candidate-2026-3-stage1-package.sha256 | a996bffc112d7ad763644cf48d13951b0da6fdf3a86f8562d278b6bee3fff5fc |

The baseline-to-implementation diff contains no historical manifest, original checksum list, source-register source file, application source, Prisma schema/migration, or fixture changes. Existing commits were not amended, rebased, squashed, or rewritten.

## Local validation results

Runtime: Node 24.18.0; npm 11.16.0; Git 2.55.0.windows.1; Windows PowerShell.

| Gate | Command / method | Result |
| --- | --- | --- |
| Source-register, 2026.2 and 2026.3 package, correction integrity | Vitest four named integrity test files | 4 files, 11 tests PASS before commit |
| Same gates plus owner remediation | Vitest same four files plus hrms-unit9-ng-2026-10-owner-remediation.test.ts | 5 files, 24 tests PASS on implementation commit |
| Unit 9 preservation | Vitest 2026.6, 2026.7 and 2026.8 preservation files | 3 files, 19 tests PASS |
| All Unit 9 | node node_modules/vitest/vitest.mjs run hrms-unit9 | 32 files, 389 tests PASS |
| Complete repository suite | node node_modules/vitest/vitest.mjs run | 161 files, 1769 tests PASS, zero failures |
| TypeScript | node node_modules/typescript/bin/tsc --noEmit | PASS, exit 0 |
| ESLint | node node_modules/eslint/bin/eslint.js . --max-warnings=0 | PASS, exit 0, zero warnings |
| Prisma schema | node node_modules/prisma/build/index.js validate | PASS, exit 0 |
| Production build, local only | npm run build | PASS, exit 0; compile, types, page data, 130 static pages and build traces complete |
| Independent deterministic reconstruction | Two separate builder processes, compare bytes to committed ZIPs | PASS, both packages |
| ZIP integrity | Python zipfile.testzip | PASS, both packages |
| Payload-to-manifest hashes | SHA-256 of every declared payload | PASS, 15 payloads |
| Recovery reversibility | Exact LF/CRLF byte comparisons | PASS |
| Sensitive-data scan | Commit blobs and expanded ZIP members | PASS, no pattern matches |
| Tracked worktree after validation | git status --porcelain=v1 | Clean |

The first Prisma validation attempt lacked DATABASE_URL and failed configuration validation. It was rerun with a process-local loopback placeholder pointing to port 1 and no credentials. Schema validation and the build then succeeded. No database connection or migration was run. The build regenerated only ignored local build/dependency outputs; the existing node_modules junction points at the shared local dependency directory.

Vitest emitted an existing forward-looking Vite config-loader warning. This did not fail tests and is separate from the zero-warning ESLint result. The staged whitespace check noted only five intentional Markdown hard-break lines in the assessment and signature block.

## Sensitive-data review

The pre-commit scan covered all 22 proposed files, including uncompressed archive bytes. A post-commit scan read Git blobs and explicitly expanded every ZIP member: 41 file/member inputs. Checks covered private keys, common cloud/GitHub/payment/Slack token formats, JWTs, credential-bearing database URLs, secret/session assignments, SSN patterns and structured banking/employee identifiers. No matches were found. Content review found authorized owner-signature metadata and historical engineering descriptions, not employee records, banking records, credentials, session tokens, or production datasets.

This is a scoped pattern and content review, not a guarantee against every possible secret encoding. Historical staging identifiers in the approved PostgreSQL engineering report are descriptive metadata, not credentials or live access.

## Complete implementation commit inventory

The implementation commit contains exactly these 22 files (665 insertions, 9 deletions, plus binary ZIPs):

1. .gitattributes
2. .gitignore
3. docs/hrms/delivery-units/unit-09/NG-CANDIDATE-2026.9_Historical_Evidence_Exception_Assessment.md
4. docs/hrms/delivery-units/unit-09/historical-integrity-corrections/Zentric_NG-CANDIDATE-2026.2_Historical_Integrity_Correction.zip
5. docs/hrms/delivery-units/unit-09/historical-integrity-corrections/Zentric_NG-CANDIDATE-2026.2_Historical_Integrity_Correction.zip.sha256
6. docs/hrms/delivery-units/unit-09/historical-integrity-corrections/Zentric_NG-CANDIDATE-2026.3_Historical_Integrity_Correction.zip
7. docs/hrms/delivery-units/unit-09/historical-integrity-corrections/Zentric_NG-CANDIDATE-2026.3_Historical_Integrity_Correction.zip.sha256
8. docs/hrms/delivery-units/unit-09/historical-integrity-corrections/correction-manifest-2026.2.json
9. docs/hrms/delivery-units/unit-09/historical-integrity-corrections/correction-manifest-2026.3.json
10. docs/hrms/delivery-units/unit-09/historical-integrity-corrections/correction-package-2026.2.sha256
11. docs/hrms/delivery-units/unit-09/historical-integrity-corrections/correction-package-2026.3.sha256
12. docs/hrms/delivery-units/unit-09/ng-candidate-2026-10-historical-integrity-correction-register.md
13. docs/hrms/delivery-units/unit-09/ng-candidate-2026-10-owner-historical-integrity-correction.md
14. docs/hrms/delivery-units/unit-09/ng-candidate-2026-2-historical-integrity-supersession.md
15. docs/hrms/delivery-units/unit-09/ng-candidate-2026-3-historical-integrity-supersession.md
16. scripts/hr-unit9-historical-integrity-correction-package.mjs
17. scripts/hr-unit9-source-register-recovery.d.mts
18. scripts/hr-unit9-source-register-recovery.mjs
19. tests/hrms-unit9-historical-integrity-correction.test.ts
20. tests/hrms-unit9-ng-2026-2-stage1-package.test.ts
21. tests/hrms-unit9-ng-2026-3-stage1-package.test.ts
22. tests/hrms-unit9-source-register-recovery.test.ts

The separate evidence-only commit adds only this validation report.

## Owner record and boundaries

Owner: Olayinka Ogunlade

Title: Founder/Owner, Zentric Analytics Ltd

Signature: Olayinka Ogunlade

Date: 20 September 2026

Decision: HISTORICAL CHECKSUM CLAIMS SUPERSEDED BY FORMAL VERSIONED CORRECTION

The owner record transcribes the owner's supplied authorization; it is not an independently generated digital signature.

No unrelated files were included. No payroll calculations, expected-value fixtures, certification controls or application behavior were changed by this correction commit. Unit 9 remains NOT_CERTIFIED and official payroll outputs remain blocked. Staging and production were not accessed or changed. No merge, deployment, Stage 2 work, or Unit 10 work was performed.

## Remote comparison

Read-only ls-remote returned feature-branch HEAD `7c11a11613b9eda55f36396ca929498b2e60d059` and dev HEAD `058d558a602d99dd52398d1c48b124a6eec84e4b`. The implementation is 1 ahead / 0 behind the feature branch and 3 ahead / 0 behind dev. The evidence commit adds one local commit. Nothing was pushed or merged. Final exact commit/tree IDs and final integrity-test results are provided in the delivery receipt.
