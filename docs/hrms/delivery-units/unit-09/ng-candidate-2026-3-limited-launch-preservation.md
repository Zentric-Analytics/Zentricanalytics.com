# NG-CANDIDATE-2026.3 preservation proof

Baseline: `dev` at `12accff73a780a98b809a4c0e1b3fdd4243f39ca`.

The limited-launch controls add an operational layer only. `git diff` against all frozen candidate artifacts is empty. SHA-256 values after implementation:

| Artifact | SHA-256 |
|---|---|
| `src/lib/hr/payroll/nigeria-2026-3.ts` | `d2f82e2983dab31dc721d21a96baebc9669804fe5ad200259d24f4707f2ee46b` |
| expected-value fixture | `9cbca5487abffdff8ccb9a624f8f6c9e30c579629c258e0a928517ab40a86b0e` |
| Stage 1 package | `a1e79fa109a74ed689e3bc64ceac34232b7e44aea7ad01a5a3d111aefd27cdae` |
| Stage 1 manifest | `5d10d678e6e2a7ec2b397d26f1fc794d9679609e446ec4341fc34d3551b407dd` |
| source register | `74626d3ef8dad0916a1857e7eb56e7cc108bb44c5392660c9584905ee6fbf55f` |
| remediation matrix | `517b048c6689d1a872fdbd2d6b87401c033c83101cfe598a2fd569d1352cd7a9` |

No expected amount was regenerated. The review-only bonus interpretation, candidate identity, evidence, source record, remediation record, and fail-closed semantics remain unchanged. `NG-CANDIDATE-2026.3` remains `NOT_CERTIFIED`.
