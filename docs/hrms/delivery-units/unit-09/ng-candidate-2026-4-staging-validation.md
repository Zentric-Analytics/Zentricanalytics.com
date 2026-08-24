# NG-CANDIDATE-2026.4 staging validation

Status: **READY FOR STAGE 1 CLOSURE REVIEW — NOT CERTIFIED**

Production was not accessed or modified. No official payroll finalization, payslip publication, payment, settlement, filing or remittance occurred.

## Candidate identity

- Starting `dev`: `b17bd2270e301d6a0f764fff19c677587053af32`.
- Functional feature commit: `29c21bf258abea61b76a949abb12b0238f0e08a2`.
- PostgreSQL evidence alignment: `0262734618b78042ce2dfd588e0e47d83d81e69c`.
- Repeatable concurrency correction: `79bea04233e52978bf51348786030debf463aec2`.
- History-preserving merge commits: `6742d31feb93874cf13f16d9d9d559ee065a7cab`, `9c7c4c5b6d3b30e43352073e05572b9fdce5e4e6`, and `5a4e9bdec15a68036b4ec130977a9a45a54ad7b6`.
- Final validated implementation `dev`: `5a4e9bdec15a68036b4ec130977a9a45a54ad7b6`.
- Exact implementation staging deployment: `dep-da6996ijnfac73a7r360`.
- Earlier candidate deployments: `dep-da693lajnfac73a7a8g0` and `dep-da696k3m8hqs73emequg`.
- Database: `zentric_analytics_staging`; 60 migrations applied, none pending or failed.

## Fresh validation

- Focused candidate/engine/limited-launch/package gate: 46/46; final candidate/package rerun: 22/22.
- Full repository gate on the final implementation SHA: 981/981 across 83 files.
- TypeScript: PASS.
- ESLint: PASS with zero warnings.
- Prisma validation: PASS.
- Production build: PASS; 125 routes generated.
- Health/live: PASS (`status=ok`). Readiness: PASS (`status=ready`, database `ok`).
- Candidate fail-closed probe: PASS; official finalization threw `NG-CANDIDATE-2026.4_NOT_CERTIFIED`.
- Deterministic replay, expected-value fixtures and package hash contracts: PASS in the focused and full suites.

## Real PostgreSQL evidence

- Candidate limited-launch correlation `limited-launch-1787598272526`: one exception winner, one resolution winner and one partition winner.
- Full payroll correlation `unit9-concurrency-1787598301207`: exactly one run, selected result, decision and prior-YTD winner; one winner for each YTD category; one retro trigger; conflicting acknowledgement rejected; append-only amendment v2; one approval.
- Integrity: PASS with 60 migrations, zero failed migrations, zero relevant orphans or duplicates, zero maker/checker violations, zero uncertified finalizations, zero broken gross-to-net results, zero employer contributions deducted from employee net, zero unbalanced journals and zero invalid payslip/payment relationships.

## Signed-in privacy and authorization

- A generic tenant `ADMIN` accessed its authorized Users workspace.
- Direct access to the payroll compliance queue returned the accessible 403 page and explicitly disclosed no data; an administrator role does not imply payroll authority.
- Direct access to the employee payroll workspace returned the same privacy-safe 403 and no payroll payload.
- A direct payroll-evidence identifier request returned only `{"error":"Forbidden"}`.
- Tenant filtering, unknown/foreign record handling and fine-grained permission contracts remain covered by the full automated suite. No second-tenant live record was fabricated.

## Preservation proof

- NG-CANDIDATE-2026.2 code: `2bb4273852b4c5cb5685b57fb3852e95886ee3e91b6a18ba523afa8c3b8b8da5`.
- NG-CANDIDATE-2026.2 fixture: `bc7113ecd2057f70a1215f7b9c61af018c70dfbb155cfb6177d50916dc20af30`.
- NG-CANDIDATE-2026.3 code: `d2f82e2983dab31dc721d21a96baebc9669804fe5ad200259d24f4707f2ee46b`.
- NG-CANDIDATE-2026.3 fixture: `9cbca5487abffdff8ccb9a624f8f6c9e30c579629c258e0a928517ab40a86b0e`.
- NG-CANDIDATE-2026.3 package: `a1e79fa109a74ed689e3bc64ceac34232b7e44aea7ad01a5a3d111aefd27cdae`.
- NG-CANDIDATE-2026.3 manifest: `5d10d678e6e2a7ec2b397d26f1fc794d9679609e446ec4341fc34d3551b407dd`.
- Shared engine normalized-LF hash: `aac43d4081025fdd45e3ad9a4da8af27270f34b6239805510904e08ae19db7ff`.
- Candidate adapter hash: `4f896c52bd32df6149782c00e7e33dee11cbfc1058b5104985edae4f19ab19e7`.

## Remaining external evidence gaps

- Deterministic treatment for materially variable monthly wages around the minimum-wage threshold.
- Ambiguous multi-employer exemption classification.
- Unusual partial-year arrangements not covered by the supported standard case.
- Approved RTA refund/offset execution procedure for negative PAYE credits.
- Canonical 2024 Gazette identifier, final commencement wording and retrospective private-sector treatment.

These gaps remain explicit compliance holds. The candidate remains `NOT CERTIFIED` and cannot cross the authoritative finalization boundary.
